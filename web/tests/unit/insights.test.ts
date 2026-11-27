import { describe, expect, it } from 'vitest';
import { formatMinutes, recentTracks, topArtists, weekStats } from '@/lib/insights';
import type { Track } from '@/lib/types';

const T = (id: string, artist: string, aid?: string): Track => ({ kind: 'song', id, title: id, artists: [{ id: aid, name: artist }] });
const DAY = 86_400_000;
const now = new Date(2026, 10, 18, 15, 0).getTime();
const play = (t: Track, daysAgo: number, min: number, completed = true) => ({ track: t, at: now - daysAgo * DAY, playedMs: min * 60_000, completed });

describe('weekStats', () => {
  it('sums minutes per day, oldest first, and ignores plays older than a week', () => {
    const h = [play(T('a', 'A'), 0, 10), play(T('b', 'A'), 0, 5), play(T('c', 'B'), 2, 20), play(T('d', 'B'), 9, 99)];
    const s = weekStats(h, now);
    expect(s.daily).toEqual([0, 0, 0, 0, 20, 0, 15]);
    expect(s.minutes).toBe(35);
    expect(s.plays).toBe(3);
    expect(s.topArtist?.name).toBe('B');
  });
  it('counts a streak of consecutive days ending today', () => {
    const t = T('a', 'A');
    expect(weekStats([play(t, 0, 1), play(t, 1, 1), play(t, 2, 1), play(t, 4, 1)], now).streak).toBe(3);
  });
  it('keeps yesterday-ending streaks alive until today ends', () => {
    const t = T('a', 'A');
    expect(weekStats([play(t, 1, 1), play(t, 2, 1)], now).streak).toBe(2);
    expect(weekStats([play(t, 3, 1)], now).streak).toBe(0);
  });
});

describe('recentTracks', () => {
  it('dedupes, then tops up from likes', () => {
    const a = T('a', 'A');
    const b = T('b', 'B');
    const c = T('c', 'C');
    const out = recentTracks([play(a, 0, 1), play(a, 1, 1), play(b, 2, 1)], [{ track: c, at: 5 }, { track: a, at: 9 }], 5);
    expect(out.map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('topArtists', () => {
  it('ranks by completions and skips artists without an id', () => {
    const h = [play(T('1', 'X', 'x'), 0, 3), play(T('2', 'X', 'x'), 1, 3), play(T('3', 'Y', 'y'), 0, 3), play(T('4', 'Z'), 0, 3)];
    expect(topArtists(h).map((a) => a.id)).toEqual(['x', 'y']);
  });
});

describe('formatMinutes', () => {
  it('switches to hours', () => {
    expect(formatMinutes(42)).toEqual({ value: '42', unit: 'minutes' });
    expect(formatMinutes(120)).toEqual({ value: '2.0', unit: 'hours' });
  });
});
