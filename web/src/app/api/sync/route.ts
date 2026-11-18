import { gate } from '@/server/auth';
import { pull, push, currentSeq, type Doc } from '@/server/sync';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const denied = await gate();
  if (denied) return denied;
  const since = Number(new URL(req.url).searchParams.get('since') ?? 0) || 0;
  return Response.json(since < 0 ? { seq: currentSeq(), docs: [] } : pull(since));
}

export async function POST(req: Request) {
  const denied = await gate();
  if (denied) return denied;
  try {
    const { docs } = (await req.json()) as { docs: Doc[] };
    if (!Array.isArray(docs)) throw new Error('docs must be an array');
    return Response.json(push(docs));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'bad request' }, { status: 400 });
  }
}
