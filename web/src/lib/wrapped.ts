import type { Track } from './types';

/* "Wrapped": a year (or all time) of listening as a handful of headline facts. Pure, so the server can run it over the whole
   play log (the browser only keeps the latest few thousand plays) and it can be unit-tested. */

export type WrappedPlay = { track: Track; at: number; playedMs: number; completed: boolean; skipped?: boolean };

export type Wrapped = {
  label: string;
  years: number[]; // every year that has listening, newest first
  minutes: number;
  plays: number; // songs finished
  songs: number;
  artists: number;
  topArtists: { name: string; id?: string; thumb?: string; ms: number; plays: number }[];
  topSongs: { track: Track; plays: number }[];
  topArtistShare: number; // 0..1 of the listening time
  persona: { title: string; line: string };
  hourMs: number[];
  peakHour: number | null;
  busiestDay: { day: string; minutes: number } | null;
  busiestMonth: { month: string; minutes: number } | null;
  longestStreak: number;
  activeDays: number;
  newArtists: number; // first heard in this period
  skipRate: number;
};

const DAY = 86_400_000;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** An instant as a UTC date that reads like the viewer's wall clock (`tzOffsetMin` is `Date.getTimezoneOffset()`). */
const wall = (at: number, tz: number) => new Date(at - tz * 60_000);

function persona(hourMs: number[]): Wrapped['persona'] {
  const total = hourMs.reduce((a, b) => a + b, 0) || 1;
  const part = (from: number, to: number) => hourMs.reduce((n, v, h) => n + (from < to ? (h >= from && h < to ? v : 0) : h >= from || h < to ? v : 0), 0) / total;
  const night = part(22, 5), morning = part(5, 11), afternoon = part(11, 17), evening = part(17, 22);
  if (night >= 0.3) return { title: 'Night Owl', line: `${Math.round(night * 100)}% of your listening happens after 10pm.` };
  if (morning >= 0.3) return { title: 'Early Bird', line: `${Math.round(morning * 100)}% of your listening happens before 11am.` };
  return afternoon >= evening
    ? { title: 'Daytime Drifter', line: `${Math.round(afternoon * 100)}% of your listening is between 11am and 5pm.` }
    : { title: 'Evening Unwinder', line: `${Math.round(evening * 100)}% of your listening is between 5pm and 10pm.` };
}

export function buildWrapped(history: WrappedPlay[], year: number | null, tzOffsetMin = 0): Wrapped | null {
  const yearOf = (at: number) => wall(at, tzOffsetMin).getUTCFullYear();
  const years = [...new Set(history.map((p) => yearOf(p.at)))].sort((a, b) => b - a);
  const inPeriod = history.filter((p) => year === null || yearOf(p.at) === year);
  if (!inPeriod.length) return null;

  const firstSeen = new Map<string, number>();
  for (const p of history) {
    const a = p.track.artists[0]?.name;
    if (a && a !== 'N/A') firstSeen.set(a, Math.min(firstSeen.get(a) ?? Infinity, p.at));
  }

  const hourMs = Array.from({ length: 24 }, () => 0);
  const dayMs = new Map<number, number>();
  const monthMs = new Map<string, number>();
  const tracks = new Map<string, { track: Track; plays: number }>();
  const artists = new Map<string, { name: string; id?: string; thumb?: string; ms: number; plays: number }>();
  let totalMs = 0, skips = 0, done = 0;
  for (const p of inPeriod) {
    const w = wall(p.at, tzOffsetMin);
    totalMs += p.playedMs;
    if (p.completed) done++;
    if (p.skipped) skips++;
    hourMs[w.getUTCHours()] += p.playedMs;
    const dk = Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate());
    dayMs.set(dk, (dayMs.get(dk) ?? 0) + p.playedMs);
    const mk = `${w.getUTCFullYear()}-${w.getUTCMonth()}`;
    monthMs.set(mk, (monthMs.get(mk) ?? 0) + p.playedMs);
    const t = tracks.get(p.track.id) ?? { track: p.track, plays: 0 };
    if (p.completed) t.plays++;
    tracks.set(p.track.id, t);
    const a = p.track.artists[0];
    if (a && a.name !== 'N/A') {
      const x = artists.get(a.name) ?? { name: a.name, id: a.id, thumb: p.track.thumb, ms: 0, plays: 0 };
      x.ms += p.playedMs;
      if (p.completed) x.plays++;
      artists.set(a.name, x);
    }
  }

  const days = [...dayMs.keys()].sort((a, b) => a - b);
  let best = 0, run = 0;
  days.forEach((d, i) => {
    run = i && Math.round((d - days[i - 1]) / DAY) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  const topDay = [...dayMs.entries()].sort((a, b) => b[1] - a[1])[0];
  const topMonth = [...monthMs.entries()].sort((a, b) => b[1] - a[1])[0];
  const peak = Math.max(...hourMs);
  const topArtists = [...artists.values()].sort((a, b) => b.ms - a.ms);
  const periodStart = year === null ? -Infinity : Date.UTC(year, 0, 1) + tzOffsetMin * 60_000;
  const periodEnd = year === null ? Infinity : Date.UTC(year + 1, 0, 1) + tzOffsetMin * 60_000;

  return {
    label: year === null ? 'All time' : String(year),
    years,
    minutes: Math.round(totalMs / 60_000),
    plays: done,
    songs: tracks.size,
    artists: artists.size,
    topArtists: topArtists.slice(0, 5),
    topSongs: [...tracks.values()].sort((a, b) => b.plays - a.plays).slice(0, 5),
    topArtistShare: totalMs && topArtists[0] ? topArtists[0].ms / totalMs : 0,
    persona: persona(hourMs),
    hourMs,
    peakHour: peak > 0 ? hourMs.indexOf(peak) : null,
    busiestDay: topDay ? { day: new Date(topDay[0]).toLocaleDateString('en', { day: 'numeric', month: 'long', timeZone: 'UTC' }), minutes: Math.round(topDay[1] / 60_000) } : null,
    busiestMonth: topMonth ? { month: MONTHS[Number(topMonth[0].split('-')[1])], minutes: Math.round(topMonth[1] / 60_000) } : null,
    longestStreak: best,
    activeDays: days.length,
    newArtists: [...firstSeen.values()].filter((t) => t >= periodStart && t < periodEnd).length,
    skipRate: inPeriod.length ? skips / inPeriod.length : 0,
  };
}
