'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { currentTrack, usePlayer } from '@/player/store';
import { useLibrary } from '@/player/library';
import { useLyrics } from '@/lib/api';
import { artistNames } from '@/lib/format';
import type { Track } from '@/lib/types';
import { Cover, Disc } from './Art';
import { Icon } from './Icon';
import { Seek } from './PlayerBar';
import { Bars } from './Cards';
import { useMenu } from './Menu';

export function FullPlayer() {
  const expanded = usePlayer((s) => s.expanded);
  const track = usePlayer(currentTrack);
  const playing = usePlayer((s) => s.playing);
  const panel = usePlayer((s) => s.panel);
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const buffering = usePlayer((s) => s.buffering);
  const liked = useLibrary((s) => (track ? !!s.liked[track.id] : false));
  const P = usePlayer.getState();

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && P.setExpanded(false);
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [expanded, P]);

  if (!track) return null;
  return (
    <div className={`fp${expanded ? ' open' : ''}`} aria-hidden={!expanded} role="dialog" aria-label="Now playing">
      <header className="top">
        <button className="icon-btn neu-sm" aria-label="Close player" onClick={() => P.setExpanded(false)}>
          <Icon name="down" />
        </button>
        <div className="eyebrow">Now playing</div>
        <button className="icon-btn neu-sm" aria-label="More" onClick={(e) => useMenu.getState().open(track, e)}>
          <Icon name="more" />
        </button>
      </header>

      <div className={`body${panel ? ' with-panel' : ''}`}>
        <div className="stage">
          <div className="record">
            <div className="sleeve">
              <Cover src={track.thumb} size="100%" radius={26} />
            </div>
            <div className="vinyl">
              <Disc src={track.thumb} size="100%" spin paused={!playing} />
            </div>
          </div>

          <div className="info">
            <h1 className="display title clamp2">{track.title}</h1>
            <div className="artists clamp1">
              {track.artists.map((a, i) => (
                <span key={i}>
                  {i > 0 && ', '}
                  {a.id ? (
                    <Link href={`/artist/${a.id}`} onClick={() => P.setExpanded(false)}>
                      {a.name}
                    </Link>
                  ) : (
                    a.name
                  )}
                </span>
              ))}
            </div>
            <div style={{ marginTop: 26 }}>
              <Seek />
            </div>
            <div className="controls">
              <button className={`icon-btn${shuffle ? ' on' : ''}`} aria-label="Shuffle" aria-pressed={shuffle} onClick={() => P.toggleShuffle()}>
                <Icon name="shuffle" />
              </button>
              <button className="icon-btn big neu-sm" aria-label="Previous" onClick={() => P.prev()}>
                <Icon name="prev" size={24} />
              </button>
              <button className="playbig" aria-label={playing ? 'Pause' : 'Play'} onClick={() => P.toggle()}>
                {buffering ? <span className="spinner" /> : <Icon name={playing ? 'pause' : 'play'} size={30} />}
              </button>
              <button className="icon-btn big neu-sm" aria-label="Next" onClick={() => P.next()}>
                <Icon name="next" size={24} />
              </button>
              <button className={`icon-btn${repeat !== 'off' ? ' on' : ''}`} aria-label={`Repeat ${repeat}`} onClick={() => P.cycleRepeat()}>
                <Icon name={repeat === 'one' ? 'repeatOne' : 'repeat'} />
              </button>
            </div>
            <div className="secondary">
              <button className={`chip${liked ? ' on' : ''}`} onClick={() => useLibrary.getState().toggleLike(track)}>
                <Icon name={liked ? 'heartFill' : 'heart'} size={18} /> {liked ? 'Liked' : 'Like'}
              </button>
              <button className={`chip${panel === 'lyrics' ? ' on' : ''}`} onClick={() => P.setPanel('lyrics')}>
                <Icon name="lyrics" size={18} /> Lyrics
              </button>
              <button className={`chip${panel === 'queue' ? ' on' : ''}`} onClick={() => P.setPanel('queue')}>
                <Icon name="queue" size={18} /> Up next
              </button>
            </div>
          </div>
        </div>

        {panel && (
          <aside className="panel neu fade-in">
            {panel === 'lyrics' ? <Lyrics track={track} /> : <Queue />}
          </aside>
        )}
      </div>

      <style jsx>{`
        .fp {
          position: fixed; inset: 0; z-index: 70; display: flex; flex-direction: column;
          background:
            radial-gradient(900px 600px at 20% 0%, var(--bg-hi), transparent 60%),
            var(--bg);
          transform: translateY(102%); transition: transform .55s var(--ease); visibility: hidden;
        }
        .fp.open { transform: none; visibility: visible; }
        .top { display: flex; align-items: center; justify-content: space-between; padding: 22px 32px; }
        .body { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr; gap: 32px; padding: 0 48px 40px; }
        .body.with-panel { grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.9fr); }
        .stage { display: flex; align-items: center; justify-content: center; gap: 64px; min-height: 0; }
        .record { position: relative; width: min(46vh, 430px); aspect-ratio: 1; flex: none; margin-right: min(16vh, 150px); }
        .sleeve { position: absolute; inset: 0; z-index: 2; }
        .vinyl { position: absolute; inset: 3%; z-index: 1; transform: translateX(38%); transition: transform .8s var(--ease); }
        .fp:not(.open) .vinyl { transform: translateX(0); }
        .info { width: min(520px, 100%); min-width: 0; }
        .title { font-size: clamp(34px, 4.4vw, 60px); }
        .artists { margin-top: 12px; font-size: 20px; color: var(--ink-2); font-weight: 600; letter-spacing: -0.02em; }
        .artists :global(a:hover) { color: var(--ink); }
        .controls { display: flex; align-items: center; justify-content: space-between; margin-top: 28px; max-width: 420px; }
        :global(.icon-btn.big) { width: 58px; height: 58px; }
        .on { color: var(--ink) !important; }
        .controls > :global(.icon-btn:not(.big)) { color: var(--ink-3); }
        .playbig { width: 84px; height: 84px; border-radius: 50%; display: grid; place-items: center; background: var(--accent); color: var(--accent-ink); box-shadow: 0 18px 34px -12px rgba(0,0,0,.55); transition: transform .2s var(--ease); }
        .playbig:active { transform: scale(.94); }
        .spinner { width: 26px; height: 26px; border-radius: 50%; border: 3px solid color-mix(in oklab, var(--accent-ink) 30%, transparent); border-top-color: var(--accent-ink); animation: spin .8s linear infinite; }
        .secondary { display: flex; gap: 12px; margin-top: 30px; flex-wrap: wrap; }
        .chip { display: inline-flex; align-items: center; gap: 8px; height: 42px; padding: 0 18px; border-radius: 999px; background: var(--surface); box-shadow: var(--neu-sm); font-weight: 600; font-size: 14px; color: var(--ink-2); }
        .chip.on { box-shadow: var(--neu-in); color: var(--ink); }
        .panel { border-radius: 30px; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
        .body.with-panel .stage { flex-direction: column; gap: 34px; }
        .body.with-panel .record { width: min(32vh, 300px); margin-right: min(12vh, 110px); }
        .body.with-panel .info { text-align: left; }
        @media (max-width: 900px) {
          .top { padding: 16px 18px; }
          .body, .body.with-panel { grid-template-columns: 1fr; padding: 0 22px 26px; }
          .stage, .body.with-panel .stage { flex-direction: column; gap: 26px; justify-content: flex-start; padding-top: 8px; }
          .record { width: min(64vw, 40vh); margin-right: 18vw; }
          .body.with-panel .stage { display: none; }
          .title { font-size: 34px; }
          .artists { font-size: 17px; }
          .controls { max-width: none; }
          .panel { position: fixed; inset: 76px 12px 16px; z-index: 2; }
        }
      `}</style>
    </div>
  );
}

function Lyrics({ track }: { track: Track }) {
  const { data, isLoading } = useLyrics(track);
  const position = usePlayer((s) => s.position);
  const box = useRef<HTMLDivElement>(null);
  const ms = position * 1000 + 250;
  const synced = !!data?.synced;
  const activeIdx = synced ? Math.max(0, (data?.lines ?? []).findLastIndex((l) => l.t <= ms)) : -1;

  useEffect(() => {
    if (!synced || !box.current) return;
    const el = box.current.querySelector<HTMLElement>(`[data-i="${activeIdx}"]`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeIdx, synced]);

  return (
    <>
      <div className="ph">
        <span className="eyebrow">Lyrics</span>
        <button className="icon-btn" aria-label="Close" onClick={() => usePlayer.getState().setPanel('lyrics')}>
          <Icon name="close" size={18} />
        </button>
      </div>
      <div className="lyr" ref={box}>
        {isLoading && <p className="muted">Finding lyrics…</p>}
        {!isLoading && !data && <p className="muted">No lyrics found for this song.</p>}
        {data?.lines.map((l, i) => (
          <p
            key={i}
            data-i={i}
            className={synced ? (i === activeIdx ? 'cur' : i < activeIdx ? 'past' : '') : 'plain'}
            onClick={() => synced && l.t >= 0 && usePlayer.getState().seek(l.t / 1000)}
          >
            {l.text || ' '}
          </p>
        ))}
        {data && <p className="src">Lyrics · {data.source}</p>}
      </div>
      <style jsx>{`
        .ph { display: flex; align-items: center; justify-content: space-between; padding: 18px 18px 6px 26px; }
        .lyr { flex: 1; overflow-y: auto; padding: 10px 28px 40vh; scrollbar-width: thin; }
        p { margin: 0 0 18px; font-size: 26px; line-height: 1.25; font-weight: 750; letter-spacing: -0.03em; color: var(--ink-3); transition: color .3s, transform .3s var(--ease); cursor: pointer; transform-origin: left center; }
        p.cur { color: var(--ink); transform: scale(1.02); }
        p.past { color: color-mix(in oklab, var(--ink-2) 70%, var(--ink-3)); }
        p.plain { color: var(--ink); font-size: 20px; font-weight: 600; cursor: default; margin-bottom: 8px; }
        p.src { font-size: 12px; font-weight: 600; color: var(--ink-2); margin-top: 30px; letter-spacing: 0; cursor: default; }
        p.muted { font-size: 16px; }
      `}</style>
    </>
  );
}

function Queue() {
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const playing = usePlayer((s) => s.playing);
  const autoplay = usePlayer((s) => s.autoplay);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.querySelector('.q.cur')?.scrollIntoView({ block: 'center' });
  }, []);

  return (
    <>
      <div className="ph">
        <span className="eyebrow">Up next · {Math.max(0, queue.length - index - 1)}</span>
        <div className="row" style={{ gap: 4 }}>
          <button className={`auto${autoplay ? ' on' : ''}`} onClick={() => usePlayer.setState({ autoplay: !autoplay })}>
            Autoplay {autoplay ? 'on' : 'off'}
          </button>
          <button className="icon-btn" aria-label="Close" onClick={() => usePlayer.getState().setPanel('queue')}>
            <Icon name="close" size={18} />
          </button>
        </div>
      </div>
      <div className="list" ref={listRef}>
        {queue.map((t, i) => (
          <div key={`${t.id}-${i}`} className={`q${i === index ? ' cur' : ''}${i < index ? ' past' : ''}`} onClick={() => usePlayer.getState().jump(i)}>
            <Disc src={t.thumb} size={42} />
            <div className="grow">
              <div className="clamp1" style={{ fontWeight: 650, fontSize: 14.5 }}>{t.title}</div>
              <div className="clamp1 muted" style={{ fontSize: 13 }}>{artistNames(t.artists)}</div>
            </div>
            {i === index ? (
              playing ? <Bars /> : null
            ) : (
              <button
                className="icon-btn x"
                aria-label="Remove from queue"
                onClick={(e) => {
                  e.stopPropagation();
                  usePlayer.getState().removeAt(i);
                }}
              >
                <Icon name="close" size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
      <style jsx>{`
        .ph { display: flex; align-items: center; justify-content: space-between; padding: 18px 14px 8px 26px; }
        .auto { font-size: 12.5px; font-weight: 650; padding: 7px 12px; border-radius: 999px; color: var(--ink-2); }
        .auto.on { color: var(--ink); box-shadow: var(--neu-in); }
        .list { flex: 1; overflow-y: auto; padding: 4px 12px 24px; }
        .q { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-radius: 16px; cursor: pointer; }
        .q:hover { background: color-mix(in oklab, var(--ink) 5%, transparent); }
        .q.cur { background: var(--surface-2); box-shadow: var(--neu-sm); }
        .q.past { opacity: 0.5; }
        .x { width: 34px; height: 34px; opacity: 0; }
        .q:hover .x { opacity: 1; }
      `}</style>
    </>
  );
}
