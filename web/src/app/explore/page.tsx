'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useExplore, useMood, api } from '@/lib/api';
import { artistNames } from '@/lib/format';
import type { AlbumCard, Track } from '@/lib/types';
import { Wheel, type WheelItem } from '@/components/Wheel';
import { ShelfRow, ShelfSkeleton } from '@/components/Cards';
import { Disc } from '@/components/Art';
import { Icon } from '@/components/Icon';
import { currentTrack, usePlayer } from '@/player/store';
import { toast } from '@/components/Toast';
import { useSettings } from '@/player/settings';
import Link from 'next/link';

type Tab = 'trending' | 'new' | 'moods';

export default function ExploreGate() {
  const enabled = useSettings((s) => s.dev.explore);
  if (!enabled)
    return (
      <div className="neu fade-in" style={{ padding: 32, borderRadius: 30, maxWidth: 520 }}>
        <h1 className="display h2">Explore is off</h1>
        <p className="muted" style={{ marginTop: 12 }}>Turn it on under Settings → Developer.</p>
        <Link href="/settings" className="pill-btn solid" style={{ marginTop: 18 }}>Open settings</Link>
      </div>
    );
  return <Explore />;
}

function Explore() {
  const { data, isLoading, error } = useExplore();
  const [tab, setTab] = useState<Tab>('trending');
  const [focus, setFocus] = useState(0);
  const [mood, setMood] = useState<{ browseId: string; params: string; title: string } | null>(null);
  const router = useRouter();
  const cur = usePlayer((s) => currentTrack(s)?.id);

  const trending: Track[] = useMemo(() => (data?.trending ?? []).filter((t) => t.thumb), [data]);
  const releases: AlbumCard[] = data?.newReleases ?? [];

  const items: WheelItem[] = useMemo(
    () =>
      tab === 'trending'
        ? trending.map((t) => ({ key: t.id, title: t.title, subtitle: artistNames(t.artists), thumb: t.thumb }))
        : releases.map((a) => ({ key: a.id, title: a.title, subtitle: a.subtitle ?? artistNames(a.artists), thumb: a.thumb })),
    [tab, trending, releases],
  );

  const playAt = async (i: number) => {
    if (tab === 'trending') {
      usePlayer.getState().play(trending, i, { source: 'explore:trending' });
      return;
    }
    const a = releases[i];
    if (!a) return;
    try {
      const album = await api.album(a.id);
      if (album.tracks.length) usePlayer.getState().play(album.tracks, 0, { source: `album:${a.id}` });
      else router.push(`/album/${a.id}`);
    } catch {
      toast("Couldn't open that album");
    }
  };

  const focused = tab === 'trending' ? trending[focus] : undefined;
  const focusedAlbum = tab === 'new' ? releases[focus] : undefined;

  return (
    <div className="explore">
      <header className="head">
        <h1 className="display h2">Explore</h1>
        <div className="tabs neu-in" role="tablist">
          {(['trending', 'new', 'moods'] as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => (setTab(t), setFocus(0))}>
              {t === 'trending' ? 'Trending' : t === 'new' ? 'New releases' : 'Moods'}
            </button>
          ))}
        </div>
      </header>

      {error && <p className="muted">Couldn&apos;t load Explore: {(error as Error).message}</p>}

      {tab !== 'moods' ? (
        <div className="split">
          <div className="wheel-col">
            {isLoading ? (
              <div className="loading muted">Tuning in…</div>
            ) : (
              <Wheel key={tab} items={items} onPlay={playAt} onCenter={setFocus} activeKey={cur} />
            )}
          </div>
          <aside className="focus">
            {(focused || focusedAlbum) && (
              <div className="fcard fade-in" key={(focused ?? focusedAlbum)!.id}>
                <Disc src={(focused ?? focusedAlbum)!.thumb} size={300} spin={!!focused && cur === focused.id} />
                <div className="eyebrow" style={{ marginTop: 30 }}>{tab === 'trending' ? `#${focus + 1} trending` : 'New release'}</div>
                <h2 className="display ftitle clamp2">{(focused ?? focusedAlbum)!.title}</h2>
                <div className="muted fsub clamp1">{focused ? artistNames(focused.artists) : focusedAlbum?.subtitle}</div>
                <div className="row" style={{ marginTop: 22 }}>
                  <button className="pill-btn solid" onClick={() => playAt(focus)}>
                    <Icon name="play" size={16} /> Play
                  </button>
                  {focused && (
                    <button className="pill-btn" onClick={() => usePlayer.getState().playRadio(focused)}>
                      <Icon name="radio" size={17} /> Radio
                    </button>
                  )}
                  {focusedAlbum && (
                    <button className="pill-btn" onClick={() => router.push(`/album/${focusedAlbum.id}`)}>
                      Open album
                    </button>
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
      ) : (
        <div className="moods fade-in">
          <div className="mood-grid">
            {(data?.moods ?? []).map((m) => (
              <button
                key={m.params}
                className={`mood neu-sm${mood?.params === m.params ? ' on' : ''}`}
                onClick={() => setMood(m)}
                style={{ ['--stripe' as string]: m.color ?? 'var(--ink-3)' }}
              >
                {m.title}
              </button>
            ))}
          </div>
          {mood && <MoodShelves {...mood} />}
          {!mood && data?.shelves.slice(0, 3).map((s) => <ShelfRow key={s.title} shelf={s} />)}
        </div>
      )}

      <style jsx>{`
        .explore { display: flex; flex-direction: column; min-height: calc(100dvh - 60px); }
        .head { display: flex; align-items: center; justify-content: space-between; gap: 18px; flex-wrap: wrap; }
        .tabs { display: flex; gap: 4px; padding: 6px; border-radius: 999px; }
        .tabs button { height: 40px; padding: 0 18px; border-radius: 999px; font-weight: 650; font-size: 14px; color: var(--ink-2); transition: all .25s var(--ease); }
        .tabs button.on { background: var(--surface); box-shadow: var(--neu-sm); color: var(--ink); }
        .split { flex: 1; display: grid; grid-template-columns: minmax(0, 560px) 1fr; gap: 40px; margin-top: 10px; height: calc(100dvh - var(--player-h) - 150px); min-height: 520px; }
        .wheel-col { min-height: 0; height: 100%; }
        .loading { display: grid; place-items: center; height: 100%; font-weight: 600; }
        .focus { display: flex; align-items: center; justify-content: center; }
        .fcard { display: flex; flex-direction: column; align-items: flex-start; max-width: 460px; }
        .ftitle { font-size: clamp(30px, 3.4vw, 48px); margin-top: 8px; }
        .fsub { font-size: 18px; font-weight: 600; margin-top: 8px; }
        .moods { margin-top: 28px; }
        .mood-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 14px; }
        .mood { position: relative; text-align: left; padding: 18px 18px 18px 26px; border-radius: 18px; font-weight: 700; letter-spacing: -0.02em; overflow: hidden; }
        .mood::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 6px; background: var(--stripe); }
        .mood.on { box-shadow: var(--neu-in); }
        @media (max-width: 900px) {
          .split { grid-template-columns: 1fr; height: calc(100dvh - 300px); }
          .focus { display: none; }
        }
      `}</style>
    </div>
  );
}

function MoodShelves({ browseId, params, title }: { browseId: string; params: string; title: string }) {
  const { data, isLoading } = useMood(browseId, params);
  return (
    <div>
      {isLoading && <ShelfSkeleton />}
      {data?.map((s) => <ShelfRow key={s.title} shelf={{ ...s, title: s.title === 'Playlists' ? title : s.title }} />)}
    </div>
  );
}
