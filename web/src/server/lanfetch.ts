import 'server-only';
import http from 'node:http';
import https from 'node:https';
import { Readable } from 'node:stream';

const REFUSED = /ECONNREFUSED|ECONNRESET|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH|ENOTFOUND|EAI_AGAIN|UND_ERR|fetch failed|network|timeout|aborted/i;

export function isNetworkError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const c = (e as { cause?: { code?: string; message?: string } }).cause;
  return e.name === 'TimeoutError' || e.name === 'AbortError' || REFUSED.test(`${e.message} ${c?.code ?? ''} ${c?.message ?? ''} ${(e as { code?: string }).code ?? ''}`);
}

export function isLanAddress(v: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(v.trim());
  if (!m) return false;
  const [a, b, c, d] = m.slice(1).map(Number);
  if ([a, b, c, d].some((n) => n > 255)) return false;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a === 127;
}

export function viaAddress(address: string, url: string, init: RequestInit = {}): Promise<Response> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const secure = u.protocol === 'https:';
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((v, k) => (headers[k] = v));
    headers.host = u.host;
    const body = init.body == null ? undefined : String(init.body);
    if (body !== undefined) headers['content-length'] = String(Buffer.byteLength(body));
    const req = (secure ? https : http).request(
      {
        host: address,
        port: u.port || (secure ? 443 : 80),
        path: u.pathname + u.search,
        method: init.method ?? 'GET',
        headers,
        ...(secure ? { servername: u.hostname } : {}),
        signal: init.signal ?? undefined,
      },
      (res) => {
        const h = new Headers();
        for (const [k, v] of Object.entries(res.headers)) {
          if (Array.isArray(v)) v.forEach((x) => h.append(k, x));
          else if (v !== undefined) h.set(k, v);
        }
        const status = res.statusCode ?? 502;
        const empty = status === 204 || status === 205 || status === 304;
        if (empty) res.resume();
        resolve(new Response(empty ? null : (Readable.toWeb(res) as unknown as ReadableStream), { status, statusText: res.statusMessage, headers: h }));
      },
    );
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

export function parseAddresses(v: string | null | undefined): string[] {
  return [...new Set(String(v ?? '').split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean))].filter(isLanAddress).slice(0, 4);
}

export function checkAddresses(v: string): { ok: string[]; bad: string[] } {
  const all = String(v ?? '').split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
  return { ok: parseAddresses(v), bad: all.filter((x) => !isLanAddress(x)) };
}

export type Route = 'direct' | 'lan';

const LAN_ATTEMPT_MS = 2500;

export async function reach(
  url: string,
  init: RequestInit,
  opts: { lan?: string | null; preferLan?: boolean; attemptMs?: number; lastGood?: string | null },
): Promise<{ res: Response; route: Route; address: string | null }> {
  let addrs = parseAddresses(opts.lan);
  if (opts.lastGood && addrs.includes(opts.lastGood)) addrs = [opts.lastGood, ...addrs.filter((x) => x !== opts.lastGood)];
  type Step = { route: Route; address: string | null };
  const direct: Step = { route: 'direct', address: null };
  const home: Step[] = addrs.map((address) => ({ route: 'lan', address }));
  const steps: Step[] = opts.preferLan ? [...home, direct] : [direct, ...home];
  let last: unknown;
  for (let i = 0; i < steps.length; i++) {
    const { route, address } = steps[i];
    const final = i === steps.length - 1;
    const ac = new AbortController();
    const outer = init.signal;
    const onAbort = () => ac.abort(outer?.reason);
    if (outer) outer.aborted ? ac.abort(outer.reason) : outer.addEventListener('abort', onAbort, { once: true });
    const budget = route === 'lan' ? Math.min(opts.attemptMs ?? LAN_ATTEMPT_MS, LAN_ATTEMPT_MS) : opts.attemptMs;
    const timer = !final && budget ? setTimeout(() => ac.abort(new DOMException('route timed out', 'TimeoutError')), budget) : null;
    try {
      const attempt = { ...init, signal: ac.signal };
      const res = route === 'lan' ? await viaAddress(address!, url, attempt) : await fetch(url, attempt);
      return { res, route, address };
    } catch (e) {
      last = e;
      outer?.removeEventListener('abort', onAbort);
      if (outer?.aborted || !isNetworkError(e)) throw e;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  throw last;
}
