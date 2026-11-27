import type { Track } from './types';

/** Songs from your own library (liked first, then plays) whose title or artists contain every word of the query. */
export function matchLibrary(q: string, liked: Track[], plays: Track[], max = 5): Track[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const seen = new Set<string>();
  const out: Track[] = [];
  for (const t of [...liked, ...plays]) {
    if (seen.has(t.id)) continue;
    const hay = `${t.title} ${t.artists.map((a) => a.name).join(' ')}`.toLowerCase();
    if (!words.every((w) => hay.includes(w))) continue;
    seen.add(t.id);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}
