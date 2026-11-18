import { checkPassword, hasOwner, issueTokens, setAuthCookies } from '@/server/auth';

// Slow down guessing: 8 failures per client per 10 minutes.
const fails = new Map<string, { n: number; until: number }>();

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const f = fails.get(ip);
  if (f && f.n >= 8 && f.until > Date.now()) return Response.json({ error: 'too many attempts, try later' }, { status: 429 });
  try {
    const { username, password } = await req.json();
    if (!hasOwner() || !checkPassword(String(username ?? ''), String(password ?? ''))) {
      fails.set(ip, { n: (f && f.until > Date.now() ? f.n : 0) + 1, until: Date.now() + 10 * 60_000 });
      return Response.json({ error: 'wrong username or password' }, { status: 401 });
    }
    fails.delete(ip);
    const t = issueTokens(String(username).trim(), req.headers.get('x-lomu-device') ?? 'web');
    await setAuthCookies(t);
    return Response.json({ ...t, user: String(username).trim() });
  } catch {
    return Response.json({ error: 'bad request' }, { status: 400 });
  }
}
