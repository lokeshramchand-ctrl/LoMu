import { clearAuthCookies, revokeAll } from '@/server/auth';

export async function POST() {
  revokeAll();
  await clearAuthCookies();
  return Response.json({ ok: true });
}
