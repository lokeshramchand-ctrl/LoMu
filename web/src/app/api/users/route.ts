import { readJson } from '@/server/body';
import { createUser, deleteUser, listUsers, maxUsers, requireAdmin, setDisabled, setPassword } from '@/server/auth';
import { revokeDevices } from '@/server/connect';

export const dynamic = 'force-dynamic';

export async function GET() {
  const me = await requireAdmin();
  if (me instanceof Response) return me;
  return Response.json({ users: listUsers(), max: maxUsers() });
}

export async function POST(req: Request) {
  const me = await requireAdmin();
  if (me instanceof Response) return me;
  try {
    const { username, password } = await readJson(req);
    const u = createUser(String(username ?? ''), String(password ?? ''));
    return Response.json({ user: u });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  const me = await requireAdmin();
  if (me instanceof Response) return me;
  try {
    const b = await readJson(req);
    const id = Number(b?.id);
    if (!Number.isInteger(id)) throw new Error('id required');
    if (typeof b.password === 'string') setPassword(id, b.password);
    if (typeof b.disabled === 'boolean') {
      if (b.disabled && id === me.id) throw new Error('you cannot disable yourself');
      setDisabled(id, b.disabled);
      if (b.disabled) revokeDevices(id);
    }
    return Response.json({ users: listUsers() });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const me = await requireAdmin();
  if (me instanceof Response) return me;
  try {
    const id = Number(new URL(req.url).searchParams.get('id'));
    if (!Number.isInteger(id)) throw new Error('id required');
    if (id === me.id) throw new Error('you cannot delete yourself');
    deleteUser(id);
    revokeDevices(id);
    return Response.json({ users: listUsers() });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 400 });
  }
}
