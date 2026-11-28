import { describe, expect, it } from 'vitest';
import { artistNames, fmtTime } from '@/lib/format';
import { applyMode } from '@/lib/worst';

describe('worst-case data the UI must survive', () => {
  it('formats durations from seconds to hours, and survives junk', () => {
    expect(fmtTime(0)).toBe('0:00');
    expect(fmtTime(59)).toBe('0:59');
    expect(fmtTime(213)).toBe('3:33');
    expect(fmtTime(7384)).toBe('2:03:04');
    expect(fmtTime(36000)).toBe('10:00:00');
    expect(fmtTime(NaN)).toBe('0:00');
    expect(fmtTime(-5)).toBe('0:00');
  });
  it('never leaves the artist line blank', () => {
    expect(artistNames([])).toBe('Unknown artist');
    expect(artistNames(undefined)).toBe('Unknown artist');
    expect(artistNames([{ name: 'A' }])).toBe('A');
    expect(artistNames([{ name: 'A' }, { name: 'B' }])).toBe('A, B');
  });
  it('the dev data switch is a no-op outside the browser and in production', () => {
    const data = { songs: [{ kind: 'song', title: 'x', artists: [{ name: 'y' }] }] };
    expect(applyMode(data)).toBe(data);
  });
});
