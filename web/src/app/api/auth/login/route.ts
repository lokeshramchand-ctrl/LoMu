import { readJson } from '@/server/body';
import { checkPassword, hasOwner, issueTokens, setAuthCookies } from '@/server/auth';
import { clientIp, limiter } from '@/server/ratelimit';

// Slow down guessing: per address and per account name, so neither one address nor many addresses can grind a password.
const byIp = limiter(40, 10 * 60_000); // generous: behind a proxy chain several clients can share one address
const byName = limiter(10, 10 * 60_000);

export async function POST(req: Request) {
  const ip = clientIp(req);
  try {
    const body = await readJson(req);
    const username = String(body?.username ?? '').trim().toLowerCase().slice(0, 64);
    const password = String(body?.password ?? '');
    const wait = Math.max(byIp.blocked(ip), byName.blocked(username));
    if (wait) return Response.json({ error: 'too many attempts, try later' }, { status: 429, headers: { 'retry-after': String(wait) } });
    const user = hasOwner() ? await checkPassword(username, password) : null;
    if (!user) {
      byIp.fail(ip);
      byName.fail(username);
      return Response.json({ error: 'wrong username or password' }, { status: 401 });
    }
    byIp.clear(ip);
    byName.clear(username);
    const t = issueTokens(user, req.headers.get('x-lomu-device') ?? 'web');
    await setAuthCookies(t);
    return Response.json({ ...t, user: user.username, role: user.role });
  } catch {
    return Response.json({ error: 'bad request' }, { status: 400 });
  }
}
