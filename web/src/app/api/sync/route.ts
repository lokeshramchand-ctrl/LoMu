import { requireUser } from '@/server/auth';
import { pull, push, currentSeq, type Doc } from '@/server/sync';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const since = Number(new URL(req.url).searchParams.get('since') ?? 0) || 0;
  return Response.json(since < 0 ? { seq: currentSeq(user.id), docs: [] } : pull(user.id, since));
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  try {
    if (Number(req.headers.get('content-length') ?? 0) > 40_000_000) return Response.json({ error: 'too large' }, { status: 413 });
    const { docs } = (await req.json()) as { docs: Doc[] };
    if (!Array.isArray(docs)) throw new Error('docs must be an array');
    return Response.json(push(user.id, docs));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'bad request' }, { status: 400 });
  }
}
