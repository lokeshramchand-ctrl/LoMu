'use client';
import Link from 'next/link';
import type { Item, Shelf, Track } from '@/lib/types';
import { artistNames, fmtTime, hrefFor } from '@/lib/format';
import { currentTrack, usePlayer } from '@/player/store';
import { useLibrary } from '@/player/library';
import { Avatar, Cover, Disc } from './Art';
import { Icon } from './Icon';
import { useMenu } from './Menu';

const CARD = 168;

export function ItemCard({ item, siblings }: { item: Item; siblings?: Track[] }) {
  const cur = usePlayer((s) => currentTrack(s)?.id);
  const playing = usePlayer((s) => s.playing);
  if (item.kind === 'song') {
    const active = cur === item.id;
    return (
      <button
        className="card"
        onClick={() => {
          const list = siblings?.length ? siblings : [item];
          const i = list.findIndex((t) => t.id === item.id);
          if (list.length > 1) usePlayer.getState().play(list, Math.max(0, i), { source: 'shelf' });
          else usePlayer.getState().playRadio(item);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          useMenu.getState().open(item, e);
        }}
        title={`${item.title} — ${artistNames(item.artists)}`}
      >
        <div className="art">
          <Disc src={item.thumb} size={CARD} spin={active} paused={active && !playing} />
          <span className="hover-play neu-sm"><Icon name={active && playing ? 'pause' : 'play'} size={18} /></span>
        </div>
        <div className="t clamp1">{item.title}</div>
        <div className="s clamp1">{artistNames(item.artists)}</div>
        <CardStyle />
      </button>
    );
  }
  const href = hrefFor(item)!;
  return (
    <Link href={href} className="card" title={item.title}>
      <div className="art">
        {item.kind === 'artist' ? <Avatar src={item.thumb} size={CARD} /> : <Cover src={item.thumb} size={CARD} />}
      </div>
      <div className="t clamp1" style={item.kind === 'artist' ? { textAlign: 'center' } : undefined}>{item.title}</div>
      <div className="s clamp1" style={item.kind === 'artist' ? { textAlign: 'center' } : undefined}>
        {item.kind === 'album' ? [item.subtitle ?? artistNames(item.artists)].filter(Boolean).join(' · ') : item.subtitle}
      </div>
      <CardStyle />
    </Link>
  );
}

function CardStyle() {
  return (
    <style jsx global>{`
      .card { display: block; width: ${CARD}px; text-align: left; }
      .card .art { position: relative; margin-bottom: 14px; transition: transform .35s var(--ease); }
      .card:hover .art { transform: translateY(-3px); }
      .card .t { font-weight: 700; font-size: 15px; letter-spacing: -0.015em; }
      .card .s { color: var(--ink-2); font-size: 13.5px; margin-top: 3px; }
      .card .hover-play { position: absolute; right: 6px; bottom: 6px; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; opacity: 0; transform: scale(.85); transition: all .25s var(--ease); z-index: 3; }
      .card:hover .hover-play, .card:focus-visible .hover-play { opacity: 1; transform: none; }
      @media (max-width: 900px) { .card { width: 138px; } .card .art > * { width: 138px !important; height: 138px !important; } }
    `}</style>
  );
}

export function ShelfRow({ shelf, action }: { shelf: Shelf; action?: React.ReactNode }) {
  const songs = shelf.items.filter((i): i is Track => i.kind === 'song');
  return (
    <section className="section fade-in">
      <div className="section-head">
        <h2 className="h3">{shelf.title}</h2>
        {action}
      </div>
      <div className="hscroll">
        {shelf.items.map((it) => (
          <ItemCard key={`${it.kind}:${it.id}`} item={it} siblings={songs.length > 1 ? songs : undefined} />
        ))}
      </div>
    </section>
  );
}

export function ShelfSkeleton({ title = true }: { title?: boolean }) {
  return (
    <section className="section">
      {title && <div className="skeleton" style={{ width: 180, height: 22, borderRadius: 8, marginBottom: 18 }} />}
      <div className="hscroll">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i}>
            <div className="skeleton" style={{ width: CARD, height: CARD, borderRadius: '50%', marginBottom: 14 }} />
            <div className="skeleton" style={{ width: 120, height: 14, borderRadius: 6 }} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function TrackRow({
  track,
  index,
  list,
  showIndex,
  showArt = true,
  playlistId,
}: {
  track: Track;
  index: number;
  list: Track[];
  showIndex?: boolean;
  showArt?: boolean;
  playlistId?: string;
}) {
  const active = usePlayer((s) => currentTrack(s)?.id === track.id);
  const playing = usePlayer((s) => s.playing);
  const liked = useLibrary((s) => !!s.liked[track.id]);
  const toggleLike = useLibrary((s) => s.toggleLike);
  const openMenu = (e: { clientX: number; clientY: number }) => useMenu.getState().open(track, e, playlistId ? { playlistId, playlistIndex: index } : undefined);
  return (
    <div
      className={`trow${active ? ' active' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => usePlayer.getState().play(list, index, { source: 'list' })}
      onKeyDown={(e) => e.key === 'Enter' && usePlayer.getState().play(list, index)}
      onContextMenu={(e) => {
        e.preventDefault();
        openMenu(e);
      }}
    >
      {showIndex && <span className="idx">{active && playing ? <Bars /> : index + 1}</span>}
      {showArt && <Disc src={track.thumb} size={48} spin={active} paused={active && !playing} />}
      <div className="grow">
        <div className="tt clamp1">
          {track.title}
          {track.explicit && <span className="e">E</span>}
        </div>
        <div className="ta clamp1">
          {track.artists.map((a, i) => (
            <span key={i}>
              {i > 0 && ', '}
              {a.id ? (
                <Link href={`/artist/${a.id}`} onClick={(e) => e.stopPropagation()}>
                  {a.name}
                </Link>
              ) : (
                a.name
              )}
            </span>
          ))}
          {track.album?.name && !showIndex && <span> · {track.album.name}</span>}
        </div>
      </div>
      <button
        className={`icon-btn like${liked ? ' on' : ''}`}
        aria-label={liked ? 'Unlike' : 'Like'}
        onClick={(e) => {
          e.stopPropagation();
          toggleLike(track);
        }}
      >
        <Icon name={liked ? 'heartFill' : 'heart'} size={19} />
      </button>
      <span className="dur">{track.duration ? fmtTime(track.duration) : ''}</span>
      <button
        className="icon-btn"
        aria-label="More"
        onClick={(e) => {
          e.stopPropagation();
          openMenu(e);
        }}
      >
        <Icon name="more" size={20} />
      </button>
      <style jsx>{`
        .trow { display: flex; align-items: center; gap: 16px; padding: 10px 14px; border-radius: 20px; cursor: pointer; transition: background .2s; }
        .trow:hover { background: color-mix(in oklab, var(--surface-2) 70%, transparent); }
        .trow.active { background: var(--surface); box-shadow: var(--neu-sm); }
        .idx { width: 22px; text-align: center; color: var(--ink-2); font-variant-numeric: tabular-nums; font-weight: 600; font-size: 14px; }
        .tt { font-weight: 650; font-size: 15px; letter-spacing: -0.01em; }
        .ta { color: var(--ink-2); font-size: 13.5px; margin-top: 2px; }
        .ta :global(a:hover) { color: var(--ink); text-decoration: underline; }
        .e { display: inline-grid; place-items: center; width: 16px; height: 16px; font-size: 10px; font-weight: 800; border-radius: 4px; background: var(--ink-3); color: var(--surface); margin-left: 8px; vertical-align: 2px; }
        .dur { width: 44px; text-align: right; color: var(--ink-2); font-variant-numeric: tabular-nums; font-size: 13.5px; }
        .like { opacity: 0; color: var(--ink-2); }
        .trow:hover .like, .like.on { opacity: 1; }
        .like.on { color: var(--ink); }
        @media (max-width: 900px) { .dur { display: none; } .like { display: none; } .trow { gap: 12px; padding: 8px 6px; } }
      `}</style>
    </div>
  );
}

export function Bars() {
  return (
    <span className="bars" aria-label="Playing">
      <i /><i /><i />
      <style jsx>{`
        .bars { display: inline-flex; gap: 2px; align-items: flex-end; height: 14px; }
        .bars i { width: 3px; background: var(--ink); border-radius: 2px; animation: b 0.9s ease-in-out infinite; }
        .bars i:nth-child(2) { animation-delay: -0.3s; }
        .bars i:nth-child(3) { animation-delay: -0.6s; }
        @keyframes b { 0%, 100% { height: 4px; } 50% { height: 14px; } }
      `}</style>
    </span>
  );
}
