import { readJson } from '@/server/body';
import { cookies } from 'next/headers';
import { rotate, setAuthCookies } from '@/server/auth';

export async function POST(req: Request) {
  let refresh: string | undefined;
  try {
    refresh = (await readJson(req))?.refresh;
  } catch {
    /* cookie-based clients send no body */
  }
  refresh ??= (await cookies()).get('lomu_rt')?.value;
  const t = refresh ? rotate(refresh, req.headers.get('x-lomu-device') ?? 'web') : null;
  if (!t) return Response.json({ error: 'invalid refresh token' }, { status: 401 });
  await setAuthCookies(t);
  const { access, refresh: next, expiresIn } = t;
  return Response.json({ access, refresh: next, expiresIn });
}
