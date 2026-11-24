import 'server-only';
import type { Shelf, Track } from '@/lib/types';
import { all } from './sync';
import { radio } from './catalog';
import { cached, readStale, writeStale } from './yt';
import { aiShelf, refreshAiMix } from './ai-recs';
import { affinity, dailyMixes, dayKey, diversify, rankCandidates, type Affinity, type PlayDoc, type LikeDoc } from './recs-core';

/* Server-side recommendations, shared by the web player and the phone. Signals come from the
   synced play log and likes; candidates come from YouTube's own radio for the strongest recent
   seeds; the scoring itself lives in recs-core.ts so it can be unit-tested without a network. */

const SEEDS = 5;
const PER_SEED = 30;
const DAILY_SEEDS = 6;

async function candidatesFor(seeds: Track[]): Promise<{ map: Map<string, Track[]>; ok: number }> {
  const map = new Map<string, Track[]>();
  let ok = 0;
  await Promise.all(
    seeds.map(async (s) => {
      try {
        map.set(s.id, (await radio(s.id)).filter((t) => t.id !== s.id).slice(0, PER_SEED));
        ok++;
      } catch {
        map.set(s.id, []);
      }
    }),
  );
  return { map, ok };
}

/**
 * Five themed mixes, built once per calendar day and then kept, so they are the same all day (and on every device that
 * asks the server). If YouTube cannot be reached nothing is stored and yesterday's set stays on screen.
 */
async function dailyPlaylists(uid: number, aff: Affinity, now: number): Promise<Shelf[]> {
  const day = dayKey(now);
  const key = `recs:u${uid}:mixes5:${day}:${Math.floor(aff.playCount / 1000)}`; // a big import changes the bucket and rebuilds
  const kept = readStale<Shelf[]>(key);
  if (kept && kept.length >= 5) return kept; // a short set is rebuilt next time, not kept for the day
  const seeds = aff.topTracks.slice(0, 20);
  const { map, ok } = await candidatesFor(seeds);
  if (!ok && seeds.length) return readStale<Shelf[]>(`recs:u${uid}:mixes5:last`) ?? [];
  const shelves: Shelf[] = dailyMixes(aff, map, day).map((m) => ({ title: m.title, subtitle: m.subtitle, items: m.items }));
  if (shelves.length) {
    if (shelves.length >= 5) writeStale(key, shelves);
    writeStale(`recs:u${uid}:mixes5:last`, shelves);
  }
  return shelves;
}

const memo = new Map<number, { at: number; aff: Affinity }>();

/** The account's taste profile. A big imported history makes this a real cost, so it is kept for a minute. */
export function userAffinity(uid: number): Affinity {
  const hit = memo.get(uid);
  if (hit && Date.now() - hit.at < 60_000) return hit.aff;
  const plays = all(uid, 'play', 40000).map((r) => r.value as PlayDoc);
  const likes = all(uid, 'like', 10000).map((r) => r.value as LikeDoc);
  const aff = affinity(plays, likes, Date.now());
  memo.set(uid, { at: Date.now(), aff });
  return aff;
}

export function buildMixes(uid: number): Promise<Shelf[]> {
  // The play log changes slowly relative to how often the home page is opened.
  return cached(`recs:u${uid}:mixes`, 3 * 60_000, async () => {
    const plays = all(uid, 'play', 40000).map((r) => r.value as PlayDoc);
    const likes = all(uid, 'like', 10000).map((r) => r.value as LikeDoc);
    if (!plays.length && !likes.length) return [];

    const now = Date.now();
    const aff = affinity(plays, likes, now);
    const seeds = aff.topTracks.slice(0, SEEDS);
    const { map: cands, ok } = await candidatesFor(seeds);
    // Nothing reachable (offline): throw, so `cached` serves the last full set instead of a thin one.
    if (!ok && seeds.length && readStale(`recs:u${uid}:mixes`)) throw new Error('YouTube unreachable');
    const ranked = rankCandidates(seeds, cands, aff);

    const shelves: Shelf[] = [];
    refreshAiMix(uid, aff, now); // at most once a day, in the background
    const ai = aiShelf(uid, now);
    if (ai) shelves.push(ai);
    shelves.push(...(await dailyPlaylists(uid, aff, now)));

    if (aff.onRepeat.length) shelves.push({ title: 'On Repeat', subtitle: 'Your last 30 days', items: aff.onRepeat.slice(0, 50) });

    for (const seed of seeds.slice(0, 3)) {
      const list = diversify(
        (cands.get(seed.id) ?? []).filter((t) => !aff.heavilyPlayed.has(t.id) && !aff.skipped.has(t.id)),
        2,
      ).slice(0, 15);
      if (list.length >= 5) shelves.push({ title: `Because you played ${seed.title}`, items: list });
    }

    const fresh = ranked.filter((t) => t.artists.every((a) => !aff.knownArtists.has(a.name.toLowerCase())));
    const discover = diversify(fresh, 1).slice(0, 20);
    if (discover.length >= 5) shelves.push({ title: 'Discover', subtitle: 'Artists you have not played yet', items: discover });
    return shelves;
  });
}

/** Adaptive autoplay: what should follow `seedId`, skipping things you keep skipping. */
export async function nextUp(uid: number, seedId: string, recent: string[] = []): Promise<Track[]> {
  const aff = userAffinity(uid);
  const skip = new Set(recent);
  const list = (await radio(seedId)).filter((t) => t.id !== seedId && !skip.has(t.id) && !aff.skipped.has(t.id));
  // Liked artists first, otherwise YouTube's order.
  const score = (t: Track) => t.artists.reduce((m, a) => Math.max(m, aff.artistScore.get(a.name.toLowerCase()) ?? 0), 0);
  return diversify([...list].sort((a, b) => score(b) - score(a)), 3).slice(0, 25);
}
