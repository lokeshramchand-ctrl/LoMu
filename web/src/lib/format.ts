import type { ArtistRef, Item } from './types';

export const fmtTime = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ss = sec.toString().padStart(2, '0');
  return h ? `${h}:${m.toString().padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

export const artistNames = (a: ArtistRef[] | undefined) => (a ?? []).map((x) => x.name).filter(Boolean).join(', ') || 'Unknown artist';

export const hrefFor = (i: Item): string | null => {
  switch (i.kind) {
    case 'album':
      return `/album/${encodeURIComponent(i.id)}`;
    case 'playlist':
      return `/playlist/${encodeURIComponent(i.id)}`;
    case 'artist':
      return `/artist/${encodeURIComponent(i.id)}`;
    default:
      return null;
  }
};

export const greeting = (d = new Date()) => {
  const h = d.getHours();
  if (h < 5) return ['Late', 'night'];
  if (h < 12) return ['Good', 'morning'];
  if (h < 17) return ['Good', 'afternoon'];
  return ['Good', 'evening'];
};
