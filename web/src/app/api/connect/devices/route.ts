import { requireUser } from '@/server/auth';
import { snapshot } from '@/server/connect';
import { hubConnect } from '@/server/hub';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const viaHub = await hubConnect('devices');
  if (viaHub?.ok) return Response.json(await viaHub.json(), { headers: { 'cache-control': 'no-store' } });
  return Response.json(snapshot(user.id), { headers: { 'cache-control': 'no-store' } });
}
