'use client';
import { useEffect, useMemo, useState } from 'react';
import { useExplore, useHome, useMood, useRecs } from '@/lib/api';
import { artistNames } from '@/lib/format';
import { detectSleep, formatSpan } from '@/lib/sleep';
import { useSleep } from '@/player/sleep';
import Link from 'next/link';
import { formatMinutes, recentTracks, topArtists, weekStats } from '@/lib/insights';
import type { ArtistCard, Item, Shelf, Track } from '@/lib/types';
import { ItemCard, ShelfSkeleton, ShelfTile } from '@/components/Cards';
import { Cover } from '@/components/Art';
import { Bento, Tile } from '@/components/Bento';
import { Icon } from '@/components/Icon';
import { Sheet, Toggle } from '@/components/ui';
import { useLibrary } from '@/player/library';
import { currentTrack, usePlayer } from '@/player/store';
import { HOME_SECTIONS, useSettings } from '@/player/settings';
import { warm, warmProps } from '@/lib/warm';

const LOG_SHOWN = 12;

export default function Home() {
  const home = useSettings((s) => s.home);
  const history = useLibrary((s) => s.history);
  const liked = useLibrary((s) => s.liked);
  const [custom, setCustom] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const recs = useRecs();
  const explore = useExplore();
  const feed = useHome();

  const likedList = useMemo(() => Object.values(liked), [liked]);
  const recent = useMemo(() => recentTracks(history, likedList, 8), [history, likedList]);
  const stats = useMemo(() => weekStats(history), [history]);
  const anchors = useSleep((s) => s.anchors);
  // The most recent sleep with the queue on, whenever it was (older nights are on the Insights page).
  const lastSleep = useMemo(() => detectSleep(history, anchors)[0] ?? null, [history, anchors]);
  const artists = useMemo(() => topArtists(history), [history]);
  const personal = history.length > 0 || likedList.length > 0;
  const mixes: Shelf[] = recs.data ?? [];
  const mixTracks = (mixes[0]?.items.filter((i): i is Track => i.kind === 'song') ?? []) as Track[];

  const cur = usePlayer((s) => currentTrack(s)?.id);
  const playing = usePlayer((s) => s.playing);
  const nowTrack = usePlayer((s) => currentTrack(s)) ?? history[0]?.track;
  // newest first, whatever order the history was stored in
  const sorted = useMemo(() => [...history].sort((a, b) => b.at - a.at).slice(0, 40), [history]);
  const logTracks = useMemo(() => sorted.map((p) => p.track), [sorted]);
  // the log: newest first, grouped by day
  const groups = useMemo(() => {
    const out: { label: string; rows: { p: (typeof sorted)[number]; i: number }[] }[] = [];
    const today = new Date().toDateString();
    const yday = new Date(Date.now() - 864e5).toDateString();
    sorted.slice(0, showAll ? sorted.length : LOG_SHOWN).forEach((p, i) => {
      const d = new Date(p.at);
      const ds = d.toDateString();
      const label = ds === today ? 'Today' : ds === yday ? 'Yesterday' : d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' });
      let g = out[out.length - 1];
      if (!g || g.label !== label) out.push((g = { label, rows: [] }));
      g.rows.push({ p, i });
    });
    return out;
  }, [sorted, showAll]);
  // only the latest play of the current song is marked as current
  const curRow = sorted.findIndex((p) => p.track.id === cur);
  // where the sleep note belongs: before the first play that happened after the sleep began
  const noteAt = lastSleep ? sorted.findIndex((p) => p.at <= lastSleep.end) : -1;

  const playMix = () => {
    const list = mixTracks.length ? mixTracks : recent;
    if (list.length) usePlayer.getState().play(list, 0, { source: 'home-mix' });
  };

  const showStats = home.stats && history.length > 0;
  const m = formatMinutes(stats.minutes);
  const trending = explore.data?.trending ?? [];
  const hasArtists = home.artists && artists.length > 0;
  const hasMoods = home.moods && (explore.data?.moods?.length ?? 0) > 0;

  const artistShelf: Shelf = {
    title: 'Your artists',
    subtitle: 'Most played lately',
    items: artists.slice(0, 20).map((a): ArtistCard => ({ kind: 'artist', id: a.id!, title: a.name, thumb: artThumb(history, a.id!) })),
  };

  return (
    <Bento className="fade-in">
      <header className="greet">
        <div className="gtext">
          <h1 suppressHydrationWarning>{new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</h1>
          {!personal && <p className="muted">Play a few songs and LoMu starts learning your taste.</p>}
        </div>
        <div className="grow" />
        <Link href="/insights" className="btn ghost">
          <Icon name="history" size={14} /> Insights
        </Link>
        <button className="btn ghost" onClick={() => setCustom(true)}>
          <Icon name="sliders" size={14} /> Customise
        </button>
      </header>

      {nowTrack && (
        <div className="now" role="region" aria-label="Now">
          <Cover src={nowTrack.thumb} size={48} radius={10} />
          <div className="what">
            <span className="state">{cur ? (playing ? 'Playing now' : 'Paused') : 'Last played'}</span>
            <b className="clamp1">{nowTrack.title}</b>
            <span className="muted small clamp1">{artistNames(nowTrack.artists)}</span>
          </div>
          {mixTracks.length > 0 && (
            <button className="btn" onClick={playMix}>
              <Icon name="play" size={10} /> My mix
            </button>
          )}
          <button className="btn primary" onClick={() => (cur ? usePlayer.getState().toggle() : usePlayer.getState().play([nowTrack], 0, { source: 'home-resume' }))}>
            <Icon name={cur && playing ? 'pause' : 'play'} size={12} /> {cur ? (playing ? 'Pause' : 'Resume') : 'Play'}
          </button>
        </div>
      )}

      {history.length > 0 ? (
        <div className="log-grid">
          <section aria-label="Listening log">
            {groups.map((g) => (
              <div key={g.label} className="log-group">
                <h2 className="log-day">{g.label}</h2>
                {g.rows.map(({ p, i }) => (
                  <div key={`${p.at}-${i}`}>
                    {i === noteAt && lastSleep && (
                      <p className="log-note">
                        Probably asleep from {new Date(lastSleep.asleepFrom).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} during {lastSleep.lastAwake.title}; the queue kept going for about {formatSpan(lastSleep.asleepMs)}.
                      </p>
                    )}
                    <button className={`log-row${cur === p.track.id && i === curRow ? ' active' : ''}`} onClick={() => usePlayer.getState().play(logTracks, i, { source: 'home-log' })} {...warmProps(p.track.id)}>
                      <time dateTime={new Date(p.at).toISOString()}>{new Date(p.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>
                      <Cover src={p.track.thumb} size={40} radius={8} />
                      <div className="grow">
                        <div className="clamp1 t">{p.track.title}</div>
                        <div className="clamp1 s">{artistNames(p.track.artists)}</div>
                      </div>
                      <span className="end">
                        {!p.completed && <span className="small">partial</span>}
                        <Icon name="play" size={14} />
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            ))}
            {sorted.length > LOG_SHOWN && (
              <button className="btn log-more" onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Show fewer' : `Show earlier (${sorted.length - LOG_SHOWN})`}
              </button>
            )}
          </section>
          {showStats && (
            <aside className="rail" aria-label="This week">
              <h2>This week</h2>
              <dl className="facts">
                <div><dt>Listened</dt><dd>{m.value}{m.unit ? ` ${m.unit}` : ''}</dd></div>
                <div><dt>Songs finished</dt><dd>{stats.plays}</dd></div>
                <div><dt>Streak</dt><dd>{stats.streak} {stats.streak === 1 ? 'day' : 'days'}</dd></div>
                <div><dt>Top artist</dt><dd className="clamp1">{stats.topArtist?.name ?? '-'}</dd></div>
              </dl>
              <Link href="/insights" className="showall" style={{ display: 'inline-block', marginTop: 12 }}>All insights</Link>
            </aside>
          )}
        </div>
      ) : (
        home.quick && <QuickPicks tracks={recent.length ? recent : trending.slice(0, 8)} personal={recent.length > 0} loading={!recent.length && explore.isLoading} />
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
          {mixes.map((s) => (
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
                <span className="chip-ic lg">
                  <Icon name="sparkles" size={14} />
                </span>
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
      {home.trending && trending.length > 0 && <ShelfTile shelf={{ title: 'Trending now', subtitle: 'What people are playing right now', items: trending.slice(0, 20) }} />}
      {home.newReleases && explore.data && explore.data.newReleases.length > 0 && (
        <ShelfTile shelf={{ title: 'New releases', subtitle: 'Fresh albums and singles', items: explore.data.newReleases.slice(0, 20) }} />
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
        title="Customise home"
        eyebrow="Home"
        sub="Choose what shows up and what stays out of the way. Saved on this device."
        footer={
          <button className="btn" onClick={() => HOME_SECTIONS.forEach((s) => useSettings.getState().setHome(s.id, s.id !== 'youtube'))}>
            Reset
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

/** First-run view, before there is any history: a grid of songs to start from. */
function QuickPicks({ tracks, personal, loading }: { tracks: Track[]; personal: boolean; loading: boolean }) {
  const cur = usePlayer((s) => currentTrack(s)?.id);
  const playing = usePlayer((s) => s.playing);
  // The first few quick picks are the likeliest next play: resolve them while the page is idle.
  useEffect(() => {
    const t = setTimeout(() => tracks.slice(0, 4).forEach((x) => warm(x.id)), 600);
    return () => clearTimeout(t);
  }, [tracks]);
  if (!loading && !tracks.length) return null;
  return (
    <section className="qwrap" aria-label="Quick picks">
      <div className="qgrid">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 8 }} />)
          : tracks.map((t, i) => {
              const active = cur === t.id;
              return (
                <button
                  key={t.id}
                  className={`q${active ? ' active' : ''}`}
                  onClick={() => usePlayer.getState().play(tracks, i, { source: 'home-quick' })}
                  title={`${t.title} - ${artistNames(t.artists)}`}
                  {...warmProps(t.id)}
                >
                  <Cover src={t.thumb} size={72} radius={0} />
                  <div className="grow tx">
                    <div className="clamp1 t">{t.title}</div>
                    {!personal && <div className="clamp1 s">{artistNames(t.artists)}</div>}
                  </div>
                  <span className="go">
                    <Icon name={active && playing ? 'pause' : 'play'} size={18} />
                  </span>
                </button>
              );
            })}
      </div>
      <style jsx>{`
        .qwrap { grid-column: 1 / -1; }
        .qgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr)); gap: 16px; }
        .q { position: relative; display: flex; align-items: center; gap: 16px; min-width: 0; width: 100%; min-height: 72px; padding-block: 0; padding-inline: 0 16px; border-radius: var(--r); overflow: hidden; background: var(--surface); box-shadow: inset 0 0 0 1px var(--border); text-align: start; transition: background .15s var(--ease), transform .1s ease-out; }
        .q:hover { background: var(--card-hover); }
        .q:active { transform: scale(.985); }
        .q :global(.cover) { border-radius: var(--r-sm) 0 0 var(--r-sm); box-shadow: none; }
        .tx { min-width: 0; }
        .t { font-weight: 600; font-size: .9375rem; color: var(--ink); }
        .q.active .t { color: var(--signal-t); }
        .s { color: var(--muted); font-size: .8125rem; }
        .go { width: 40px; height: 40px; border-radius: var(--r); display: grid; place-items: center; background: var(--signal); color: var(--on-signal); opacity: 0; transform: translateY(4px); transition: opacity .2s var(--ease), transform .2s var(--ease); flex: none; }
        .q:hover .go, .q:focus-visible .go, .q.active .go { opacity: 1; transform: none; }
        @media (hover: none) { .go { opacity: 1; transform: none; } }
        @media (max-width: 700px) { .qgrid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; } .q { height: 56px; gap: 8px; } .q :global(.cover) { width: 56px !important; height: 56px !important; } .go { display: none; } .t { font-size: .8125rem; } }
      `}</style>
    </section>
  );
}

function Moods({ moods }: { moods: { title: string; params: string; browseId: string }[] }) {
  const [sel, setSel] = useState<number | null>(null);
  const m = sel != null ? moods[sel] : undefined;
  const { data, isLoading } = useMood(m?.browseId ?? '', m?.params ?? '');
  if (!moods.length) return null;
  return (
    <Tile span={12} title="Browse by mood" sub="Jump straight into a feeling" label="Moods">
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
