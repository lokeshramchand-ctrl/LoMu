import { readJson } from '@/server/body';
import { gate } from '@/server/auth';
import { connectHub, disconnectHub, hubStatus, setHubLan, startHub, syncNow } from '@/server/hub';

export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await gate();
  if (denied) return denied;
  startHub();
  return Response.json(hubStatus());
}

export async function POST(req: Request) {
  const denied = await gate();
  if (denied) return denied;
  if (!process.env.LOMU_LOCAL_TOKEN) return Response.json({ error: 'only available in the desktop app' }, { status: 404 });
  try {
    const b = (await readJson(req)) as { action?: string; url?: string; username?: string; password?: string; lan?: string };
    if (b.action === 'sync') syncNow();
    else if (b.action === 'lan') setHubLan(String(b.lan ?? ''));
    else await connectHub(String(b.url ?? ''), String(b.username ?? ''), String(b.password ?? ''), String(b.lan ?? ''));
    return Response.json(hubStatus());
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'bad request' }, { status: 400 });
  }
}

export async function DELETE() {
  const denied = await gate();
  if (denied) return denied;
  disconnectHub();
  return Response.json(hubStatus());
}
