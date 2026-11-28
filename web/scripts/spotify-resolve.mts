import fs from 'node:fs';
import path from 'node:path';
import { Innertube, Log } from 'youtubei.js';
import { readSpotify, norm, trackKey, type Agg } from '../src/lib/spotify.ts';

Log.setLevel(Log.Level.NONE);
const DIR = path.resolve(process.cwd(), '../Spotify');
const OUT = path.join(DIR, 'resolved.json');
const limit = Number(process.argv[2]) || Infinity;

type Hit = { id: string; title: string; artists: string[]; duration?: number; album?: string } | null;
const cache: Record<string, Hit> = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};

const { tracks } = readSpotify(DIR);
const todo = [...tracks.values()]
  .filter((t) => t.real >= 1 && !(trackKey(t) in cache))
  .sort((a, b) => b.real - a.real)
  .slice(0, limit);
console.log(`${tracks.size} songs, ${todo.length} to look up, ${Object.keys(cache).length} already done`);

const yt = await Innertube.create({ generate_session_locally: false, retrieve_player: false, location: 'IN', lang: 'en' });

const tokens = (s: string) => new Set(norm(s).split(' ').filter(Boolean));
const jaccard = (a: Set<string>, b: Set<string>) => {
  if (!a.size || !b.size) return 0;
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n / (a.size + b.size - n);
};

async function find(t: Agg): Promise<Hit> {
  const first = await search(`${t.artist} ${t.track}`, t);
  if (first) return first;
  const short = t.track.replace(/\s*[-–(\[].*$/, '').trim();
  return short && short !== t.track ? search(`${t.artist} ${short}`, t) : null;
}

async function search(q: string, t: Agg): Promise<Hit> {
  const res: any = await yt.music.search(q, { type: 'song' });
  const items: any[] = [];
  for (const sec of res.contents ?? []) for (const c of sec.contents ?? []) if (c?.id && (c.item_type === 'song' || c.item_type === 'video')) items.push(c);
  const want = tokens(t.track);
  const wantArtist = norm(t.artist);
  let best: { s: number; c: any } | null = null;
  for (const c of items.slice(0, 8)) {
    const title = String(c.title ?? c.name ?? '');
    const artists: string[] = (c.artists ?? c.authors ?? []).map((a: any) => String(a.name ?? ''));
    const sim = jaccard(want, tokens(title));
    const artistOk = artists.some((a) => { const n = norm(a); return n && (wantArtist.includes(n) || n.includes(wantArtist)); }) ||
      tokens(t.artist).size > 0 && [...tokens(t.artist)].some((w) => w.length > 2 && artists.some((a) => norm(a).includes(w)));
    if (!artistOk || sim < 0.5) continue;
    const s = sim + (c.item_type === 'song' ? 0.15 : 0);
    if (!best || s > best.s) best = { s, c };
  }
  if (!best) return null;
  const c = best.c;
  return {
    id: c.id,
    title: String(c.title ?? c.name),
    artists: (c.artists ?? c.authors ?? []).map((a: any) => String(a.name)),
    duration: c.duration?.seconds,
    album: c.album?.name,
  };
}

let done = 0, hit = 0, i = 0;
const save = () => fs.writeFileSync(OUT, JSON.stringify(cache));
async function worker() {
  while (i < todo.length) {
    const t = todo[i++];
    let h: Hit = null;
    for (let tryN = 0; tryN < 3; tryN++) {
      try { h = await find(t); break; } catch (e) { await new Promise((r) => setTimeout(r, 1500 * (tryN + 1))); if (tryN === 2) h = undefined as any; }
    }
    if (h === (undefined as any)) continue;
    cache[trackKey(t)] = h;
    done++;
    if (h) hit++;
    if (done % 100 === 0) { save(); console.log(`${done}/${todo.length}  matched ${hit}`); }
  }
}
await Promise.all(Array.from({ length: 8 }, () => worker()));
save();
console.log(`finished: ${done} looked up, ${hit} matched (${Math.round((hit / Math.max(1, done)) * 100)}%)`);
if (process.argv[3] === 'show') for (const t of todo.slice(0, 25)) console.log(`${t.artist} - ${t.track}  =>`, JSON.stringify(cache[trackKey(t)]));
