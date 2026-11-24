import type { Track } from '@/lib/types';

/* Pure scoring for the recommendation engine (no I/O, so it is unit-tested). */

export type PlayDoc = { track: Track; at: number; playedMs: number; completed: boolean; skipped: boolean };
export type LikeDoc = { track: Track; at: number };

export type Affinity = {
  trackScore: Map<string, number>;
  artistScore: Map<string, number>;
  topTracks: Track[]; // strongest positive signals, distinct artists preferred
  onRepeat: Track[]; // most played in the last 30 days
  heavilyPlayed: Set<string>; // completed 3+ times: not "new" any more
  skipped: Set<string>; // early-skipped recently and never liked
  knownArtists: Set<string>;
  favorites: Track[]; // strongest tracks overall (positive score), best first: the "familiar" pool of the daily mix
};

const DAY = 86_400_000;
const decay = (ageMs: number, halfLifeDays: number) => Math.pow(0.5, Math.max(0, ageMs) / DAY / halfLifeDays);
const name = (t: Track) => t.artists[0]?.name.toLowerCase() ?? '';

export function affinity(plays: PlayDoc[], likes: LikeDoc[], now: number): Affinity {
  const trackScore = new Map<string, number>();
  const artistScore = new Map<string, number>();
  const byId = new Map<string, Track>();
  const completions = new Map<string, number>();
  const recentSkips = new Map<string, number>();
  const monthPlays = new Map<string, number>();
  const likedIds = new Set(likes.map((l) => l.track.id));

  const add = (t: Track, w: number) => {
    byId.set(t.id, t);
    trackScore.set(t.id, (trackScore.get(t.id) ?? 0) + w);
    for (const a of t.artists) artistScore.set(a.name.toLowerCase(), (artistScore.get(a.name.toLowerCase()) ?? 0) + w * 0.5);
  };

  for (const p of plays) {
    const age = now - p.at;
    const d = decay(age, 14);
    if (p.completed) {
      add(p.track, d); // finishing a song is the strongest implicit "yes"
      completions.set(p.track.id, (completions.get(p.track.id) ?? 0) + 1);
      if (age < 30 * DAY) monthPlays.set(p.track.id, (monthPlays.get(p.track.id) ?? 0) + 1);
    } else if (p.skipped) {
      add(p.track, -1.2 * d);
      if (age < 21 * DAY) recentSkips.set(p.track.id, (recentSkips.get(p.track.id) ?? 0) + 1);
    } else {
      // Listened for a while but not to the end: the further in, the stronger the "yes" (flat 0.3 when the length is unknown).
      const dur = (p.track.duration ?? 0) * 1000;
      add(p.track, (dur > 0 ? Math.min(0.7, Math.max(0.1, (p.playedMs / dur) * 0.8)) : 0.3) * d);
    }
  }
  for (const l of likes) add(l.track, 2 * decay(now - l.at, 45));

  const ranked = [...trackScore.entries()].filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]);
  const topTracks: Track[] = [];
  const perArtist = new Map<string, number>();
  for (const [id] of ranked) {
    const t = byId.get(id)!;
    const n = perArtist.get(name(t)) ?? 0;
    if (n >= (topTracks.length < 3 ? 1 : 2)) continue; // spread the first few seeds, then at most two per artist
    perArtist.set(name(t), n + 1);
    topTracks.push(t);
    if (topTracks.length >= 20) break;
  }

  const onRepeat = [...monthPlays.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([id]) => byId.get(id)!);

  const favorites = ranked.slice(0, 80).map(([id]) => byId.get(id)!);

  return {
    trackScore,
    favorites,
    artistScore,
    topTracks,
    onRepeat,
    heavilyPlayed: new Set([...completions].filter(([, n]) => n >= 3).map(([id]) => id)),
    skipped: new Set([...recentSkips].filter(([id, n]) => n >= 1 && !likedIds.has(id)).map(([id]) => id)),
    knownArtists: new Set([...artistScore].filter(([, s]) => s > 0).map(([a]) => a)),
  };
}

/**
 * Consensus ranking: a candidate that several strong seeds agree on, ranked high in each
 * seed's radio, beats one that appears once. Skipped and over-played tracks drop out.
 */
export function rankCandidates(seeds: Track[], cands: Map<string, Track[]>, aff: Affinity): Track[] {
  const score = new Map<string, number>();
  const byId = new Map<string, Track>();
  const seedIds = new Set(seeds.map((s) => s.id));
  seeds.forEach((seed, si) => {
    const seedWeight = 1 / (1 + si * 0.25);
    (cands.get(seed.id) ?? []).forEach((t, rank, list) => {
      if (seedIds.has(t.id) || aff.skipped.has(t.id) || aff.heavilyPlayed.has(t.id)) return;
      byId.set(t.id, t);
      const positional = 1 - (rank / Math.max(1, list.length)) * 0.5;
      score.set(t.id, (score.get(t.id) ?? 0) + seedWeight * positional);
    });
  });
  for (const [id, s] of score) {
    const t = byId.get(id)!;
    const artistBoost = Math.min(1, Math.max(0, ...t.artists.map((a) => aff.artistScore.get(a.name.toLowerCase()) ?? 0)) / 5);
    score.set(id, s * (1 + 0.3 * artistBoost));
  }
  return [...score.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => byId.get(id)!);
}

/** Keeps at most `cap` tracks per lead artist, preserving order. */
export function diversify(list: Track[], cap: number): Track[] {
  const seen = new Map<string, number>();
  const out: Track[] = [];
  for (const t of list) {
    const a = name(t);
    const n = seen.get(a) ?? 0;
    if (a && n >= cap) continue;
    seen.set(a, n + 1);
    out.push(t);
  }
  return out;
}

/* ---------------------------------------------------------------- daily mix */

/** Local calendar day, e.g. 2026-11-21: the mix is rebuilt when this changes. */
export const dayKey = (now: number) => {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Small deterministic PRNG (mulberry32), so a given day always shuffles the same way. */
export function seeded(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353), (h = (h << 13) | (h >>> 19));
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Picks `n` of `list`, favouring the front (weights fall off with rank) but never in the same order two days running. */
function pickWeighted<T>(list: T[], n: number, rnd: () => number): T[] {
  const pool = list.map((t, i) => ({ t, k: Math.pow(rnd(), 1 / (1 + 1.5 / (1 + i * 0.15))) }));
  return pool.sort((a, b) => b.k - a.k).slice(0, n).map((x) => x.t);
}

/** Which seeds to explore today: always the top two, the rest rotate so each day reaches a different corner of your taste. */
export function dailySeeds(top: Track[], day: string, n = 6): Track[] {
  if (top.length <= n) return top;
  const rnd = seeded('seeds:' + day);
  return [...top.slice(0, 2), ...pickWeighted(top.slice(2), n - 2, rnd)];
}

/**
 * The daily mix: a playlist, not a list. Three pools are blended in a fixed rhythm
 * (familiar favourite, fresh track from a known artist, fresh track, ... with a discovery every fifth slot),
 * so it opens with something you love, never runs two tracks by one artist back to back, and
 * eases from comfortable to new and back. Deterministic per day.
 */
export type MixScope = {
  salt?: string; // keeps each themed mix's shuffle different
  familiar?: Track[]; // the history pool (defaults to all favourites)
  known?: Set<string>; // lower-case artists that count as "known" for this mix
  exclude?: Set<string>; // tracks already placed in a sibling mix
};

export function dailyMix(aff: Affinity, ranked: Track[], day: string, size = 40, scope: MixScope = {}): Track[] {
  const rnd = seeded('mix:' + day + (scope.salt ?? ''));
  const ex = scope.exclude;
  const bad = (t: Track) => aff.skipped.has(t.id) || !!ex?.has(t.id);
  const knownSet = scope.known ?? aff.knownArtists;
  const familiar = pickWeighted((scope.familiar ?? aff.favorites).filter((t) => !bad(t)), Math.round(size * 0.35), rnd);
  const fresh = ranked.filter((t) => !bad(t));
  const known = fresh.filter((t) => t.artists.some((a) => knownSet.has(a.name.toLowerCase())));
  const unknown = fresh.filter((t) => t.artists.every((a) => !knownSet.has(a.name.toLowerCase())));
  const used = new Set(familiar.map((t) => t.id));
  const take = (src: Track[], n: number) => {
    const out: Track[] = [];
    for (const t of pickWeighted(src.filter((x) => !used.has(x.id)), n * 2, rnd)) {
      if (out.length >= n) break;
      used.add(t.id);
      out.push(t);
    }
    return out;
  };
  const known2 = take(known, Math.round(size * 0.4));
  const disc = take(unknown, Math.round(size * 0.25));
  const spill = take(fresh, size); // tops up whichever pool ran short

  // Rhythm: F K F K D, repeated. A pool that runs dry hands its slot to the next one.
  const q = { F: [...familiar], K: [...known2], D: [...disc], S: spill };
  const rhythm: ('F' | 'K' | 'D')[] = ['F', 'K', 'F', 'K', 'D'];
  const out: Track[] = [];
  const lead = (t: Track) => name(t);
  const total = familiar.length + known2.length + disc.length + spill.length;
  for (let i = 0; out.length < size && out.length < total && i < size * 4; i++) {
    const order = [rhythm[i % rhythm.length], 'F', 'K', 'D', 'S'] as ('F' | 'K' | 'D' | 'S')[];
    for (const k of order) {
      const idx = q[k].findIndex((t) => !out.length || lead(t) !== lead(out[out.length - 1]));
      if (idx < 0) continue;
      out.push(q[k].splice(idx, 1)[0]);
      break;
    }
  }
  return out;
}

/* ------------------------------------------------------- five themed daily mixes */

/**
 * Groups seed tracks into at most `k` tastes. Two seeds belong together when they share an artist or when YouTube's
 * radios for them return the same songs (the closest thing to "same genre" the catalogue exposes). Greedy merging,
 * with a small penalty on size so one huge cluster does not swallow everything.
 */
export function clusterSeeds(seeds: Track[], cands: Map<string, Track[]>, k = 5): Track[][] {
  type C = { seeds: Track[]; ids: Set<string>; artists: Set<string> };
  const cs: C[] = seeds.map((s) => ({
    seeds: [s],
    ids: new Set((cands.get(s.id) ?? []).map((t) => t.id)),
    artists: new Set(s.artists.map((a) => a.name.toLowerCase())),
  }));
  const sim = (a: C, b: C) => {
    const same = [...a.artists].some((x) => b.artists.has(x));
    let n = 0;
    for (const id of a.ids) if (b.ids.has(id)) n++;
    const overlap = n / Math.max(1, Math.min(a.ids.size, b.ids.size));
    return ((same ? 2 : 0) + overlap) / (1 + 0.15 * (a.seeds.length + b.seeds.length));
  };
  while (cs.length > k) {
    let bi = 0, bj = 1, best = -1;
    for (let i = 0; i < cs.length; i++)
      for (let j = i + 1; j < cs.length; j++) {
        const s = sim(cs[i], cs[j]);
        if (s > best) (best = s), (bi = i), (bj = j);
      }
    const a = cs[bi], b = cs.splice(bj, 1)[0];
    a.seeds.push(...b.seeds);
    b.ids.forEach((x) => a.ids.add(x));
    b.artists.forEach((x) => a.artists.add(x));
  }
  return cs.map((c) => c.seeds);
}

export type ThemedMix = { title: string; subtitle: string; items: Track[] };

/** "Arijit Singh, Pritam and more": the artists a cluster leans on most. */
function mixName(group: Track[], aff: Affinity): string {
  const score = new Map<string, { n: string; s: number }>();
  for (const t of group) {
    const a = t.artists[0]?.name;
    if (!a) continue;
    const e = score.get(a.toLowerCase()) ?? { n: a, s: 0 };
    e.s += aff.trackScore.get(t.id) ?? 0;
    score.set(a.toLowerCase(), e);
  }
  const top = [...score.values()].sort((a, b) => b.s - a.s).slice(0, 3).map((x) => x.n);
  return top.length ? top.join(', ') + ' and more' : 'Your taste';
}

/**
 * Up to five mixes for the day, like Daily Mix 1..5. Each one is a taste cluster: songs you already play from those
 * artists, plus the consensus of the cluster's radios (same artists first, then neighbours). No song appears in two mixes.
 */
export function dailyMixes(aff: Affinity, cands: Map<string, Track[]>, day: string, count = 5, size = 40): ThemedMix[] {
  const seeds = aff.topTracks.slice(0, 15);
  const weight = (g: Track[]) => g.reduce((n, t) => n + (aff.trackScore.get(t.id) ?? 0), 0);
  // Seeds whose radio came back empty cannot be grouped by sound: they join a group afterwards.
  const withRadio = seeds.filter((t) => (cands.get(t.id)?.length ?? 0) > 0);
  const without = seeds.filter((t) => !withRadio.includes(t));
  let groups = clusterSeeds(withRadio.length ? withRadio : seeds, cands, count);
  if (withRadio.length) without.forEach((t, i) => groups[i % groups.length].push(t));
  // Fewer tastes than mixes: split the biggest group in two until there are enough.
  while (groups.length < count) {
    groups.sort((a, b) => b.length - a.length);
    if (groups[0].length < 2) break;
    const [x, y] = clusterSeeds(groups[0], cands, 2);
    groups = [x, y, ...groups.slice(1)];
  }
  groups.sort((a, b) => weight(b) - weight(a));

  const globalRanked = rankCandidates(seeds, cands, aff); // top-up pool when a group's own radios run short
  // A thin pool is shared fairly: no mix may use more than its share, so the last one is not left with scraps.
  const pool = new Set([...globalRanked.map((t) => t.id), ...aff.favorites.map((t) => t.id)]).size;
  const each = Math.max(12, Math.min(size, Math.floor(pool / Math.max(1, groups.length))));
  const taken = new Set<string>();
  const out: ThemedMix[] = [];
  groups.forEach((g, i) => {
    const artists = new Set<string>();
    for (const t of g) for (const a of t.artists) artists.add(a.name.toLowerCase());
    // Artists that keep showing up in this cluster's radios belong to its sound too.
    const seen = new Map<string, number>();
    for (const s of g) for (const t of cands.get(s.id) ?? []) for (const a of t.artists) seen.set(a.name.toLowerCase(), (seen.get(a.name.toLowerCase()) ?? 0) + 1);
    for (const [a, n] of seen) if (n >= 2 && aff.knownArtists.has(a)) artists.add(a);
    const familiar = aff.favorites.filter((t) => t.artists.some((a) => artists.has(a.name.toLowerCase())));
    const own = rankCandidates(g, cands, aff);
    const ownIds = new Set(own.map((t) => t.id));
    const ranked = [...own, ...globalRanked.filter((t) => !ownIds.has(t.id))];
    const items = dailyMix(aff, ranked, day, each, { salt: `#${i}`, familiar, known: artists, exclude: taken });
    if (items.length < 8) return;
    items.forEach((t) => taken.add(t.id));
    out.push({ title: '', subtitle: mixName(g, aff), items });
  });
  return out.map((m, i) => ({ ...m, title: `Daily Mix ${i + 1}` }));
}
