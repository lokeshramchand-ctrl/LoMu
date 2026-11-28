import { getUser, requireUser } from '@/server/auth';
import { currentSeq, onChange } from '@/server/sync';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const enc = new TextEncoder();
  let off = () => {};
  let ping: ReturnType<typeof setInterval>;
  const stream = new ReadableStream({
    start(c) {
      const send = (s: string) => {
        try {
          c.enqueue(enc.encode(s));
        } catch {
        }
      };
      send(`event: seq\ndata: ${currentSeq(user.id)}\n\n`);
      off = onChange(user.id, (seq) => send(`event: seq\ndata: ${seq}\n\n`));
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
        send(': ping\n\n');
      }, Number(process.env.LOMU_PING_MS) || 25_000);
      req.signal.addEventListener('abort', () => {
        off();
        clearInterval(ping);
        try {
          c.close();
        } catch {
        }
      });
    },
    cancel() {
      off();
      clearInterval(ping);
    },
  });
  return new Response(stream, {
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no' },
  });
}
