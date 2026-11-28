import vm from 'node:vm';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { Innertube, Platform, Log } from 'youtubei.js';

Platform.shim.eval = (data) =>
  vm.runInNewContext(`(function(){\n${data.output}\n})()`, { URL, URLSearchParams, TextEncoder, TextDecoder }, { timeout: 5000 });
Log.setLevel(Log.Level.NONE);

const script = process.argv[2] || 'scripts/po-chromium.mjs';
const VIDEO = process.argv[3] || 'dQw4w9WgXcQ';
const it = await Innertube.create({ generate_session_locally: false, retrieve_player: true, location: 'IN', lang: 'en' });
const visitor = it.session.context.client.visitorData;
console.log('visitor', visitor?.slice(0, 12));

const child = spawn('node', [script], { stdio: ['pipe', 'pipe', 'inherit'] });
const rl = createInterface({ input: child.stdout });
const waiting = new Map();
rl.on('line', (l) => { const m = JSON.parse(l); waiting.get(m.id)?.(m); });
let n = 0;
const call = (msg) => new Promise((res) => { const id = ++n; waiting.set(id, res); child.stdin.write(JSON.stringify({ id, ...msg }) + '\n'); });

const ch = await it.getAttestationChallenge('ENGAGEMENT_TYPE_UNBOUND');
const bg = ch.bg_challenge;
const challenge = {
  program: bg.program,
  globalName: bg.global_name,
  interpreterUrl: bg.interpreter_url?.private_do_not_access_or_else_trusted_resource_url_wrapped_value,
};
console.log('init', await call({ cmd: 'init', challenge, requestKey: 'O43z0dpjhgX20SCx4KAo' }));
const sess = await call({ cmd: 'mint', binding: visitor });
console.log('session token', sess.ok, sess.token?.length, sess.error);

const content = await call({ cmd: 'mint', binding: VIDEO });
for (const client of ['MWEB', 'YTMUSIC', 'IOS', 'WEB']) {
  for (const mode of ['none', 'content-in-player', 'session-in-player']) {
    try {
      const opts = { client };
      if (mode === 'content-in-player') opts.po_token = content.token;
      if (mode === 'session-in-player') opts.po_token = sess.token;
      const info = await it.getBasicInfo(VIDEO, opts);
      const f = (info.streaming_data?.adaptive_formats ?? []).filter((x) => x.has_audio && !x.has_video).sort((a, b) => b.bitrate - a.bitrate)[0];
      if (!f) { console.log(client, mode, 'no formats', info.playability_status?.status); continue; }
      const url = await f.decipher(it.session.player);
      const hasPot = new URL(url).searchParams.has('pot');
      const variants = [
        ['hdr', url, { range: 'bytes=2000000-2001000' }],
        ['urlrange', `${url}&range=2000000-2001000`, {}],
        ['hdr+sess', `${url}&pot=${encodeURIComponent(sess.token)}`, { range: 'bytes=2000000-2001000' }],
        ['urlrange+sess', `${url}&pot=${encodeURIComponent(sess.token)}&range=2000000-2001000`, {}],
      ];
      const out = [];
      for (const [label, u, h] of variants) {
        const r = await fetch(u, { headers: h });
        out.push(label + '=' + r.status);
        await r.body?.cancel();
      }
      console.log(client, f.itag, mode, 'urlHasPot=' + hasPot, out.join(' '));
    } catch (e) {
      console.log(client, mode, 'ERR', String(e.message).slice(0, 100));
    }
  }
}
child.stdin.end();
