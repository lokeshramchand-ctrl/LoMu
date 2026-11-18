import { createOwner, issueTokens, setAuthCookies } from '@/server/auth';

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();
    createOwner(String(username ?? ''), String(password ?? ''));
    const t = issueTokens(String(username).trim(), req.headers.get('x-lomu-device') ?? 'web');
    await setAuthCookies(t);
    return Response.json({ ...t, user: String(username).trim() });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 400 });
  }
}
