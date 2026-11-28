import { afterAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lomu-migrate-test-'));
afterAll(async () => {
  (await import('@/server/db')).closeDb();
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
});

describe('migration from the single-owner schema', () => {
  it('moves the owner, documents and sessions to account 1', async () => {
    const old = new DatabaseSync(path.join(dir, 'lomu.db'));
    old.exec(`
      CREATE TABLE settings (k TEXT PRIMARY KEY, v TEXT NOT NULL);
      CREATE TABLE owner (id INTEGER PRIMARY KEY CHECK (id = 1), username TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL, created INTEGER NOT NULL);
      CREATE TABLE refresh (hash TEXT PRIMARY KEY, expires INTEGER NOT NULL, device TEXT);
      CREATE TABLE docs (kind TEXT NOT NULL, key TEXT NOT NULL, value TEXT, updated INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, seq INTEGER NOT NULL, PRIMARY KEY (kind, key));
      CREATE INDEX docs_seq ON docs (seq);
      CREATE TABLE cache (k TEXT PRIMARY KEY, v TEXT NOT NULL, at INTEGER NOT NULL);
    `);
    const salt = 'ab'.repeat(16);
    const hash = crypto.scryptSync('old owner password', salt, 64).toString('hex');
    old.prepare('INSERT INTO owner VALUES (1, ?, ?, ?, ?)').run('Lokesh', salt, hash, 1);
    old.exec(`INSERT INTO docs VALUES ('like', 'a', '{"x":1}', 10, 0, 1), ('play', 'p', '{"y":2}', 11, 0, 2)`);
    old.prepare("INSERT INTO refresh VALUES ('deadbeef', ?, 'phone')").run(Date.now() + 1e9);
    old.close();

    process.env.LOMU_DATA_DIR = dir;
    const auth = await import('@/server/auth');
    const sync = await import('@/server/sync');
    expect(auth.hasOwner()).toBe(true);
    expect(await auth.checkPassword('lokesh', 'old owner password')).toMatchObject({ id: 1, role: 'admin', username: 'Lokesh' });
    expect(sync.all(1, 'like')).toHaveLength(1);
    expect(sync.pull(1, 0).docs.map((d) => d.seq)).toEqual([1, 2]);
    expect(sync.currentSeq(2)).toBe(0);
    expect(auth.listUsers()[0].devices).toBe(1);
    expect(auth.createUser('guest', 'a decent password').id).toBe(2);
    (await import('@/server/db')).closeDb();
    expect(auth.listUsers()).toHaveLength(2);
  });
});
