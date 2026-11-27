'use client';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSearch, useSuggest } from '@/lib/api';
import { artistNames, hrefFor } from '@/lib/format';
import type { Item } from '@/lib/types';
import { ItemCard, ShelfTile, ShelfSkeleton, TrackRow } from '@/components/Cards';
import { Avatar, Cover } from '@/components/Art';
import { Bento, Tile } from '@/components/Bento';
import { Icon } from '@/components/Icon';
import { useLibrary } from '@/player/library';
import { usePlayer } from '@/player/store';
import { matchLibrary } from '@/lib/libsearch';

const CATS = ['Top hits India', 'Lo-fi beats', 'Workout', 'Arijit Singh', 'Anirudh', 'Chill vibes', 'Punjabi', '90s Bollywood'];

export default function SearchPage() {
  return (
    <Suspense>
      <SearchInner />
    </Suspense>
  );
}

function SearchInner() {
  const params = useSearchParams();
  const router = useRouter();
  const q = params.get('q') ?? '';
  const [text, setText] = useState(q);
  const [debounced, setDebounced] = useState(q);
  const [focused, setFocused] = useState(!q);
  const input = useRef<HTMLInputElement>(null);
  const recent = useLibrary((s) => s.recentSearches);
  const liked = useLibrary((s) => s.liked);
  const history = useLibrary((s) => s.history);
  const mine = useMemo(
    () => (q ? matchLibrary(q, Object.values(liked).sort((a, b) => b.at - a.at).map((x) => x.track), history.map((p) => p.track)) : []),
    [q, liked, history],
  );
  const [type, setType] = useState<'all' | 'songs' | 'artists' | 'albums' | 'playlists' | 'videos'>('all');

  useEffect(() => {
    setText(q);
    setType('all');
  }, [q]);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(text), 160);
    return () => clearTimeout(t);
  }, [text]);
  useEffect(() => {
    if (!q) input.current?.focus();
  }, [q]);

  const sugg = useSuggest(focused ? debounced : '');
  const { data, isLoading, error } = useSearch(q);

  const submit = (value: string) => {
    const v = value.trim();
    if (!v) return;
    useLibrary.getState().rememberSearch(v);
    setFocused(false);
    input.current?.blur();
    router.push(`/search?q=${encodeURIComponent(v)}`);
  };

  return (
    <Bento className="fade-in">
      <h1 className="sr-only">Search</h1>
      <div className="bento-full sb">
      <form
        className="box"
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
      >
        <Icon name="search" size={18} />
        <input
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Songs, artists, albums, playlists"
          aria-label="Search"
          enterKeyHint="search"
          autoComplete="off"
        />
        {text && (
          <button type="button" className="icon-btn sm" aria-label="Clear" onClick={() => (setText(''), input.current?.focus())}>
            <Icon name="close" size={16} />
          </button>
        )}
      </form>

      {focused && text.trim().length > 1 && sugg.data && (
        <div className="sugg card fade-in">
          {sugg.data.queries.map((s) => (
            <button key={s} className="srow" onMouseDown={(e) => e.preventDefault()} onClick={() => submit(s)}>
              <Icon name="search" size={16} />
              <span className="clamp1">{s}</span>
            </button>
          ))}
          {sugg.data.items.map((it) => (
            <SuggestItem key={it.kind + it.id} item={it} onDone={() => setFocused(false)} />
          ))}
        </div>
      )}
      </div>

      {q && isLoading && (
        <Tile span={12} flush label="Loading results">
          <ShelfSkeleton title={false} />
        </Tile>
      )}
      {error && (
        <Tile span={12} tone="quiet" label="Search error">
          <div className="callout err"><Icon name="warn" size={16} />Search did not finish. Check your connection and try again.</div>
        </Tile>
      )}

      {mine.length > 0 && (
        <Tile span={12} flush title="In your library" label="In your library">
          <div className="list">
            {mine.map((t, i) => (
              <TrackRow key={t.id} track={t} index={i} list={mine} />
            ))}
          </div>
        </Tile>
      )}

      {data && (
        <>
          <div className="chips bento-full" role="tablist" aria-label="Result type" style={{ justifySelf: 'start' }}>
            {([
              ['all', 'All', 0],
              ['songs', 'Songs', data.songs.length],
              ['artists', 'Artists', data.artists.length],
              ['albums', 'Albums', data.albums.length],
              ['playlists', 'Playlists', data.playlists.length],
              ['videos', 'Videos', data.videos.length],
            ] as const)
              .filter(([id, , n]) => id === 'all' || n > 0)
              .map(([id, label]) => (
                <button key={id} role="tab" aria-selected={type === id} className={type === id ? 'on' : ''} onClick={() => setType(id)}>
                  {label}
                </button>
              ))}
          </div>

          {type === 'all' && (
            <>
              {data.top && <TopResult item={data.top} />}
              {data.songs.length > 0 && (
                <Tile
                  span={data.top ? 7 : 12}
                  md={12}
                  flush
                  title="Songs"
                  label="Songs"
                  action={
                    data.songs.length > 5 ? (
                      <button className="btn ghost sm" onClick={() => setType('songs')}>
                        Show all {data.songs.length}
                      </button>
                    ) : undefined
                  }
                >
                  <div className="list">
                    {data.songs.slice(0, 5).map((t, i) => (
                      <TrackRow key={t.id} track={t} index={i} list={data.songs} />
                    ))}
                  </div>
                </Tile>
              )}
              {data.artists.length > 0 && <ShelfTile shelf={{ title: 'Artists', items: data.artists }} />}
              {data.albums.length > 0 && <ShelfTile shelf={{ title: 'Albums & singles', items: data.albums }} />}
              {data.playlists.length > 0 && <ShelfTile shelf={{ title: 'Playlists', items: data.playlists }} />}
              {data.videos.length > 0 && <ShelfTile shelf={{ title: 'Videos', items: data.videos }} />}
            </>
          )}

          {type === 'songs' && (
            <Tile
              span={12}
              flush
              title="Songs"
              sub={`${data.songs.length} results`}
              label="Songs"
              action={
                <button className="btn primary sm" onClick={() => usePlayer.getState().play(data.songs, 0, { source: `search:${q}` })}>
                  <Icon name="play" size={10} /> Play all
                </button>
              }
            >
              <div className="list">
                {data.songs.map((t, i) => (
                  <TrackRow key={t.id} track={t} index={i} list={data.songs} />
                ))}
              </div>
            </Tile>
          )}
          {type === 'artists' && <ItemGrid items={data.artists} title="Artists" />}
          {type === 'albums' && <ItemGrid items={data.albums} title="Albums" />}
          {type === 'playlists' && <ItemGrid items={data.playlists} title="Playlists" />}
          {type === 'videos' && <ItemGrid items={data.videos} title="Videos" />}

          {!data.songs.length && !data.albums.length && !data.artists.length && (
            <Tile span={12} tone="quiet" label="No results">
              <div className="empty"><b>Nothing found for "{q}"</b><span>Try a different spelling, or search for the artist.</span></div>
            </Tile>
          )}
        </>
      )}

      {!q && (
        <>
          {recent.length > 0 && (
            <Tile
              span={12}
              title="Recent searches"
              label="Recent searches"
              action={
                <button className="btn ghost sm" onClick={() => useLibrary.getState().clearSearches()}>
                  Clear
                </button>
              }
            >
              <div className="pills">
                {recent.map((r) => (
                  <button key={r} className="pill" onClick={() => submit(r)}>
                    <Icon name="history" size={14} /> {r}
                  </button>
                ))}
              </div>
            </Tile>
          )}
          <Tile span={12} title="Browse categories" label="Browse categories">
            <div className="cats">
              {CATS.map((label) => (
                <button key={label} className="cat" onClick={() => submit(label)}>
                  {label}
                </button>
              ))}
            </div>
          </Tile>
        </>
      )}

      <style jsx>{`
        .cats { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
        .cat { position: relative; display: flex; align-items: flex-end; height: 120px; padding: 16px; border-radius: var(--r); background: var(--surface); box-shadow: inset 0 0 0 1px var(--border); color: var(--ink); font-family: var(--font-display); font-size: 1.5rem; letter-spacing: -.02em; line-height: 1.1; text-align: left; transition: background .15s, transform .1s ease-out; }
        .cat:hover { background: var(--card-hover); }
        .cat:active { transform: scale(.98); }
        @media (max-width: 900px) { .cats { grid-template-columns: 1fr 1fr; gap: 12px; } .cat { height: 88px; font-size: 1.125rem; } }
        .box { position: relative; display: flex; align-items: center; gap: 12px; height: 48px; padding: 0 12px 0 16px; border-radius: var(--r); background: var(--surface-2); color: var(--muted); transition: background .15s, box-shadow .15s; }
        .box:hover { background: var(--card-hover); }
        .box:focus-within { background: var(--card-hover); box-shadow: 0 0 0 2px var(--ink); color: var(--text); }
        .box input { flex: 1; border: 0; outline: 0; background: transparent; font-size: 16px; font-weight: 400; color: var(--ink); min-width: 0; }
        .box input::placeholder { color: var(--muted); font-weight: 400; }
        .sb { position: relative; }
        .sugg { position: absolute; z-index: 30; inset-inline-start: 0; top: calc(100% + 8px); width: min(640px, 100%); padding: 8px; background: var(--card-hover); border-radius: var(--r); box-shadow: var(--shadow-lg), 0 0 0 1px var(--border-2); }
        :global(.srow) { display: flex; align-items: center; gap: 12px; width: 100%; padding: 8px 12px; border-radius: var(--r-sm); text-align: start; font-weight: 400; font-size: 1rem; color: var(--text); }
        :global(.srow:hover) { background: var(--row-hover); }
        .pills { display: flex; flex-wrap: wrap; gap: 8px; }
        .pill { display: inline-flex; align-items: center; gap: 8px; min-height: 32px; padding: 0 14px; border-radius: var(--r); background: var(--pill); font-size: 14px; font-weight: 500; transition: background .2s; }
        .pill:hover { background: var(--pill-hover); }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(164px, 1fr)); gap: 24px 20px; }
        @media (max-width: 900px) {
      `}</style>
    </Bento>
  );
}

function SuggestItem({ item, onDone }: { item: Item; onDone: () => void }) {
  const router = useRouter();
  const sub = item.kind === 'song' ? artistNames(item.artists) : item.kind === 'album' ? item.subtitle ?? 'Album' : item.kind === 'artist' ? 'Artist' : 'Playlist';
  return (
    <button
      className="srow"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        onDone();
        if (item.kind === 'song') usePlayer.getState().playRadio(item);
        else router.push(hrefFor(item)!);
      }}
    >
      {item.kind === 'song' ? <Cover src={item.thumb} size={38} radius={8} /> : item.kind === 'artist' ? <Avatar src={item.thumb} size={38} /> : <Cover src={item.thumb} size={38} radius={8} />}
      <span className="grow" style={{ minWidth: 0 }}>
        <span className="clamp1" style={{ display: 'block' }}>{item.title}</span>
        <span className="clamp1 muted" style={{ display: 'block', fontSize: 13 }}>{sub}</span>
      </span>
    </button>
  );
}

function TopResult({ item }: { item: Item }) {
  const href = hrefFor(item);
  const body = (
    <>
      {item.kind === 'artist' ? <Avatar src={item.thumb} size={92} /> : <Cover src={item.thumb} size={92} radius={4} />}
      <div>
        <div className="tt clamp2">{item.title}</div>
        <div className="muted clamp1">{item.kind === 'song' ? artistNames(item.artists) : item.kind === 'album' ? artistNames(item.artists) : item.subtitle}</div>
      </div>
      <style jsx>{`
        .tt { font-family: var(--font-display); font-size: 2.25rem; font-weight: 400; letter-spacing: -.02em; line-height: 1.1; margin: var(--sp-2) 0; color: var(--ink); }
      `}</style>
    </>
  );
  return item.kind === 'song' ? (
    <Tile span={5} md={12} tone="glow" onClick={() => usePlayer.getState().playRadio(item)} label="Top result">
      {body}
    </Tile>
  ) : (
    <Tile span={5} md={12} tone="glow" href={href!} label="Top result">
      {body}
    </Tile>
  );
}

function ItemGrid({ items, title }: { items: Item[]; title: string }) {
  return (
    <Tile span={12} title={title} sub={`${items.length} results`} label={title}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))', gap: 'var(--sp-4)' }}>
        {items.map((it) => (
          <ItemCard key={it.kind + it.id} item={it} />
        ))}
      </div>
    </Tile>
  );
}
