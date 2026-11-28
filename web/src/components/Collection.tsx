'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ArtistRef, Track } from '@/lib/types';
import { usePlayer } from '@/player/store';
import { Cover } from './Art';
import { Icon } from './Icon';
import { Bento } from './Bento';
import { TrackRow } from './Cards';
import { toast } from './Toast';

export function runTime(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

function SaveOffline({ tracks }: { tracks: Track[] }) {
  const [state, setState] = useState<{ enabled: boolean; saved: number }>({ enabled: false, saved: 0 });
  const ids = tracks.map((t) => t.id);
  const key = ids.join(',');
  useEffect(() => {
    if (!key) return;
    let live = true;
    const load = () => fetch(`/api/offline?ids=${key}`).then((r) => r.json()).then((d) => live && setState(d)).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [key]);
  if (!state.enabled || !ids.length) return null;
  const done = state.saved >= ids.length;
  return (
    <button
      className="btn sm"
      disabled={done}
      onClick={() =>
        fetch('/api/offline', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids }) })
          .then((r) => r.json())
          .then((d) => toast(d.queued ? `Saving ${d.queued} songs for offline` : 'Already saved or saving'))
          .catch(() => toast('Could not start the download'))
      }
    >
      {done ? 'Saved offline' : state.saved ? `Save offline (${state.saved}/${ids.length})` : 'Save offline'}
    </button>
  );
}

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

        <SaveOffline tracks={tracks} />
        {!tracks.length && <div className="aempty">{empty}</div>}
        {tracks.length > 0 && (
          <div className="alist">
            {tracks.map((t, i) => (
              <TrackRow key={`${t.id}-${i}`} track={t} index={i} list={tracks} showArt playlistId={playlistId} />
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
  if (error) console.error(error);
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
