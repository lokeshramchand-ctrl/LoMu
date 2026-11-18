import 'server-only';
import type { AlbumCard, ArtistCard, ArtistRef, Item, PlaylistCard, Shelf, Track } from '@/lib/types';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const txt = (x: any): string => {
  if (x == null) return '';
  if (typeof x === 'string') return x;
  if (typeof x.text === 'string') return x.text;
  const s = x.toString?.();
  return typeof s === 'string' && s !== '[object Object]' ? s : '';
};

/** Rewrites Google image URLs to a crisp square size. */
export function sizedThumb(url: string | undefined, size = 544): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('//')) url = 'https:' + url;
  if (/googleusercontent\.com|ggpht\.com/.test(url)) {
    const base = url.split('=')[0];
    return `${base}=w${size}-h${size}-l90-rj`;
  }
  if (url.includes('i.ytimg.com')) {
    // Video thumbnails are 16:9; hq720/maxres are the sharpest, cropped to a square by CSS.
    return url.replace(/\/(default|mqdefault|hqdefault|sddefault|hq720)\.jpg.*$/, '/hq720.jpg');
  }
  return url;
}

function thumbList(node: any): { url: string; width?: number }[] {
  const t = node?.thumbnail ?? node?.thumbnails;
  if (!t) return [];
  if (Array.isArray(t)) return t;
  if (Array.isArray(t.contents)) return t.contents;
  if (Array.isArray(t.thumbnails)) return t.thumbnails;
  return [];
}

export function bestThumb(node: any, size = 544): string | undefined {
  const list = thumbList(node);
  if (!list.length) return undefined;
  const best = [...list].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
  return sizedThumb(best?.url, size);
}

const isChannel = (id?: string) => !!id && (id.startsWith('UC') || id.startsWith('FEmusic_library_privately_owned_artist'));

/** Artist refs from the item, falling back to the subtitle/flex-column runs. */
function artistsOf(node: any): ArtistRef[] {
  const direct: ArtistRef[] = (node?.artists ?? [])
    .map((a: any) => ({ id: a.channel_id || a.endpoint?.payload?.browseId, name: txt(a.name) }))
    .filter((a: ArtistRef) => a.name);
  if (direct.length) return direct;
  if (node?.author?.name) return [{ id: node.author.channel_id, name: txt(node.author.name) }];

  const runs: any[] = [
    ...(node?.flex_columns?.[1]?.title?.runs ?? []),
    ...(node?.subtitle?.runs ?? []),
    ...(node?.long_byline?.runs ?? []),
    ...(node?.short_byline?.runs ?? []),
  ];
  const linked = runs
    .filter((r) => isChannel(r?.endpoint?.payload?.browseId))
    .map((r) => ({ id: r.endpoint.payload.browseId, name: txt(r.text) }));
  if (linked.length) return dedupe(linked);
  const parts = txt(node?.flex_columns?.[1]?.title || node?.subtitle)
    .split(' • ')
    .map((x) => x.trim())
    .filter((x) => x && !KIND_WORDS.has(x) && !/^\d+(:\d+)+$/.test(x) && !/\b(views|plays|listeners|subscribers)\b/i.test(x));
  return parts[0] ? [{ name: parts[0] }] : [];
}

function dedupe(a: ArtistRef[]) {
  const seen = new Set<string>();
  return a.filter((x) => (seen.has(x.name) ? false : (seen.add(x.name), true)));
}

function albumOf(node: any): Track['album'] {
  if (node?.album?.name) return { id: node.album.id, name: txt(node.album.name) };
  const run = (node?.flex_columns?.[2]?.title?.runs ?? []).find((r: any) => r?.endpoint?.payload?.browseId?.startsWith('MPRE'));
  return run ? { id: run.endpoint.payload.browseId, name: txt(run.text) } : undefined;
}

const KIND_WORDS = new Set(['Song', 'Video', 'Album', 'Single', 'EP', 'Playlist', 'Artist', 'Profile', 'Episode', 'Podcast']);
const SUBTITLE_KINDS = /^(Song|Video|Album|Single|EP|Playlist|Artist|Profile|Episode)\s*•\s*/;

export function toTrack(node: any, fallback?: Partial<Track>): Track | null {
  const id: string | undefined = node?.video_id ?? node?.id ?? node?.endpoint?.payload?.videoId;
  if (!id || id.length !== 11) return null;
  const title = txt(node.title) || txt(node.name);
  if (!title) return null;
  const artists = artistsOf(node);
  return {
    kind: 'song',
    id,
    title,
    artists: artists.length ? artists : fallback?.artists ?? [],
    album: albumOf(node) ?? fallback?.album,
    duration: node.duration?.seconds || fallback?.duration || undefined,
    thumb: bestThumb(node) ?? fallback?.thumb,
    explicit: !!node.badges?.some?.((b: any) => /explicit/i.test(txt(b.label) || b.icon_type || '')),
    video: node.item_type === 'video' && !fallback?.album,
  };
}

export function toItem(node: any): Item | null {
  if (!node) return null;
  const kind: string = node.item_type ?? '';
  const title = txt(node.title) || txt(node.name);
  const subtitle = txt(node.subtitle).replace(SUBTITLE_KINDS, '') || undefined;
  switch (kind) {
    case 'song':
    case 'video':
    case 'non_music_track':
      return toTrack(node);
    case 'album': {
      const a: AlbumCard = {
        kind: 'album',
        id: node.id,
        title,
        subtitle,
        artists: artistsOf(node),
        year: node.year ? String(node.year) : undefined,
        thumb: bestThumb(node),
      };
      return a.id ? a : null;
    }
    case 'playlist': {
      const p: PlaylistCard = {
        kind: 'playlist',
        id: String(node.id ?? '').replace(/^VL/, ''),
        title,
        subtitle,
        thumb: bestThumb(node),
      };
      return p.id ? p : null;
    }
    case 'artist':
    case 'library_artist': {
      const a: ArtistCard = {
        kind: 'artist',
        id: node.id,
        title,
        subtitle: subtitle?.replace(/monthly audience/, 'listeners'),
        thumb: bestThumb(node, 400),
      };
      return a.id ? a : null;
    }
    default:
      return null;
  }
}

export function toShelf(section: any): Shelf | null {
  const title = txt(section?.header?.title) || txt(section?.title);
  const items = ((section?.contents ?? []) as any[]).map(toItem).filter(Boolean) as Item[];
  if (!title || !items.length) return null;
  return { title, subtitle: txt(section?.header?.strapline) || undefined, items };
}

export const compact = <T,>(a: (T | null | undefined)[]) => a.filter(Boolean) as T[];
