import 'server-only';
import { cached } from './yt';

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ArtistExtra = { image?: string; banner?: string; genre?: string; origin?: string; since?: string; bio?: string; bioSource?: string };

const UA = { 'user-agent': 'LoMu/1.0 (personal non-commercial music player)' };
const norm = (s: string) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/^the /, '').replace(/[^a-z0-9]+/g, ' ').trim();

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(4500) });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

const val = (x: unknown) => (typeof x === 'string' && x.trim() && x !== 'null' ? x.trim() : undefined);

/** TheAudioDB: square artist photo, wide banner, genre, origin, formation year. */
async function audiodb(name: string): Promise<ArtistExtra | null> {
  const d = await getJson(`https://www.theaudiodb.com/api/v1/json/123/search.php?s=${encodeURIComponent(name)}`);
  const a = (d?.artists ?? []).find((x: any) => norm(x.strArtist ?? '') === norm(name));
  if (!a) return null;
  return {
    image: val(a.strArtistThumb),
    banner: val(a.strArtistWideThumb) ?? val(a.strArtistFanart),
    genre: val(a.strGenre),
    origin: val(a.strCountry),
    since: val(a.intFormedYear) ?? val(a.intBornYear),
    bio: val(a.strBiographyEN),
    bioSource: val(a.strBiographyEN) ? 'TheAudioDB' : undefined,
  };
}

const MUSICAL = /\b(singer|rapper|musician|band|group|duo|composer|producer|dj|songwriter|vocalist|guitarist|music)\b/i;

/** Wikipedia: biography (and a portrait as a last-resort image). */
async function wikipedia(name: string): Promise<ArtistExtra | null> {
  for (const title of [name, `${name} (musician)`, `${name} (band)`, `${name} (singer)`, `${name} (rapper)`]) {
    try {
      const d = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`);
      if (d?.type === 'standard' && d.extract && MUSICAL.test(`${d.description ?? ''} ${d.extract}`)) {
        return { bio: d.extract, bioSource: 'Wikipedia', image: d.originalimage?.source ?? d.thumbnail?.source };
      }
    } catch {
      /* try the next title */
    }
  }
  return null;
}

/** Best-effort artist extras. Every source is optional; failures are silent. */
export function enrichArtist(name: string, needBio: boolean): Promise<ArtistExtra> {
  return cached(`enrich:${norm(name)}:${needBio ? 1 : 0}`, 24 * 3600_000, async () => {
    const [adb, wp] = await Promise.all([audiodb(name).catch(() => null), wikipedia(name).catch(() => null)]);
    return {
      image: adb?.image ?? wp?.image,
      banner: adb?.banner,
      genre: adb?.genre,
      origin: adb?.origin,
      since: adb?.since,
      bio: needBio ? wp?.bio ?? adb?.bio : undefined,
      bioSource: needBio ? (wp?.bio ? 'Wikipedia' : adb?.bioSource) : undefined,
    };
  });
}
