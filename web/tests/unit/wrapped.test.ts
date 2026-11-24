import { describe, expect, it } from 'vitest';
import { buildWrapped, type WrappedPlay } from '@/lib/wrapped';
import type { Track } from '@/lib/types';

const T = (id: string, artist: string): Track => ({ kind: 'song', id, title: id, artists: [{ name: artist }] });
const at = (y: number, m: number, d: number, h = 12) => Date.UTC(y, m - 1, d, h);
const p = (t: Track, when: number, o: Partial<WrappedPlay> = {}): WrappedPlay => ({ track: t, at: when, playedMs: 180_000, completed: true, skipped: false, ...o });

describe('buildWrapped', () => {
  const a = T('a', 'Alpha'), b = T('b', 'Beta'), c = T('c', 'Gamma');
  const history = [
    p(a, at(2025, 3, 1)), p(b, at(2025, 3, 2)),
    p(a, at(2026, 1, 1, 23)), p(a, at(2026, 1, 2, 23)), p(a, at(2026, 1, 3, 23)), p(b, at(2026, 1, 3, 23)), p(c, at(2026, 6, 9, 23), { completed: false, skipped: true, playedMs: 10_000 }),
  ];

  it('limits to the year, ranks and finds the streak', () => {
    const w = buildWrapped(history, 2026)!;
    expect(w.label).toBe('2026');
    expect(w.years).toEqual([2026, 2025]);
    expect(w.topArtists[0].name).toBe('Alpha');
    expect(w.topSongs[0]).toMatchObject({ plays: 3 });
    expect(w.longestStreak).toBe(3);
    expect(w.busiestMonth!.month).toBe('January');
    expect(w.persona.title).toBe('Night Owl');
    expect(w.newArtists).toBe(1); // Gamma is first heard in 2026; Alpha and Beta came in 2025
    expect(w.skipRate).toBeCloseTo(1 / 5);
  });
  it('all time covers every year, and a year with nothing is null', () => {
    expect(buildWrapped(history, null)!.songs).toBe(3);
    expect(buildWrapped(history, 2020)).toBeNull();
  });
  it('reads hours in the viewer zone', () => {
    const w = buildWrapped([p(a, Date.UTC(2026, 0, 5, 20, 30))], 2026, -330)!; // IST: 2am next day
    expect(w.peakHour).toBe(2);
    expect(w.persona.title).toBe('Night Owl');
  });
});
