import 'server-only';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// The data directory lives outside the project tree (writes inside it would retrigger the dev
// bundler) and is the only thing that needs backing up: one SQLite file.
const dir = process.env.LOMU_DATA_DIR || path.join(os.homedir(), '.lomu');

type G = typeof globalThis & { __lomuDb?: DatabaseSync };
const g = globalThis as G;

/** Brings an older database up to date. Everything an older version stored belongs to user 1 (the former single owner). */
function migrate(d: DatabaseSync) {
  const cols = (t: string) => (d.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name);
  if (!cols('refresh').includes('uid')) d.exec('ALTER TABLE refresh ADD COLUMN uid INTEGER NOT NULL DEFAULT 1');
  const legacy = d.prepare('SELECT username, salt, hash, created FROM owner WHERE id = 1').get() as
    | { username: string; salt: string; hash: string; created: number }
    | undefined;
  if (legacy && !d.prepare('SELECT 1 FROM users LIMIT 1').get()) {
    d.prepare("INSERT INTO users (id, username, salt, hash, role, created) VALUES (1, ?, ?, ?, 'admin', ?)").run(legacy.username, legacy.salt, legacy.hash, legacy.created);
  }
  const docCols = cols('docs');
  if (!docCols.length) {
    d.exec(`
      -- One row per synced object, per user. seq is that user's position in the change log: a client that
      -- remembers the highest seq it saw asks only for rows above it.
      CREATE TABLE docs (
        uid INTEGER NOT NULL, kind TEXT NOT NULL, key TEXT NOT NULL, value TEXT, updated INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, seq INTEGER NOT NULL,
        PRIMARY KEY (uid, kind, key)
      );
    `);
  } else if (!docCols.includes('uid')) {
    d.exec(`
      BEGIN;
      CREATE TABLE docs_v2 (
        uid INTEGER NOT NULL, kind TEXT NOT NULL, key TEXT NOT NULL, value TEXT, updated INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, seq INTEGER NOT NULL,
        PRIMARY KEY (uid, kind, key)
      );
      INSERT INTO docs_v2 (uid, kind, key, value, updated, deleted, seq) SELECT 1, kind, key, value, updated, deleted, seq FROM docs;
      DROP TABLE docs;
      ALTER TABLE docs_v2 RENAME TO docs;
      COMMIT;
    `);
  }
  d.exec('CREATE INDEX IF NOT EXISTS docs_uid_seq ON docs (uid, seq); CREATE INDEX IF NOT EXISTS docs_uid_kind ON docs (uid, kind, updated);');
}

const backupDir = path.join(dir, 'backups');
const KEEP = 7;

/** One consistent copy of the live database per day (VACUUM INTO is safe while it is in use); keeps the newest KEEP. */
export function backupNow(d: DatabaseSync = db()): void {
  const file = path.join(backupDir, `lomu-${new Date().toISOString().slice(0, 10)}.db`);
  try {
    fs.mkdirSync(backupDir, { recursive: true });
    if (!fs.existsSync(file)) {
      try {
        d.prepare('VACUUM INTO ?').run(file);
      } catch (e) {
        fs.rmSync(file, { force: true }); // a half-written copy would block today's retry
        throw e;
      }
    }
    const old = fs.readdirSync(backupDir).filter((f) => /^lomu-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort().slice(0, -KEEP);
    for (const f of old) fs.rmSync(path.join(backupDir, f), { force: true });
  } catch (e) {
    console.error('[lomu] backup failed', e);
  }
}

/** Unix ms of the newest backup, or null when there is none. */
export function lastBackup(): number | null {
  try {
    const t = fs.readdirSync(backupDir).filter((f) => f.endsWith('.db')).map((f) => fs.statSync(path.join(backupDir, f)).mtimeMs);
    return t.length ? Math.max(...t) : null;
  } catch {
    return null;
  }
}

export function db(): DatabaseSync {
  if (g.__lomuDb) return g.__lomuDb;
  fs.mkdirSync(dir, { recursive: true });
  const d = new DatabaseSync(path.join(dir, 'lomu.db'));
  d.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA synchronous = NORMAL;
    CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT NOT NULL);
    -- Legacy single-owner table, kept only so an old database can be migrated into users.
    CREATE TABLE IF NOT EXISTS owner (id INTEGER PRIMARY KEY CHECK (id = 1), username TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL, created INTEGER NOT NULL);
    -- Accounts. The first one is the admin and can add the others.
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE COLLATE NOCASE, salt TEXT NOT NULL, hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user', disabled INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS refresh (hash TEXT PRIMARY KEY, expires INTEGER NOT NULL, device TEXT, uid INTEGER NOT NULL DEFAULT 1);
    -- Last good answer for catalogue pages and recommendations, served when YouTube cannot be reached.
    CREATE TABLE IF NOT EXISTS cache (k TEXT PRIMARY KEY, v TEXT NOT NULL, at INTEGER NOT NULL);
  `);
  migrate(d);
  g.__lomuDb = d;
  backupNow(d);
  setInterval(() => g.__lomuDb && backupNow(g.__lomuDb), 6 * 3600_000).unref(); // 6 h so a server running for days still rolls over at midnight
  return d;
}

export function getSetting(k: string): string | undefined {
  const row = db().prepare('SELECT v FROM settings WHERE k = ?').get(k) as { v: string } | undefined;
  return row?.v;
}
export function setSetting(k: string, v: string) {
  db().prepare('INSERT INTO settings (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').run(k, v);
}

/** Closes the connection (tests, graceful shutdown). */
export function closeDb() {
  g.__lomuDb?.close();
  g.__lomuDb = undefined;
}
