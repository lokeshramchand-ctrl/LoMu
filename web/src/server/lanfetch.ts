import 'server-only';
import http from 'node:http';
import https from 'node:https';
import { Readable } from 'node:stream';

/* Reaching the home server from inside the home network.

   The server's public name resolves to the router's public address. From a device on the same network that path is
   often broken: many routers cannot loop a connection back in (no "NAT loopback"), and with Cloudflare WARP on, the
   connection is tunnelled out and has to come back in from the internet. The server is however reachable on its
   private LAN address, and its certificate is for the public name, so the fix is to connect to the LAN address while
   still speaking to the public *name* (TLS server name and Host header unchanged). That is what [viaAddress] does. */

const REFUSED = /ECONNREFUSED|ECONNRESET|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH|ENOTFOUND|EAI_AGAIN|UND_ERR|fetch failed|network|timeout|aborted/i;

/** True for "could not reach it" failures, as opposed to the server answering with an error. */
export function isNetworkError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const c = (e as { cause?: { code?: string; message?: string } }).cause;
  return e.name === 'TimeoutError' || e.name === 'AbortError' || REFUSED.test(`${e.message} ${c?.code ?? ''} ${c?.message ?? ''} ${(e as { code?: string }).code ?? ''}`);
}

/** Only a private (LAN) IPv4 address is accepted as a fallback target: never an arbitrary host. */
export function isLanAddress(v: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(v.trim());
  if (!m) return false;
  const [a, b, c, d] = m.slice(1).map(Number);
  if ([a, b, c, d].some((n) => n > 255)) return false;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a === 127;
}

/** Same as fetch(url, init), but opens the connection to [address] (keeping the URL's host name for TLS and Host). */
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

/** Splits "10.10.10.136, 192.168.1.17" into the valid private addresses (at most 4, no duplicates, order kept). */
export function parseAddresses(v: string | null | undefined): string[] {
  return [...new Set(String(v ?? '').split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean))].filter(isLanAddress).slice(0, 4);
}

/** Like [parseAddresses] but reports what was wrong, for a settings form. */
export function checkAddresses(v: string): { ok: string[]; bad: string[] } {
  const all = String(v ?? '').split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
  return { ok: parseAddresses(v), bad: all.filter((x) => !isLanAddress(x)) };
}

export type Route = 'direct' | 'lan';

const LAN_ATTEMPT_MS = 2500; // a home address either answers at once or is not reachable from here

/**
 * Tries the routes in order and returns the first that connects (any HTTP answer counts as "connected"). The routes are
 * the public name ("direct") and each home address in turn. [attemptMs] bounds only the time to get response headers on
 * every route but the last, so a black-holed route fails over quickly; the final route and long-lived streams are bounded
 * by the caller's own signal. [lastGood] is the home address that worked last time: it goes first among the home addresses.
 */
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
      return { res, route, address }; // the caller's abort still reaches a long-lived stream through ac
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
