'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/* The phone's cover colour wash: the vivid colour of the playing song's artwork at the top, fading to the page colour,
   with the blurred cover over it. Home and the full player share this one layer so they match after a song change. */

const cache = new Map<string, string | null>();

/** Most common saturated colour of the artwork, pushed to a rich mid-dark tone (the phone's playerTint). */
function vivid(img: HTMLImageElement): string | null {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) return null;
  g.drawImage(img, 0, 0, 32, 32);
  const px = g.getImageData(0, 0, 32, 32).data; // throws when the image is not CORS-readable
  const buckets = new Map<number, { w: number; r: number; g: number; b: number }>();
  for (let i = 0; i < px.length; i += 4) {
    const [r, gr, b] = [px[i], px[i + 1], px[i + 2]];
    const max = Math.max(r, gr, b), min = Math.min(r, gr, b);
    const s = max ? (max - min) / max : 0;
    const h = Math.round((hue(r, gr, b) / 360) * 12) % 12;
    const e = buckets.get(h) ?? { w: 0, r: 0, g: 0, b: 0 };
    const w = 0.15 + s * (max / 255); // vivid, bright pixels count most
    e.w += w; e.r += r * w; e.g += gr * w; e.b += b * w;
    buckets.set(h, e);
  }
  const top = [...buckets.values()].sort((a, b) => b.w - a.w)[0];
  if (!top) return null;
  const [h, s, v] = rgb2hsv(top.r / top.w, top.g / top.w, top.b / top.w);
  return `hsl(${h} ${Math.round(hsv2hslS(h, Math.max(s, 0.92), Math.min(1, Math.max(v, 0.7))) * 100)}% ${Math.round(hsv2hslL(Math.max(s, 0.92), Math.min(1, Math.max(v, 0.7))) * 100)}%)`;
}
const hue = (r: number, g: number, b: number) => rgb2hsv(r, g, b)[0];
function rgb2hsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  let h = 0;
  if (d) h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [Math.round(h * 60), max ? d / max : 0, max];
}
const hsv2hslL = (s: number, v: number) => v * (1 - s / 2);
const hsv2hslS = (_h: number, s: number, v: number) => { const l = hsv2hslL(s, v); return l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l); };

/** The artwork's wash colour, or null until it has been read (or when the image cannot be read). */
export function useCoverTint(thumb?: string): string | null {
  const [tint, setTint] = useState<string | null>(thumb ? cache.get(thumb) ?? null : null);
  useEffect(() => {
    if (!thumb) return setTint(null);
    if (cache.has(thumb)) return setTint(cache.get(thumb) ?? null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      let c: string | null = null;
      try { c = vivid(img); } catch { /* tainted canvas: no colour, the blurred cover still shows */ }
      cache.set(thumb, c);
      setTint(c); // the previous colour stays until the new one is ready, so a song change fades
    };
    img.onerror = () => cache.set(thumb, null);
    img.src = thumb;
  }, [thumb]);
  return tint;
}

/**
 * Fixed layer behind the page. `page` also makes the shell transparent (html.wash) so the layer shows through;
 * without it the layer fills its positioned parent (the full player).
 */
export function CoverWash({ thumb, page = false }: { thumb?: string; page?: boolean }) {
  const tint = useCoverTint(thumb);
  useEffect(() => {
    if (!page) return;
    document.documentElement.classList.add('wash');
    return () => document.documentElement.classList.remove('wash');
  }, [page]);
  if (!thumb) return null;
  const layer = (
    <div className={`wash${page ? ' page' : ''}`} aria-hidden style={tint ? ({ '--tint': tint } as React.CSSProperties) : undefined}>
      <div className="wash-img" style={{ backgroundImage: `url(${thumb})` }} />
    </div>
  );
  // fixed inside the page's animated container would be clipped to it, so the page layer lives on <body>
  return page ? createPortal(layer, document.body) : layer;
}
