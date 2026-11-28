import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let sync: typeof import('@/server/sync');
let auth: typeof import('@/server/auth');
let connect: typeof import('@/server/connect');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lomu-mu-test-'));

beforeAll(async () => {
  process.env.LOMU_DATA_DIR = dir;
  delete process.env.LOMU_MAX_USERS;
  sync = await import('@/server/sync');
  auth = await import('@/server/auth');
  connect = await import('@/server/connect');
});
afterAll(async () => {
  (await import('@/server/db')).closeDb();
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
});

const PW = 'a decent password';

describe('accounts', () => {
  it('first account is admin; the server allows the owner plus three guests', () => {
    const owner = auth.createOwner('owner', PW);
    expect(owner).toMatchObject({ id: 1, role: 'admin' });
    const a = auth.createUser('guest.one', PW);
    const b = auth.createUser('guest_two', PW);
    const c = auth.createUser('guest-three', PW);
    expect([a.id, b.id, c.id]).toEqual([2, 3, 4]);
    expect(a.role).toBe('user');
    expect(() => auth.createUser('fifth', PW)).toThrow(/limited to 4/);
    expect(auth.userCount()).toBe(4);
  });

  it('validates names and passwords, and refuses duplicates in any letter case', () => {
    process.env.LOMU_MAX_USERS = '10';
    expect(() => auth.createUser('x', PW)).toThrow('too short');
    expect(() => auth.createUser('has space', PW)).toThrow('letters, digits');
    expect(() => auth.createUser('a'.repeat(33), PW)).toThrow('too long');
    expect(() => auth.createUser('newbie', 'short')).toThrow('at least 8');
    expect(() => auth.createUser('newbie', 'p'.repeat(201))).toThrow('too long');
    expect(() => auth.createUser('GUEST.ONE', PW)).toThrow('taken');
    delete process.env.LOMU_MAX_USERS;
  });

  it('logs each account in with its own password only', async () => {
    expect((await auth.checkPassword('guest.one', PW))?.id).toBe(2);
    expect((await auth.checkPassword('GUEST.ONE', PW))?.id).toBe(2);
    expect(await auth.checkPassword('guest.one', 'someone elses pw')).toBeNull();
    expect(await auth.checkPassword('guest.one', 'x'.repeat(5000))).toBeNull();
  });

  it('tokens carry the account and die with it', async () => {
    const t = auth.issueTokens({ id: 2, username: 'guest.one', role: 'user' });
    expect(auth.verify(t.access)).toMatchObject({ sub: 'guest.one', uid: 2 });
    const next = auth.rotate(t.refresh);
    expect(next?.user.id).toBe(2);
    auth.setDisabled(2, true);
    expect(auth.rotate(next!.refresh)).toBeNull();
    expect(await auth.checkPassword('guest.one', PW)).toBeNull();
    auth.setDisabled(2, false);
    expect(await auth.checkPassword('guest.one', PW)).not.toBeNull();
  });

  it('a password change signs the account out everywhere', async () => {
    const t = auth.issueTokens({ id: 3, username: 'guest_two', role: 'user' });
    auth.setPassword(3, 'brand new password');
    expect(auth.rotate(t.refresh)).toBeNull();
    expect(await auth.checkPassword('guest_two', PW)).toBeNull();
    expect(await auth.checkPassword('guest_two', 'brand new password')).not.toBeNull();
  });

  it('keeps at most 25 sessions per account', () => {
    const u = { id: 4, username: 'guest-three', role: 'user' as const };
    for (let i = 0; i < 40; i++) auth.issueTokens(u);
    expect(auth.listUsers().find((x) => x.id === 4)!.devices).toBe(25);
  });

  it('never removes the last admin', () => {
    expect(() => auth.deleteUser(1)).toThrow('only admin');
    expect(() => auth.setDisabled(1, true)).toThrow('only admin');
  });
});

describe('data isolation', () => {
  it('each account sees only its own documents and its own seq', () => {
    sync.push(1, [{ kind: 'like', key: 'song', value: { who: 'owner' }, updated: 10 }]);
    sync.push(2, [{ kind: 'like', key: 'song', value: { who: 'guest' }, updated: 5 }]);
    sync.push(2, [{ kind: 'like', key: 'only-guest', value: { x: 1 }, updated: 6 }]);
    expect(sync.all(1, 'like').map((d) => d.value.who ?? d.key)).toEqual(['owner']);
    expect(sync.all(2, 'like').map((d) => d.key).sort()).toEqual(['only-guest', 'song']);
    expect(sync.all(3, 'like')).toEqual([]);
    expect(sync.pull(3, 0).docs).toEqual([]);
    expect(sync.pull(2, 0).docs).toHaveLength(2);
    expect(sync.currentSeq(1)).toBe(1);
    expect(sync.currentSeq(2)).toBe(2);
  });

  it('a delete on one account does not touch another', () => {
    sync.push(2, [{ kind: 'like', key: 'song', value: null, updated: 99, deleted: true }]);
    expect(sync.all(1, 'like').map((d) => d.key)).toEqual(['song']);
    expect(sync.all(2, 'like').map((d) => d.key)).toEqual(['only-guest']);
  });

  it('change notifications are per account', () => {
    const seen: string[] = [];
    const off1 = sync.onChange(1, () => seen.push('one'));
    const off3 = sync.onChange(3, () => seen.push('three'));
    sync.push(3, [{ kind: 'search', key: 'q', value: 'hi', updated: 1 }]);
    off1();
    off3();
    expect(seen).toEqual(['three']);
  });

  it('applyRemote is scoped too', () => {
    sync.applyRemote(3, [{ kind: 'saved', key: 'r', value: { a: 1 }, updated: 5 }]);
    expect(sync.all(3, 'saved')).toHaveLength(1);
    expect(sync.all(1, 'saved')).toHaveLength(0);
  });

  it('enforces the per-account document quota for new documents only', () => {
    process.env.LOMU_MAX_DOCS = '3';
    expect(sync.all(4, 'play')).toHaveLength(0);
    const r = sync.push(4, [1, 2, 3, 4, 5].map((n) => ({ kind: 'play', key: `p${n}`, value: { n }, updated: n })));
    expect(r.applied).toBe(3);
    expect(sync.push(4, [{ kind: 'play', key: 'p1', value: { n: 'edited' }, updated: 50 }]).applied).toBe(1);
    delete process.env.LOMU_MAX_DOCS;
  });

  it('deleting an account removes its data and leaves the others alone', async () => {
    auth.deleteUser(4);
    expect(sync.all(4, 'play')).toEqual([]);
    expect(sync.pull(4, 0).docs).toEqual([]);
    expect(sync.all(1, 'like')).toHaveLength(1);
    expect(await auth.checkPassword('guest-three', PW)).toBeNull();
    expect(auth.createUser('guest-four', PW).id).toBe(5);
  });
});

describe('connect rooms', () => {
  const ids = (uid: number) => connect.snapshot(uid).devices.map((d) => d.id);
  const st = { track: { id: 'abc' }, playing: true, position: 1, duration: 100, volume: 1, shuffle: false, repeat: 'off' as const, queueLen: 1 };

  it('devices and commands never cross accounts', () => {
    const gotB: { e: string; d: unknown }[] = [];
    const offA = connect.connect(1, 'dev-aaaaaaaa', 'A', 'web', () => {});
    const offB = connect.connect(2, 'dev-bbbbbbbb', 'B', 'web', (e, d) => gotB.push({ e, d }));
    expect(ids(1)).toEqual(['dev-aaaaaaaa']);
    expect(ids(2)).toEqual(['dev-bbbbbbbb']);
    expect(connect.command(1, 'dev-aaaaaaaa', 'dev-bbbbbbbb', { type: 'pause' })).toBe('offline');
    expect(gotB.filter((x) => x.e === 'command')).toEqual([]);
    connect.report(2, 'dev-bbbbbbbb', st);
    connect.report(1, 'dev-aaaaaaaa', st);
    expect(gotB.filter((x) => x.e === 'command')).toEqual([]);
    offA();
    offB();
  });

  it('caps devices per account and connections per device', () => {
    const offs: (() => void)[] = [];
    for (let i = 0; i < 16; i++) offs.push(connect.connect(9, `device-${String(i).padStart(4, '0')}`, 'D', 'web', () => {}));
    expect(() => connect.connect(9, 'device-extra-17', 'D', 'web', () => {})).toThrow('too many devices');
    for (let i = 0; i < 5; i++) offs.push(connect.connect(9, 'device-0000', 'D', 'web', () => {}));
    expect(() => connect.connect(9, 'device-0000', 'D', 'web', () => {})).toThrow('too many connections');
    offs.forEach((o) => o());
  });

  it('revoking an account tells its devices and clears the room', () => {
    const got: string[] = [];
    connect.connect(7, 'dev-revoked1', 'R', 'web', (e) => got.push(e));
    connect.revokeDevices(7);
    expect(got).toContain('revoked');
    expect(ids(7)).toEqual([]);
  });
});

describe('rate limiter', () => {
  it('blocks after the limit, unblocks after the window, and stays bounded', async () => {
    const { limiter, clientIp } = await import('@/server/ratelimit');
    const l = limiter(3, 50, 10);
    for (let i = 0; i < 3; i++) l.fail('k');
    expect(l.blocked('k')).toBeGreaterThan(0);
    expect(l.blocked('other')).toBe(0);
    l.clear('k');
    expect(l.blocked('k')).toBe(0);
    for (let i = 0; i < 100; i++) l.fail('flood' + i);
    expect(l.size()).toBeLessThanOrEqual(10);
    l.fail('t');
    l.fail('t');
    l.fail('t');
    await new Promise((r) => setTimeout(r, 70));
    expect(l.blocked('t')).toBe(0);

    const req = (xff?: string) => new Request('http://x', { headers: xff ? { 'x-forwarded-for': xff } : {} });
    expect(clientIp(req())).toBe('local');
    expect(clientIp(req('1.1.1.1'))).toBe('1.1.1.1');
    expect(clientIp(req('6.6.6.6, 1.1.1.1'))).toBe('1.1.1.1');
    process.env.LOMU_PROXY_HOPS = '2';
    expect(clientIp(req('6.6.6.6, 1.1.1.1, 10.0.0.1'))).toBe('1.1.1.1');
    delete process.env.LOMU_PROXY_HOPS;
  });
});
