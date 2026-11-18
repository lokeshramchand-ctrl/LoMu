'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useExplore, useMood } from '@/lib/api';
import type { AlbumCard, Track } from '@/lib/types';
import { ItemCard, ShelfRow, ShelfSkeleton, TrackRow } from '@/components/Cards';
import { EmptyState, PageHeader } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useSettings } from '@/player/settings';
import { usePlayer } from '@/player/store';

type Tab = 'trending' | 'new' | 'moods';

export default function ExploreGate() {
  const enabled = useSettings((s) => s.dev.explore);
  if (!enabled)
    return (
      <>
        <PageHeader eyebrow="Explore" title="Explore is off" sub="Trending songs, new releases and moods. Turn it on under Settings → Developer." />
        <div>
          <Link href="/settings" className="btn primary">
            Open settings
          </Link>
        </div>
      </>
    );
  return <Explore />;
}

function Explore() {
  const { data, isLoading, error } = useExplore();
  const [tab, setTab] = useState<Tab>('trending');
  const [mood, setMood] = useState<{ browseId: string; params: string; title: string } | null>(null);
  const moodData = useMood(mood?.browseId ?? '', mood?.params ?? '');

  const trending: Track[] = useMemo(() => (data?.trending ?? []).filter((t) => t.thumb), [data]);
  const releases: AlbumCard[] = data?.newReleases ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Explore"
        title="What's happening"
        sub="Charts, fresh releases and moods from YouTube Music."
        actions={
          tab === 'trending' && trending.length > 0 ? (
            <button className="btn primary" onClick={() => usePlayer.getState().play(trending, 0, { source: 'explore:trending' })}>
              <Icon name="play" size={14} /> Play trending
            </button>
          ) : undefined
        }
      />

      <div className="chips" role="tablist" style={{ alignSelf: 'flex-start' }}>
        {([['trending', 'Trending'], ['new', 'New releases'], ['moods', 'Moods']] as [Tab, string][]).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {isLoading && <ShelfSkeleton />}
      {error && (
        <div className="callout err">
          <Icon name="warn" size={18} /> Couldn&apos;t load Explore. {(error as Error).message}
        </div>
      )}

      {tab === 'trending' && (
        <section className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {trending.map((t, i) => (
            <TrackRow key={t.id} track={t} index={i} list={trending} showIndex />
          ))}
        </section>
      )}

      {tab === 'new' && (
        <section className="fade-in grid">
          {releases.map((a) => (
            <ItemCard key={a.id} item={a} />
          ))}
          {!isLoading && !releases.length && <EmptyState icon="disc" title="No new releases right now" />}
        </section>
      )}

      {tab === 'moods' && (
        <section className="fade-in">
          <div className="mood-row">
            {(data?.moods ?? []).map((m) => (
              <button key={m.params} className={`btn${mood?.params === m.params ? ' primary' : ''}`} onClick={() => setMood(mood?.params === m.params ? null : m)} aria-pressed={mood?.params === m.params}>
                {m.title}
              </button>
            ))}
          </div>
          {mood && (
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {moodData.isLoading && <ShelfSkeleton />}
              {moodData.data?.map((s) => <ShelfRow key={s.title} shelf={s} />)}
            </div>
          )}
          {!mood && <p className="muted" style={{ marginTop: 16 }}>Pick a mood to see playlists for it.</p>}
        </section>
      )}

      <style jsx>{`
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(164px, 1fr)); gap: 24px 20px; }
        .mood-row { display: flex; flex-wrap: wrap; gap: 8px; }
      `}</style>
    </>
  );
}
