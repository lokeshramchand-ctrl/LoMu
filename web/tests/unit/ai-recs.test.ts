import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { decide, matches, parsePlan, RETRY_AFTER, SHOW_FOR, type AiMix } from '@/server/ai-recs';
import { parseJson } from '@/server/ai';
import { dayKey } from '@/server/recs-core';
import type { Track } from '@/lib/types';

const T = (title: string, artist: string): Track => ({ kind: 'song', id: title, title, artists: [{ name: artist }] });
const now = new Date(2026, 10, 23, 12, 0).getTime();
const items = Array.from({ length: 15 }, (_, i) => T(`s${i}`, `a${i}`));
const mix = (at: number): AiMix => ({ day: dayKey(at), at, title: 't', blurb: '', items });

describe('decide', () => {
  it('builds when nothing is stored, but not again within the retry window', () => {
    expect(decide(undefined, 0, now)).toEqual({ show: false, refresh: true });
    expect(decide(undefined, now - 1000, now).refresh).toBe(false);
    expect(decide(undefined, now - RETRY_AFTER, now).refresh).toBe(true);
  });
  it('shows a mix under a day old and hides it after that', () => {
    expect(decide(mix(now - 3_600_000), 0, now).show).toBe(true);
    expect(decide(mix(now - SHOW_FOR - 1), 0, now).show).toBe(false);
  });
  it('does not rebuild a mix made today, but does the next day', () => {
    expect(decide(mix(now - 1000), 0, now).refresh).toBe(false);
    expect(decide(mix(now - 20 * 3_600_000), 0, now).refresh).toBe(true);
  });
  it('keeps showing yesterday\'s mix while today\'s build is retried', () => {
    const d = decide(mix(now - 20 * 3_600_000), now - RETRY_AFTER, now);
    expect(d).toEqual({ show: true, refresh: true });
  });
});

describe('parsing and matching', () => {
  it('reads JSON out of fences and think blocks', () => {
    expect(parseJson('<think>hm {x}</think>```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it('rejects plans with too few songs', () => {
    expect(parsePlan({ tracks: [{ artist: 'a', title: 'b' }] })).toBeNull();
  });
  it('matches a hit that has extra words, and rejects a different song or artist', () => {
    const want = { artist: 'Khruangbin', title: 'Maria También' };
    expect(matches(T('Maria Tambien (Official Video)', 'Khruangbin'), want)).toBe(true);
    expect(matches(T('Evan Finds the Third Room', 'Khruangbin'), want)).toBe(false);
    expect(matches(T('Maria También', 'Someone Else'), want)).toBe(false);
  });
});
