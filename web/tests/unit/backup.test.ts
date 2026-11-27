import { afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lomu-backup-test-'));
process.env.LOMU_DATA_DIR = dir;
afterAll(async () => {
  (await import('@/server/db')).closeDb();
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
});

describe('nightly backup', () => {
  it('writes a copy that opens with the same data, and prunes to the newest 7', async () => {
    const { db, backupNow, lastBackup } = await import('@/server/db');
    db().prepare("INSERT INTO settings (k, v) VALUES ('probe', 'kept')").run();
    const backups = path.join(dir, 'backups');
    for (let i = 1; i <= 9; i++) fs.writeFileSync(path.join(backups, `lomu-2020-01-0${i}.db`), 'old');
    fs.rmSync(path.join(backups, `lomu-${new Date().toISOString().slice(0, 10)}.db`), { force: true });
    backupNow();
    const files = fs.readdirSync(backups).sort();
    expect(files).toHaveLength(7);
    expect(files).not.toContain('lomu-2020-01-01.db');
    const copy = new DatabaseSync(path.join(backups, files[files.length - 1]));
    expect(copy.prepare("SELECT v FROM settings WHERE k = 'probe'").get()).toEqual({ v: 'kept' });
    copy.close();
    expect(lastBackup()).toBeGreaterThan(0);
  });
});
