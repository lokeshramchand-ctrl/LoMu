import { createOwner, issueTokens, setAuthCookies } from '@/server/auth';

export async function POST(req: Request) {
  try {
    const { username, password, code } = await req.json();
    // Optional first-run guard: if LOMU_SETUP_CODE is set, only someone who knows it can claim the account.
    const need = process.env.LOMU_SETUP_CODE;
    if (need && String(code ?? '') !== need) throw new Error('wrong setup code');
    createOwner(String(username ?? ''), String(password ?? ''));
    const t = issueTokens(String(username).trim(), req.headers.get('x-lomu-device') ?? 'web');
    await setAuthCookies(t);
    return Response.json({ ...t, user: String(username).trim() });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 400 });
  }
}
