'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useLibrary } from '@/player/library';
import { usePlayer } from '@/player/store';
import type { Track } from '@/lib/types';
import { TrackRow, ItemCard } from '@/components/Cards';
import { Cover } from '@/components/Art';
import { Mosaic } from '@/components/Mosaic';
import { Icon, type IconName } from '@/components/Icon';
import { EmptyState, PageHeader, Stat } from '@/components/ui';

type Tab = 'liked' | 'playlists' | 'albums' | 'artists' | 'history';
const TABS: { id: Tab; label: string }[] = [
  { id: 'liked', label: 'Liked' },
  { id: 'playlists', label: 'Playlists' },
  { id: 'albums', label: 'Albums' },
  { id: 'artists', label: 'Artists' },
  { id: 'history', label: 'History' },
];

export default function Library() {
  const [tab, setTab] = useState<Tab>('liked');
  const liked = useLibrary((s) => s.liked);
  const playlists = useLibrary((s) => s.playlists);
  const albums = useLibrary((s) => s.albums);
  const artists = useLibrary((s) => s.artists);
  const saved = useLibrary((s) => s.savedPlaylists);
  const history = useLibrary((s) => s.history);

  const likedTracks: Track[] = useMemo(() => Object.values(liked).sort((a, b) => b.at - a.at).map((x) => x.track), [liked]);
  const historyTracks: Track[] = useMemo(() => history.slice(0, 300).map((p) => p.track), [history]);
  const savedCount = Object.keys(saved).length;

  return (
    <>
      <PageHeader eyebrow="Library" title="Your library" sub="Everything you have liked, saved and played. Synced to your other devices." />

      <section className="grid-stats">
        <Stat icon="heart" label="Liked songs" value={likedTracks.length} />
        <Stat icon="playlist" label="Playlists" value={playlists.length + savedCount} />
        <Stat icon="disc" label="Albums saved" value={Object.keys(albums).length} />
        <Stat icon="history" label="Plays logged" value={history.length} />
      </section>

      <div className="chips" role="tablist" style={{ alignSelf: 'flex-start' }}>
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'liked' && (
        <section className="fade-in">
          <div className="hero card pad">
            <Cover src={likedTracks[0]?.thumb} size={112} radius={14} />
            <div className="grow">
              <div className="eyebrow">Collection</div>
              <h2 className="ht">Liked songs</h2>
              <div className="muted small">{likedTracks.length} songs</div>
              <div className="row" style={{ marginTop: 14 }}>
                <button className="btn primary" disabled={!likedTracks.length} onClick={() => usePlayer.getState().play(likedTracks, 0, { source: 'liked' })}>
                  <Icon name="play" size={14} /> Play
                </button>
                <button className="btn" disabled={!likedTracks.length} onClick={() => usePlayer.getState().play(likedTracks, 0, { source: 'liked', shuffle: true })}>
                  <Icon name="shuffle" size={16} /> Shuffle
                </button>
              </div>
            </div>
          </div>
          {likedTracks.length === 0 && <EmptyState icon="heart" title="No liked songs yet" hint="Tap the heart on any song and it lands here." />}
          <div className="list">
            {likedTracks.map((t, i) => (
              <TrackRow key={t.id} track={t} index={i} list={likedTracks} />
            ))}
          </div>
        </section>
      )}

      {tab === 'playlists' && (
        <section className="fade-in grid">
          <button
            className="newpl card"
            onClick={() => {
              const name = prompt('Playlist name');
              if (name) useLibrary.getState().createPlaylist(name);
            }}
          >
            <span className="chip-ic lg">
              <Icon name="plus" size={20} />
            </span>
            New playlist
          </button>
          {playlists.map((p) => (
            <Link key={p.id} href={`/library/playlist/${p.id}`} className="pl">
              <Mosaic tracks={p.tracks} size={164} />
              <div className="t clamp1">{p.name}</div>
              <div className="s muted">{p.tracks.length} songs</div>
            </Link>
          ))}
          {Object.values(saved)
            .sort((a, b) => b.at - a.at)
            .map((x) => (
              <ItemCard key={x.item.id} item={x.item} />
            ))}
        </section>
      )}

      {tab === 'albums' && (
        <section className="fade-in grid">
          {Object.values(albums).length === 0 && <Empty icon="disc" title="No saved albums" text="Save albums with the Save button on any album page." />}
          {Object.values(albums)
            .sort((a, b) => b.at - a.at)
            .map((x) => (
              <ItemCard key={x.item.id} item={x.item} />
            ))}
        </section>
      )}

      {tab === 'artists' && (
        <section className="fade-in grid">
          {Object.values(artists).length === 0 && <Empty icon="user" title="No followed artists" text="Follow artists from their page and they show up here." />}
          {Object.values(artists)
            .sort((a, b) => b.at - a.at)
            .map((x) => (
              <ItemCard key={x.item.id} item={x.item} />
            ))}
        </section>
      )}

      {tab === 'history' && (
        <section className="fade-in list">
          {historyTracks.length === 0 && <EmptyState icon="history" title="Nothing played yet" hint="Songs you play will appear here." />}
          {historyTracks.map((t, i) => (
            <TrackRow key={`${t.id}-${i}`} track={t} index={i} list={historyTracks} />
          ))}
        </section>
      )}

      <style jsx>{`
        .hero { display: flex; align-items: center; gap: 22px; margin-bottom: 14px; }
        .ht { font-size: 1.7rem; font-weight: 600; letter-spacing: -.04em; line-height: 1.1; margin: 4px 0; }
        .list { display: flex; flex-direction: column; gap: 1px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(164px, 1fr)); gap: 24px 20px; }
        .newpl { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; aspect-ratio: 1; font-weight: 500; transition: box-shadow .25s var(--ease), transform .3s var(--spring); }
        .newpl:hover { box-shadow: var(--lift-hi); transform: translateY(-2px); }
        :global(.pl) { display: block; }
        .t { font-weight: 600; font-size: 13.5px; margin-top: 10px; }
        .s { font-size: 12.5px; margin-top: 2px; }
        @media (max-width: 900px) { .grid { grid-template-columns: repeat(auto-fill, minmax(138px, 1fr)); } .hero { flex-direction: column; align-items: flex-start; } }
      `}</style>
    </>
  );
}

function Empty({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <EmptyState icon={icon} title={title} hint={text} />
    </div>
  );
}
