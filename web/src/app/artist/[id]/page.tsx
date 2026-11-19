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
  const [allSongs, setAllSongs] = useState(false);
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
        <div className="row hero card pad">
          {photo && <div className="amb" aria-hidden style={{ backgroundImage: `url(${photo})` }} />}
          <Avatar src={photo} size={168} alt={data.name} />
          <div className="grow">
            <div className="eyebrow">Artist</div>
            <h1 className="h1 name">{data.name}</h1>
            {facts.length > 0 && <div className="muted facts">{facts.join(' · ')}</div>}
            <div className="row" style={{ marginTop: 20, flexWrap: 'wrap' }}>
              <button className="btn primary" disabled={!data.topSongs.length} onClick={() => usePlayer.getState().play(data.topSongs, 0, { source: `artist:${id}` })}>
                <Icon name="play" size={14} /> Play
              </button>
              {data.topSongs[0] && (
                <button className="btn" onClick={() => usePlayer.getState().playRadio(data.topSongs[0])}>
                  <Icon name="radio" size={16} /> Radio
                </button>
              )}
              <button className="btn" onClick={() => useLibrary.getState().toggleSaved({ kind: 'artist', id, title: data.name, thumb: photo })}>
                <Icon name={following ? 'check' : 'plus'} size={16} /> {following ? 'Following' : 'Follow'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {data.topSongs.length > 0 && (
        <section>
          <div className="section-head">
            <h2>Top songs</h2>
            {data.topSongs.length > 5 && (
              <button className="btn ghost sm" onClick={() => setAllSongs(!allSongs)}>
                {allSongs ? 'Show less' : `Show all ${data.topSongs.length}`}
              </button>
            )}
          </div>
          {(allSongs ? data.topSongs : data.topSongs.slice(0, 5)).map((t, i) => (
            <TrackRow key={t.id} track={t} index={i} list={data.topSongs} showIndex />
          ))}
        </section>
      )}

      {data.shelves.map((s) => (
        <ShelfRow key={s.title} shelf={s} />
      ))}

      {data.description && (
        <section>
          <div className="section-head"><h2>About</h2></div>
          <div className="about card pad">
            <p className={bioOpen ? '' : 'clamp4'}>{data.description}</p>
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 10 }}>
              <button className="more" onClick={() => setBioOpen(!bioOpen)}>{bioOpen ? 'Show less' : 'Read more'}</button>
              {data.bioSource && <span className="muted src">Source · {data.bioSource}</span>}
            </div>
          </div>
        </section>
      )}

      <style jsx>{`
        .fade-in { display: flex; flex-direction: column; gap: 20px; }
        .ah { position: relative; padding-top: 12px; }
        .banner { position: absolute; left: 0; right: 0; top: 12px; height: 100%; min-height: 200px; overflow: hidden; border-radius: var(--r); opacity: .25; mask-image: linear-gradient(180deg, #000, transparent); pointer-events: none; }
        .banner img { width: 100%; height: 100%; object-fit: cover; }
        .amb { position: absolute; inset: -25%; background-size: cover; background-position: center; filter: blur(70px) saturate(1.4); opacity: .18; pointer-events: none; }
        .hero { position: relative; overflow: hidden; gap: 28px; align-items: flex-end; flex-wrap: wrap; }
        .hero > :global(*:not(.amb)) { position: relative; }
        .name { font-size: clamp(1.8rem, 4vw, 3rem); font-weight: 600; margin: 4px 0 6px; }
        .facts { font-weight: 500; font-size: 13.5px; }
        .about { max-width: 860px; }
        .about p { margin: 0; line-height: 1.6; color: var(--text); white-space: pre-line; font-size: 14px; }
        .clamp4 { display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
        .more { font-weight: 500; font-size: 13px; color: var(--signal); }
        .src { font-size: 12px; font-weight: 500; }
        @media (max-width: 900px) { .hero { gap: 18px; } }
      `}</style>
    </div>
  );
}
