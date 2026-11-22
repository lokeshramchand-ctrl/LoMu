'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ArtistRef, Track } from '@/lib/types';
import { usePlayer } from '@/player/store';
import { Cover } from './Art';
import { Icon } from './Icon';
import { Bento } from './Bento';
import { TrackRow } from './Cards';

/** "1:45:13" for a total running time in seconds. */
export function runTime(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

/**
 * Shared page for albums, playlists and generated mixes, after the Soundwaves reference: round controls on top, one
 * pastel card (small label, title, cover, song count with running time, black shuffle button), then plain song rows.
 */
export function Collection({
  kind,
  title,
  thumb,
  artists,
  meta,
  description,
  tracks,
  source,
  actions,
  playlistId,
  cover,
  empty,
  heading,
  eyebrow,
  extra,
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
  empty?: React.ReactNode;
  heading?: React.ReactNode;
  eyebrow?: string;
  extra?: React.ReactNode;
}) {
  const router = useRouter();
  const [more, setMore] = useState(false);
  const total = tracks.reduce((n, t) => n + (t.duration || 0), 0);
  const fill = `var(--tile-${(Math.abs([...title].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7)) % 4) + 1})`;
  const label = eyebrow ?? (artists?.length ? artists.map((a) => a.name).join(', ') : 'Selected for you');
  return (
    <Bento className="fade-in">
      <div className="acol">
        <div className="abar">
          {actions && <div className="apill">{actions}</div>}
          <div className="grow" />
          <button className="aclose" aria-label="Close" onClick={() => router.back()}>
            <Icon name="close" size={18} />
          </button>
        </div>

        <section className="acard" style={{ background: fill }} aria-label={`${kind} header`}>
          <div className="alab clamp1">{label}</div>
          {heading ?? <h1 className="atitle clamp2">{title}</h1>}
          <button className="aart" aria-label={`Play ${title}`} disabled={!tracks.length} onClick={() => usePlayer.getState().play(tracks, 0, { source })}>
            {cover ?? <Cover src={thumb} size="100%" radius={28} />}
          </button>
          <div className="afoot">
            <span className="aicon"><Icon name="waveform" size={22} /></span>
            <div className="grow">
              <b>{tracks.length} {tracks.length === 1 ? 'song' : 'songs'}</b>
              <span>{total ? runTime(total) : meta}</span>
            </div>
            <button className="ashuf" aria-label="Shuffle play" title="Shuffle" disabled={!tracks.length} onClick={() => usePlayer.getState().play(tracks, 0, { source, shuffle: true })}>
              <Icon name="shuffle" size={22} />
            </button>
          </div>
        </section>

        {!tracks.length && <div className="aempty">{empty}</div>}
        {tracks.length > 0 && (
          <div className="alist">
            {tracks.map((t, i) => (
              <TrackRow key={`${t.id}-${i}`} track={t} index={i} list={tracks} showArt showArtist={false} playlistId={playlistId} />
            ))}
          </div>
        )}

        {description && (
          <div className="adesc">
            <p className={`ph-desc${more ? '' : ' clamp4'}`}>{description}</p>
            {description.length > 140 && (
              <button className="ph-more" onClick={() => setMore(!more)}>
                {more ? 'Show less' : 'Show full description'}
              </button>
            )}
          </div>
        )}
      </div>
      {extra}
    </Bento>
  );
}

export function PageError({ error, retry }: { error: unknown; retry?: () => void }) {
  if (error) console.error(error); // details stay in the console, not on the page
  return (
    <div className="callout err" style={{ maxWidth: 560 }}>
      <Icon name="warn" size={20} />
      <div className="grow">
        <b>This page did not load</b>
        <div className="small">Check your connection and try again.</div>
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
    <div className="tile" style={{ flexDirection: 'row', gap: 24, alignItems: 'flex-end' }}>
      <div className="skeleton" style={{ width: 232, height: 232, borderRadius: 4 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton" style={{ width: '55%', height: 64, borderRadius: 8 }} />
        <div className="skeleton" style={{ width: '25%', height: 16, borderRadius: 6, marginTop: 14 }} />
      </div>
    </div>
  );
}
