import { describe, expect, it } from 'vitest';
import { matchLibrary } from '@/lib/libsearch';
import type { Track } from '@/lib/types';

const t = (id: string, title: string, artist: string) => ({ id, title, artists: [{ name: artist }] }) as Track;

describe('matchLibrary', () => {
  it('needs every word, puts liked first, dedupes and caps', () => {
    const liked = [t('1', 'Kesariya', 'Arijit Singh')];
    const plays = [t('1', 'Kesariya', 'Arijit Singh'), t('2', 'Tum Hi Ho', 'Arijit Singh'), t('3', 'Other', 'Someone')];
    expect(matchLibrary('arijit', liked, plays).map((x) => x.id)).toEqual(['1', '2']);
    expect(matchLibrary('arijit tum', liked, plays).map((x) => x.id)).toEqual(['2']);
    expect(matchLibrary('arijit', liked, plays, 1)).toHaveLength(1);
    expect(matchLibrary('   ', liked, plays)).toEqual([]);
  });
});
