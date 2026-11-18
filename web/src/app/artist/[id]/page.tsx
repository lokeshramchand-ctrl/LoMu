'use client';
import { use, useState } from 'react';
import { useArtist } from '@/lib/api';
import { PageError, PageSkeleton } from '@/components/Collection';
import { ShelfRow, TrackRow } from '@/components/Cards';
import { Avatar } from '@/components/Art';
import { Icon } from '@/components/Icon';
import { useLibrary } from '@/player/library';
import { usePlayer } from '@/player/store';
import { useSettings } from '@/player/settings';

export default function ArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent(use(params).id);
  const enrich = useSettings((s) => s.dev.artistEnrichment);
  const { data, isLoading, error, refetch } = useArtist(id, enrich);
  const following = useLibrary((s) => !!s.artists[id]);
  const [bioOpen, setBioOpen] = useState(false);
  if (isLoading) return <PageSkeleton />;
  if (error || !data) return <PageError error={error} retry={() => refetch()} />;

  const photo = data.image ?? data.thumb;
  const facts = [data.genre, data.origin, data.since && `since ${data.since}`, data.subscribers].filter(Boolean);
  return (
    <div className="fade-in">
      <header className="ah">
        {data.banner && (
          <div className="banner" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.banner} alt="" referrerPolicy="no-referrer" />
          </div>
        )}
        <div className="row hero">
          <Avatar src={photo} size={220} alt={data.name} />
          <div className="grow">
            <div className="eyebrow">Artist</div>
            <h1 className="display name">{data.name}</h1>
            {facts.length > 0 && <div className="muted facts">{facts.join(' · ')}</div>}
            <div className="row" style={{ marginTop: 20, flexWrap: 'wrap' }}>
              <button className="pill-btn solid" disabled={!data.topSongs.length} onClick={() => usePlayer.getState().play(data.topSongs, 0, { source: `artist:${id}` })}>
                <Icon name="play" size={16} /> Play
              </button>
              {data.topSongs[0] && (
                <button className="pill-btn" onClick={() => usePlayer.getState().playRadio(data.topSongs[0])}>
                  <Icon name="radio" size={17} /> Radio
                </button>
              )}
              <button className="pill-btn" onClick={() => useLibrary.getState().toggleSaved({ kind: 'artist', id, title: data.name, thumb: photo })}>
                <Icon name={following ? 'check' : 'plus'} size={17} /> {following ? 'Following' : 'Follow'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {data.topSongs.length > 0 && (
        <section className="section">
          <h2 className="h3" style={{ marginBottom: 12 }}>Top songs</h2>
          {data.topSongs.map((t, i) => (
            <TrackRow key={t.id} track={t} index={i} list={data.topSongs} />
          ))}
        </section>
      )}

      {data.shelves.map((s) => (
        <ShelfRow key={s.title} shelf={s} />
      ))}

      {data.description && (
        <section className="section">
          <h2 className="h3" style={{ marginBottom: 12 }}>About</h2>
          <div className="about neu">
            <p className={bioOpen ? '' : 'clamp4'}>{data.description}</p>
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 10 }}>
              <button className="more" onClick={() => setBioOpen(!bioOpen)}>{bioOpen ? 'Show less' : 'Read more'}</button>
              {data.bioSource && <span className="muted src">Source · {data.bioSource}</span>}
            </div>
          </div>
        </section>
      )}

      <style jsx>{`
        .ah { position: relative; }
        .banner { position: absolute; left: calc(-1 * var(--gutter)); right: calc(-1 * var(--gutter)); top: -36px; height: 260px; overflow: hidden; z-index: -1; opacity: 0.35; mask-image: linear-gradient(180deg, #000, transparent); }
        .banner img { width: 100%; height: 100%; object-fit: cover; filter: grayscale(0.4); }
        .hero { gap: 40px; align-items: flex-end; flex-wrap: wrap; padding-top: 80px; }
        .name { font-size: clamp(40px, 6vw, 84px); margin: 6px 0 10px; }
        .facts { font-weight: 600; }
        .about { border-radius: 28px; padding: 24px 26px; max-width: 860px; }
        .about p { margin: 0; line-height: 1.6; color: var(--ink); white-space: pre-line; }
        .clamp4 { display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
        .more { font-weight: 700; font-size: 14px; }
        .src { font-size: 12.5px; font-weight: 600; }
        @media (max-width: 900px) { .hero { gap: 22px; padding-top: 40px; } }
      `}</style>
    </div>
  );
}
