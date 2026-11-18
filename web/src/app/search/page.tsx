'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSearch, useSuggest } from '@/lib/api';
import { artistNames, hrefFor } from '@/lib/format';
import type { Item } from '@/lib/types';
import { ShelfRow, ShelfSkeleton, TrackRow } from '@/components/Cards';
import { Avatar, Cover, Disc } from '@/components/Art';
import { Icon } from '@/components/Icon';
import { useLibrary } from '@/player/library';
import { usePlayer } from '@/player/store';

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

  useEffect(() => setText(q), [q]);
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
    <div>
      <h1 className="display h2">Search</h1>
      <form
        className="box neu-in"
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
      >
        <Icon name="search" size={22} />
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
          <button type="button" className="icon-btn" aria-label="Clear" onClick={() => (setText(''), input.current?.focus())}>
            <Icon name="close" size={18} />
          </button>
        )}
      </form>

      {focused && (text.trim().length > 1 ? sugg.data : recent.length > 0) && (
        <div className="sugg neu fade-in">
          {text.trim().length > 1 ? (
            <>
              {sugg.data?.queries.map((s) => (
                <button key={s} className="srow" onMouseDown={(e) => e.preventDefault()} onClick={() => submit(s)}>
                  <Icon name="search" size={17} />
                  <span className="clamp1">{s}</span>
                </button>
              ))}
              {sugg.data?.items.map((it) => (
                <SuggestItem key={it.kind + it.id} item={it} onDone={() => setFocused(false)} />
              ))}
            </>
          ) : (
            <>
              <div className="row" style={{ justifyContent: 'space-between', padding: '6px 12px' }}>
                <span className="eyebrow">Recent</span>
                <button className="muted" style={{ fontSize: 13, fontWeight: 600 }} onMouseDown={(e) => e.preventDefault()} onClick={() => useLibrary.getState().clearSearches()}>
                  Clear
                </button>
              </div>
              {recent.map((s) => (
                <button key={s} className="srow" onMouseDown={(e) => e.preventDefault()} onClick={() => submit(s)}>
                  <Icon name="history" size={17} />
                  <span className="clamp1">{s}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {q && isLoading && (
        <>
          <ShelfSkeleton />
          <ShelfSkeleton />
        </>
      )}
      {error && <p className="muted">Search failed: {(error as Error).message}</p>}

      {data && (
        <div className="results fade-in">
          <div className="top-grid">
            {data.top && <TopResult item={data.top} />}
            {data.songs.length > 0 && (
              <section className="songs">
                <h2 className="h3" style={{ marginBottom: 12 }}>Songs</h2>
                {data.songs.slice(0, 5).map((t, i) => (
                  <TrackRow key={t.id} track={t} index={i} list={data.songs} />
                ))}
              </section>
            )}
          </div>
          {data.artists.length > 0 && <ShelfRow shelf={{ title: 'Artists', items: data.artists }} />}
          {data.albums.length > 0 && <ShelfRow shelf={{ title: 'Albums & singles', items: data.albums }} />}
          {data.playlists.length > 0 && <ShelfRow shelf={{ title: 'Playlists', items: data.playlists }} />}
          {data.videos.length > 0 && <ShelfRow shelf={{ title: 'Videos', items: data.videos }} />}
          {!data.songs.length && !data.albums.length && !data.artists.length && <p className="muted" style={{ marginTop: 30 }}>Nothing found for “{q}”.</p>}
        </div>
      )}

      <style jsx>{`
        .box { position: relative; display: flex; align-items: center; gap: 14px; height: 64px; padding: 0 12px 0 24px; border-radius: 999px; margin-top: 26px; color: var(--ink-2); }
        .box input { flex: 1; border: 0; outline: 0; background: transparent; font-size: 19px; font-weight: 550; color: var(--ink); letter-spacing: -0.01em; min-width: 0; }
        .box input::placeholder { color: var(--ink-3); }
        .sugg { position: absolute; z-index: 30; margin-top: 12px; width: min(640px, calc(100% - 2 * var(--gutter))); border-radius: 26px; padding: 10px; }
        :global(.srow) { display: flex; align-items: center; gap: 14px; width: 100%; padding: 11px 12px; border-radius: 14px; text-align: left; font-weight: 550; color: var(--ink); }
        :global(.srow:hover) { background: color-mix(in oklab, var(--ink) 5%, transparent); }
        .results { margin-top: 10px; }
        .top-grid { display: grid; grid-template-columns: minmax(280px, 400px) 1fr; gap: 34px; margin-top: 36px; align-items: start; }
        @media (max-width: 900px) { .top-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
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
      {item.kind === 'song' ? <Disc src={item.thumb} size={38} /> : item.kind === 'artist' ? <Avatar src={item.thumb} size={38} /> : <Cover src={item.thumb} size={38} radius={10} />}
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
      {item.kind === 'song' ? (
        <Disc src={item.thumb} size={150} />
      ) : item.kind === 'artist' ? (
        <Avatar src={item.thumb} size={150} />
      ) : (
        <Cover src={item.thumb} size={150} />
      )}
      <div className="eyebrow" style={{ marginTop: 22 }}>Top result · {item.kind === 'song' ? 'Song' : item.kind}</div>
      <div className="tt clamp2">{item.title}</div>
      <div className="muted clamp1">{item.kind === 'song' ? artistNames(item.artists) : item.kind === 'album' ? artistNames(item.artists) : item.subtitle}</div>
      <style jsx>{`
        .tt { font-size: 30px; font-weight: 800; letter-spacing: -0.04em; line-height: 1.05; margin: 6px 0 6px; }
      `}</style>
    </>
  );
  const cls = 'top neu';
  const style = { display: 'block', padding: 26, borderRadius: 30, textAlign: 'left' as const, width: '100%' };
  return item.kind === 'song' ? (
    <button className={cls} style={style} onClick={() => usePlayer.getState().playRadio(item)}>
      {body}
    </button>
  ) : (
    <Link className={cls} style={style} href={href!}>
      {body}
    </Link>
  );
}
