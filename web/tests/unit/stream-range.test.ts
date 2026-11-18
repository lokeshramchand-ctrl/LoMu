import { describe, expect, it } from 'vitest';
import { parseRange } from '@/server/stream';

describe('parseRange', () => {
  it('handles the common forms', () => {
    expect(parseRange(null, 1000)).toBeNull();
    expect(parseRange('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 });
    expect(parseRange('bytes=500-', 1000)).toEqual({ start: 500, end: 999 });
    expect(parseRange('bytes=-100', 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange('bytes=900-5000', 1000)).toEqual({ start: 900, end: 999 });
  });
  it('rejects unsatisfiable ranges', () => {
    expect(parseRange('bytes=2000-', 1000)).toBeNull();
    expect(parseRange('bytes=50-10', 1000)).toBeNull();
  });
});
