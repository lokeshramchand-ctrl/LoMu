import fs from 'node:fs';
import path from 'node:path';

/* Spotify "Download your data" export -> per-song listening totals and timestamped plays.
   Both export formats are read (the older StreamingHistoryN.json and the newer StreamingHistory_music_N.json).
   Spotify records how long each play lasted (msPlayed), which Google's history does not, so a skip is a real skip. */

export type SpotifyRow = { endTime: string; artistName: string; trackName: string; msPlayed: number };
export type Agg = { artist: string; track: string; plays: number; real: number; ms: number };
export type SpotifyPlay = { artist: string; track: string; start: number; ms: number };

export const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/\b(feat|ft|with|from|remastered|remaster|version|original|motion picture soundtrack|official|audio|video)\b.*$/, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

export const trackKey = (t: { artist: string; track: string }) => `${norm(t.artist)}|${norm(t.track)}`;

/** "2023-02-20 15:50" is UTC; the play began msPlayed before it ended. */
const startOf = (r: SpotifyRow) => {
  const m = r.endTime.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/);
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - r.msPlayed;
};

export function readSpotify(dir: string): { tracks: Map<string, Agg>; plays: SpotifyPlay[] } {
  const files: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/^StreamingHistory(_music)?_?\d+\.json$/.test(e.name)) files.push(p);
    }
  };
  walk(dir);
  const seen = new Set<string>();
  const tracks = new Map<string, Agg>();
  const plays: SpotifyPlay[] = [];
  for (const f of files.sort()) {
    for (const r of JSON.parse(fs.readFileSync(f, 'utf8')) as SpotifyRow[]) {
      const start = startOf(r);
      const artist = (r.artistName ?? '').trim();
      const track = (r.trackName ?? '').trim();
      if (start === null || !artist || !track || artist === 'Unknown Artist') continue;
      const dup = `${r.endTime}|${artist}|${track}`; // the two exports (and the zip inside the folder) must not double count
      if (seen.has(dup)) continue;
      seen.add(dup);
      const k = trackKey({ artist, track });
      const a = tracks.get(k) ?? { artist, track, plays: 0, real: 0, ms: 0 };
      a.plays++;
      a.ms += r.msPlayed;
      if (r.msPlayed >= 30_000) a.real++;
      tracks.set(k, a);
      plays.push({ artist, track, start, ms: r.msPlayed });
    }
  }
  plays.sort((x, y) => x.start - y.start);
  return { tracks, plays };
}
