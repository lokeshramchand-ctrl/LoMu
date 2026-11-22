import { cookies } from 'next/headers';
import { clearAuthCookies, currentUser, refreshOwner, revokeUser } from '@/server/auth';

/** Signs the calling account out of every device (and only that account). */
export async function POST(req: Request) {
  let uid = (await currentUser())?.id ?? null;
  if (uid === null) {
    let refresh: string | undefined;
    try {
      refresh = (await req.json())?.refresh;
    } catch {
      /* no body */
    }
    refresh ??= (await cookies()).get('lomu_rt')?.value;
    uid = refresh ? refreshOwner(refresh) : null;
  }
  if (uid !== null) revokeUser(uid);
  await clearAuthCookies();
  return Response.json({ ok: true });
}
