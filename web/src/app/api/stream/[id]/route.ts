import { proxyAudio, type Codec } from '@/server/stream';
import { idParam } from '@/server/http';
import { gate } from '@/server/auth';
export const dynamic = 'force-dynamic';
export const GET = async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const denied = await gate();
  if (denied) return denied;
  const id = await idParam(ctx);
  const codec: Codec = new URL(req.url).searchParams.get('codec') === 'aac' ? 'aac' : 'opus';
  try {
    return await proxyAudio(id, codec, req.headers.get('range'), req.signal);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[stream]', id, message);
    return new Response(message, { status: 502 });
  }
};
