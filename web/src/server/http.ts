import 'server-only';
import { gate } from './auth';

export async function json<T>(fn: () => Promise<T>, maxAge = 0): Promise<Response> {
  const denied = await gate();
  if (denied) return denied;
  try {
    const data = await fn();
    return Response.json(data, {
      headers: { 'cache-control': maxAge ? `private, max-age=${maxAge}` : 'no-store' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[api]', message);
    return Response.json({ error: message }, { status: 502 });
  }
}

export const idParam = async (ctx: { params: Promise<{ id: string }> }) => decodeURIComponent((await ctx.params).id);
