'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { Item, Shelf, Track } from '@/lib/types';
import { artistNames, fmtTime, hrefFor } from '@/lib/format';
import { currentTrack, usePlayer } from '@/player/store';
import { useLibrary } from '@/player/library';
import { Avatar, Cover } from './Art';
import { Icon } from './Icon';
import { Tile } from './Bento';
import { useMenu } from './Menu';
import { warmProps } from '@/lib/warm';

export function playTrackFrom(item: Track, siblings?: Track[], source = 'shelf') {
  const list = siblings?.length ? siblings : [item];
  const i = list.findIndex((t) => t.id === item.id);
  if (list.length > 1) usePlayer.getState().play(list, Math.max(0, i), { source });
  else usePlayer.getState().playRadio(item);
}

export function ItemCard({ item, siblings }: { item: Item; siblings?: Track[] }) {
  const cur = usePlayer((s) => currentTrack(s)?.id);
  const playing = usePlayer((s) => s.playing);
  if (item.kind === 'song') {
    const active = cur === item.id;
    return (
      <button
        className={`it${active ? ' active' : ''}`}
        onClick={() => playTrackFrom(item, siblings)}
        onContextMenu={(e) => {
          e.preventDefault();
          useMenu.getState().open(item, e);
        }}
        title={`${item.title} by ${artistNames(item.artists)}`}
        {...warmProps(item.id)}
      >
        <div className="art">
          <Cover src={item.thumb} size="100%" />
          <span className="go"><Icon name={active && playing ? 'pause' : 'play'} size={18} /></span>
        </div>
        <div className="t clamp1">{item.title}</div>
        <div className="s clamp1">{artistNames(item.artists)}</div>
        <CardStyle />
      </button>
    );
  }
  const href = hrefFor(item)!;
  const round = item.kind === 'artist';
  return (
    <Link href={href} className="it" title={item.title}>
      <div className="art">
        {round ? <Avatar src={item.thumb} size="100%" /> : <Cover src={item.thumb} size="100%" radius={4} />}
        <span
          className="go"
          role="button"
          aria-label={`Play ${item.title}`}
          onClick={(e) => {
            // The play button plays straight away; the rest of the card opens the page.
            e.preventDefault();
            e.stopPropagation();
            playItem(item);
          }}
        >
          <Icon name="play" size={18} />
        </span>
      </div>
      <div className={`t clamp1${round ? ' c' : ''}`}>{item.title}</div>
      <div className={`s clamp1${round ? ' c' : ''}`}>
        {item.kind === 'album' ? [item.subtitle ?? artistNames(item.artists)].filter(Boolean).join(' · ') : item.subtitle}
      </div>
      <CardStyle />
    </Link>
  );
}

function CardStyle() {
  return (
    <style jsx global>{`
      .it { display: block; width: 100%; min-width: 0; text-align: start; border-radius: var(--r-sm); transition: transform .1s ease-out; }
      .it:active { transform: scale(.98); }
      .it .art { position: relative; width: 100%; aspect-ratio: 1; margin-bottom: 12px; border-radius: var(--r-sm); box-shadow: 0 16px 32px -20px rgba(0, 0, 0, .6); }
      .it .art:has(.round) { border-radius: 50%; }
      .it .t { font-weight: 600; font-size: .9375rem; color: var(--ink); line-height: 1.3; }
      .it .s { color: var(--muted); font-size: .8125rem; margin-top: 2px; white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .it .c { text-align: start; }
      .it.active .t { color: var(--signal-t); }
      .it:hover .t { text-decoration: underline; text-decoration-color: var(--border-2); text-underline-offset: 3px; }
      .it .go { position: absolute; inset-inline-end: 8px; bottom: 8px; width: 40px; height: 40px; border-radius: var(--r); display: grid; place-items: center; background: var(--signal); color: var(--on-signal); box-shadow: 0 8px 16px -6px rgba(0, 0, 0, .5); opacity: 0; transform: translateY(6px); transition: opacity .2s var(--ease), transform .2s var(--ease), background .15s; }
      .it .go:hover { background: var(--signal-hi); }
      .it:hover .go, .it:focus-visible .go, .it:focus-within .go, .it.active .go { opacity: 1; transform: none; }
      /* touch has no hover: the play control is always there */
      @media (hover: none) { .it .go { opacity: 1; transform: none; } }
      @media (max-width: 900px) { .it .t { font-size: .875rem; } .it .s { font-size: .75rem; } .it .go { width: 36px; height: 36px; } }
    `}</style>
  );
}

/** Plays what a card stands for: a song (with its shelf as the queue) or the radio of an album / playlist / artist. */
function playItem(item: Item) {
  if (item.kind === 'song') return playTrackFrom(item);
  const path = item.kind === 'album' ? `/api/album/${item.id}` : item.kind === 'artist' ? `/api/artist/${item.id}` : `/api/playlist/${item.id}`;
  fetch(path)
    .then((r) => r.json())
    .then((d: { tracks?: Track[]; topSongs?: Track[] }) => {
      const list = d.tracks?.length ? d.tracks : d.topSongs ?? [];
      if (list.length) usePlayer.getState().play(list, 0, { source: `${item.kind}:${item.id}` });
    })
    .catch(() => {});
}

function ShowAll({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button className="showall" onClick={onToggle}>
      {open ? 'Show less' : 'Show all'}
    </button>
  );
}

/** A shelf as a bento tile: title on top, cards scrolling inside. */
export function ShelfTile({ shelf, action, span = 12 }: { shelf: Shelf; action?: React.ReactNode; span?: number }) {
  const songs = shelf.items.filter((i): i is Track => i.kind === 'song');
  const [open, setOpen] = useState(false);
  return (
    <Tile
      span={span}
      md={12}
      title={shelf.title}
      sub={shelf.subtitle}
      action={
        <>
          {action}
          <ShowAll open={open} onToggle={() => setOpen(!open)} />
        </>
      }
      label={shelf.title}
    >
      <div className={`hscroll${open ? ' open' : ''}`}>
        {shelf.items.map((it) => (
          <ItemCard key={`${it.kind}:${it.id}`} item={it} siblings={songs.length > 1 ? songs : undefined} />
        ))}
      </div>
    </Tile>
  );
}

export function ShelfSkeleton({ title = true }: { title?: boolean }) {
  return (
    <section>
      {title && <div className="skeleton" style={{ width: 160, height: 28, borderRadius: 4, marginBottom: 14 }} />}
      <div className="hscroll">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i}>
            <div className="skeleton" style={{ width: '100%', aspectRatio: '1', borderRadius: 4, marginBottom: 12 }} />
            <div className="skeleton" style={{ width: '70%', height: 16, borderRadius: 4, marginBottom: 8 }} />
            <div className="skeleton" style={{ width: '45%', height: 12, borderRadius: 4 }} />
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
      className={`trow${active ? ' active' : ''}${showIndex ? ' idxrow' : ''}`}
      role="button"
      tabIndex={0}
      {...warmProps(track.id)}
      onClick={() => usePlayer.getState().play(list, index, { source: 'list' })}
      onKeyDown={(e) => e.key === 'Enter' && usePlayer.getState().play(list, index)}
      onContextMenu={(e) => {
        e.preventDefault();
        openMenu(e);
      }}
    >
      {showIndex && (
        <span className="idx">
          <span className="n">{active && playing ? <Bars /> : index + 1}</span>
          <span className="p"><Icon name={active && playing ? 'pause' : 'play'} size={14} /></span>
        </span>
      )}
      {showArt && <Cover src={track.thumb} size={40} radius={4} />}
      <div className="grow">
        <div className="tt clamp1">{track.title}</div>
        <div className="ta clamp1">
          {track.explicit && <span className="e">E</span>}
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
        </div>
        {track.why && <div className="ta why clamp1">{track.why}</div>}
      </div>
      {!showIndex && track.album?.name && (
        <div className="alb clamp1">
          {track.album.id ? (
            <Link href={`/album/${track.album.id}`} onClick={(e) => e.stopPropagation()}>
              {track.album.name}
            </Link>
          ) : (
            track.album.name
          )}
        </div>
      )}
      <button
        className={`icon-btn sm like${liked ? ' on' : ''}`}
        aria-label={liked ? 'Unlike' : 'Like'}
        onClick={(e) => {
          e.stopPropagation();
          toggleLike(track);
        }}
      >
        <Icon name={liked ? 'heartFill' : 'heart'} size={18} />
      </button>
      <span className="dur">{track.duration ? fmtTime(track.duration) : ''}</span>
      <button
        className="icon-btn sm more"
        aria-label="More"
        onClick={(e) => {
          e.stopPropagation();
          openMenu(e);
        }}
      >
        <Icon name="more" size={18} />
      </button>
      <style jsx>{`
        .trow { display: flex; align-items: center; gap: 16px; min-height: 56px; padding: 0 16px; border-radius: var(--r-sm); cursor: pointer; transition: background .12s ease-out, transform .1s ease-out; }
        .trow:active { transform: scale(.995); }
        .trow:hover { background: var(--row-hover); }
        .trow.active { background: transparent; }
        .idx { position: relative; width: 20px; height: 20px; flex: none; display: grid; place-items: center; text-align: end; color: var(--muted); font-family: var(--font-num); font-size: .8125rem; }
        .idx .p { position: absolute; inset: 0; display: none; place-items: center; color: var(--ink); }
        .trow:hover .idx .n { visibility: hidden; }
        .trow:hover .idx .p { display: grid; }
        .tt { font-weight: 500; font-size: .9375rem; color: var(--ink); }
        .trow.active .tt { color: var(--signal-t); }
        .ta { color: var(--muted); font-size: .8125rem; margin-top: 0; }
        .why { font-style: italic; opacity: .75; }
        .trow:hover .ta { color: var(--ink); }
        .ta :global(a:hover), .alb :global(a:hover) { color: var(--ink); text-decoration: underline; }
        .e { display: inline-grid; place-items: center; width: 16px; height: 16px; font-size: 10px; font-weight: 700; border-radius: 2px; background: var(--muted); color: var(--bg); margin-inline-end: 6px; vertical-align: 1px; }
        .alb { flex: 0 0 28%; color: var(--muted); font-size: .8125rem; }
        .trow:hover .alb { color: var(--ink); }
        .dur { min-width: 44px; text-align: end; color: var(--ink); font-weight: 500; font-size: .875rem; }
        .like, .more { opacity: 0; color: var(--muted); }
        .trow:hover .like, .like.on, .trow:focus-within .like, .trow:hover .more, .trow:focus-within .more { opacity: 1; }
        .like.on { color: var(--signal-t); }
        @media (max-width: 1100px) { .alb { display: none; } }
        @media (max-width: 900px) { .like { display: none; } .more { opacity: 1; } .trow { gap: 12px; padding: 0 8px; } }
      `}</style>
    </div>
  );
}

export function Bars() {
  return (
    <span className="bars" aria-label="Playing">
      <i /><i /><i />
      <style jsx>{`
        .bars { display: inline-flex; gap: 2px; align-items: flex-end; height: 13px; }
        .bars i { width: 3px; background: var(--signal); border-radius: 1px; animation: b .9s ease-in-out infinite; }
        .bars i:nth-child(2) { animation-delay: -.3s; }
        .bars i:nth-child(3) { animation-delay: -.6s; }
        @keyframes b { 0%, 100% { height: 4px; } 50% { height: 13px; } }
      `}</style>
    </span>
  );
}
