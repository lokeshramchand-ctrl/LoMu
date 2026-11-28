import { json } from '@/server/http';
import { buildMixes } from '@/server/recs';

export const dynamic = 'force-dynamic';

export const GET = (req: Request) => {
  const tz = Number(new URL(req.url).searchParams.get('tz'));
  return json((u) => buildMixes(u.id, Number.isFinite(tz) && new URL(req.url).searchParams.has('tz') ? tz : undefined));
};
