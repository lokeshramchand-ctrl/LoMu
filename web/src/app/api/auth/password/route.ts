import { readJson } from '@/server/body';
import { checkPassword, issueTokens, requireUser, setAuthCookies, setPassword } from '@/server/auth';
import { limiter } from '@/server/ratelimit';

const tries = limiter(8, 10 * 60_000);

/** Change your own password: { current, next }. Every other device is signed out; this one stays signed in. */
export async function POST(req: Request) {
  const me = await requireUser();
  if (me instanceof Response) return me;
  if (!me.username) return Response.json({ error: 'no account yet' }, { status: 400 });
  if (tries.blocked(String(me.id))) return Response.json({ error: 'too many attempts, try later' }, { status: 429 });
  try {
    const { current, next } = await readJson(req);
    if (!(await checkPassword(me.username, String(current ?? '')))) {
      tries.fail(String(me.id));
      return Response.json({ error: 'current password is wrong' }, { status: 401 });
    }
    setPassword(me.id, String(next ?? ''));
    const t = issueTokens(me, req.headers.get('x-lomu-device') ?? 'web');
    await setAuthCookies(t);
    return Response.json({ ok: true, ...t });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 400 });
  }
}
