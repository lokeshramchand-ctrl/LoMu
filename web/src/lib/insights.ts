import type { ArtistRef, Track } from './types';

/* Pure helpers behind the personalised parts of the home page (no React, unit-tested). */

export type PlayLike = { track: Track; at: number; playedMs: number; completed: boolean };

const DAY = 86_400_000;
const dayKey = (t: number) => {
  const d = new Date(t);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
};

/** Last 7 days (oldest first) of listening minutes, plus headline numbers. */
export function weekStats(history: PlayLike[], now = Date.now()) {
  const today = dayKey(now);
  const daily = Array.from({ length: 7 }, () => 0);
  let plays = 0;
  const artistMs = new Map<string, { ref: ArtistRef; ms: number }>();
  const days = new Set<number>();
  for (const p of history) {
    const k = dayKey(p.at);
    days.add(k);
    const back = Math.round((today - k) / DAY);
    if (back >= 0 && back < 7) {
      daily[6 - back] += p.playedMs / 60_000;
      if (p.completed) plays++;
      const a = p.track.artists[0];
      if (a && a.name !== 'N/A') {
        const cur = artistMs.get(a.name) ?? { ref: a, ms: 0 };
        cur.ms += p.playedMs;
        artistMs.set(a.name, cur);
      }
    }
  }
  // Streak: consecutive days with any listening, ending today (or yesterday if nothing yet today).
  let streak = 0;
  let cursor = days.has(today) ? today : today - DAY;
  while (days.has(cursor)) {
    streak++;
    cursor -= DAY;
  }
  const top = [...artistMs.values()].sort((a, b) => b.ms - a.ms)[0];
  return { minutes: Math.round(daily.reduce((a, b) => a + b, 0)), plays, streak, daily: daily.map((m) => Math.round(m)), topArtist: top?.ref };
}

/** Most recent distinct songs, topped up from likes when the history is short. */
export function recentTracks(history: PlayLike[], liked: { track: Track; at: number }[], n = 8): Track[] {
  const seen = new Set<string>();
  const out: Track[] = [];
  const push = (t: Track) => {
    if (seen.has(t.id) || t.video) return;
    seen.add(t.id);
    out.push(t);
  };
  for (const p of history) {
    push(p.track);
    if (out.length >= n) return out;
  }
  for (const l of [...liked].sort((a, b) => b.at - a.at)) {
    push(l.track);
    if (out.length >= n) break;
  }
  return out;
}

/** Artists ranked by completed plays and listening time, with an id so they can be linked. */
export function topArtists(history: PlayLike[], n = 12): ArtistRef[] {
  const score = new Map<string, { ref: ArtistRef; s: number }>();
  for (const p of history) {
    for (const a of p.track.artists.slice(0, 1)) {
      if (!a.id) continue;
      const cur = score.get(a.id) ?? { ref: a, s: 0 };
      cur.s += (p.completed ? 1 : 0.25) + p.playedMs / 600_000;
      score.set(a.id, cur);
    }
  }
  return [...score.values()].sort((a, b) => b.s - a.s).slice(0, n).map((x) => x.ref);
}

export function formatMinutes(m: number): { value: string; unit: string } {
  if (m >= 90) return { value: (m / 60).toFixed(m >= 600 ? 0 : 1), unit: 'h' };
  return { value: String(m), unit: 'min' };
}
