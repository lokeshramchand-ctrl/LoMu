import { readJson } from '@/server/body';
import { resolveImport, type ImportRef } from '@/server/catalog';
import { json } from '@/server/http';
import { gate } from '@/server/auth';

export const dynamic = 'force-dynamic';

export const POST = async (req: Request) => {
  const denied = await gate(); // before reading the body: strangers do not get to make us parse it
  if (denied) return denied;
  const body = (await readJson(req, 100_000).catch(() => ({}))) as { items?: ImportRef[] };
  const items = (Array.isArray(body.items) ? body.items : []).slice(0, 30).map((i) => ({
    id: typeof i?.id === 'string' ? i.id.slice(0, 20) : undefined,
    title: typeof i?.title === 'string' ? i.title.slice(0, 200) : undefined,
    artist: typeof i?.artist === 'string' ? i.artist.slice(0, 200) : undefined,
  }));
  return json(async () => ({ tracks: await resolveImport(items) }));
};
