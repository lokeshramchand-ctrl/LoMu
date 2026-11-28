import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { parseRange, proxyAudio, type Codec } from './stream';

const dir = () => process.env.LOMU_AUDIO_CACHE_DIR || '';
export const audioCacheEnabled = () => !!dir();
const limitBytes = () => (Number(process.env.LOMU_AUDIO_CACHE_MB) || 2048) * 1024 * 1024;
const MIME: Record<Codec, string> = { opus: 'audio/webm', aac: 'audio/mp4' };

type G = typeof globalThis & { __lomuFilling?: Set<string>; __lomuLastStream?: string };
const g = globalThis as G;
const filling: Set<string> = (g.__lomuFilling ??= new Set());

const file = (id: string, codec: Codec) => path.join(dir(), `${id}.${codec}`);

export function cachedFile(id: string, codec: Codec): string | null {
  if (!audioCacheEnabled() || !/^[\w-]{11}$/.test(id)) return null;
  const f = file(id, codec);
  try {
    if (!fs.statSync(f).isFile()) return null;
    const now = new Date();
    fs.utimesSync(f, now, now);
    return f;
  } catch {
    return null;
  }
}

export function serveFile(f: string, codec: Codec, rangeHeader: string | null): Response {
  const len = fs.statSync(f).size;
  const range = parseRange(rangeHeader, len);
  if (rangeHeader && !range) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${len}` } });
  const start = range?.start ?? 0;
  const end = range?.end ?? len - 1;
  const body = Readable.toWeb(fs.createReadStream(f, { start, end })) as ReadableStream<Uint8Array>;
  const headers = new Headers({
    'content-type': MIME[codec],
    'content-length': String(end - start + 1),
    'accept-ranges': 'bytes',
    'cache-control': 'private, max-age=3600, no-transform',
    'x-lomu-client': 'disk',
    'x-lomu-length': String(len),
  });
  if (range) headers.set('content-range', `bytes ${start}-${end}/${len}`);
  return new Response(body, { status: range ? 206 : 200, headers });
}

export function maybeFill(id: string, codec: Codec) {
  if (!/^[\w-]{11}$/.test(id)) return;
  if (!audioCacheEnabled()) return;
  g.__lomuLastStream = id;
  const key = `${id}.${codec}`;
  if (filling.has(key) || cachedFile(id, codec)) return;
  setTimeout(() => {
    if (g.__lomuLastStream !== id || filling.has(key) || cachedFile(id, codec)) return;
    filling.add(key);
    fill(id, codec)
      .catch((e) => console.error('[audio-cache]', id, e instanceof Error ? e.message : e))
      .finally(() => filling.delete(key));
  }, 12_000);
}

const queue: { id: string; codec: Codec }[] = [];
let workers = 0;

export function download(ids: string[], codec: Codec): number {
  if (!audioCacheEnabled()) return 0;
  let n = 0;
  for (const id of ids.slice(0, 500)) {
    const key = `${id}.${codec}`;
    if (!/^[\w-]{11}$/.test(id) || filling.has(key) || cachedFile(id, codec)) continue;
    filling.add(key);
    queue.push({ id, codec });
    n++;
  }
  while (workers < 2 && workers < queue.length) {
    workers++;
    void drain();
  }
  return n;
}

async function drain() {
  for (let j = queue.shift(); j; j = queue.shift()) {
    await fill(j.id, j.codec)
      .catch((e) => console.error('[audio-cache]', j.id, e instanceof Error ? e.message : e))
      .finally(() => filling.delete(`${j.id}.${j.codec}`));
  }
  workers--;
}

export function savedCount(ids: string[], codec: Codec): number {
  return ids.filter((id) => /^[\w-]{11}$/.test(id) && fs.existsSync(file(id, codec))).length;
}

async function fill(id: string, codec: Codec) {
  fs.mkdirSync(dir(), { recursive: true });
  const part = file(id, codec) + '.part';
  const res = await proxyAudio(id, codec, null, new AbortController().signal);
  if (!res.ok || !res.body) throw new Error(`upstream ${res.status}`);
  const total = Number(res.headers.get('x-lomu-length'));
  await pipeline(Readable.fromWeb(res.body as never), fs.createWriteStream(part));
  if (!total || fs.statSync(part).size !== total) {
    fs.rmSync(part, { force: true });
    throw new Error('incomplete download');
  }
  fs.renameSync(part, file(id, codec));
  evict();
}

function evict() {
  try {
    const entries = fs.readdirSync(dir()).map((n) => {
      const p = path.join(dir(), n);
      const st = fs.statSync(p);
      return { p, n, size: st.size, at: st.mtimeMs };
    });
    for (const e of entries) if (e.n.endsWith('.part') && Date.now() - e.at > 3600_000) fs.rmSync(e.p, { force: true });
    const files = entries.filter((e) => !e.n.endsWith('.part')).sort((a, b) => a.at - b.at);
    let total = files.reduce((s, f) => s + f.size, 0);
    for (const f of files) {
      if (total <= limitBytes()) break;
      fs.rmSync(f.p, { force: true });
      total -= f.size;
    }
  } catch {
  }
}
