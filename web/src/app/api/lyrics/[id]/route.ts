import { lyrics } from '@/server/catalog';
import { idParam, json } from '@/server/http';
export const dynamic = 'force-dynamic';
export const GET = async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const id = await idParam(ctx);
  const q = new URL(req.url).searchParams;
  return json(
    () =>
      lyrics({
        id,
        title: q.get('title') ?? '',
        artist: q.get('artist') ?? '',
        album: q.get('album') ?? undefined,
        duration: Number(q.get('duration')) || undefined,
      }),
    3600,
  );
};
