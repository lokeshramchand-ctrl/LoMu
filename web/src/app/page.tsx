'use client';
import { useEffect, useMemo, useState } from 'react';
import { useExplore, useHome, useMood, useRecs } from '@/lib/api';
import { artistNames } from '@/lib/format';
import Link from 'next/link';
import { formatMinutes, topArtists, weekStats } from '@/lib/insights';
import type { ArtistCard, Item, Shelf, Track } from '@/lib/types';
import { ItemCard, ShelfSkeleton, ShelfTile } from '@/components/Cards';
import { Avatar, Cover } from '@/components/Art';
import { Bento, Tile } from '@/components/Bento';
import { Icon } from '@/components/Icon';
import { Sheet, Toggle } from '@/components/ui';
import { useLibrary } from '@/player/library';
import { currentTrack, usePlayer } from '@/player/store';
import { HOME_SECTIONS, useSettings } from '@/player/settings';
import { warmProps } from '@/lib/warm';

export default function Home() {
  const home = useSettings((s) => s.home);
  const history = useLibrary((s) => s.history);
  const liked = useLibrary((s) => s.liked);
  const [custom, setCustom] = useState(false);

  const recs = useRecs();
  const explore = useExplore();
  const feed = useHome();

  const likedList = useMemo(() => Object.values(liked), [liked]);
  const stats = useMemo(() => weekStats(history), [history]);
  const artists = useMemo(() => topArtists(history), [history]);
  const personal = history.length > 0 || likedList.length > 0;
  const mixes: Shelf[] = recs.data ?? [];
  const songsOf = (s?: Shelf) => (s?.items.filter((i): i is Track => i.kind === 'song') ?? []) as Track[];
  const trending = explore.data?.trending ?? [];
  // On Repeat is its own row and page; everything else feeds the black feature card and the pastel picks.
  const onRepeatShelf = mixes.find((s) => /repeat/i.test(s.title));
  const onRepeat = songsOf(onRepeatShelf);
  const pickPool = useMemo(() => {
    const fromMixes = mixes.filter((s) => s !== onRepeatShelf).flatMap(songsOf);
    const base = fromMixes.length >= 3 ? fromMixes : [...fromMixes, ...(trending.filter((i): i is Track => i.kind === 'song') as Track[])];
    const seen = new Set<string>();
    return base.filter((t) => !seen.has(t.id) && !!seen.add(t.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recs.data, explore.data]);
  const feature = pickPool[0];
  const picks = pickPool.slice(1, 5);
  const featureLiked = useLibrary((s) => (feature ? !!s.liked[feature.id] : false));
  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Late night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const cur = usePlayer((s) => currentTrack(s)?.id);
  const playing = usePlayer((s) => s.playing);
  const playList = (list: Track[], source: string, at = 0) => {
    if (list.length) usePlayer.getState().play(list, at, { source });
  };

  const showStats = home.stats && history.length > 0;
  const m = formatMinutes(stats.minutes);
  const hasArtists = home.artists && artists.length > 0;
  const hasMoods = home.moods && (explore.data?.moods?.length ?? 0) > 0;

  const artistShelf: Shelf = {
    title: 'Your artists',
    items: artists.slice(0, 20).map((a): ArtistCard => ({ kind: 'artist', id: a.id!, title: a.name, thumb: artThumb(history, a.id!) })),
  };

  return (
    <Bento className="fade-in">
      <header className="greet">
        <div className="gtext">
          <h1>My LoMu</h1>
          <p className="muted" suppressHydrationWarning>
            {personal ? `${greeting}. ${new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}` : 'Play a few songs and LoMu starts learning your taste.'}
          </p>
        </div>
        <div className="grow" />
        <Link href="/insights" className="btn ghost">
          Insights
        </Link>
        <button className="btn ghost" onClick={() => setCustom(true)}>
          Customise
        </button>
      </header>

      {home.quick && feature && (
        <section className="fcard" aria-label="Featured song">
          <button className="fart" aria-label={`Play ${feature.title}`} onClick={() => usePlayer.getState().playRadio(feature)}>
            <Cover src={feature.thumb} size="100%" radius={18} />
          </button>
          <div className="ftext">
            <div>
              <div className="ft clamp2">{feature.title}</div>
              <div className="fs clamp1">{artistNames(feature.artists)}</div>
            </div>
            <div className="fact">
              <button className="fheart" aria-label={featureLiked ? 'Remove from liked songs' : 'Like'} onClick={() => useLibrary.getState().toggleLike(feature)}>
                <Icon name={featureLiked ? 'heartFill' : 'heart'} size={24} />
              </button>
              <button className="fplay" aria-label={cur === feature.id && playing ? 'Pause' : 'Play'} onClick={() => (cur === feature.id ? usePlayer.getState().toggle() : usePlayer.getState().playRadio(feature))}>
                <Icon name={cur === feature.id && playing ? 'pause' : 'play'} size={22} />
              </button>
            </div>
          </div>
        </section>
      )}
      {home.quick && !feature && (recs.isLoading || explore.isLoading) && <div className="skeleton" style={{ gridColumn: '1 / -1', height: 164, borderRadius: 28 }} />}

      {home.quick && onRepeat.length > 0 && (
        <section className="onrep" aria-label="On Repeat">
          <Link href="/mix?name=On%20Repeat" className="oh">
            <h2>On Repeat</h2>
            <Icon name="right" size={18} />
          </Link>
          <div className="orow">
            {onRepeat.slice(0, 16).map((t, i) => (
              <button key={t.id} className={`oi${cur === t.id ? ' on' : ''}`} onClick={() => playList(onRepeat, 'home-onrepeat', i)} title={`${t.title} by ${artistNames(t.artists)}`} {...warmProps(t.id)}>
                <Cover src={t.thumb} size="100%" radius={18} />
                <span className="clamp1">{t.title}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {home.quick && picks.length > 0 && (
        <section className="picked" aria-label="Picked for you">
          <h2>Picked For You</h2>
          <div className="pgrid">
            {picks.map((t, i) => (
              <button key={t.id} className="pick" style={{ background: `var(--tile-${(i % 4) + 1})` }} onClick={() => usePlayer.getState().playRadio(t)} {...warmProps(t.id)}>
                <span className="pa"><Avatar src={t.thumb} size="100%" /></span>
                <b className="clamp1">{t.title}</b>
                <span className="clamp1 muted">{artistNames(t.artists)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {showStats && (
        <aside className="week-line" aria-label="This week">
          <h2>This week</h2>
          <dl className="facts">
            <div><dt>Listened</dt><dd>{m.value}{m.unit ? ` ${m.unit}` : ''}</dd></div>
            <div><dt>Songs finished</dt><dd>{stats.plays}</dd></div>
            <div><dt>Streak</dt><dd>{stats.streak} {stats.streak === 1 ? 'day' : 'days'}</dd></div>
            <div><dt>Top artist</dt><dd className="clamp1">{stats.topArtist?.name ?? '-'}</dd></div>
          </dl>
        </aside>
      )}

      {home.moods && explore.isLoading && (
        <Tile span={12} flush label="Loading moods">
          <div className="skeleton" style={{ height: 32, width: '60%', borderRadius: 8 }} />
        </Tile>
      )}
      {hasMoods && <Moods moods={explore.data?.moods ?? []} />}

      {home.mixes && (
        <>
          {recs.isLoading && personal && (
            <Tile span={12} flush label="Loading mixes">
              <ShelfSkeleton title={false} />
            </Tile>
          )}
          {mixes.filter((s) => s !== onRepeatShelf || !home.quick).map((s) => (
            <ShelfTile
              key={`rec-${s.title}`}
              shelf={s}
              action={
                <button
                  className="btn sm"
                  onClick={() => {
                    const t = s.items.filter((i): i is Track => i.kind === 'song');
                    if (t.length) usePlayer.getState().play(t, 0, { source: 'home-mix' });
                  }}
                >
                  <Icon name="play" size={10} /> Play
                </button>
              }
            />
          ))}
          {!recs.isLoading && !mixes.length && (
            <Tile span={12} tone="quiet" label="Mixes">
              <div className="empty-row">
                <div className="grow">
                  <b style={{ color: 'var(--text)', fontWeight: 700 }}>Your mixes will appear here</b>
                  <div className="small muted">LoMu builds Your Mix, On Repeat and Discover from what you finish, skip and like. Play a few songs and come back.</div>
                </div>
              </div>
            </Tile>
          )}
        </>
      )}

      {hasArtists && <ShelfTile shelf={artistShelf} />}
      {home.trending && explore.isLoading && (
        <Tile span={12} flush label="Loading trending">
          <ShelfSkeleton />
        </Tile>
      )}
      {home.trending && trending.length > 0 && <ShelfTile shelf={{ title: 'Trending now', items: trending.slice(0, 20) }} />}
      {home.newReleases && explore.data && explore.data.newReleases.length > 0 && (
        <ShelfTile shelf={{ title: 'New releases', items: explore.data.newReleases.slice(0, 20) }} />
      )}

      {home.youtube && (
        <>
          {feed.isLoading && (
            <Tile span={12} flush label="Loading feed">
              <ShelfSkeleton title={false} />
            </Tile>
          )}
          {feed.error && (
            <Tile span={12} tone="quiet" label="Feed error">
              <div className="empty-row">
                <Icon name="warn" size={16} />
                <span className="grow">The YouTube Music feed did not load. Check your connection and try again.</span>
                <button className="btn sm" onClick={() => feed.refetch()}>
                  Retry
                </button>
              </div>
            </Tile>
          )}
          {feed.data?.shelves.map((s) => <ShelfTile key={`yt-${s.title}`} shelf={s} />)}
        </>
      )}

      <Sheet
        open={custom}
        onClose={() => setCustom(false)}
        title="Customise Today"
        sub="Saved on this device."
        footer={
          <button className="btn" onClick={() => HOME_SECTIONS.forEach((s) => useSettings.getState().setHome(s.id, s.id !== 'youtube'))}>
            Reset to defaults
          </button>
        }
      >
        {HOME_SECTIONS.map((s) => (
          <Toggle key={s.id} label={s.label} hint={s.hint} on={home[s.id]} onChange={(v) => useSettings.getState().setHome(s.id, v)} />
        ))}
      </Sheet>

      <style jsx global>{`
        .greet { grid-column: 1 / -1; display: flex; align-items: flex-end; gap: 8px; flex-wrap: wrap; padding: 8px 0 0; }
        .greet h1 { font-size: clamp(2.25rem, 4.4vw, 3.5rem); letter-spacing: -.03em; line-height: 1.02; padding-bottom: .05em; }
        .greet .gtext p { margin-top: 8px; max-width: 48ch; }
        .empty-row { display: flex; align-items: center; gap: var(--sp-3); color: var(--muted); }
        @media (max-width: 700px) { .greet h1 { font-size: 2rem; } .greet .gtext { flex-basis: 100%; } .greet .grow { display: none; } .greet .btn.ghost { padding-inline-start: 0; } }
      `}</style>
    </Bento>
  );
}

/** The artist avatar comes from the song art of their most recent play (artist photos need a network call). */
function artThumb(history: { track: Track }[], artistId: string) {
  return history.find((p) => p.track.artists[0]?.id === artistId)?.track.thumb;
}

function Moods({ moods }: { moods: { title: string; params: string; browseId: string }[] }) {
  const [sel, setSel] = useState<number | null>(null);
  const m = sel != null ? moods[sel] : undefined;
  const { data, isLoading } = useMood(m?.browseId ?? '', m?.params ?? '');
  if (!moods.length) return null;
  return (
    <Tile span={12} title="Browse by mood" label="Moods">
      <div className="chips mood-row">
        {moods.slice(0, 16).map((x, i) => (
          <button key={x.params} className={sel === i ? 'on' : ''} onClick={() => setSel(sel === i ? null : i)} aria-pressed={sel === i}>
            {x.title}
          </button>
        ))}
      </div>
      {m && (
        <div className="mood-out">
          {isLoading && <ShelfSkeleton title={false} />}
          {data?.slice(0, 1).map((s) => (
            <div key={s.title} className="hscroll open">
              {s.items.slice(0, 12).map((it) => (
                <MoodItem key={`${it.kind}:${it.id}`} item={it} siblings={s.items.filter((i): i is Track => i.kind === 'song')} />
              ))}
            </div>
          ))}
          {!isLoading && !data?.length && <p className="muted small">Nothing found for this mood right now.</p>}
        </div>
      )}
    </Tile>
  );
}

function MoodItem({ item, siblings }: { item: Item; siblings: Track[] }) {
  return <ItemCard item={item} siblings={siblings.length > 1 ? siblings : undefined} />;
}
