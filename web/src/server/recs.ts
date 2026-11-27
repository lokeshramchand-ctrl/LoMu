import 'server-only';
import type { Shelf, Track } from '@/lib/types';
import { all } from './sync';
import { radio } from './catalog';
import { cached, readStale, writeStale } from './yt';
import { aiShelf, refreshAiMix } from './ai-recs';
import { affinity, blockedTrack, dailyMixes, moodMixes, moodPlan, repeatRewind, dayKey, discoverWeekly as pickWeekly, diversify, hourOf, orderByNow, rankCandidates, slotAffinities, timeMixes, weekKey, type Affinity, type PlayDoc, type SlotId, type LikeDoc } from './recs-core';

/* Server-side recommendations, shared by the web player and the phone. Signals come from the
   synced play log and likes; candidates come from YouTube's own radio for the strongest recent
   seeds; the scoring itself lives in recs-core.ts so it can be unit-tested without a network. */

const SEEDS = 5;
const PER_SEED = 30;

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
  const key = `recs:u${uid}:mixes5:${day}:${Math.floor(aff.playCount / 1000)}:${blockSig(aff.blocked)}`; // a big import changes the bucket and rebuilds
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

/** Four mixes, one per part of the day you listen in: built once a day, put in order of "right now" when served. */
async function timeOfDay(uid: number, aff: Affinity, plays: PlayDoc[], now: number, tz?: number): Promise<Shelf[]> {
  const day = dayKey(now);
  const key = `recs:u${uid}:tod:${day}:${tz ?? 'srv'}:${Math.floor(aff.playCount / 1000)}:${blockSig(aff.blocked)}`;
  let built = readStale<(Shelf & { slot: SlotId })[]>(key);
  if (!built) {
    const slots = slotAffinities(plays, now, tz, aff.blocked);
    const seeds = [...new Map(slots.flatMap((s) => s.aff.topTracks.slice(0, 4)).map((t) => [t.id, t])).values()];
    const { map, ok } = await candidatesFor(seeds);
    if (!ok && seeds.length) return [];
    built = timeMixes(aff, slots, map, day).map((m) => ({ title: m.title, subtitle: m.subtitle, items: m.items, slot: m.slot }));
    if (built.length) writeStale(key, built);
  }
  return orderByNow<Shelf>(built, tz === undefined ? new Date(now).getHours() : hourOf(now, tz));
}

/** One playlist a week of artists you have never played, the same all week. */
async function discoverWeekly(uid: number, aff: Affinity, now: number): Promise<Shelf | null> {
  const week = weekKey(now);
  const key = `recs:u${uid}:dw:${week}:${Math.floor(aff.playCount / 1000)}:${blockSig(aff.blocked)}`;
  const kept = readStale<Shelf>(key);
  if (kept) return kept;
  const { map, ok } = await candidatesFor(aff.topTracks.slice(0, 20));
  if (!ok) return null;
  const items = pickWeekly(aff, map, week);
  if (!items.length) return null;
  const shelf: Shelf = { title: 'Discover Weekly', subtitle: 'Artists new to you · changes every Monday', items };
  writeStale(key, shelf);
  return shelf;
}

/** Artists the user said never to recommend (lower-case names), from the synced 'block' documents. */
export function blockedSet(uid: number): Set<string> {
  return new Set(all(uid, 'block', 5000).map((r) => r.key));
}

/** Short fingerprint of the block list: part of every cache key, so blocking an artist rebuilds the day's mixes. */
const blockSig = (b: Set<string>) => {
  let h = 5381;
  for (const c of [...b].sort().join('|')) h = ((h << 5) + h + c.charCodeAt(0)) | 0;
  return b.size ? (h >>> 0).toString(36) : '0';
};

/** Mood mixes and Repeat Rewind: shelves with their own cache. Moods need YouTube, Rewind needs only the history. */
async function momentsAndRewind(uid: number, aff: Affinity, now: number): Promise<Shelf[]> {
  const day = dayKey(now);
  const sig = `${Math.floor(aff.playCount / 1000)}:${blockSig(aff.blocked)}`;
  const out: Shelf[] = [];
  const rewind = repeatRewind(aff, weekKey(now));
  if (rewind.length) out.push({ title: 'Repeat Rewind', subtitle: 'Songs you loved, a while ago', items: rewind });
  const plan = moodPlan(aff);
  if (plan.length) {
    const key = `recs:u${uid}:moods:${day}:${sig}`;
    let moods = readStale<Shelf[]>(key);
    if (!moods) {
      const { map, ok } = await candidatesFor([...new Map(plan.flatMap((m) => m.seeds).map((t) => [t.id, t])).values()]);
      if (ok) {
        moods = moodMixes(aff, plan, map, day).map((m) => ({ title: m.title, subtitle: m.subtitle, items: m.items }));
        if (moods.length) writeStale(key, moods);
      }
    }
    out.push(...(moods ?? []));
  }
  return out;
}

const memo = new Map<number, { at: number; aff: Affinity }>();

/** The account's taste profile. A big imported history makes this a real cost, so it is kept for a minute. */
export function userAffinity(uid: number): Affinity {
  const hit = memo.get(uid);
  if (hit && Date.now() - hit.at < 60_000) return hit.aff;
  const plays = all(uid, 'play', 40000).map((r) => r.value as PlayDoc);
  const likes = all(uid, 'like', 10000).map((r) => r.value as LikeDoc);
  const aff = affinity(plays, likes, Date.now(), blockedSet(uid));
  memo.set(uid, { at: Date.now(), aff });
  return aff;
}

export function buildMixes(uid: number, tz?: number): Promise<Shelf[]> {
  // The play log changes slowly relative to how often the home page is opened.
  return cached(`recs:u${uid}:mixes:${tz ?? 'srv'}`, 3 * 60_000, async () => {
    const plays = all(uid, 'play', 40000).map((r) => r.value as PlayDoc);
    const likes = all(uid, 'like', 10000).map((r) => r.value as LikeDoc);
    if (!plays.length && !likes.length) return [];

    const now = Date.now();
    const aff = affinity(plays, likes, now, blockedSet(uid));
    const seeds = aff.topTracks.slice(0, SEEDS);
    const { map: cands, ok } = await candidatesFor(seeds);
    // Nothing reachable (offline): throw, so `cached` serves the last full set instead of a thin one.
    if (!ok && seeds.length && readStale(`recs:u${uid}:mixes:${tz ?? 'srv'}`)) throw new Error('YouTube unreachable');
    const ranked = rankCandidates(seeds, cands, aff);

    const shelves: Shelf[] = [];
    refreshAiMix(uid, aff, now); // at most once a day, in the background
    const ai = aiShelf(uid, now);
    if (ai) shelves.push(ai);
    shelves.push(...(await dailyPlaylists(uid, aff, now)));
    const dw = await discoverWeekly(uid, aff, now);
    if (dw) shelves.push(dw);
    shelves.push(...(await timeOfDay(uid, aff, plays, now, tz)));
    shelves.push(...(await momentsAndRewind(uid, aff, now)));

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
    // Cached shelves may predate a block: nothing by a blocked artist is ever served.
    return shelves.map((s) => ({ ...s, items: s.items.filter((i) => i.kind !== 'song' || !blockedTrack(aff, i)) }));
  });
}

/** Adaptive autoplay: what should follow `seedId`, skipping things you keep skipping. */
export async function nextUp(uid: number, seedId: string, recent: string[] = []): Promise<Track[]> {
  const aff = userAffinity(uid);
  const skip = new Set(recent);
  const list = (await radio(seedId)).filter((t) => t.id !== seedId && !skip.has(t.id) && !aff.skipped.has(t.id) && !blockedTrack(aff, t));
  // Liked artists first, otherwise YouTube's order.
  const score = (t: Track) => t.artists.reduce((m, a) => Math.max(m, aff.artistScore.get(a.name.toLowerCase()) ?? 0), 0);
  return diversify([...list].sort((a, b) => score(b) - score(a)), 3).slice(0, 25);
}
