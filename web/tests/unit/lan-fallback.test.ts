import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

/* The home server's public name does not work from inside the LAN (no NAT loopback, or Cloudflare WARP tunnelling the
   connection out and back). The clients then connect to the server's LAN address but keep speaking to the public name.
   Here the "public name" is a .invalid host (never resolves) and the "LAN address" is 127.0.0.1. */

const NAME = 'lomu.invalid';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lomu-lan-test-'));
let port = 0;
let srv: http.Server;
let blackhole: net.Server;
const seenHosts: string[] = [];
const docs: unknown[] = [];

let lan: typeof import('@/server/lanfetch');
let hub: typeof import('@/server/hub');

beforeAll(async () => {
  process.env.LOMU_DATA_DIR = dir;
  process.env.LOMU_LOCAL_TOKEN = 'test';
  srv = http.createServer((req, res) => {
    seenHosts.push(String(req.headers.host));
    const url = new URL(req.url!, 'http://x');
    const send = (code: number, o: unknown) => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(o));
    };
    if (url.pathname === '/boom') return send(500, { error: 'server error' });
    if (url.pathname === '/echo') {
      let b = '';
      req.on('data', (c) => (b += c));
      return req.on('end', () => send(200, { method: req.method, body: b, ct: req.headers['content-type'] }));
    }
    if (url.pathname === '/stream') {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write('event: hi\ndata: 1\n\n');
      res.on('close', () => seenHosts.push('stream-closed'));
      return;
    }
    if (url.pathname === '/api/auth/login') return send(200, { access: 'a', refresh: 'r' });
    if (url.pathname === '/api/auth/status') return send(200, { user: 'me', lan: '127.0.0.1' });
    if (req.headers.authorization !== 'Bearer a') return send(401, { error: 'unauthorized' });
    if (url.pathname === '/api/sync' && req.method === 'GET') return send(200, { seq: 0, docs: [] });
    if (url.pathname === '/api/sync' && req.method === 'POST') {
      let b = '';
      req.on('data', (c) => (b += c));
      return req.on('end', () => {
        docs.push(...JSON.parse(b).docs);
        send(200, { seq: docs.length, applied: JSON.parse(b).docs.length });
      });
    }
    send(404, {});
  });
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  port = (srv.address() as AddressInfo).port;
  // accepts connections and never answers: what a blocked/hairpinned route looks like
  // Same port on 127.0.0.2, so "direct" (127.0.0.2) hangs while the LAN address (127.0.0.1) works.
  blackhole = net.createServer(() => {});
  await new Promise<void>((r) => blackhole.listen(port, '127.0.0.2', r));
  lan = await import('@/server/lanfetch');
  hub = await import('@/server/hub');
});
afterAll(async () => {
  hub.disconnectHub();
  srv.closeAllConnections();
  blackhole.close();
  srv.close();
  (await import('@/server/db')).closeDb();
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
});

describe('lan address check', () => {
  it('accepts only private IPv4 addresses', () => {
    for (const ok of ['192.168.1.17', '10.0.0.5', '172.16.4.2', '172.31.255.1', '100.64.1.1', '127.0.0.1']) expect(lan.isLanAddress(ok), ok).toBe(true);
    for (const bad of ['8.8.8.8', '163.223.190.197', '172.32.0.1', '192.169.1.1', '256.1.1.1', 'example.com', '', '192.168.1', '192.168.1.1:80', '192.168.1.1/x']) expect(lan.isLanAddress(bad), bad).toBe(false);
  });
});

describe('reach', () => {
  it('falls back to the LAN address when the public name does not resolve, keeping the Host header', async () => {
    seenHosts.length = 0;
    const { res, route } = await lan.reach(`http://${NAME}:${port}/echo`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"a":1}' }, { lan: '127.0.0.1' });
    expect(route).toBe('lan');
    expect(await res.json()).toEqual({ method: 'POST', body: '{"a":1}', ct: 'application/json' });
    expect(seenHosts).toEqual([`${NAME}:${port}`]); // the server still sees the public name
  });

  it('uses the direct route when it works, and does not touch the LAN one', async () => {
    const { route, res } = await lan.reach(`http://127.0.0.1:${port}/echo`, {}, { lan: '10.255.255.1' });
    expect(route).toBe('direct');
    expect(res.status).toBe(200);
  });

  it('fails over from a route that connects but never answers', async () => {
    const t = Date.now();
    const { res, route } = await lan.reach(`http://127.0.0.2:${port}/echo`, {}, { lan: '127.0.0.1', attemptMs: 300 });
    expect(route).toBe('lan');
    expect(res.status).toBe(200);
    expect(Date.now() - t).toBeLessThan(3000);
  });

  it('without a fallback, a hung route is bounded by the caller signal', async () => {
    const t = Date.now();
    await expect(lan.reach(`http://127.0.0.2:${port}/echo`, { signal: AbortSignal.timeout(300) }, {})).rejects.toBeTruthy();
    expect(Date.now() - t).toBeLessThan(3000);
  });

  it('does not fail over on a real HTTP error: a 500 is an answer', async () => {
    const { res, route } = await lan.reach(`http://127.0.0.1:${port}/boom`, {}, { lan: '127.0.0.1' });
    expect(res.status).toBe(500);
    expect(route).toBe('direct');
  });

  it('prefers the LAN first once it has proved to be the way in', async () => {
    const { route } = await lan.reach(`http://127.0.0.1:${port}/echo`, {}, { lan: '127.0.0.1', preferLan: true });
    expect(route).toBe('lan');
  });

  it('ignores a non-LAN fallback address (never connects to an arbitrary host)', async () => {
    await expect(lan.reach(`http://${NAME}:${port}/echo`, {}, { lan: '8.8.8.8' })).rejects.toBeTruthy();
  });

  it('streams through the LAN route and closes the upstream when the caller aborts', async () => {
    seenHosts.length = 0;
    const ac = new AbortController();
    const { res, route } = await lan.reach(`http://${NAME}:${port}/stream`, { signal: ac.signal }, { lan: '127.0.0.1' });
    expect(route).toBe('lan');
    const reader = res.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain('event: hi');
    ac.abort();
    await reader.read().catch(() => {});
    await new Promise((r) => setTimeout(r, 200));
    expect(seenHosts).toContain('stream-closed');
  });

  it('parses a list of home addresses and rejects anything that is not private', () => {
    expect(lan.parseAddresses('10.10.10.136, 192.168.1.17')).toEqual(['10.10.10.136', '192.168.1.17']);
    expect(lan.parseAddresses('10.10.10.136;8.8.8.8  10.10.10.136 192.168.1.17')).toEqual(['10.10.10.136', '192.168.1.17']);
    expect(lan.parseAddresses('1.1.1.1')).toEqual([]);
    expect(lan.parseAddresses(null)).toEqual([]);
    expect(lan.parseAddresses('10.0.0.1,10.0.0.2,10.0.0.3,10.0.0.4,10.0.0.5')).toHaveLength(4);
    expect(lan.checkAddresses('10.10.10.136, nope, 8.8.8.8')).toEqual({ ok: ['10.10.10.136'], bad: ['nope', '8.8.8.8'] });
  });

  it('tries home addresses in order, skipping one that does not answer, and reports which worked', async () => {
    const t = Date.now();
    // 127.0.0.2 hangs (black hole), 127.0.0.1 answers
    const { res, route, address } = await lan.reach(`http://${NAME}:${port}/echo`, {}, { lan: '127.0.0.2, 127.0.0.1', attemptMs: 300 });
    expect(route).toBe('lan');
    expect(address).toBe('127.0.0.1');
    expect(res.status).toBe(200);
    expect(Date.now() - t).toBeLessThan(3000);
  });

  it('goes straight to the address that worked last time', async () => {
    const t = Date.now();
    const { address } = await lan.reach(`http://${NAME}:${port}/echo`, {}, { lan: '127.0.0.2, 127.0.0.1', preferLan: true, lastGood: '127.0.0.1', attemptMs: 2000 });
    expect(address).toBe('127.0.0.1');
    expect(Date.now() - t).toBeLessThan(1000); // did not wait on the black hole first
  });

  it('classifies network failures but not other errors', () => {
    expect(lan.isNetworkError(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } }))).toBe(true);
    expect(lan.isNetworkError(new DOMException('x', 'TimeoutError'))).toBe(true);
    expect(lan.isNetworkError(new Error('JSON parse failed'))).toBe(false);
    expect(lan.isNetworkError('nope')).toBe(false);
  });
});

describe('desktop hub over the LAN route', () => {
  it('signs in and syncs when only the LAN address works, and reports the route', async () => {
    docs.length = 0;
    await hub.connectHub(`http://${NAME}:${port}`, 'me', 'secret password', '127.0.0.1');
    const sync = await import('@/server/sync');
    sync.push(1, [{ kind: 'like', key: 'k', value: { x: 1 }, updated: 5 }]);
    await hub.syncHub();
    const st = hub.hubStatus();
    expect(st.state).toBe('online');
    expect(st.lan).toBe('127.0.0.1');
    expect(st.route).toBe('lan');
    expect(docs).toHaveLength(1);
  });

  it('rejects a public address as the home network address', () => {
    expect(() => hub.setHubLan('8.8.8.8')).toThrow(/home network/);
    expect(() => hub.setHubLan('10.10.10.136, 8.8.8.8')).toThrow(/8\.8\.8\.8/);
    hub.setHubLan('10.10.10.136, 192.168.1.17');
    expect(hub.hubStatus().lan).toBe('10.10.10.136,192.168.1.17');
    expect(() => hub.setHubLan('')).not.toThrow();
  });

  it('a wrong LAN address does not break a server that is reachable by name', async () => {
    hub.disconnectHub();
    await hub.connectHub(`http://127.0.0.1:${port}`, 'me', 'secret password', '10.255.255.1');
    await hub.syncHub();
    expect(hub.hubStatus().state).toBe('online');
    expect(hub.hubStatus().route).toBe('direct');
  });

  it('learns the LAN address from the server when none was set', async () => {
    hub.disconnectHub();
    await hub.connectHub(`http://127.0.0.1:${port}`, 'me', 'secret password');
    await new Promise((r) => setTimeout(r, 300));
    expect(hub.hubStatus().lan).toBe('127.0.0.1');
  });
});
