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
      add(p.track, 0.3 * d); // listened for a while but not to the end
    }
  }
  for (const l of likes) add(l.track, 2 * decay(now - l.at, 45));

  const ranked = [...trackScore.entries()].filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]);
  const topTracks: Track[] = [];
  const usedArtists = new Set<string>();
  for (const [id] of ranked) {
    const t = byId.get(id)!;
    if (usedArtists.has(name(t)) && topTracks.length < 3) continue; // spread the first few seeds
    usedArtists.add(name(t));
    topTracks.push(t);
    if (topTracks.length >= 12) break;
  }

  const onRepeat = [...monthPlays.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([id]) => byId.get(id)!);

  return {
    trackScore,
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
