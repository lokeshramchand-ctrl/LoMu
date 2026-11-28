import 'server-only';
import { resetYt, yt } from './yt';

/* eslint-disable @typescript-eslint/no-explicit-any */

export type Codec = 'opus' | 'aac';
export type Resolved = {
  url: string;
  mime: string;
  bitrate: number;
  itag: number;
  length: number;
  client: string;
  expiresAt: number;
};

const CLIENTS = ['VISIONOS', 'ANDROID_VR', 'IOS', 'YTMUSIC', 'MWEB'] as const;

const CHUNK = 1024 * 1024;

const cache: Map<string, Resolved> = ((globalThis as any).__lomuStreams ??= new Map());
const inflight: Map<string, Promise<Resolved>> = ((globalThis as any).__lomuStreamsInflight ??= new Map());
const flagged: Map<string, number> = ((globalThis as any).__lomuFlagged ??= new Map());

export function invalidate(id: string, codec: Codec) {
  cache.delete(`${id}:${codec}`);
}

export async function resolveAudio(id: string, codec: Codec, opts: { skip?: string[]; itag?: number } = {}): Promise<Resolved> {
  if (!/^[\w-]{11}$/.test(id)) throw new Error('bad video id');
  const skip = opts.skip ?? [];
  const key = `${id}:${codec}`;
  const hit = cache.get(key);
  if (hit && hit.expiresAt - Date.now() > 5 * 60_000 && !skip.includes(hit.client) && (!opts.itag || hit.itag === opts.itag)) return hit;
  const pending = inflight.get(key);
  if (pending && !skip.length && !opts.itag) return pending;

  const job = (async () => {
    const errors: string[] = [];
    const order = [...CLIENTS].sort((a, b) => (flagged.get(a) ?? 0) > Date.now() ? 1 : (flagged.get(b) ?? 0) > Date.now() ? -1 : 0);
    for (const client of order) {
      if (skip.includes(client)) continue;
      try {
        const r = await tryClient(id, codec, client, opts.itag);
        flagged.delete(client);
        cache.set(key, r);
        return r;
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        if (/not a bot|LOGIN_REQUIRED/i.test(msg)) flagged.set(client, Date.now() + 30 * 60_000);
        errors.push(`${client}: ${msg.slice(0, 80)}`);
      }
    }
    resetYt();
    throw new Error(`No playable stream (${errors.join('; ')})`);
  })();
  if (!skip.length && !opts.itag) inflight.set(key, job);
  try {
    return await job;
  } finally {
    inflight.delete(key);
  }
}

async function tryClient(id: string, codec: Codec, client: string, itag?: number): Promise<Resolved> {
  const it = await yt();
  const info: any = await it.getBasicInfo(id, { client: client as any });
  const status = info.playability_status?.status;
  if (status && status !== 'OK') throw new Error(`${status}: ${info.playability_status?.reason ?? ''}`);
  let audio: any[] = (info.streaming_data?.adaptive_formats ?? []).filter((f: any) => f.has_audio && !f.has_video && f.content_length);
  if (itag) audio = audio.filter((f) => f.itag === itag);
  if (!audio.length) throw new Error(itag ? `itag ${itag} unavailable` : 'no audio formats');
  const want = codec === 'opus' ? 'audio/webm' : 'audio/mp4';
  const f = [...audio].sort((a, b) => {
    const pa = a.mime_type?.startsWith(want) ? 1 : 0;
    const pb = b.mime_type?.startsWith(want) ? 1 : 0;
    if (pa !== pb) return pb - pa;
    const da = a.is_drc ? 1 : 0;
    const db = b.is_drc ? 1 : 0;
    if (da !== db) return da - db;
    return (b.bitrate ?? 0) - (a.bitrate ?? 0);
  })[0];
  const url: string = await f.decipher(it.session.player);
  if (!url) throw new Error('decipher failed');
  const len = Number(f.content_length);
  await Promise.all(
    ['bytes=0-1', `bytes=${Math.max(0, len - 2)}-${len - 1}`].map(async (range) => {
      const probe = await fetch(url, { headers: { range }, signal: AbortSignal.timeout(8000) });
      await probe.body?.cancel().catch(() => {});
      if (probe.status !== 206 && probe.status !== 200) throw new Error(`googlevideo ${probe.status} (${range})`);
    }),
  );
  const expire = Number(new URL(url).searchParams.get('expire')) * 1000 || Date.now() + 5 * 3600_000;
  return {
    url,
    mime: String(f.mime_type).split(';')[0],
    bitrate: f.bitrate ?? 0,
    itag: f.itag,
    length: Number(f.content_length),
    client,
    expiresAt: expire,
  };
}

export async function warmAudio(id: string, codec: Codec): Promise<void> {
  await resolveAudio(id, codec);
}

export function parseRange(h: string | null, len: number): { start: number; end: number } | null {
  if (!h) return null;
  const m = /bytes=(\d*)-(\d*)/.exec(h);
  if (!m) return null;
  let start = m[1] ? Number(m[1]) : NaN;
  let end = m[2] ? Number(m[2]) : len - 1;
  if (Number.isNaN(start)) {
    start = Math.max(0, len - end);
    end = len - 1;
  }
  end = Math.min(end, len - 1);
  if (start > end || start >= len) return null;
  return { start, end };
}

async function fetchChunk(r: Resolved, a: number, b: number, signal: AbortSignal): Promise<Response> {
  return fetch(r.url, { headers: { range: `bytes=${a}-${b}`, accept: '*/*' }, signal });
}

export async function proxyAudio(id: string, codec: Codec, rangeHeader: string | null, signal: AbortSignal): Promise<Response> {
  let r = await resolveAudio(id, codec);
  const len = r.length;
  const range = parseRange(rangeHeader, len);
  if (rangeHeader && !range) {
    return new Response(null, { status: 416, headers: { 'content-range': `bytes */${len}` } });
  }
  const start = range?.start ?? 0;
  const end = range?.end ?? len - 1;
  const tried: string[] = [];

  let offset = start;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let chunkEnd = -1;

  async function openChunk(): Promise<ReadableStreamDefaultReader<Uint8Array> | Uint8Array | null> {
    const b = Math.min(offset + CHUNK - 1, end);
    for (let attempt = 0; attempt < 4; attempt++) {
      let res: Response;
      try {
        res = await fetchChunk(r, offset, b, signal);
      } catch (e) {
        if (signal.aborted) return null;
        if (attempt === 3) throw e;
        continue;
      }
      if (res.status === 206 && res.body) {
        chunkEnd = b;
        return res.body.getReader();
      }
      if (res.status === 200) {
        const buf = new Uint8Array(await res.arrayBuffer());
        chunkEnd = b;
        return buf.subarray(offset, b + 1);
      }
      await res.body?.cancel().catch(() => {});
      tried.push(r.client);
      invalidate(id, codec);
      r = await resolveAudio(id, codec, { skip: tried, itag: r.itag });
    }
    throw new Error('upstream kept failing');
  }

  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (offset > end) return controller.close();
        if (!reader) {
          const opened = await openChunk();
          if (!opened) return controller.close();
          if (opened instanceof Uint8Array) {
            controller.enqueue(opened);
            offset += opened.byteLength;
            return;
          }
          reader = opened;
        }
        const { done, value } = await reader.read();
        if (done) {
          reader = null;
          if (offset <= chunkEnd) throw new Error('upstream ended early');
          return;
        }
        controller.enqueue(value);
        offset += value.byteLength;
      } catch (e) {
        if (signal.aborted) return controller.close();
        controller.error(e);
      }
    },
    cancel() {
      offset = end + 1;
      reader?.cancel().catch(() => {});
    },
  });

  const headers = new Headers({
    'content-type': r.mime,
    'content-length': String(end - start + 1),
    'accept-ranges': 'bytes',
    'cache-control': 'private, max-age=3600, no-transform',
    'x-lomu-client': r.client,
    'x-lomu-itag': String(r.itag),
    'x-lomu-length': String(len),
  });
  if (range) headers.set('content-range', `bytes ${start}-${end}/${len}`);
  return new Response(body, { status: range ? 206 : 200, headers });
}
