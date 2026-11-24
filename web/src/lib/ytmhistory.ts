import type { Track } from './types';

/* Google Takeout "My Activity" watch history -> LoMu plays. Only entries whose product is "YouTube Music" are used:
   plain YouTube watching says nothing reliable about music taste.

   Takeout records when a song started, never how long it was heard, so listening is inferred from the gap to the
   next song: a song replaced within seconds was skipped, one followed by a long gap (or the end of a session) was
   heard to the end. */

export type ImportedPlay = { track: Track; at: number; playedMs: number; completed: boolean; skipped: boolean };

const SKIP_BELOW_MS = 35_000; // the next song began within this long: skipped
const PARTIAL_BELOW_MS = 100_000; // heard a good part, but not to the end
const SESSION_GAP_MS = 20 * 60_000; // a longer silence ends a session; the last song of one counts as finished
const FULL_PLAY_MS = 180_000; // stand-in length of a finished song (the real length is not in the export)

const OFFSETS: Record<string, number> = {
  UTC: 0, GMT: 0, IST: 330, PST: -480, PDT: -420, MST: -420, MDT: -360, CST: -360, CDT: -300, EST: -300, EDT: -240,
  BST: 60, CET: 60, CEST: 120, EET: 120, EEST: 180, JST: 540, KST: 540, AEST: 600, AEDT: 660, SGT: 480, HKT: 480, PKT: 300,
};
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** "Nov 19, 2026, 8:32:41 AM IST" (the space before AM is a narrow no-break space) -> epoch ms, or null. */
export function parseWhen(s: string): number | null {
  const m = s.replace(/[  ]/g, ' ').trim().match(/^([A-Za-z]{3})[a-z]* (\d{1,2}), (\d{4}),? (\d{1,2}):(\d{2})(?::(\d{2}))? ?([AP]M)? ?([A-Za-z]{2,5}|[+-]\d{2}:?\d{2})?$/i);
  if (!m) return null;
  const mon = MONTHS.indexOf(m[1].toLowerCase());
  if (mon < 0) return null;
  let h = Number(m[4]) % 12;
  if (/pm/i.test(m[7] ?? '')) h += 12;
  else if (!m[7]) h = Number(m[4]);
  const zone = m[8];
  if (!zone) return new Date(Number(m[3]), mon, Number(m[2]), h, Number(m[5]), Number(m[6] ?? 0)).getTime(); // browser's own zone
  let off = OFFSETS[zone.toUpperCase()];
  if (off === undefined) {
    const z = zone.match(/^([+-])(\d{2}):?(\d{2})$/);
    if (!z) return new Date(Number(m[3]), mon, Number(m[2]), h, Number(m[5]), Number(m[6] ?? 0)).getTime();
    off = (z[1] === '-' ? -1 : 1) * (Number(z[2]) * 60 + Number(z[3]));
  }
  return Date.UTC(Number(m[3]), mon, Number(m[2]), h, Number(m[5]), Number(m[6] ?? 0)) - off * 60_000;
}

const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&nbsp;/g, ' ');

const ENTRY = /<p class="mdl-typography--title">([^<]*)<br><\/p>[\s\S]*?Watched\s<a href="([^"]*)">([^<]*)<\/a><br>(?:<a href="[^"]*">([^<]*)<\/a><br>)?([^<]*)<br>/;

/** Every YouTube Music play in a watch-history.html, oldest first, with inferred listening. Bad or unavailable entries are dropped. */
export function parseWatchHistory(html: string): ImportedPlay[] {
  const raw: { id: string; title: string; artist: string; at: number }[] = [];
  const seen = new Set<string>();
  let from = 0;
  for (;;) {
    const a = html.indexOf('<div class="outer-cell', from);
    if (a < 0) break;
    const b = html.indexOf('<div class="outer-cell', a + 20);
    const cell = html.slice(a, b < 0 ? html.length : b);
    from = b < 0 ? html.length : b;
    const m = ENTRY.exec(cell);
    if (!m || decode(m[1]).trim() !== 'YouTube Music') continue;
    const id = m[2].match(/[?&]v=([\w-]{11})/)?.[1];
    const title = decode(m[3]).trim();
    const at = parseWhen(decode(m[5]));
    if (!id || at === null || !title || title === 'Unknown') continue;
    const key = `${at}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    raw.push({ id, title, artist: decode(m[4] ?? '').replace(/ - Topic$/, '').trim(), at });
  }
  raw.sort((x, y) => x.at - y.at);
  return raw.map((r, i) => {
    const gap = i + 1 < raw.length ? raw[i + 1].at - r.at : Infinity;
    const skipped = gap < SKIP_BELOW_MS;
    const completed = gap >= PARTIAL_BELOW_MS;
    const playedMs = gap > SESSION_GAP_MS ? FULL_PLAY_MS : Math.min(gap, FULL_PLAY_MS);
    return {
      track: {
        kind: 'song' as const,
        id: r.id,
        title: r.title,
        artists: r.artist ? [{ name: r.artist }] : [],
        thumb: `https://i.ytimg.com/vi/${r.id}/mqdefault.jpg`,
      },
      at: r.at,
      playedMs,
      completed,
      skipped,
    };
  });
}

export function summarize(plays: ImportedPlay[]) {
  const ids = new Set(plays.map((p) => p.track.id));
  return { plays: plays.length, songs: ids.size, from: plays[0]?.at ?? 0, to: plays[plays.length - 1]?.at ?? 0 };
}
