import { cookies } from 'next/headers';
import { rotate, setAuthCookies } from '@/server/auth';

export async function POST(req: Request) {
  let refresh: string | undefined;
  try {
    refresh = (await req.json())?.refresh;
  } catch {
    /* cookie-based clients send no body */
  }
  refresh ??= (await cookies()).get('lomu_rt')?.value;
  const t = refresh ? rotate(refresh, req.headers.get('x-lomu-device') ?? 'web') : null;
  if (!t) return Response.json({ error: 'invalid refresh token' }, { status: 401 });
  await setAuthCookies(t);
  return Response.json(t);
}
