import 'server-only';
import crypto from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { db, getSetting, setSetting } from './db';

const ACCESS_TTL = 15 * 60;
const REFRESH_TTL = 60 * 24 * 3600;

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url');
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

let secretKey: Buffer | null = null;
function secret(): Buffer {
  if (secretKey) return secretKey;
  let s = getSetting('jwt_secret');
  if (!s) {
    s = crypto.randomBytes(32).toString('hex');
    setSetting('jwt_secret', s);
  }
  return (secretKey = Buffer.from(s, 'hex'));
}

function sign(payload: Record<string, unknown>): string {
  const head = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', secret()).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

export function verify(token: string | undefined | null): { sub: string; uid?: number } | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const expect = crypto.createHmac('sha256', secret()).update(`${parts[0]}.${parts[1]}`).digest();
  let got: Buffer;
  try {
    got = Buffer.from(parts[2], 'base64url');
  } catch {
    return null;
  }
  if (got.length !== expect.length || !crypto.timingSafeEqual(got, expect)) return null;
  try {
    const p = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (typeof p.exp !== 'number' || p.exp < Date.now() / 1000) return null;
    return { sub: String(p.sub), uid: typeof p.uid === 'number' ? p.uid : undefined };
  } catch {
    return null;
  }
}

export type User = { id: number; username: string; role: 'admin' | 'user' };
type UserRow = { id: number; username: string; salt: string; hash: string; role: string; disabled: number; created: number };

export const maxUsers = () => Math.max(1, Math.min(50, Number(process.env.LOMU_MAX_USERS) || 4));

export const hasOwner = () => !!db().prepare('SELECT 1 FROM users LIMIT 1').get();
export const userCount = () => (db().prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;

const toUser = (r: { id: number; username: string; role: string }): User => ({ id: r.id, username: r.username, role: r.role === 'admin' ? 'admin' : 'user' });

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') };
}

function checkNewCredentials(username: string, password: string, strictName: boolean) {
  const name = username.trim();
  if (name.length < 2) throw new Error('username too short');
  if (name.length > 32) throw new Error('username too long (32 at most)');
  if (strictName && !/^[A-Za-z0-9._-]+$/.test(name)) throw new Error('username may only use letters, digits, dot, dash and underscore');
  if (password.length < 8) throw new Error('password must be at least 8 characters');
  if (password.length > 200) throw new Error('password too long');
  return name;
}

export function createOwner(username: string, password: string): User {
  if (hasOwner()) throw new Error('already set up');
  const name = checkNewCredentials(username, password, false);
  const { salt, hash } = hashPassword(password);
  const r = db().prepare("INSERT INTO users (username, salt, hash, role, created) VALUES (?, ?, ?, 'admin', ?)").run(name, salt, hash, Date.now());
  return { id: Number(r.lastInsertRowid), username: name, role: 'admin' };
}

export function createUser(username: string, password: string, role: 'admin' | 'user' = 'user'): User {
  const name = checkNewCredentials(username, password, true);
  if (userCount() >= maxUsers()) throw new Error(`this server is limited to ${maxUsers()} accounts`);
  if (db().prepare('SELECT 1 FROM users WHERE username = ?').get(name)) throw new Error('that username is taken');
  const { salt, hash } = hashPassword(password);
  const r = db().prepare('INSERT INTO users (username, salt, hash, role, created) VALUES (?, ?, ?, ?, ?)').run(name, salt, hash, role, Date.now());
  return { id: Number(r.lastInsertRowid), username: name, role };
}

export function listUsers(): (User & { disabled: boolean; created: number; devices: number })[] {
  const rows = db().prepare('SELECT id, username, role, disabled, created FROM users ORDER BY id').all() as UserRow[];
  return rows.map((r) => ({
    ...toUser(r),
    disabled: !!r.disabled,
    created: r.created,
    devices: (db().prepare('SELECT COUNT(*) AS n FROM refresh WHERE uid = ? AND expires > ?').get(r.id, Date.now()) as { n: number }).n,
  }));
}

export function getUser(id: number): User | null {
  const r = db().prepare('SELECT id, username, role, disabled FROM users WHERE id = ?').get(id) as UserRow | undefined;
  return r && !r.disabled ? toUser(r) : null;
}

function adminCount() {
  return (db().prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND disabled = 0").get() as { n: number }).n;
}

export function setPassword(id: number, password: string) {
  checkNewCredentials('xx', password, false);
  const { salt, hash } = hashPassword(password);
  db().prepare('UPDATE users SET salt = ?, hash = ? WHERE id = ?').run(salt, hash, id);
  revokeUser(id);
}

export function setDisabled(id: number, disabled: boolean) {
  const u = db().prepare('SELECT role FROM users WHERE id = ?').get(id) as { role: string } | undefined;
  if (!u) throw new Error('no such user');
  if (disabled && u.role === 'admin' && adminCount() <= 1) throw new Error('cannot disable the only admin');
  db().prepare('UPDATE users SET disabled = ? WHERE id = ?').run(disabled ? 1 : 0, id);
  if (disabled) revokeUser(id);
}

export function deleteUser(id: number) {
  const d = db();
  const u = d.prepare('SELECT role FROM users WHERE id = ?').get(id) as { role: string } | undefined;
  if (!u) throw new Error('no such user');
  if (u.role === 'admin' && adminCount() <= 1) throw new Error('cannot delete the only admin');
  d.exec('BEGIN');
  try {
    d.prepare('DELETE FROM docs WHERE uid = ?').run(id);
    d.prepare('DELETE FROM refresh WHERE uid = ?').run(id);
    d.prepare('DELETE FROM cache WHERE k LIKE ?').run(`%:u${id}:%`);
    d.prepare('DELETE FROM users WHERE id = ?').run(id);
    d.exec('COMMIT');
  } catch (e) {
    d.exec('ROLLBACK');
    throw e;
  }
}

const DUMMY_SALT = 'x'.repeat(32);
const scryptAsync = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) => crypto.scrypt(password, salt, 64, (e, k) => (e ? reject(e) : resolve(k))));

export async function checkPassword(username: string, password: string): Promise<User | null> {
  if (password.length > 1000) return null;
  const row = db().prepare('SELECT id, username, salt, hash, role, disabled FROM users WHERE username = ?').get(username.trim()) as UserRow | undefined;
  if (!row) {
    await scryptAsync(password, DUMMY_SALT);
    return null;
  }
  const h = await scryptAsync(password, row.salt);
  const ok = crypto.timingSafeEqual(h, Buffer.from(row.hash, 'hex'));
  return ok && !row.disabled ? toUser(row) : null;
}

export type Tokens = { access: string; refresh: string; expiresIn: number };

const MAX_SESSIONS = 25;

export function issueTokens(user: User, device = 'web'): Tokens {
  const now = Math.floor(Date.now() / 1000);
  const access = sign({ sub: user.username, uid: user.id, iat: now, exp: now + ACCESS_TTL });
  const refresh = crypto.randomBytes(32).toString('base64url');
  const d = db();
  d.prepare('DELETE FROM refresh WHERE expires < ?').run(Date.now());
  d.prepare('INSERT INTO refresh (hash, expires, device, uid) VALUES (?, ?, ?, ?)').run(sha(refresh), Date.now() + REFRESH_TTL * 1000, device.slice(0, 40), user.id);
  d.prepare('DELETE FROM refresh WHERE uid = ? AND hash NOT IN (SELECT hash FROM refresh WHERE uid = ? ORDER BY expires DESC LIMIT ?)').run(user.id, user.id, MAX_SESSIONS);
  return { access, refresh, expiresIn: ACCESS_TTL };
}

export function rotate(refresh: string, device = 'web'): (Tokens & { user: User }) | null {
  const d = db();
  const row = d.prepare('SELECT expires, uid FROM refresh WHERE hash = ?').get(sha(refresh)) as { expires: number; uid: number } | undefined;
  if (!row || row.expires < Date.now()) return null;
  d.prepare('DELETE FROM refresh WHERE hash = ?').run(sha(refresh));
  const user = getUser(row.uid);
  return user ? { ...issueTokens(user, device), user } : null;
}

export function revokeUser(uid: number) {
  db().prepare('DELETE FROM refresh WHERE uid = ?').run(uid);
}

export function refreshOwner(refresh: string): number | null {
  const r = db().prepare('SELECT uid FROM refresh WHERE hash = ?').get(sha(refresh)) as { uid: number } | undefined;
  return r?.uid ?? null;
}

const COOKIE = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.LOMU_SECURE_COOKIES === '1', path: '/' };

export async function setAuthCookies(t: Tokens) {
  const c = await cookies();
  c.set('lomu_at', t.access, { ...COOKIE, maxAge: ACCESS_TTL });
  c.set('lomu_rt', t.refresh, { ...COOKIE, maxAge: REFRESH_TTL });
}

export async function clearAuthCookies() {
  const c = await cookies();
  c.delete('lomu_at');
  c.delete('lomu_rt');
}

export const isLocalMode = () => !!process.env.LOMU_LOCAL_TOKEN;

function localOwner(h: Headers): User | null {
  const want = process.env.LOMU_LOCAL_TOKEN;
  const got = h.get('x-lomu-local');
  if (!want || !got) return null;
  const a = Buffer.from(got);
  const b = Buffer.from(want);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (!hasOwner()) createOwner('local', crypto.randomBytes(24).toString('hex'));
  const r = db().prepare('SELECT id, username, role FROM users ORDER BY id LIMIT 1').get() as { id: number; username: string; role: string };
  return toUser(r);
}

export async function currentUser(): Promise<User | null> {
  const h = await headers();
  const local = localOwner(h);
  if (local) return local;
  const bearer = h.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  const c = await cookies();
  const v = verify(bearer ?? c.get('lomu_at')?.value);
  if (!v) return null;
  const row = (
    v.uid !== undefined
      ? db().prepare('SELECT id, username, role, disabled FROM users WHERE id = ? AND username = ?').get(v.uid, v.sub)
      : db().prepare('SELECT id, username, role, disabled FROM users WHERE username = ?').get(v.sub)
  ) as UserRow | undefined;
  return row && !row.disabled ? toUser(row) : null;
}

export async function requireUser(): Promise<User | Response> {
  if (!hasOwner()) return { id: 1, username: '', role: 'admin' };
  const u = await currentUser();
  return u ?? Response.json({ error: 'unauthorized' }, { status: 401 });
}

export async function requireAdmin(): Promise<User | Response> {
  const u = await requireUser();
  if (u instanceof Response) return u;
  if (u.role !== 'admin' || !u.username) return Response.json({ error: 'admin only' }, { status: 403 });
  return u;
}

export async function gate(): Promise<Response | null> {
  const u = await requireUser();
  return u instanceof Response ? u : null;
}
