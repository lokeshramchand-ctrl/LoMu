import { gate } from '@/server/auth';
import { currentSeq, onChange } from '@/server/sync';

export const dynamic = 'force-dynamic';

/** Server-sent events: a `seq` message whenever any device pushes, so the others pull at once. */
export async function GET(req: Request) {
  const denied = await gate();
  if (denied) return denied;
  const enc = new TextEncoder();
  let off = () => {};
  let ping: ReturnType<typeof setInterval>;
  const stream = new ReadableStream({
    start(c) {
      const send = (s: string) => {
        try {
          c.enqueue(enc.encode(s));
        } catch {
          /* closed */
        }
      };
      send(`event: seq\ndata: ${currentSeq()}\n\n`);
      off = onChange((seq) => send(`event: seq\ndata: ${seq}\n\n`));
      ping = setInterval(() => send(': ping\n\n'), 25_000);
      req.signal.addEventListener('abort', () => {
        off();
        clearInterval(ping);
        try {
          c.close();
        } catch {
          /* already closed */
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
