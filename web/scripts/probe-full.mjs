import vm from 'node:vm';
import { Innertube, Platform, Log } from 'youtubei.js';

Platform.shim.eval = (data) =>
  vm.runInNewContext(`(function(){\n${data.output}\n})()`, { URL, URLSearchParams, TextEncoder, TextDecoder }, { timeout: 5000 });
Log.setLevel(Log.Level.NONE);

const VIDEO = process.argv[2] || 'dQw4w9WgXcQ';
const it = await Innertube.create({ generate_session_locally: false, retrieve_player: true, location: 'IN', lang: 'en' });
for (const client of ['VISIONOS', 'ANDROID_VR', 'TV', 'IOS']) {
  try {
    const info = await it.getBasicInfo(VIDEO, { client });
    const f = (info.streaming_data?.adaptive_formats ?? []).filter((x) => x.has_audio && !x.has_video && x.content_length).sort((a, b) => b.bitrate - a.bitrate)[0];
    const url = await f.decipher(it.session.player);
    const len = Number(f.content_length);
    const CH = 1024 * 1024;
    let ok = 0, bad = '';
    for (let o = 0; o < len; o += CH) {
      const r = await fetch(url, { headers: { range: `bytes=${o}-${Math.min(o + CH - 1, len - 1)}` } });
      const buf = await r.arrayBuffer();
      if (r.status !== 206 && r.status !== 200) { bad = `${r.status} at ${o}`; break; }
      ok += buf.byteLength;
    }
    console.log(client, 'itag', f.itag, 'len', len, 'got', ok, bad || 'COMPLETE');
  } catch (e) {
    console.log(client, 'ERR', String(e.message).slice(0, 100));
  }
}
