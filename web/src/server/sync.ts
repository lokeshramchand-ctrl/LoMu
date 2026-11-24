import 'server-only';
import { EventEmitter } from 'node:events';
import { db } from './db';

/* Document sync, per account. Every synced object ("doc") is (kind, key) -> JSON value, last write wins by the
   client-supplied `updated` timestamp. Each accepted write gets the account's next `seq`; clients ask for
   everything above the seq they last saw, so a sync is incremental. Deletes are tombstones. Accounts never see
   each other's documents: every query below is scoped by `uid`. */

export type Doc = { kind: string; key: string; value: unknown | null; updated: number; deleted?: boolean };
export type Row = { kind: string; key: string; value: unknown | null; updated: number; deleted: boolean; seq: number };

const KINDS = new Set(['like', 'playlist', 'saved', 'play', 'search', 'queue', 'block']);
/** Per-account ceiling, so one runaway client cannot fill the disk for everybody. */
const MAX_DOCS = () => Number(process.env.LOMU_MAX_DOCS) || 300_000;

type G = typeof globalThis & { __lomuBus?: EventEmitter };
const bus: EventEmitter = ((globalThis as G).__lomuBus ??= new EventEmitter());
bus.setMaxListeners(200);
/** Calls `fn` whenever documents of account `uid` change. */
export const onChange = (uid: number, fn: (seq: number) => void) => {
  const h = (u: number, seq: number) => {
    if (u === uid) fn(seq);
  };
  bus.on('seq', h);
  return () => bus.off('seq', h);
};

export function currentSeq(uid: number): number {
  const r = db().prepare('SELECT COALESCE(MAX(seq), 0) AS s FROM docs WHERE uid = ?').get(uid) as { s: number };
  return r.s;
}

export function pull(uid: number, since: number, limit = 2000): { seq: number; docs: Row[] } {
  const rows = db()
    .prepare('SELECT kind, key, value, updated, deleted, seq FROM docs WHERE uid = ? AND seq > ? ORDER BY seq LIMIT ?')
    .all(uid, since, limit) as { kind: string; key: string; value: string | null; updated: number; deleted: number; seq: number }[];
  const docs = rows.map((r) => ({ ...r, deleted: !!r.deleted, value: r.value ? JSON.parse(r.value) : null }));
  return { seq: docs.length ? docs[docs.length - 1].seq : since, docs };
}

function write(uid: number, docs: Doc[], remote: boolean): { before: number; seq: number; applied: number } {
  const d = db();
  const before = currentSeq(uid);
  let seq = before;
  let applied = 0;
  const get = d.prepare('SELECT updated, value, deleted FROM docs WHERE uid = ? AND kind = ? AND key = ?');
  const put = d.prepare(
    `INSERT INTO docs (uid, kind, key, value, updated, deleted, seq) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(uid, kind, key) DO UPDATE SET value = excluded.value, updated = excluded.updated, deleted = excluded.deleted, seq = excluded.seq`,
  );
  let room = Infinity;
  d.exec('BEGIN');
  try {
    room = MAX_DOCS() - (d.prepare('SELECT COUNT(*) AS n FROM docs WHERE uid = ?').get(uid) as { n: number }).n;
    for (const doc of docs.slice(0, 5000)) {
      if (!KINDS.has(doc.kind) || typeof doc.key !== 'string' || !doc.key || doc.key.length > 200) continue;
      // Hub pulls use "equal timestamp = already known"; client pushes use "equal timestamp, same content = no-op".
      const updated = remote ? Number(doc.updated) || 0 : Number(doc.updated) || Date.now();
      const cur = get.get(uid, doc.kind, doc.key) as { updated: number; value: string | null; deleted: number } | undefined;
      if (cur && (remote ? cur.updated >= updated : cur.updated > updated)) continue; // a newer write already won
      const json = doc.deleted || doc.value == null ? null : JSON.stringify(doc.value);
      if (json && json.length > 200_000) continue;
      const del = doc.deleted || json === null ? 1 : 0;
      // A client that re-offers its whole library (every start-up does) must not re-stamp documents that did not
      // change: that would make every other device pull the whole log again.
      if (cur && cur.updated === updated && cur.value === json && cur.deleted === del) continue;
      if (!cur) {
        if (room <= 0) continue; // over the account's quota: new documents are refused, edits still go through
        room--;
      }
      put.run(uid, doc.kind, doc.key, json, updated, del, ++seq);
      applied++;
    }
    d.exec('COMMIT');
  } catch (e) {
    d.exec('ROLLBACK');
    throw e;
  }
  if (applied) bus.emit('seq', uid, seq);
  return { before, seq, applied };
}

export function push(uid: number, docs: Doc[]): { seq: number; applied: number } {
  const { seq, applied } = write(uid, docs, false);
  return { seq, applied };
}

/**
 * Applies documents that came from another server (the sync hub). Same last-write-wins rule as [push], but an
 * equal timestamp counts as already known, so a write that bounces back is not applied twice.
 * Returns the local seq before and after, so the caller can tell its own bookkeeping apart from new local edits.
 */
export function applyRemote(uid: number, rows: Doc[]): { before: number; after: number; applied: number } {
  const { before, seq, applied } = write(uid, rows, true);
  return { before, after: seq, applied };
}

/** All live docs of a kind (used by the recommendation engine). */
export function all(uid: number, kind: string, limit = 5000): { key: string; value: any; updated: number }[] {
  return (db()
    .prepare('SELECT key, value, updated FROM docs WHERE uid = ? AND kind = ? AND deleted = 0 ORDER BY updated DESC LIMIT ?')
    .all(uid, kind, limit) as { key: string; value: string; updated: number }[]).map((r) => ({ ...r, value: JSON.parse(r.value) }));
}
