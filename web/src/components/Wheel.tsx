'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Disc } from './Art';
import { Icon } from './Icon';

export type WheelItem = { key: string; title: string; subtitle: string; thumb?: string };

const ITEM_H = 132;
const RADIUS = 560; // px radius of the arc the rows ride on
const STEP = 0.24; // radians between neighbouring rows

export function Wheel({
  items,
  onPlay,
  onCenter,
  playLabel = 'Play',
  activeKey,
}: {
  items: WheelItem[];
  onPlay: (index: number) => void;
  onCenter?: (index: number) => void;
  playLabel?: string;
  activeKey?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const rows = useRef<(HTMLDivElement | null)[]>([]);
  const [center, setCenter] = useState(0);
  const centerRef = useRef(0);

  const layout = useCallback(() => {
    const el = box.current;
    if (!el) return;
    const b = el.getBoundingClientRect();
    const cy = b.top + b.height / 2;
    let best = 0;
    let bestD = Infinity;
    rows.current.forEach((node, i) => {
      if (!node) return;
      const r = node.getBoundingClientRect();
      const d = (r.top + r.height / 2 - cy) / ITEM_H;
      const ad = Math.abs(d);
      if (ad < bestD) {
        bestD = ad;
        best = i;
      }
      const theta = Math.max(-1.25, Math.min(1.25, d * STEP));
      const x = RADIUS * (1 - Math.cos(theta));
      const rot = (-theta * 180) / Math.PI * 0.85;
      const scale = 1 - Math.min(ad, 4) * 0.05;
      node.style.transform = `translateX(${x.toFixed(1)}px) rotate(${rot.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      node.style.opacity = Math.max(0.06, 1 - ad * 0.22).toFixed(3);
    });
    if (best !== centerRef.current) {
      centerRef.current = best;
      setCenter(best);
      onCenter?.(best);
    }
  }, [onCenter]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(() => ((raf = 0), layout()));
    };
    layout();
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [layout, items]);

  const scrollTo = (i: number) => {
    const node = rows.current[i];
    const el = box.current;
    if (!node || !el) return;
    el.scrollTo({ top: node.offsetTop - el.clientHeight / 2 + ITEM_H / 2, behavior: 'smooth' });
  };

  return (
    <div
      className="wheel"
      ref={box}
      tabIndex={0}
      aria-label="Explore list"
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown') (e.preventDefault(), scrollTo(Math.min(items.length - 1, center + 1)));
        if (e.key === 'ArrowUp') (e.preventDefault(), scrollTo(Math.max(0, center - 1)));
        if (e.key === 'Enter') onPlay(center);
      }}
    >
      <div className="spacer" />
      {items.map((it, i) => (
        <div
          key={it.key}
          ref={(n) => {
            rows.current[i] = n;
          }}
          className={`wrow${i === center ? ' center' : ''}`}
          onClick={() => (i === center ? onPlay(i) : scrollTo(i))}
        >
          <Disc src={it.thumb} size={112} spin={activeKey === it.key} />
          <div className="txt">
            <div className="t clamp1">{it.title}</div>
            <div className="s clamp1">{it.subtitle}</div>
          </div>
          <button
            className="play"
            tabIndex={i === center ? 0 : -1}
            onClick={(e) => {
              e.stopPropagation();
              onPlay(i);
            }}
          >
            {playLabel === 'Play' ? 'Play' : <Icon name="play" size={16} />}
          </button>
        </div>
      ))}
      <div className="spacer" />
      <style jsx>{`
        .wheel {
          position: relative; height: 100%; overflow-y: auto; overflow-x: hidden; scroll-snap-type: y mandatory;
          scrollbar-width: none; overscroll-behavior: contain; outline: none;
          mask-image: linear-gradient(180deg, transparent, #000 14%, #000 86%, transparent);
        }
        .wheel::-webkit-scrollbar { display: none; }
        .spacer { height: calc(50% - ${ITEM_H / 2}px); }
        .wrow {
          position: relative; height: ${ITEM_H}px; display: flex; align-items: center; gap: 20px; padding-left: 10px;
          scroll-snap-align: center; transform-origin: 66px 50%; cursor: pointer; will-change: transform, opacity;
        }
        .wrow::before {
          content: ''; position: absolute; left: 0; top: 10px; bottom: 10px; right: 0; border-radius: 999px;
          background: var(--surface); box-shadow: var(--neu-md); opacity: 0; transform: scaleX(.92); transform-origin: left center;
          transition: opacity .35s var(--ease), transform .35s var(--ease); z-index: -1;
        }
        .wrow.center::before { opacity: 1; transform: none; }
        .txt { min-width: 0; flex: 1; }
        .t { font-size: 21px; font-weight: 800; letter-spacing: -0.035em; }
        .s { font-size: 15px; color: var(--ink-2); font-weight: 500; margin-top: 3px; }
        .play {
          height: 46px; padding: 0 24px; border-radius: 999px; margin-right: 14px; font-weight: 650; font-size: 15px;
          background: var(--surface); box-shadow: var(--neu-sm), inset 0 0 0 1px rgba(255,255,255,.5);
          opacity: 0; pointer-events: none; transition: opacity .3s var(--ease);
        }
        .wrow.center .play { opacity: 1; pointer-events: auto; }
        .play:active { box-shadow: var(--neu-in); }
        .wrow:not(.center) .t { color: color-mix(in oklab, var(--ink) 80%, var(--ink-2)); }
        @media (max-width: 900px) { .t { font-size: 18px; } .s { font-size: 14px; } }
      `}</style>
    </div>
  );
}
