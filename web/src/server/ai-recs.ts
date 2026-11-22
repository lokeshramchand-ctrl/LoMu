import 'server-only';
import type { Shelf, Track } from '@/lib/types';
import { aiConfigured, chatJson } from './ai';
import { search } from './catalog';
import { readStale, writeStale } from './yt';
import { dayKey, diversify, type Affinity } from './recs-core';

/* "Picked by AI": one playlist per day, written by the model from your taste and then checked against the real
   catalogue (the model proposes artist and title, YouTube Music decides what exists). It is built at most once a
   day, in the background, so opening the app never waits for it and an idle app never calls the model.
   If the AI server cannot be reached for a whole day, the shelf disappears and the normal mixes carry on. */

export type AiMix = { day: string; at: number; title: string; blurb: string; items: Track[] };
type Plan = { title: string; blurb: string; picks: { artist: string; title: string }[] };

const HOUR = 3_600_000;
export const SHOW_FOR = 24 * HOUR; // an AI mix older than this is hidden
export const RETRY_AFTER = 2 * HOUR; // after a failed attempt, wait before trying again
const MIN_TRACKS = 12;

/** Pure rule: show the stored mix while it is under a day old; ask for a new one once per calendar day. */
export function decide(mix: AiMix | undefined, lastTry: number, now: number): { show: boolean; refresh: boolean } {
  const show = !!mix && now - mix.at < SHOW_FOR && mix.items.length >= MIN_TRACKS;
  const stale = !mix || mix.day !== dayKey(now);
  return { show, refresh: stale && now - lastTry >= RETRY_AFTER };
}

export function parsePlan(raw: unknown): Plan | null {
  const o = raw as { title?: unknown; blurb?: unknown; tracks?: unknown };
  if (!o || !Array.isArray(o.tracks)) return null;
  const picks = o.tracks
    .map((t: any) => ({ artist: String(t?.artist ?? '').trim(), title: String(t?.title ?? '').trim() }))
    .filter((t) => t.artist && t.title);
  if (picks.length < MIN_TRACKS) return null;
  return { title: String(o.title ?? '').trim().slice(0, 60) || 'Picked by AI', blurb: String(o.blurb ?? '').trim().slice(0, 160), picks };
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** A search hit counts only if both the title and an artist overlap what was asked for. */
export function matches(t: Track, want: { artist: string; title: string }): boolean {
  const tt = norm(t.title);
  const wt = norm(want.title);
  const wa = norm(want.artist);
  if (!tt || !wt || !(tt.includes(wt) || wt.includes(tt))) return false;
  return t.artists.some((a) => {
    const n = norm(a.name);
    return !!n && (n.includes(wa) || wa.includes(n));
  });
}

function profile(aff: Affinity): string {
  const artists = [...aff.artistScore.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([n]) => n);
  const tracks = aff.topTracks.slice(0, 15).map((t) => `${t.artists[0]?.name ?? '?'} - ${t.title}`);
  return JSON.stringify({ favouriteArtists: artists, favouriteSongs: tracks, localHour: new Date().getHours() });
}

const SYSTEM =
  'You are a music curator. From the listener profile, make one playlist of 30 real, well-known released songs: about 60% close to their taste and 40% from artists NOT in their list that they would likely love. Vary the artists (at most 2 songs per artist) and order the songs so the energy flows. Only name songs you are sure exist. Answer with JSON only: {"title": short playlist name, "blurb": one sentence on why it suits them, "tracks": [{"artist": string, "title": string}]}.';

async function resolve(picks: Plan['picks']): Promise<Track[]> {
  const out: (Track | null)[] = new Array(picks.length).fill(null);
  let next = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (next < picks.length) {
        const i = next++;
        try {
          const hits = (await search(`${picks[i].artist} ${picks[i].title}`)).songs.slice(0, 5);
          out[i] = hits.find((h) => matches(h, picks[i])) ?? null;
        } catch {
          out[i] = null;
        }
      }
    }),
  );
  const seen = new Set<string>();
  return out.filter((t): t is Track => !!t && !seen.has(t.id) && !!seen.add(t.id));
}

const key = (uid: number, what: string) => `ai:u${uid}:${what}`;
const running = new Set<number>();

/** The stored mix as a shelf, or null when there is none or it is over a day old. */
export function aiShelf(uid: number, now = Date.now()): Shelf | null {
  const mix = readStale<AiMix>(key(uid, 'mix'));
  if (!mix || !decide(mix, 0, now).show) return null;
  return { title: mix.title, subtitle: mix.blurb || 'Picked by AI', items: mix.items };
}

/** Starts today's build in the background when it is due. Never throws and never waits. */
export function refreshAiMix(uid: number, aff: Affinity, now = Date.now()): void {
  if (!aiConfigured() || running.has(uid)) return;
  const mix = readStale<AiMix>(key(uid, 'mix'));
  const lastTry = readStale<number>(key(uid, 'try')) ?? 0;
  if (!decide(mix, lastTry, now).refresh) return;
  running.add(uid);
  writeStale(key(uid, 'try'), now);
  void (async () => {
    try {
      const plan = parsePlan(await chatJson(SYSTEM, profile(aff)));
      if (!plan) throw new Error('AI plan was unusable');
      const found = await resolve(plan.picks);
      const items = diversify(found.filter((t) => !aff.heavilyPlayed.has(t.id) && !aff.skipped.has(t.id)), 2);
      if (items.length < MIN_TRACKS) throw new Error(`only ${items.length} songs resolved`);
      writeStale(key(uid, 'mix'), { day: dayKey(now), at: Date.now(), title: plan.title, blurb: plan.blurb, items } satisfies AiMix);
    } catch (e) {
      console.warn('[ai] daily mix not built:', e instanceof Error ? e.message : e);
    } finally {
      running.delete(uid);
    }
  })();
}
