/* Black-box audit + stress test against a running LoMu server.

   Usage:  node tests/audit/blackbox.mjs http://localhost:4300 <setupCode>
   Start the server on a THROWAWAY data dir first (LOMU_DATA_DIR=/tmp/x LOMU_SETUP_CODE=...): it creates accounts
   and writes data. Exits non-zero if any check fails. */

const BASE = (process.argv[2] ?? 'http://localhost:4300').replace(/\/+$/, '');
const CODE = process.argv[3] ?? '';
const PW = 'correct horse battery';

let pass = 0;
const failures = [];
const ok = (cond, name, extra = '') => {
  if (cond) pass++;
  else {
    failures.push(name + (extra ? ` (${extra})` : ''));
    console.log('  FAIL', name, extra);
  }
};
const section = (s) => console.log('\n# ' + s);

async function call(method, path, { token, body, headers = {}, raw } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: res.status, json, text, headers: res.headers };
}

/** Opens an SSE stream and collects events until closed. */
function sse(path, token) {
  const ac = new AbortController();
  const events = [];
  const done = (async () => {
    try {
      const res = await fetch(BASE + path, { headers: { authorization: `Bearer ${token}` }, signal: ac.signal });
      if (!res.ok) return events.push({ event: 'http', data: res.status });
      const dec = new TextDecoder();
      let buf = '';
      for await (const chunk of res.body) {
        buf += dec.decode(chunk, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, i);
          buf = buf.slice(i + 2);
          const ev = /^event: (.*)$/m.exec(block)?.[1];
          const data = /^data: (.*)$/m.exec(block)?.[1];
          if (ev) events.push({ event: ev, data: data ? JSON.parse(data) : null });
        }
      }
    } catch {
      /* aborted */
    }
  })();
  return { events, close: () => ac.abort(), done };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const users = {};
async function login(name, password = PW, headers = {}) {
  return call('POST', '/api/auth/login', { body: { username: name, password }, headers });
}

// ---------------------------------------------------------------- first run
section('first-run setup');
let r = await call('GET', '/api/auth/status');
ok(r.json?.setup === false, 'fresh server reports setup=false');
if (CODE) {
  r = await call('POST', '/api/auth/setup', { body: { username: 'owner', password: PW, code: 'wrong' } });
  ok(r.status === 400, 'setup with a wrong code is refused', r.status);
}
r = await call('POST', '/api/auth/setup', { body: { username: 'owner', password: 'short', code: CODE } });
ok(r.status === 400, 'setup with a short password is refused');
r = await call('POST', '/api/auth/setup', { body: { username: 'owner', password: PW, code: CODE } });
ok(r.status === 200 && r.json?.role === 'admin' && r.json?.access, 'owner setup works and is admin', r.status + ' ' + r.text.slice(0, 80));
users.owner = r.json;
r = await call('POST', '/api/auth/setup', { body: { username: 'second', password: PW, code: CODE } });
ok(r.status === 400, 'a second setup is refused');

// ---------------------------------------------------------------- unauthenticated access
section('every protected route refuses anonymous callers');
const protectedRoutes = [
  ['GET', '/api/sync'], ['POST', '/api/sync'], ['GET', '/api/sync/events'],
  ['GET', '/api/connect/devices'], ['POST', '/api/connect/state'], ['POST', '/api/connect/command'], ['GET', '/api/connect/events?id=abcdefgh1234'],
  ['GET', '/api/recs'], ['GET', '/api/recs/next?seed=x'], ['GET', '/api/home'], ['GET', '/api/explore'], ['GET', '/api/search?q=a'],
  ['GET', '/api/suggest?q=a'], ['GET', '/api/track/abc'], ['GET', '/api/stream/abc'], ['GET', '/api/radio/abc'], ['GET', '/api/related/abc'],
  ['GET', '/api/album/abc'], ['GET', '/api/artist/abc'], ['GET', '/api/playlist/abc'], ['GET', '/api/lyrics/abc'], ['GET', '/api/mood'],
  ['POST', '/api/import'], ['GET', '/api/hub'], ['POST', '/api/hub'], ['DELETE', '/api/hub'],
  ['GET', '/api/users'], ['POST', '/api/users'], ['PATCH', '/api/users'], ['DELETE', '/api/users?id=1'], ['POST', '/api/auth/password'],
];
for (const [m, p] of protectedRoutes) {
  const x = await call(m, p, m === 'GET' || m === 'DELETE' ? {} : { body: {} });
  ok(x.status === 401, `${m} ${p} -> 401 anonymous`, String(x.status));
}
const bad = await call('GET', '/api/sync', { token: 'garbage' });
ok(bad.status === 401, 'garbage bearer token -> 401');
const [h, b, s] = users.owner.access.split('.');
const forged = `${h}.${Buffer.from(JSON.stringify({ sub: 'owner', uid: 1, exp: 9e9 })).toString('base64url')}.${s}`;
ok((await call('GET', '/api/sync', { token: forged })).status === 401, 'forged token signature -> 401');
const none = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${b}.`;
ok((await call('GET', '/api/sync', { token: none })).status === 401, 'alg=none token -> 401');

// ---------------------------------------------------------------- user management
section('account management (owner + 3 guests)');
const T = users.owner.access;
r = await call('GET', '/api/users', { token: T });
ok(r.status === 200 && r.json.users.length === 1 && r.json.max === 4, 'admin lists users', r.text.slice(0, 80));
for (const n of ['guest1', 'guest2', 'guest3']) {
  r = await call('POST', '/api/users', { token: T, body: { username: n, password: PW } });
  ok(r.status === 200 && r.json.user.role === 'user', `admin creates ${n}`, r.text.slice(0, 80));
}
r = await call('POST', '/api/users', { token: T, body: { username: 'guest4', password: PW } });
ok(r.status === 400 && /limited/.test(r.json?.error ?? ''), 'a 5th account is refused', r.text.slice(0, 80));
r = await call('POST', '/api/users', { token: T, body: { username: 'GUEST1', password: PW } });
ok(r.status === 400, 'duplicate name (different case) refused');
r = await call('POST', '/api/users', { token: T, body: { username: "bad name'; DROP TABLE users;--", password: PW } });
ok(r.status === 400, 'odd characters in a username refused');
for (const n of ['guest1', 'guest2', 'guest3']) {
  r = await login(n);
  ok(r.status === 200, `${n} can sign in`);
  users[n] = r.json;
}
ok((await call('GET', '/api/users', { token: users.guest1.access })).status === 403, 'guest cannot list users');
ok((await call('POST', '/api/users', { token: users.guest1.access, body: { username: 'x1', password: PW } })).status === 403, 'guest cannot create users');
ok((await call('DELETE', '/api/users?id=1', { token: users.guest1.access })).status === 403, 'guest cannot delete the owner');
ok((await call('PATCH', '/api/users', { token: users.guest1.access, body: { id: 1, password: 'hacked password' } })).status === 403, 'guest cannot reset the owner password');
ok((await login('owner', 'hacked password')).status === 401, 'owner password unchanged after the attempt');
ok((await call('DELETE', '/api/users?id=1', { token: T })).status === 400, 'admin cannot delete themselves');
r = await call('GET', '/api/auth/status', { token: users.guest1.access });
ok(r.json?.user === 'guest1' && r.json?.role === 'user', 'status shows the guest account');

// ---------------------------------------------------------------- isolation over HTTP
section('data isolation over HTTP');
const names = ['owner', 'guest1', 'guest2', 'guest3'];
for (const n of names) {
  r = await call('POST', '/api/sync', { token: users[n].access, body: { docs: [
    { kind: 'like', key: 'shared-song', value: { by: n }, updated: 1000 },
    { kind: 'like', key: `only-${n}`, value: { by: n }, updated: 1001 },
    { kind: 'play', key: `p-${n}`, value: { by: n }, updated: 1002 },
  ] } });
  ok(r.status === 200 && r.json.applied === 3, `${n} pushes 3 docs`, r.text.slice(0, 80));
}
for (const n of names) {
  r = await call('GET', '/api/sync?since=0', { token: users[n].access });
  const docs = r.json.docs;
  ok(docs.length === 3 && docs.every((d) => d.value.by === n), `${n} pulls only their own docs`, JSON.stringify(docs.map((d) => d.value.by)));
  ok(r.json.seq === 3, `${n} has an independent seq`, String(r.json.seq));
}
r = await call('GET', '/api/sync?since=-1', { token: users.guest2.access });
ok(r.json.seq === 3 && r.json.docs.length === 0, 'since=-1 returns just the seq');
ok((await call('GET', '/api/sync?since=abc', { token: users.guest2.access })).status === 200, 'non-numeric since tolerated');

section('Connect: devices and commands stay inside an account');
const devOwner = sse('/api/connect/events?id=owner-device-1&name=OwnerPC&kind=web', users.owner.access);
const devGuest = sse('/api/connect/events?id=guest-device-1&name=GuestPhone&kind=android', users.guest1.access);
await wait(500);
r = await call('GET', '/api/connect/devices', { token: users.owner.access });
ok(r.json.devices.length === 1 && r.json.devices[0].id === 'owner-device-1', 'owner sees only their device', JSON.stringify(r.json.devices.map((d) => d.id)));
r = await call('GET', '/api/connect/devices', { token: users.guest1.access });
ok(r.json.devices.length === 1 && r.json.devices[0].id === 'guest-device-1', 'guest sees only their device');
r = await call('POST', '/api/connect/command', { token: users.owner.access, body: { from: 'owner-device-1', to: 'guest-device-1', cmd: { type: 'pause' } } });
ok(r.status === 404, "owner cannot control a guest's device", String(r.status));
await wait(200);
ok(!devGuest.events.some((e) => e.event === 'command'), 'guest device received no foreign command');
r = await call('POST', '/api/connect/state', { token: users.owner.access, body: { id: 'owner-device-1', state: { track: { id: 'zzz' }, playing: true, position: 1, duration: 9, volume: 1, shuffle: false, repeat: 'off', queueLen: 1 } } });
ok(r.status === 200, 'owner reports state');
await wait(200);
ok(!devGuest.events.some((e) => e.event === 'devices' && JSON.stringify(e.data).includes('zzz')), "guest never hears about the owner's track");
const devOwner2 = sse('/api/connect/events?id=owner-device-2&name=OwnerPhone&kind=android', users.owner.access);
await wait(300);
r = await call('POST', '/api/connect/command', { token: users.owner.access, body: { from: 'owner-device-2', to: 'owner-device-1', cmd: { type: 'seek', position: 5 } } });
ok(r.status === 200, 'owner controls own other device');
await wait(200);
ok(devOwner.events.some((e) => e.event === 'command' && e.data.cmd.type === 'seek'), 'command arrived on the target device');
r = await sse('/api/connect/events?id=../../etc/passwd&name=x', users.owner.access);
await wait(200);
ok(r.events[0]?.event === 'http' && r.events[0].data === 400, 'bad device id refused');
r.close();

// ---------------------------------------------------------------- lifecycle
section('disabling, password change and deletion take effect at once');
r = await call('PATCH', '/api/users', { token: T, body: { id: 3, disabled: true } }); // guest2
ok(r.status === 200, 'admin disables guest2');
ok((await call('GET', '/api/sync', { token: users.guest2.access })).status === 401, 'disabled account: its still-valid access token stops working');
ok((await login('guest2')).status === 401, 'disabled account cannot sign in');
ok((await call('POST', '/api/auth/refresh', { body: { refresh: users.guest2.refresh } })).status === 401, 'disabled account cannot refresh');
ok((await call('PATCH', '/api/users', { token: T, body: { id: 3, disabled: false } })).status === 200, 're-enabled');
r = await login('guest2');
ok(r.status === 200, 'guest2 signs in again');
users.guest2 = r.json;
ok((await call('GET', '/api/sync?since=0', { token: users.guest2.access })).json.docs.length === 3, 'data survived being disabled');

r = await call('POST', '/api/auth/password', { token: users.guest3.access, body: { current: 'wrong password', next: 'a new password 1' } });
ok(r.status === 401, 'password change needs the current password');
r = await call('POST', '/api/auth/password', { token: users.guest3.access, body: { current: PW, next: 'tiny' } });
ok(r.status === 400, 'new password must be long enough');
const g3old = users.guest3;
r = await call('POST', '/api/auth/password', { token: users.guest3.access, body: { current: PW, next: 'a new password 1' } });
ok(r.status === 200 && r.json.access, 'guest3 changes their password');
ok((await call('POST', '/api/auth/refresh', { body: { refresh: g3old.refresh } })).status === 401, 'old sessions are signed out by a password change');
ok((await login('guest3', PW)).status === 401 && (await login('guest3', 'a new password 1')).status === 200, 'only the new password works');
users.guest3 = (await login('guest3', 'a new password 1')).json;

r = await call('POST', '/api/auth/refresh', { body: { refresh: users.owner.refresh } });
ok(r.status === 200 && r.json.access && !r.json.user, 'refresh returns just a token pair', Object.keys(r.json ?? {}).join());
users.owner = { ...users.owner, ...r.json };
ok((await call('POST', '/api/auth/refresh', { body: { refresh: users.owner.refresh } })).status === 200, 'rotated refresh token works once');

r = await call('DELETE', '/api/users?id=4', { token: users.owner.access }); // guest3
ok(r.status === 200 && r.json.users.length === 3, 'admin deletes guest3');
ok((await call('GET', '/api/sync', { token: users.guest3.access })).status === 401, 'deleted account is locked out');
r = await call('POST', '/api/users', { token: users.owner.access, body: { username: 'guest3', password: PW } });
ok(r.status === 200, 'the seat is free again; same name can be reused');
const re = await login('guest3');
const reDocs = await call('GET', '/api/sync?since=0', { token: re.json.access });
ok(reDocs.json.docs.length === 0 && reDocs.json.seq === 0, 'a re-created account starts empty (no data inherited)');

// logout only signs out the caller
const keep = (await login('guest1')).json;
await call('POST', '/api/auth/logout', { token: users.guest2.access });
ok((await call('POST', '/api/auth/refresh', { body: { refresh: users.guest2.refresh } })).status === 401, 'logout revokes that account sessions');
ok((await call('POST', '/api/auth/refresh', { body: { refresh: keep.refresh } })).status === 200, "logout of guest2 does not sign out guest1");

// ---------------------------------------------------------------- brute force
section('brute-force protection');
let limited = 0;
for (let i = 0; i < 14; i++) {
  r = await login('owner', 'not the password ' + i);
  if (r.status === 429) limited++;
}
ok(limited > 0, 'repeated wrong passwords get 429', `limited=${limited}`);
ok(r.headers.get('retry-after') !== null, '429 carries Retry-After');
r = await login('owner', PW, { 'x-forwarded-for': '9.9.9.9' });
ok(r.status === 429, 'forging X-Forwarded-For does not dodge the per-account limit', String(r.status));
r = await login('guest1', PW, { 'x-forwarded-for': '9.9.9.9' });
ok(r.status === 200, 'other accounts are not locked out by it', String(r.status));

// ---------------------------------------------------------------- malformed input
section('malformed input never crashes the server');
const fuzz = [
  ['POST', '/api/sync', { raw: '{not json', token: users.guest1.access, headers: { 'content-type': 'application/json' } }],
  ['POST', '/api/sync', { body: { docs: 'nope' }, token: users.guest1.access }],
  ['POST', '/api/sync', { body: { docs: [null, 1, 'x', {}, { kind: 'like' }, { kind: 'like', key: 5 }] }, token: users.guest1.access }],
  ['POST', '/api/connect/command', { raw: '[]', token: users.guest1.access, headers: { 'content-type': 'application/json' } }],
  ['POST', '/api/connect/state', { body: { id: 5 }, token: users.guest1.access }],
  ['POST', '/api/auth/login', { raw: 'xx', headers: { 'content-type': 'application/json' } }],
  ['POST', '/api/auth/login', { body: { username: { a: 1 }, password: [] } }],
  ['POST', '/api/auth/login', { body: { username: 'a'.repeat(100000), password: 'b'.repeat(100000) } }],
  ['POST', '/api/users', { body: { username: null, password: null }, token: users.owner.access }],
  ['PATCH', '/api/users', { body: { id: 'x' }, token: users.owner.access }],
  ['DELETE', '/api/users?id=abc', { token: users.owner.access }],
  ['DELETE', '/api/users?id=999', { token: users.owner.access }],
  ['GET', '/api/stream/' + encodeURIComponent('../../../etc/passwd'), { token: users.guest1.access }],
  ['GET', '/api/stream/%00', { token: users.guest1.access }],
  ['GET', '/api/search?q=' + 'a'.repeat(50000), { token: users.guest1.access }],
  ['GET', '/api/recs/next?seed=&recent=' + 'a,'.repeat(5000), { token: users.guest1.access }],
];
for (const [m, p, o] of fuzz) {
  const x = await call(m, p, o);
  ok(x.status < 500 || x.status === 502, `${m} ${p.slice(0, 40)} -> ${x.status} (not a crash)`);
}
const alive = await call('GET', '/api/auth/status');
ok(alive.status === 200, 'server still answers after the fuzz round');
// A quota-violating huge doc is skipped, not fatal
r = await call('POST', '/api/sync', { token: users.guest1.access, body: { docs: [{ kind: 'like', key: 'huge', value: { x: 'y'.repeat(300000) }, updated: 5 }] } });
ok(r.status === 200 && r.json.applied === 0, 'an oversized document is skipped');

// ---------------------------------------------------------------- body limits and live streams
section('body limits and live streams of removed accounts');
const chunked = (bytes) => new ReadableStream({ start(c) { for (let i = 0; i < bytes; i += 65536) c.enqueue(new Uint8Array(Math.min(65536, bytes - i)).fill(32)); c.close(); } });
let big = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: chunked(2_000_000), duplex: 'half' }).catch(() => null);
ok(big && big.status === 400, 'a 2 MB chunked body to login is refused', String(big?.status));
big = await fetch(BASE + '/api/sync', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${users.guest1.access}` }, body: chunked(41_000_000), duplex: 'half' }).catch(() => null);
ok(big && big.status === 413, 'a 41 MB chunked body to sync gets 413', String(big?.status));
const t413 = Date.now();
r = await call('POST', '/api/import', { raw: ' '.repeat(5_000_000), headers: { 'content-type': 'application/json' } });
ok(r.status === 401 && Date.now() - t413 < 3000, 'anonymous /api/import is refused before its body is read', String(r.status));
ok((await call('GET', '/api/auth/status')).status === 200, 'server healthy after the oversize bodies');

const g3 = (await call('GET', '/api/users', { token: users.owner.access })).json.users.find((u) => u.username === 'guest3');
if (g3) await call('DELETE', `/api/users?id=${g3.id}`, { token: users.owner.access }); // the 4 seats are full: free one
const victim = (await call('POST', '/api/users', { token: users.owner.access, body: { username: 'streamvictim', password: PW } })).json;
if (victim?.user) {
  const vt = (await login('streamvictim')).json;
  const vs = sse('/api/sync/events', vt.access);
  const vc = sse('/api/connect/events?id=victim-device-1&name=V&kind=web', vt.access);
  await wait(500);
  ok(vs.events.length > 0 && vc.events.length > 0, 'victim has live sync and connect streams');
  let ended = false;
  vs.done.then(() => (ended = true));
  let endedC = false;
  vc.done.then(() => (endedC = true));
  await call('DELETE', `/api/users?id=${victim.user.id}`, { token: users.owner.access });
  const pingMs = Number(process.env.LOMU_PING_MS) || 25_000;
  await wait(Math.min(pingMs * 2.5, 30_000));
  ok(ended && endedC, 'streams of a deleted account are closed at the next keep-alive', `sync ended=${ended} connect ended=${endedC} (start the server with LOMU_PING_MS=1000)`);
  vs.close();
  vc.close();
} else {
  ok(false, 'could not create the stream-test account', JSON.stringify(victim));
}

// ---------------------------------------------------------------- pages and headers
section('pages and headers');
for (const p of ['/', '/search', '/library', '/explore', '/insights', '/settings', '/import', '/manifest.webmanifest']) {
  const x = await call('GET', p);
  ok(x.status === 200, `page ${p} -> 200`, String(x.status));
}
const page = await call('GET', '/');
ok(!page.headers.get('x-powered-by'), 'no X-Powered-By');
for (const hd of ['x-content-type-options', 'referrer-policy', 'x-frame-options', 'permissions-policy']) {
  ok(!!page.headers.get(hd), `security header ${hd} present`);
}
const api = await call('GET', '/api/auth/status');
ok(!!api.headers.get('x-content-type-options'), 'API responses carry X-Content-Type-Options');
ok((await call('GET', '/api/sync', { token: users.guest1.access })).headers.get('cache-control')?.includes('no-store') ?? true, 'sync not cacheable');

// ---------------------------------------------------------------- stress
section('stress');
const t0 = Date.now();
// 1. parallel pushes from all accounts, each its own docs, plus overlapping keys
const accts = ['owner', 'guest1', 'guest2'].map((n) => ({ n, tok: users[n].access }));
if (!(await call('GET', '/api/sync', { token: users.guest2.access })).status === 200) accts.pop();
const pushes = [];
for (let i = 0; i < 300; i++) {
  const a = accts[i % accts.length];
  pushes.push(call('POST', '/api/sync', { token: a.tok, body: { docs: Array.from({ length: 20 }, (_, k) => ({ kind: 'play', key: `s${i}-${k}`, value: { t: i, k, by: a.n }, updated: 10_000 + i * 100 + k })) } }));
}
const res = await Promise.all(pushes);
ok(res.every((x) => x.status === 200), '300 concurrent pushes all succeed', String(res.find((x) => x.status !== 200)?.status));
for (const a of accts) {
  const mine = [];
  let since = 0;
  for (;;) {
    const p = await call('GET', `/api/sync?since=${since}`, { token: a.tok });
    mine.push(...p.json.docs);
    if (p.json.docs.length < 2000) break;
    since = p.json.seq;
  }
  const plays = mine.filter((d) => d.kind === 'play');
  const own = plays.every((d) => d.value.by === a.n);
  const expected = 100 * 20 + 1; // 300 pushes / 3 accounts, 20 docs each, plus the one earlier play doc
  ok(own && plays.length === expected, `${a.n}: ${plays.length}/${expected} plays, none from another account`, `own=${own}`);
  const seqs = new Set(mine.map((d) => d.seq));
  ok(seqs.size === mine.length, `${a.n}: seq numbers are unique`);
}
console.log(`  300 pushes x 20 docs in ${Date.now() - t0} ms`);

// 2. many SSE connections held at once (sync + connect), then dropped
const t1 = Date.now();
const streams = [];
for (let i = 0; i < 40; i++) streams.push(sse('/api/sync/events', accts[i % accts.length].tok));
for (let i = 0; i < 12; i++) streams.push(sse(`/api/connect/events?id=stress-device-${String(i).padStart(3, '0')}&name=S${i}&kind=web`, users.guest1.access));
await wait(1200);
const connected = streams.filter((x) => x.events.some((e) => e.event === 'seq' || e.event === 'devices')).length;
ok(connected === 52 - 0 || connected >= 50, `${connected}/52 SSE streams connected`);
const refused = streams.filter((x) => x.events.some((e) => e.event === 'error' || e.event === 'http')).length;
console.log(`  streams refused (device cap is 16/account incl. earlier ones): ${refused}`);
// a push must notify every sync stream of that account
await call('POST', '/api/sync', { token: users.owner.access, body: { docs: [{ kind: 'like', key: 'ping-all', value: { x: 1 }, updated: 99999 }] } });
await wait(400);
const ownerStreams = streams.slice(0, 40).filter((_, i) => i % accts.length === 0);
ok(ownerStreams.every((x) => x.events.filter((e) => e.event === 'seq').length >= 2), "a push wakes all of that account's streams");
const others = streams.slice(0, 40).filter((_, i) => i % accts.length !== 0);
ok(others.every((x) => x.events.filter((e) => e.event === 'seq').length === 1), 'and none of the other accounts');
streams.forEach((x) => x.close());
[devOwner, devGuest, devOwner2].forEach((x) => x.close());
await wait(300);
console.log(`  52 SSE streams in ${Date.now() - t1} ms`);
r = await call('GET', '/api/auth/status');
ok(r.status === 200, 'server healthy after streams dropped');

// 3. read hammer: latency percentiles
const lat = [];
const tR = Date.now();
await Promise.all(
  Array.from({ length: 40 }, async (_, w) => {
    for (let i = 0; i < 25; i++) {
      const s = performance.now();
      const x = await call('GET', `/api/sync?since=${1900 + ((i * 37) % 100)}`, { token: accts[w % accts.length].tok });
      lat.push(performance.now() - s);
      if (x.status !== 200) failures.push('hammer status ' + x.status);
    }
  }),
);
lat.sort((a, b) => a - b);
const pct = (p) => Math.round(lat[Math.floor((lat.length - 1) * p)]);
console.log(`  1000 incremental reads, 40 workers: ${Date.now() - tR} ms total, p50 ${pct(0.5)} ms, p95 ${pct(0.95)} ms, p99 ${pct(0.99)} ms`);
ok(pct(0.95) < 1500, 'read p95 under 1.5 s with 40 concurrent workers', String(pct(0.95)));

// 4. login flood on valid credentials must not starve other traffic
const tL = Date.now();
const flood = Array.from({ length: 12 }, () => login('guest1'));
const probe = performance.now();
const pr = await call('GET', '/api/auth/status');
const probeMs = Math.round(performance.now() - probe);
await Promise.all(flood);
console.log(`  12 parallel valid logins took ${Date.now() - tL} ms; a status probe during them took ${probeMs} ms`);
ok(pr.status === 200 && probeMs < 3000, 'server stays responsive during a login burst', String(probeMs));

console.log(`\n${pass} checks passed, ${failures.length} failed`);
if (failures.length) {
  console.log(failures.map((f) => ' - ' + f).join('\n'));
  process.exit(1);
}
