import https from 'node:https';
import dns from 'node:dns';

const url = new URL(process.argv[2] ?? 'https://lomu.deploy-ui.lokeshrc.me');
const addrs = process.argv.length > 3 ? process.argv.slice(3) : ['10.10.10.136', '192.168.1.17'];

const probe = (host, label, path = '/api/health') =>
  new Promise((resolve) => {
    const t0 = Date.now();
    const req = https.request(
      { host, port: url.port || 443, path, method: 'GET', servername: url.hostname, headers: { host: url.host }, timeout: 5000 },
      (res) => {
        let b = '';
        res.on('data', (c) => (b += c));
        res.on('end', async () => {
          if (res.statusCode === 404 && path === '/api/health') {
            const r = await probe(host, label, '/api/auth/status');
            return resolve({ ...r, note: r.ok ? 'reachable (server build is older than /api/health)' : r.note });
          }
          let j = {};
          try {
            j = JSON.parse(b);
          } catch {
          }
          resolve({ label, ok: res.statusCode === 200 && (path === '/api/auth/status' || j.ok === true), ms: Date.now() - t0, note: res.statusCode === 200 ? `v${j.version ?? '?'} db ${j.db ?? '?'}` : `HTTP ${res.statusCode}${res.statusCode === 404 ? '' : ''}` });
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error('timed out (5 s)')));
    req.on('error', (e) => resolve({ label, ok: false, ms: Date.now() - t0, note: e.code ?? e.message }));
    req.end();
  });

const resolved = await dns.promises.lookup(url.hostname, { all: true }).catch(() => []);
console.log(`name ${url.hostname} resolves to: ${resolved.map((r) => r.address).join(', ') || '(does not resolve)'}\n`);

const results = [];
results.push(await probe(resolved[0]?.address ?? url.hostname, `public name (${resolved[0]?.address ?? 'no dns'})`));
for (const a of addrs) results.push(await probe(a, `home address ${a}`));

for (const r of results) console.log(`${r.ok ? 'OK  ' : 'FAIL'}  ${r.label.padEnd(36)} ${String(r.ms).padStart(5)} ms  ${r.note}`);

const home = results.slice(1).filter((r) => r.ok);
console.log('');
if (results[0].ok && home.length) console.log('Everything works. The apps will use the public name, with the home address(es) as backup.');
else if (!results[0].ok && home.length) console.log(`The public name does not work from here but ${home.length} home address(es) do: this is the same-network problem, and the apps will use the home address.`);
else if (results[0].ok) console.log('The public name works. No home address answered from this device (normal away from home, or if the address is wrong).');
else console.log('Nothing answered. Check the server is running (Coolify) and that this device is on the home network.');
process.exit(results.some((r) => r.ok) ? 0 : 1);
