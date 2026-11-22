import { readJson } from '@/server/body';
import { createOwner, issueTokens, setAuthCookies } from '@/server/auth';
import { clientIp, limiter } from '@/server/ratelimit';

const attempts = limiter(10, 10 * 60_000);

export async function POST(req: Request) {
  const ip = clientIp(req);
  const wait = attempts.blocked(ip);
  if (wait) return Response.json({ error: 'too many attempts, try later' }, { status: 429, headers: { 'retry-after': String(wait) } });
  try {
    const { username, password, code } = await readJson(req);
    // Optional first-run guard: if LOMU_SETUP_CODE is set, only someone who knows it can claim the account.
    const need = process.env.LOMU_SETUP_CODE;
    if (need && String(code ?? '') !== need) {
      attempts.fail(ip);
      throw new Error('wrong setup code');
    }
    const user = createOwner(String(username ?? ''), String(password ?? ''));
    const t = issueTokens(user, req.headers.get('x-lomu-device') ?? 'web');
    await setAuthCookies(t);
    return Response.json({ ...t, user: user.username, role: user.role });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 400 });
  }
}
