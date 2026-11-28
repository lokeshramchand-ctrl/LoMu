import { describe, expect, it } from 'vitest';
import { parseWatchHistory, parseWhen } from '@/lib/ytmhistory';

const cell = (product: string, id: string, title: string, channel: string, when: string) =>
  `<div class="outer-cell mdl-cell"><div class="mdl-grid"><div class="header-cell"><p class="mdl-typography--title">${product}<br></p></div>` +
  `<div class="content-cell">Watched <a href="https://music.youtube.com/watch?v=${id}">${title}</a><br>` +
  `<a href="https://www.youtube.com/channel/UC1">${channel}</a><br>${when}<br></div></div></div>`;
const page = (...cells: string[]) => `<html><body>${cells.join('')}</body></html>`;
const T = (min: number, sec = 0) => `Nov 19, 2026, 8:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')} AM IST`;

describe('parseWhen', () => {
  it('reads Takeout times with their zone', () => {
    expect(parseWhen('Nov 19, 2026, 8:32:41 AM IST')).toBe(Date.UTC(2026, 10, 19, 3, 2, 41));
    expect(parseWhen('Jan 2, 2025, 12:05:00 PM UTC')).toBe(Date.UTC(2025, 0, 2, 12, 5, 0));
    expect(parseWhen('Jan 2, 2025, 12:05:00 AM UTC')).toBe(Date.UTC(2025, 0, 2, 0, 5, 0));
    expect(parseWhen('nonsense')).toBeNull();
  });
});

describe('parseWatchHistory', () => {
  it('keeps only YouTube Music, drops Unknown titles, cleans the artist, and infers listening from gaps', () => {
    const plays = parseWatchHistory(
      page(
        cell('YouTube Music', 'dddddddddd4', 'Last &amp; Found', 'Artist D - Topic', T(40)),
        cell('YouTube', 'xxxxxxxxxx0', 'A video', 'Some Channel', T(30)),
        cell('YouTube Music', 'cccccccccc3', 'Gone', 'Artist C - Topic', T(19)),
        cell('YouTube Music', 'uuuuuuuuuu9', 'Unknown', 'Nobody - Topic', T(15)),
        cell('YouTube Music', 'bbbbbbbbbb2', 'Half', 'Artist B', T(18, 10)),
        cell('YouTube Music', 'aaaaaaaaaa1', 'Skipped', 'Artist A - Topic', T(18, 0)),
        cell('YouTube Music', 'aaaaaaaaaa1', 'Skipped', 'Artist A - Topic', T(18, 0)),
      ),
    );
    expect(plays.map((p) => p.track.id)).toEqual(['aaaaaaaaaa1', 'bbbbbbbbbb2', 'cccccccccc3', 'dddddddddd4']);
    expect(plays[0]).toMatchObject({ skipped: true, completed: false });
    expect(plays[1]).toMatchObject({ skipped: false, completed: false });
    expect(plays[2]).toMatchObject({ skipped: false, completed: true });
    expect(plays[3]).toMatchObject({ skipped: false, completed: true });
    expect(plays[3].track.title).toBe('Last & Found');
    expect(plays[3].track.artists).toEqual([{ name: 'Artist D' }]);
    expect(plays[1].track.artists).toEqual([{ name: 'Artist B' }]);
    expect(plays[0].playedMs).toBeLessThan(35_000);
    expect(plays[3].track.thumb).toContain('dddddddddd4');
  });
});
