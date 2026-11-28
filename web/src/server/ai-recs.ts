import 'server-only';
import type { Shelf, Track } from '@/lib/types';
import { aiConfigured, chatJson } from './ai';
import { search } from './catalog';
import { readStale, writeStale } from './yt';
import { dayKey, diversify, type Affinity } from './recs-core';

export type AiMix = { day: string; at: number; title: string; blurb: string; items: Track[] };
type Plan = { title: string; blurb: string; picks: { artist: string; title: string }[] };

const HOUR = 3_600_000;
export const SHOW_FOR = 24 * HOUR;
export const RETRY_AFTER = 2 * HOUR;
const MIN_TRACKS = 12;

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

export function aiShelf(uid: number, now = Date.now()): Shelf | null {
  const mix = readStale<AiMix>(key(uid, 'mix'));
  if (!mix || !decide(mix, 0, now).show) return null;
  return { title: mix.title, subtitle: mix.blurb || 'Picked by AI', items: mix.items };
}

export type BuildReport = { title: string; proposed: number; found: number; kept: number; ms: number };

export async function buildAiMix(uid: number, aff: Affinity, now = Date.now()): Promise<BuildReport> {
  const t0 = Date.now();
  const plan = parsePlan(await chatJson(SYSTEM, profile(aff)));
  if (!plan) throw new Error('The model answered, but not with a usable playlist (too few songs or not JSON).');
  const found = await resolve(plan.picks);
  const items = diversify(found.filter((t) => !aff.heavilyPlayed.has(t.id) && !aff.skipped.has(t.id)), 2);
  if (items.length < MIN_TRACKS) throw new Error(`The model proposed ${plan.picks.length} songs but only ${items.length} could be used (found on YouTube Music, not played to death or skipped). Needs ${MIN_TRACKS}.`);
  writeStale(key(uid, 'mix'), { day: dayKey(now), at: Date.now(), title: plan.title, blurb: plan.blurb, items } satisfies AiMix);
  return { title: plan.title, proposed: plan.picks.length, found: found.length, kept: items.length, ms: Date.now() - t0 };
}

export function refreshAiMix(uid: number, aff: Affinity, now = Date.now()): void {
  if (!aiConfigured() || running.has(uid)) return;
  const mix = readStale<AiMix>(key(uid, 'mix'));
  const lastTry = readStale<number>(key(uid, 'try')) ?? 0;
  if (!decide(mix, lastTry, now).refresh) return;
  running.add(uid);
  writeStale(key(uid, 'try'), now);
  void buildAiMix(uid, aff, now)
    .then(() => writeStale(key(uid, 'err'), ''))
    .catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      writeStale(key(uid, 'err'), msg);
      console.warn('[ai] daily mix not built:', msg);
    })
    .finally(() => running.delete(uid));
}

export type AiStatus = { configured: boolean; host: string | null; building: boolean; builtAt: number | null; title: string | null; songs: number; lastTry: number | null; lastError: string | null; shown: boolean };

export function aiStatus(uid: number, now = Date.now()): AiStatus {
  const mix = readStale<AiMix>(key(uid, 'mix'));
  let host: string | null = null;
  try {
    host = process.env.LOMU_AI_URL ? new URL(process.env.LOMU_AI_URL).host : null;
  } catch {
    host = process.env.LOMU_AI_URL ?? null;
  }
  return {
    configured: aiConfigured(),
    host,
    building: running.has(uid),
    builtAt: mix?.at ?? null,
    title: mix?.title ?? null,
    songs: mix?.items.length ?? 0,
    lastTry: readStale<number>(key(uid, 'try')) ?? null,
    lastError: readStale<string>(key(uid, 'err')) || null,
    shown: !!mix && decide(mix, 0, now).show,
  };
}

export async function buildAiMixNow(uid: number, aff: Affinity): Promise<BuildReport> {
  if (running.has(uid)) throw new Error('A build is already running. Try again in a minute.');
  running.add(uid);
  writeStale(key(uid, 'try'), Date.now());
  try {
    const r = await buildAiMix(uid, aff);
    writeStale(key(uid, 'err'), '');
    return r;
  } catch (e) {
    writeStale(key(uid, 'err'), e instanceof Error ? e.message : String(e));
    throw e;
  } finally {
    running.delete(uid);
  }
}
