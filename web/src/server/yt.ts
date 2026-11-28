import 'server-only';
import vm from 'node:vm';
import os from 'node:os';
import path from 'node:path';
import { Innertube, Platform, Log, UniversalCache } from 'youtubei.js';
import { db } from './db';

Platform.shim.eval = (data) =>
  vm.runInNewContext(
    `(function(){\n${data.output}\n})()`,
    { URL, URLSearchParams, TextEncoder, TextDecoder },
    { timeout: 5000 },
  );

Log.setLevel(Log.Level.NONE);

type G = typeof globalThis & { __lomuYt?: Promise<Innertube>; __lomuYtAt?: number };
const g = globalThis as G;
const SESSION_TTL = 6 * 60 * 60 * 1000;

async function create(): Promise<Innertube> {
  return Innertube.create({
    generate_session_locally: false,
    retrieve_player: true,
    location: process.env.LOMU_REGION || 'IN',
    lang: 'en',
    cache: new UniversalCache(true, process.env.LOMU_CACHE_DIR || path.join(os.tmpdir(), 'lomu-yt-cache')),
  });
}

export function yt(): Promise<Innertube> {
  const stale = !g.__lomuYtAt || Date.now() - g.__lomuYtAt > SESSION_TTL;
  if (!g.__lomuYt || stale) {
    g.__lomuYtAt = Date.now();
    g.__lomuYt = create().catch((e) => {
      g.__lomuYt = undefined;
      throw e;
    });
  }
  return g.__lomuYt;
}

export function resetYt() {
  g.__lomuYt = undefined;
  g.__lomuYtAt = 0;
}

type Entry = { at: number; ttl: number; value: unknown };
const memo: Map<string, Entry> = ((globalThis as any).__lomuMemo ??= new Map());

const inflight: Map<string, Promise<unknown>> = ((globalThis as any).__lomuInflight ??= new Map());

export function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return Promise.resolve(hit.value as T);
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const p = load(key, ttlMs, fn).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

async function load<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  let value: T;
  try {
    value = await fn();
  } catch (e) {
    const old = readStale<T>(key);
    if (old !== undefined) return old;
    throw e;
  }
  writeStale(key, value);
  memo.set(key, { at: Date.now(), ttl: ttlMs, value });
  if (memo.size > 800) {
    const oldest = [...memo.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 200);
    for (const [k] of oldest) memo.delete(k);
  }
  return value;
}

export function readStale<T>(key: string): T | undefined {
  try {
    const row = db().prepare('SELECT v FROM cache WHERE k = ?').get(key) as { v: string } | undefined;
    return row ? (JSON.parse(row.v) as T) : undefined;
  } catch {
    return undefined;
  }
}

let writes = 0;
export function writeStale(key: string, value: unknown) {
  try {
    const json = JSON.stringify(value);
    if (!json || json.length > 2_000_000) return;
    const d = db();
    d.prepare('INSERT INTO cache (k, v, at) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, at = excluded.at').run(key, json, Date.now());
    if (++writes % 200 === 0) {
      d.prepare('DELETE FROM cache WHERE at < ?').run(Date.now() - 30 * 86400_000);
      d.prepare('DELETE FROM cache WHERE k NOT IN (SELECT k FROM cache ORDER BY at DESC LIMIT 3000)').run();
    }
  } catch {
  }
}
