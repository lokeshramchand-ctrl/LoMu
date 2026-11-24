/* Sends the Spotify listening history to a LoMu server as ordinary plays, using the matches that spotify-resolve.mts
   found. Plays join the same log as everything else, so the engine and every device see one history.
   From web/:  LOMU_PW=... node --experimental-strip-types --no-warnings scripts/spotify-import.mts [dry]
   Env: LOMU_USER (default admin), LOMU_HOST (public name), LOMU_LAN (home address to connect to instead). */
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { readSpotify, trackKey, type SpotifyPlay } from '../src/lib/spotify.ts';

const DIR = path.resolve(process.cwd(), '../Spotify');
const HOST = process.env.LOMU_HOST || 'lomu.example.com';
const LAN = process.env.LOMU_LAN || '192.168.1.20';
const dry = process.argv[2] === 'dry';

type Hit = { id: string; title: string; artists: string[]; duration?: number; album?: string } | null;
const resolved: Record<string, Hit> = JSON.parse(fs.readFileSync(path.join(DIR, 'resolved.json'), 'utf8'));
const { plays } = readSpotify(DIR);

// Small set (the default, kept light for the phone): songs listened to MIN_REAL+ times, at most PER_SONG of their most
// recent real plays each. That keeps "played 3+ times", recency and who the favourite artists are, in a fraction of the rows.
// Pass `full` to send every matched play instead.
const full = process.argv.includes('full');
const MIN_REAL = 3;
const PER_SONG = 8;
const keep = new Set<SpotifyPlay>();
if (full) plays.forEach((p) => keep.add(p));
else {
  const by = new Map<string, SpotifyPlay[]>();
  for (const p of plays) if (p.ms >= 30_000) (by.get(trackKey(p)) ?? by.set(trackKey(p), []).get(trackKey(p))!).push(p);
  for (const list of by.values()) if (list.length >= MIN_REAL) list.slice(-PER_SONG).forEach((p) => keep.add(p));
}

const docs: { kind: 'play'; key: string; value: unknown; updated: number }[] = [];
const seen = new Set<string>();
let unmatched = 0;
for (const p of plays) {
  if (!keep.has(p)) { unmatched++; continue; }
  const hit = resolved[trackKey(p)];
  if (!hit) { unmatched++; continue; }
  const key = `${p.start}:${hit.id}`;
  if (seen.has(key)) continue;
  seen.add(key);
  const dur = (hit.duration ?? 0) * 1000;
  // Spotify reports exactly how long each play lasted, so these are real completions and real skips.
  const completed = dur > 0 ? p.ms >= dur * 0.85 : p.ms >= 100_000;
  const skipped = !completed && p.ms < 30_000;
  docs.push({
    kind: 'play',
    key,
    updated: p.start,
    value: {
      track: {
        kind: 'song', id: hit.id, title: hit.title,
        artists: hit.artists.map((name) => ({ name })),
        ...(hit.duration ? { duration: hit.duration } : {}),
        ...(hit.album ? { album: { name: hit.album } } : {}),
        thumb: `https://i.ytimg.com/vi/${hit.id}/mqdefault.jpg`,
      },
      at: p.start, playedMs: p.ms, completed, skipped,
    },
  });
}
const c = docs.filter((d) => (d.value as any).completed).length;
const sk = docs.filter((d) => (d.value as any).skipped).length;
console.log(`${plays.length} Spotify plays: ${docs.length} matched to YouTube (${c} completed, ${sk} skipped), ${unmatched} not matched or never listened to`);
console.log(`songs: ${new Set(docs.map((d) => (d.value as any).track.id)).size}, ${new Date(docs[0].updated).toISOString().slice(0, 10)} .. ${new Date(docs[docs.length - 1].updated).toISOString().slice(0, 10)}`);
if (dry) process.exit(0);

function req(p: string, method: string, body?: unknown, token?: string): Promise<{ status: number; json: any }> {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : JSON.stringify(body);
    const r = https.request(
      { host: LAN, servername: HOST, port: 443, path: p, method, timeout: 60000,
        headers: { Host: HOST, 'content-type': 'application/json', 'x-lomu-device': 'import-script', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(data ? { 'content-length': Buffer.byteLength(data) } : {}) } },
      (res) => { let t = ''; res.on('data', (x) => (t += x)); res.on('end', () => { let j: any = {}; try { j = JSON.parse(t || '{}'); } catch {} resolve({ status: res.statusCode ?? 0, json: j }); }); },
    );
    r.on('error', reject);
    r.on('timeout', () => r.destroy(new Error('timeout')));
    if (data) r.write(data);
    r.end();
  });
}

const login = await req('/api/auth/login', 'POST', { username: process.env.LOMU_USER || 'admin', password: process.env.LOMU_PW });
if (!login.json.access) { console.error('login failed', login.status, login.json.error); process.exit(1); }
const BATCH = 1000;
for (let i = 0; i < docs.length; i += BATCH) {
  const r = await req('/api/sync', 'POST', { docs: docs.slice(i, i + BATCH) }, login.json.access);
  if (r.status !== 200) { console.error('batch failed at', i, r.status, r.json); process.exit(1); }
  if ((i / BATCH) % 10 === 0) console.log(`${Math.min(i + BATCH, docs.length)}/${docs.length}`);
}
console.log(`uploaded ${docs.length} plays`);
