'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { ArtistRef, Track } from '@/lib/types';
import { usePlayer } from '@/player/store';
import { Cover } from './Art';
import { Icon } from './Icon';
import { TrackRow } from './Cards';

/** Shared header + tracklist for albums and playlists. */
export function Collection({
  kind,
  title,
  thumb,
  artists,
  meta,
  description,
  tracks,
  source,
  numbered,
  actions,
  playlistId,
  cover,
}: {
  kind: string;
  title: string;
  thumb?: string;
  artists?: ArtistRef[];
  meta?: string;
  description?: string;
  tracks: Track[];
  source: string;
  numbered?: boolean;
  actions?: React.ReactNode;
  playlistId?: string;
  cover?: React.ReactNode;
}) {
  const [more, setMore] = useState(false);
  return (
    <div className="fade-in">
      <header className="ch card pad">
        {thumb && <div className="amb" aria-hidden style={{ backgroundImage: `url(${thumb})` }} />}
        <div className="art">{cover ?? <Cover src={thumb} size="100%" radius={14} />}</div>
        <div className="info">
          <div className="eyebrow">{kind}</div>
          <h1 className="h1 ttl clamp2">{title}</h1>
          {artists && artists.length > 0 && (
            <div className="by">
              {artists.map((a, i) => (
                <span key={i}>
                  {i > 0 && ', '}
                  {a.id ? <Link href={`/artist/${a.id}`}>{a.name}</Link> : a.name}
                </span>
              ))}
            </div>
          )}
          {meta && <div className="muted small meta">{meta}</div>}
          {description && (
            <div className="descwrap">
              <p className={`muted desc${more ? '' : ' clamp2'}`}>{description}</p>
              {description.length > 140 && (
                <button className="morebtn" onClick={() => setMore(!more)}>
                  {more ? 'Show less' : 'More'}
                </button>
              )}
            </div>
          )}
          <div className="row" style={{ marginTop: 18, flexWrap: 'wrap' }}>
            <button className="btn primary" disabled={!tracks.length} onClick={() => usePlayer.getState().play(tracks, 0, { source })}>
              <Icon name="play" size={14} /> Play
            </button>
            <button className="btn" disabled={!tracks.length} onClick={() => usePlayer.getState().play(tracks, 0, { source, shuffle: true })}>
              <Icon name="shuffle" size={16} /> Shuffle
            </button>
            {actions}
          </div>
        </div>
      </header>
      <div className="tl">
        {tracks.map((t, i) => (
          <TrackRow key={`${t.id}-${i}`} track={t} index={i} list={tracks} showIndex={numbered} showArt={!numbered} playlistId={playlistId} />
        ))}
      </div>
      <style jsx>{`
        .ch { position: relative; overflow: hidden; display: flex; align-items: flex-end; gap: 28px; flex-wrap: wrap; }
        .amb { position: absolute; inset: -20%; background-size: cover; background-position: center; filter: blur(60px) saturate(1.4); opacity: .16; pointer-events: none; }
        .art, .info { position: relative; }
        .descwrap { margin-top: 10px; }
        .descwrap .desc { margin: 0; }
        .morebtn { margin-top: 4px; color: var(--signal); font-weight: 500; font-size: 13px; }
        .art { width: 208px; height: 208px; flex: none; }
        .info { flex: 1; min-width: 240px; }
        .ttl { margin: 6px 0 6px; font-size: clamp(1.6rem, 3vw, 2.4rem); }
        .by { font-size: 15px; font-weight: 500; }
        .by :global(a:hover) { text-decoration: underline; }
        .meta { margin-top: 4px; }
        .desc { max-width: 640px; margin: 10px 0 0; font-size: 13.5px; }
        .tl { margin-top: 18px; display: flex; flex-direction: column; gap: 1px; }
        @media (max-width: 900px) { .art { width: 148px; height: 148px; } .ch { gap: 18px; } }
      `}</style>
    </div>
  );
}

export function PageError({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="callout err" style={{ maxWidth: 560 }}>
      <Icon name="warn" size={20} />
      <div className="grow">
        <b>Couldn&apos;t load this page</b>
        <div className="small">{error instanceof Error ? error.message : String(error ?? 'Unknown error')}</div>
      </div>
      {retry && (
        <button className="btn sm" onClick={retry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="card pad" style={{ display: 'flex', gap: 28, alignItems: 'flex-end' }}>
      <div className="skeleton" style={{ width: 208, height: 208, borderRadius: 14 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton" style={{ width: '55%', height: 38, borderRadius: 8 }} />
        <div className="skeleton" style={{ width: '25%', height: 16, borderRadius: 6, marginTop: 14 }} />
      </div>
    </div>
  );
}
