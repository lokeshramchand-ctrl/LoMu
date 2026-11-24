import { json } from '@/server/http';
import { all } from '@/server/sync';
import { buildWrapped, type WrappedPlay } from '@/lib/wrapped';

export const dynamic = 'force-dynamic';

/** `year` (or "all") and the viewer's `tz` (Date.getTimezoneOffset()). Runs over the whole play log, not just what the browser kept. */
export const GET = (req: Request) => {
  const q = new URL(req.url).searchParams;
  const y = q.get('year');
  const year = y && y !== 'all' && Number.isFinite(Number(y)) ? Number(y) : null;
  const tz = Number(q.get('tz') ?? 0) || 0;
  return json(async (u) => {
    const plays = all(u.id, 'play', 40000).map((r) => r.value as WrappedPlay);
    return { wrapped: buildWrapped(plays, year, tz) };
  });
};
