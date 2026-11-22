import { readJson, TooLarge } from '@/server/body';
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
    const { docs } = (await readJson(req, 40_000_000)) as { docs: Doc[] };
    if (!Array.isArray(docs)) throw new Error('docs must be an array');
    return Response.json(push(user.id, docs));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'bad request' }, { status: e instanceof TooLarge ? 413 : 400 });
  }
}
