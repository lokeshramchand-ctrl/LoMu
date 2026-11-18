import 'server-only';
import vm from 'node:vm';
import os from 'node:os';
import path from 'node:path';
import { Innertube, Platform, Log, UniversalCache } from 'youtubei.js';

// youtubei.js needs a JS runtime to run YouTube's stream-URL transform. It is
// evaluated in an isolated vm context with a hard timeout so player code never
// touches this process's globals.
Platform.shim.eval = (data) =>
  vm.runInNewContext(
    `(function(){\n${data.output}\n})()`,
    { URL, URLSearchParams, TextEncoder, TextDecoder },
    { timeout: 5000 },
  );

Log.setLevel(Log.Level.NONE);

type G = typeof globalThis & { __lomuYt?: Promise<Innertube>; __lomuYtAt?: number };
const g = globalThis as G;
const SESSION_TTL = 6 * 60 * 60 * 1000; // refresh the player/session a few times a day

async function create(): Promise<Innertube> {
  return Innertube.create({
    generate_session_locally: false, // a YouTube-issued visitor id is far less likely to be bot-flagged
    retrieve_player: true,
    location: process.env.LOMU_REGION || 'IN',
    lang: 'en',
    // Outside the project tree: writes inside it would retrigger the dev bundler.
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

/** Forces a fresh session on the next call (used after stream failures). */
export function resetYt() {
  g.__lomuYt = undefined;
  g.__lomuYtAt = 0;
}

// Small in-memory TTL cache for catalogue pages.
type Entry = { at: number; ttl: number; value: unknown };
const memo: Map<string, Entry> = ((globalThis as any).__lomuMemo ??= new Map());

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value as T;
  const value = await fn();
  memo.set(key, { at: Date.now(), ttl: ttlMs, value });
  if (memo.size > 800) {
    const oldest = [...memo.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 200);
    for (const [k] of oldest) memo.delete(k);
  }
  return value;
}
