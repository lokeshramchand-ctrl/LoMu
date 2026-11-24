import { describe, expect, it } from 'vitest';
import { affinity, blockedTrack, explain, moodMixes, moodPlan, repeatRewind, discoverWeekly, diversify, hourOf, orderByNow, rankCandidates, slotAffinities, slotOf, timeMixes, weekKey, type PlayDoc } from '@/server/recs-core';
import type { Track } from '@/lib/types';

const T = (id: string, artist: string): Track => ({ kind: 'song', id, title: id, artists: [{ name: artist }] });
const DAY = 86_400_000;
const now = Date.UTC(2026, 10, 18);
const play = (t: Track, daysAgo: number, how: 'done' | 'skip' | 'part'): PlayDoc => ({
  track: t,
  at: now - daysAgo * DAY,
  playedMs: how === 'skip' ? 8000 : 180000,
  completed: how === 'done',
  skipped: how === 'skip',
});

describe('affinity', () => {
  it('rewards completions and punishes early skips', () => {
    const a = T('a', 'A');
    const b = T('b', 'B');
    const aff = affinity([play(a, 1, 'done'), play(b, 1, 'skip')], [], now);
    expect(aff.trackScore.get('a')!).toBeGreaterThan(0);
    expect(aff.trackScore.get('b')!).toBeLessThan(0);
    expect(aff.skipped.has('b')).toBe(true);
    expect(aff.topTracks.map((t) => t.id)).toEqual(['a']);
  });

  it('recent plays outweigh old ones', () => {
    const a = T('a', 'A');
    const b = T('b', 'B');
    const aff = affinity([play(a, 90, 'done'), play(b, 1, 'done')], [], now);
    expect(aff.trackScore.get('b')!).toBeGreaterThan(aff.trackScore.get('a')!);
  });

  it('a like rescues a skipped track from the skip list', () => {
    const a = T('a', 'A');
    const aff = affinity([play(a, 2, 'skip')], [{ track: a, at: now - DAY }], now);
    expect(aff.skipped.has('a')).toBe(false);
  });

  it('marks tracks completed 3+ times as heavily played', () => {
    const a = T('a', 'A');
    const aff = affinity([1, 2, 3].map((d) => play(a, d, 'done')), [], now);
    expect(aff.heavilyPlayed.has('a')).toBe(true);
    expect(aff.onRepeat[0].id).toBe('a');
  });
});

describe('rankCandidates', () => {
  it('prefers candidates several seeds agree on and drops skipped ones', () => {
    const s1 = T('s1', 'S1');
    const s2 = T('s2', 'S2');
    const common = T('common', 'X');
    const once = T('once', 'Y');
    const bad = T('bad', 'Z');
    const aff = affinity([play(s1, 1, 'done'), play(s2, 1, 'done'), play(bad, 1, 'skip')], [], now);
    const ranked = rankCandidates(
      [s1, s2],
      new Map([
        [s1.id, [once, common, bad]],
        [s2.id, [common]],
      ]),
      aff,
    );
    expect(ranked.map((t) => t.id)).toEqual(['common', 'once']);
  });
});

describe('diversify', () => {
  it('caps tracks per lead artist and keeps order', () => {
    const list = [T('1', 'A'), T('2', 'A'), T('3', 'A'), T('4', 'B')];
    expect(diversify(list, 2).map((t) => t.id)).toEqual(['1', '2', '4']);
  });
});

describe('dailyMix', () => {
  const lib = Array.from({ length: 30 }, (_, i) => T('f' + i, 'Fav' + (i % 10)));
  const fresh = Array.from({ length: 60 }, (_, i) => T('n' + i, 'New' + (i % 25)));
  const aff = affinity(lib.map((t) => play(t, 2, 'done')), [], now);
  it('is stable within a day, differs across days, has no repeats or back-to-back artists', async () => {
    const { dailyMix } = await import('@/server/recs-core');
    const a = dailyMix(aff, fresh, '2026-11-21', 40);
    expect(a.map((t) => t.id)).toEqual(dailyMix(aff, fresh, '2026-11-21', 40).map((t) => t.id));
    expect(a.map((t) => t.id)).not.toEqual(dailyMix(aff, fresh, '2026-11-22', 40).map((t) => t.id));
    expect(new Set(a.map((t) => t.id)).size).toBe(a.length);
    expect(a.length).toBeGreaterThanOrEqual(30);
    for (let i = 1; i < a.length; i++) expect(a[i].artists[0].name).not.toBe(a[i - 1].artists[0].name);
  });
});

describe('dailyMixes', () => {
  // Three tastes: A-ish and B-ish share radios inside their group, C is separate. 12 artists, 2 songs each.
  const seeds = Array.from({ length: 12 }, (_, i) => T('s' + i, 'Art' + i));
  const group = (i: number) => (i < 4 ? 'g0' : i < 8 ? 'g1' : 'g2');
  const cands = new Map(
    seeds.map((s, i) => [s.id, Array.from({ length: 30 }, (_, j) => T(`${group(i)}-c${(j + i) % 30}`, `${group(i)}-artist${j % 12}`))]),
  );
  const aff = affinity(seeds.map((t) => play(t, 1, 'done')), [], now);

  it('clusters seeds by shared radios into at most k groups', async () => {
    const { clusterSeeds } = await import('@/server/recs-core');
    const g = clusterSeeds(seeds, cands, 3);
    expect(g.length).toBe(3);
    for (const c of g) expect(new Set(c.map((t) => group(Number(t.id.slice(1))))).size).toBe(1);
  });

  it('builds up to five named mixes, stable per day, with no song in two mixes', async () => {
    const { dailyMixes } = await import('@/server/recs-core');
    const a = dailyMixes(aff, cands, '2026-11-24');
    expect(a.length).toBeGreaterThanOrEqual(3);
    expect(a.length).toBeLessThanOrEqual(5);
    expect(a.map((m) => m.title)).toEqual(a.map((_, i) => `Daily Mix ${i + 1}`));
    const ids = a.flatMap((m) => m.items.map((t) => t.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(dailyMixes(aff, cands, '2026-11-24').map((m) => m.items.map((t) => t.id))).toEqual(a.map((m) => m.items.map((t) => t.id)));
  });

  it('still gives five mixes when most seeds have no radio results', async () => {
    const { dailyMixes } = await import('@/server/recs-core');
    const sparse = new Map(seeds.map((s, i) => [s.id, [0, 1, 4, 5, 8, 9].includes(i) ? cands.get(s.id)! : []]));
    const a = dailyMixes(aff, sparse, '2026-11-24');
    expect(a.length).toBe(5);
    for (const m of a) expect(m.items.length).toBeGreaterThanOrEqual(8);
  });
});

describe('time-of-day mixes', () => {
  const at = (h: number, i = 0) => Date.UTC(2026, 10, 10 + (i % 5), h, 0) - 0; // UTC hours, read back with tz 0
  const songs = (prefix: string, artist: string, n: number) => Array.from({ length: n }, (_, i) => T(`${prefix}${i}`, `${artist}`));
  const doneAt = (t: Track, hour: number, i: number): PlayDoc => ({ track: t, at: at(hour, i) + i * 60_000, playedMs: 180000, completed: true, skipped: false });
  const now = Date.UTC(2026, 10, 20, 12);

  it('maps hours to the part of the day, across midnight', () => {
    expect(slotOf(6).id).toBe('morning');
    expect(slotOf(13).id).toBe('afternoon');
    expect(slotOf(21).id).toBe('evening');
    expect(slotOf(23).id).toBe('night');
    expect(slotOf(2).id).toBe('night');
    expect(hourOf(Date.UTC(2026, 0, 1, 20, 30), -330)).toBe(2); // IST viewer, server elsewhere
  });

  it('builds a mix only for parts of the day with enough listening, led by what is played then', () => {
    const am = songs('am', 'Dawn', 30);
    const pm = songs('pm', 'Dusk', 30);
    const plays = [...am.map((t, i) => doneAt(t, 7, i)), ...pm.map((t, i) => doneAt(t, 23, i)), ...am.slice(0, 3).map((t, i) => doneAt(t, 12, i))];
    const slots = slotAffinities(plays, now, 0);
    expect(slots.map((s) => s.slot.id).sort()).toEqual(['morning', 'night']); // afternoon has 3 plays: too few
    const aff = affinity(plays, [], now);
    const cands = new Map<string, Track[]>();
    for (const s of slots) for (const seed of s.aff.topTracks.slice(0, 4)) cands.set(seed.id, songs(`r${seed.id}_`, 'Other', 12).map((t, i) => ({ ...t, artists: [{ name: `New${seed.id}${i}` }] })));
    const mixes = timeMixes(aff, slots, cands, '2026-11-20');
    const morning = mixes.find((m) => m.slot === 'morning')!;
    expect(morning.title).toBe('Morning Mix');
    expect(morning.items.filter((t) => t.id.startsWith('am')).length).toBeGreaterThan(morning.items.filter((t) => t.id.startsWith('pm')).length);
    expect(new Set(morning.items.map((t) => t.id)).size).toBe(morning.items.length);
    // "right now" goes first and is labelled
    const ordered = orderByNow(mixes, 23);
    expect(ordered[0].title).toBe('Late Night Mix');
    expect(ordered[0].subtitle).toMatch(/^Right now/);
  });
});

describe('discover weekly', () => {
  const now = Date.UTC(2026, 10, 18);
  it('only offers artists that were never played, the same all week, and nothing when thin', () => {
    const fav = T('f1', 'Fav');
    const plays: PlayDoc[] = [play(fav, 1, 'done'), play(fav, 2, 'done'), play(T('x', 'Skippy'), 1, 'skip')];
    const aff = affinity(plays, [], now);
    const fresh = Array.from({ length: 50 }, (_, i) => T(`n${i}`, `Newbie${i}`));
    const cands = new Map<string, Track[]>([
      ['f1', [...fresh, T('k1', 'Fav'), T('k2', 'Skippy')]],
    ]);
    const week = weekKey(Date.UTC(2026, 10, 18));
    const list = discoverWeekly(aff, cands, week);
    expect(list.length).toBe(30);
    expect(list.every((t) => t.artists[0].name.startsWith('Newbie'))).toBe(true);
    expect(discoverWeekly(aff, cands, week).map((t) => t.id)).toEqual(list.map((t) => t.id));
    expect(discoverWeekly(aff, cands, '2026-11-23').map((t) => t.id)).not.toEqual(list.map((t) => t.id));
    expect(discoverWeekly(aff, new Map([['f1', fresh.slice(0, 5)]]), week)).toEqual([]);
  });
  it('weekKey is the Monday of that week', () => {
    expect(weekKey(new Date(2026, 10, 18, 15).getTime())).toBe('2026-11-16'); // Wed 18 Nov 2026
    expect(weekKey(new Date(2026, 10, 22, 9).getTime())).toBe('2026-11-16'); // Sunday
    expect(weekKey(new Date(2026, 10, 23, 9).getTime())).toBe('2026-11-23'); // next Monday
  });
});

describe('blocked artists', () => {
  const now = Date.UTC(2026, 10, 18);
  it('drop out of favourites, seeds, candidates and Discover Weekly', () => {
    const bad = T('b1', 'Banned'), good = T('g1', 'Good');
    const plays = [play(bad, 1, 'done'), play(bad, 2, 'done'), play(good, 1, 'done')];
    const aff = affinity(plays, [], now, new Set(['banned']));
    expect(aff.favorites.map((t) => t.id)).toEqual(['g1']);
    expect(aff.topTracks.map((t) => t.id)).toEqual(['g1']);
    expect(aff.positives.map((t) => t.id)).toEqual(['g1']);
    const cands = new Map([['g1', [T('x1', 'Banned'), T('x2', 'Fine')]]]);
    expect(rankCandidates([good], cands, aff).map((t) => t.id)).toEqual(['x2']);
    expect(blockedTrack(aff, T('z', 'BANNED'))).toBe(true);
  });
});

describe('why this song', () => {
  const now = Date.UTC(2026, 10, 18);
  it('explains history songs, known artists and radio neighbours', () => {
    const fav = T('f', 'Anirudh');
    const aff = affinity([play(fav, 1, 'done'), play(T('o', 'Other'), 1, 'done')], [], now);
    const cands = new Map([['f', [T('n1', 'Anirudh'), T('n2', 'Stranger')]]]);
    expect(explain(fav, aff, cands, [fav])).toBe('From your listening');
    expect(explain(T('n1', 'Anirudh'), aff, cands, [fav])).toBe('Because you play Anirudh');
    expect(explain(T('n2', 'Stranger'), aff, cands, [fav])).toBe('Because you play f');
    expect(explain(T('n2', 'Stranger'), aff, cands, [fav], true)).toBe('New artist, like f');
  });
});

describe('mood mixes and repeat rewind', () => {
  const now = Date.UTC(2026, 10, 18);
  it('builds a mood mix only when the history has enough matching songs', () => {
    const slowed = Array.from({ length: 10 }, (_, i) => T(`s${i}`, `A${i}`)).map((t) => ({ ...t, title: `${t.id} (Slowed + Reverb)` }));
    const plain = Array.from({ length: 10 }, (_, i) => T(`p${i}`, `P${i}`));
    const aff = affinity([...slowed, ...plain].map((t) => play(t, 1, 'done')), [], now);
    const plan = moodPlan(aff);
    expect(plan.map((p) => p.mood.id)).toEqual(['slowed']);
    const cands = new Map<string, Track[]>();
    for (const seed of plan[0].seeds) cands.set(seed.id, Array.from({ length: 15 }, (_, i) => ({ ...T(`r${seed.id}${i}`, `N${seed.id}${i}`), title: `r${i} slowed` })));
    const mixes = moodMixes(aff, plan, cands, '2026-11-18');
    expect(mixes[0].title).toBe('Slowed & Reverb');
    expect(mixes[0].items.length).toBeGreaterThanOrEqual(10);
    expect(mixes[0].items.every((t) => !!t.why)).toBe(true);
  });
  it('rewinds songs finished 3+ times and not heard for 45+ days', () => {
    const old = Array.from({ length: 12 }, (_, i) => T(`o${i}`, `Old${i}`));
    const plays = [
      ...old.flatMap((t) => [play(t, 200, 'done'), play(t, 199, 'done'), play(t, 198, 'done')]),
      ...[play(T('r', 'Recent'), 1, 'done'), play(T('r', 'Recent'), 2, 'done'), play(T('r', 'Recent'), 3, 'done')],
    ];
    const aff = affinity(plays, [], now);
    const list = repeatRewind(aff, '2026-11-16');
    expect(list.length).toBe(12);
    expect(list.some((t) => t.id === 'r')).toBe(false);
    expect(list[0].why).toMatch(/You played this 3 times, last in /);
    expect(repeatRewind(aff, '2026-11-16').map((t) => t.id)).toEqual(list.map((t) => t.id));
  });
});
