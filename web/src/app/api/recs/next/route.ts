import { json } from '@/server/http';
import { nextUp } from '@/server/recs';

export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  return json((u) => nextUp(u.id, q.get('seed') ?? '', (q.get('recent') ?? '').split(',').filter(Boolean)));
}
