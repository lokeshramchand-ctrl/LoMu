import { getUser, requireUser } from '@/server/auth';
import { connect } from '@/server/connect';
import { hubConfigured, hubConnect } from '@/server/hub';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const q = new URL(req.url).searchParams;
  const id = (q.get('id') ?? '').slice(0, 64);
  if (!/^[\w-]{8,64}$/.test(id)) return Response.json({ error: 'bad device id' }, { status: 400 });
  const name = (q.get('name') ?? 'Device').slice(0, 60);
  const kind = q.get('kind') === 'android' ? 'android' : 'web';

  const viaHub = await hubConnect(`events?${q.toString()}`, { signal: req.signal, headers: { accept: 'text/event-stream' } }, true);
  if (viaHub?.ok && viaHub.body) {
    return new Response(viaHub.body, {
      headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no' },
    });
  }

  const enc = new TextEncoder();
  let off = () => {};
  let ping: ReturnType<typeof setInterval>;
  let retryHub: ReturnType<typeof setTimeout> | undefined;
  const stream = new ReadableStream({
    start(c) {
      const send = (event: string, data: unknown) => {
        try {
          c.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
        }
      };
      try {
        off = connect(user.id, id, name, kind, send);
      } catch (e) {
        send('error', { error: e instanceof Error ? e.message : 'refused' });
        c.close();
        return;
      }
      ping = setInterval(() => {
        if (user.username && !getUser(user.id)) {
          off();
          clearInterval(ping);
          try {
            c.close();
          } catch {
          }
          return;
        }
        try {
          c.enqueue(enc.encode(': ping\n\n'));
        } catch {
        }
      }, Number(process.env.LOMU_PING_MS) || 20_000);
      if (hubConfigured()) {
        retryHub = setTimeout(() => {
          off();
          clearInterval(ping);
          try {
            c.close();
          } catch {
          }
        }, 15_000);
      }
      req.signal.addEventListener('abort', () => {
        clearTimeout(retryHub);
        off();
        clearInterval(ping);
        try {
          c.close();
        } catch {
        }
      });
    },
    cancel() {
      clearTimeout(retryHub);
      off();
      clearInterval(ping);
    },
  });
  return new Response(stream, {
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no' },
  });
}
