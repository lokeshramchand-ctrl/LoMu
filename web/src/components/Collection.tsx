'use client';
import Link from 'next/link';
import type { ArtistRef, Track } from '@/lib/types';
import { usePlayer } from '@/player/store';
import { Cover, Disc } from './Art';
import { Icon } from './Icon';
import { TrackRow } from './Cards';

/** Shared header + tracklist for albums and playlists: the sleeve with its record sliding out. */
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
  return (
    <div className="fade-in">
      <header className="ch">
        <div className="rec">
          <div className="vinyl">
            <Disc src={thumb} size="100%" />
          </div>
          <div className="sleeve">{cover ?? <Cover src={thumb} size="100%" radius={24} />}</div>
        </div>
        <div className="info">
          <div className="eyebrow">{kind}</div>
          <h1 className="display ttl clamp2">{title}</h1>
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
          {meta && <div className="muted meta">{meta}</div>}
          {description && <p className="muted desc clamp2">{description}</p>}
          <div className="row" style={{ marginTop: 22, flexWrap: 'wrap' }}>
            <button className="pill-btn solid" disabled={!tracks.length} onClick={() => usePlayer.getState().play(tracks, 0, { source })}>
              <Icon name="play" size={16} /> Play
            </button>
            <button className="pill-btn" disabled={!tracks.length} onClick={() => usePlayer.getState().play(tracks, 0, { source, shuffle: true })}>
              <Icon name="shuffle" size={18} /> Shuffle
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
        .ch { display: flex; align-items: flex-end; gap: 44px; flex-wrap: wrap; }
        .rec { position: relative; width: 260px; height: 260px; flex: none; margin-right: 90px; }
        .vinyl { position: absolute; inset: 4%; transform: translateX(34%); transition: transform 0.8s var(--ease); }
        .rec:hover .vinyl { transform: translateX(42%) rotate(20deg); }
        .sleeve { position: absolute; inset: 0; }
        .info { flex: 1; min-width: 260px; }
        .ttl { font-size: clamp(34px, 4.6vw, 64px); margin: 8px 0 10px; }
        .by { font-size: 19px; font-weight: 700; letter-spacing: -0.02em; }
        .by :global(a:hover) { text-decoration: underline; }
        .meta { margin-top: 6px; font-weight: 550; }
        .desc { max-width: 640px; margin: 12px 0 0; line-height: 1.5; font-size: 14.5px; }
        .tl { margin-top: 40px; display: flex; flex-direction: column; gap: 2px; }
        @media (max-width: 900px) {
          .rec { width: 200px; height: 200px; margin-right: 70px; }
          .ch { gap: 26px; }
        }
      `}</style>
    </div>
  );
}

export function PageError({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="neu" style={{ padding: 28, borderRadius: 26, maxWidth: 560 }}>
      <div className="h3">Couldn&apos;t load this page</div>
      <p className="muted">{error instanceof Error ? error.message : String(error ?? 'Unknown error')}</p>
      {retry && (
        <button className="pill-btn" onClick={retry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div style={{ display: 'flex', gap: 40, alignItems: 'flex-end' }}>
      <div className="skeleton" style={{ width: 260, height: 260, borderRadius: 24 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton" style={{ width: '60%', height: 54, borderRadius: 12 }} />
        <div className="skeleton" style={{ width: '30%', height: 20, borderRadius: 8, marginTop: 16 }} />
      </div>
    </div>
  );
}
