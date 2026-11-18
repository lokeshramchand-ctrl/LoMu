'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useLibrary } from '@/player/library';
import { usePlayer } from '@/player/store';
import type { Track } from '@/lib/types';
import { TrackRow, ItemCard } from '@/components/Cards';
import { Disc } from '@/components/Art';
import { Mosaic } from '@/components/Mosaic';
import { Icon } from '@/components/Icon';

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

  const likedTracks: Track[] = useMemo(
    () => Object.values(liked).sort((a, b) => b.at - a.at).map((x) => x.track),
    [liked],
  );
  const historyTracks: Track[] = useMemo(() => history.slice(0, 300).map((p) => p.track), [history]);

  return (
    <div>
      <header className="head">
        <h1 className="display h1">
          Your
          <br />
          <span className="dim">Library</span>
        </h1>
        <div className="stats muted">
          <b>{likedTracks.length}</b> liked · <b>{playlists.length + Object.keys(saved).length}</b> playlists · <b>{history.length}</b> plays
        </div>
      </header>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tb${tab === t.id ? ' on' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'liked' && (
        <section className="fade-in">
          <div className="hero neu">
            <Disc src={likedTracks[0]?.thumb} size={150} />
            <div className="grow">
              <div className="eyebrow">Collection</div>
              <div className="ht">Liked songs</div>
              <div className="muted">{likedTracks.length} songs</div>
              <div className="row" style={{ marginTop: 16 }}>
                <button className="pill-btn solid" disabled={!likedTracks.length} onClick={() => usePlayer.getState().play(likedTracks, 0, { source: 'liked' })}>
                  <Icon name="play" size={16} /> Play
                </button>
                <button className="pill-btn" disabled={!likedTracks.length} onClick={() => usePlayer.getState().play(likedTracks, 0, { source: 'liked', shuffle: true })}>
                  <Icon name="shuffle" size={18} /> Shuffle
                </button>
              </div>
            </div>
          </div>
          {likedTracks.length === 0 && <Empty text="Tap the heart on any song and it lands here." />}
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
            className="newpl neu"
            onClick={() => {
              const name = prompt('Playlist name');
              if (name) useLibrary.getState().createPlaylist(name);
            }}
          >
            <span className="plus neu-in">
              <Icon name="plus" size={28} />
            </span>
            New playlist
          </button>
          {playlists.map((p) => (
            <Link key={p.id} href={`/library/playlist/${p.id}`} className="pl">
              <Mosaic tracks={p.tracks} />
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
          {Object.values(albums).length === 0 && <Empty text="Save albums with the bookmark button on any album page." />}
          {Object.values(albums)
            .sort((a, b) => b.at - a.at)
            .map((x) => (
              <ItemCard key={x.item.id} item={x.item} />
            ))}
        </section>
      )}

      {tab === 'artists' && (
        <section className="fade-in grid">
          {Object.values(artists).length === 0 && <Empty text="Follow artists from their page and they show up here." />}
          {Object.values(artists)
            .sort((a, b) => b.at - a.at)
            .map((x) => (
              <ItemCard key={x.item.id} item={x.item} />
            ))}
        </section>
      )}

      {tab === 'history' && (
        <section className="fade-in list">
          {historyTracks.length === 0 && <Empty text="Songs you play will appear here." />}
          {historyTracks.map((t, i) => (
            <TrackRow key={`${t.id}-${i}`} track={t} index={i} list={historyTracks} />
          ))}
        </section>
      )}

      <style jsx>{`
        .head { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; flex-wrap: wrap; }
        .stats b { color: var(--ink); }
        .tabs { display: flex; gap: 10px; margin: 34px 0 26px; overflow-x: auto; scrollbar-width: none; padding: 6px 4px 12px; }
        .tb { height: 42px; padding: 0 20px; border-radius: 999px; font-weight: 650; font-size: 14.5px; color: var(--ink-2); background: var(--surface); box-shadow: var(--neu-sm); white-space: nowrap; }
        .tb.on { color: var(--ink); box-shadow: var(--neu-in); }
        .hero { display: flex; align-items: center; gap: 28px; padding: 26px; border-radius: 32px; margin-bottom: 22px; }
        .ht { font-size: 36px; font-weight: 800; letter-spacing: -0.045em; line-height: 1; margin: 6px 0; }
        .list { display: flex; flex-direction: column; gap: 2px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(168px, 1fr)); gap: 28px 24px; }
        .newpl { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; height: 210px; border-radius: 26px; font-weight: 700; }
        .plus { width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; }
        :global(.pl) { display: block; }
        .t { font-weight: 700; margin-top: 14px; }
        .s { font-size: 13.5px; margin-top: 3px; }
        :global(.pill-btn:disabled) { opacity: .45; pointer-events: none; }
        @media (max-width: 900px) { .grid { grid-template-columns: repeat(auto-fill, minmax(138px, 1fr)); } .hero { flex-direction: column; align-items: flex-start; } }
      `}</style>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="muted" style={{ padding: '30px 6px', fontWeight: 500 }}>{text}</p>;
}
