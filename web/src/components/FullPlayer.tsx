'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { currentTrack, usePlayer } from '@/player/store';
import { useLibrary } from '@/player/library';
import { useLyrics } from '@/lib/api';
import { artistNames } from '@/lib/format';
import type { Track } from '@/lib/types';
import { Cover } from './Art';
import { Icon } from './Icon';
import { Seek, Volume } from './PlayerBar';
import { DevicesButton } from './Devices';
import { CoverWash } from '@/lib/wash';
import { useConnect, remoteDevice, sendCommand } from '@/player/connect';
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
      <CoverWash thumb={track.thumb} />
      <header className="top">
        <button className="grab" aria-label="Close player" onClick={() => P.setExpanded(false)}><i /></button>
      </header>

      <div className={`body${panel ? ' with-panel' : ''}`}>
        <div className="stage">
          <div className={`art${playing ? '' : ' paused'}`}>
            <Cover src={track.thumb} size="100%" radius={14} />
          </div>

          <div className="info">
            <div className="titlerow">
              <div className="grow">
                <h1 className="title clamp2">{track.title}</h1>
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
              </div>
              <button className={`round${liked ? ' on' : ''}`} aria-label={liked ? 'Unlike' : 'Like'} aria-pressed={liked} onClick={() => useLibrary.getState().toggleLike(track)}>
                <Icon name={liked ? 'heartFill' : 'heart'} size={18} />
              </button>
              <button className="round" aria-label="More" onClick={(e) => useMenu.getState().open(track, e)}>
                <Icon name="more" size={18} />
              </button>
            </div>
            <div style={{ marginTop: 18 }}>
              <Seek />
            </div>
            <div className="controls">
              <button className="icon-btn" aria-label="Previous" onClick={() => P.prev()}>
                <Icon name="prev" size={40} />
              </button>
              <button className="playbig" aria-label={playing ? 'Pause' : 'Play'} onClick={() => P.toggle()}>
                {buffering ? <span className="spinner" /> : <Icon name={playing ? 'pause' : 'play'} size={56} />}
              </button>
              <button className="icon-btn" aria-label="Next" onClick={() => P.next()}>
                <Icon name="next" size={40} />
              </button>
            </div>
            <Volume wide />
            <div className="bottom">
              <button className={`icon-btn${panel === 'lyrics' ? ' on' : ''}`} aria-label="Lyrics" aria-pressed={panel === 'lyrics'} onClick={() => P.setPanel('lyrics')}>
                <Icon name="lyrics" size={22} />
              </button>
              <DevicesButton />
              <button className={`icon-btn${panel === 'queue' ? ' on' : ''}`} aria-label="Up next" aria-pressed={panel === 'queue'} onClick={() => P.setPanel('queue')}>
                <Icon name="queue" size={22} />
              </button>
            </div>
          </div>
        </div>

        {panel && <aside className="panel card fade-in">{panel === 'lyrics' ? <Lyrics track={track} /> : <Queue />}</aside>}
      </div>

      <style jsx>{`
        /* always dark with white controls over the cover wash, in both themes (as on the phone) */
        .fp { --bg: #000; --ink: #fff; --text: #fff; --muted: rgba(255, 255, 255, .72); --border: rgba(255, 255, 255, .16); --border-2: rgba(255, 255, 255, .3); --signal: #fff; --signal-hi: #fff; --signal-t: #fff; --on-signal: #000; --signal-soft: rgba(255, 255, 255, .16); --surface-2: rgba(255, 255, 255, .14); --card-hover: rgba(255, 255, 255, .2); --pill: rgba(255, 255, 255, .12); --pill-hover: rgba(255, 255, 255, .2); --row-hover: rgba(255, 255, 255, .1); color: #fff; overflow: hidden; position: fixed; inset: 0; z-index: 70; display: flex; flex-direction: column; background: var(--bg); transform: translateY(102%); transition: transform .5s var(--ease-out); visibility: hidden; }
        .fp.open { transform: none; visibility: visible; }
        .top, .body { position: relative; z-index: 1; }
        .grab { width: 100%; height: 52px; display: grid; place-items: center; }
        .grab i { width: 36px; height: 5px; border-radius: 3px; background: rgba(255, 255, 255, .5); }
        .top { height: 52px; }
        .body { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr; gap: 28px; padding: 28px var(--gutter) 32px; overflow-y: auto; }
        .body.with-panel { grid-template-columns: minmax(0, 1.2fr) minmax(320px, .9fr); }
        .stage { display: flex; align-items: center; justify-content: center; gap: 56px; min-height: 0; }
        .art { width: min(46vh, 420px); aspect-ratio: 1; flex: none; box-shadow: 0 24px 56px -16px rgba(0, 0, 0, .6); border-radius: 14px; transition: transform .5s cubic-bezier(.3, 1.4, .5, 1); }
        .art.paused { transform: scale(.86); }
        .info { width: min(480px, 100%); min-width: 0; }
        .titlerow { display: flex; align-items: center; gap: 10px; }
        .title { font-size: clamp(1.4rem, 2.4vw, 1.75rem); font-family: var(--font-display); font-weight: 700; line-height: 1.2; letter-spacing: -.01em; overflow-wrap: anywhere; }
        .round { flex: none; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; background: rgba(255, 255, 255, .22); color: #fff; transition: transform .1s ease-out; }
        .round:active { transform: scale(.92); }
        .bottom { display: flex; justify-content: space-around; align-items: center; margin-top: 8px; }
        .artists { margin-top: 2px; font-size: 17px; color: var(--muted); font-weight: 500; }
        .artists :global(a:hover) { color: var(--text); text-decoration: underline; }
        .controls { display: flex; align-items: center; justify-content: space-around; margin-top: 12px; }
        .icon-btn.on { color: var(--signal-t) !important; }
        .playbig { width: 84px; height: 84px; display: grid; place-items: center; color: #fff; transition: transform .1s ease-out; }
        .playbig:active { transform: scale(.93); }
        .spinner { width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--border-2); border-top-color: var(--ink); animation: spin .8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .panel { min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
        .body.with-panel .stage { flex-direction: column; gap: 26px; }
        .body.with-panel .art { width: min(28vh, 260px); }
        @media (max-width: 900px) {
          .body, .body.with-panel { grid-template-columns: 1fr; padding: 18px var(--gutter) 26px; }
          .stage, .body.with-panel .stage { flex-direction: column; gap: 22px; justify-content: flex-start; }
          .art, .body.with-panel .art { width: min(78vw, 40vh); }
          .body.with-panel .stage { display: none; }
          .panel { position: fixed; inset: calc(var(--top-h) + 8px) 10px 10px; z-index: 2; }
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
        <button className="icon-btn sm" aria-label="Close" onClick={() => usePlayer.getState().setPanel('lyrics')}>
          <Icon name="close" size={16} />
        </button>
      </div>
      <div className="lyr" ref={box}>
        {isLoading && <p className="muted msg">Finding lyrics…</p>}
        {!isLoading && !data && <p className="muted msg">No lyrics found for this song.</p>}
        {data?.lines.map((l, i) => (
          <p
            key={i}
            data-i={i}
            className={synced ? (i === activeIdx ? 'cur' : i < activeIdx ? 'past' : '') : 'plain'}
            onClick={() => synced && l.t >= 0 && usePlayer.getState().seek(l.t / 1000)}
          >
            {l.text || ' '}
          </p>
        ))}
        {data && <p className="src">Lyrics · {data.source}</p>}
      </div>
      <style jsx>{`
        .ph { display: flex; align-items: center; justify-content: space-between; padding: 14px 14px 6px 22px; border-bottom: 1px solid var(--border); }
        .lyr { flex: 1; overflow-y: auto; padding: 18px 24px 40vh; scrollbar-width: thin; }
        p { margin: 0 0 14px; font-size: 24px; line-height: 1.25; font-weight: 600; letter-spacing: -.03em; color: var(--border-2); transition: color .3s var(--ease); cursor: pointer; }
        p.cur { color: var(--text); }
        p.past { color: var(--muted); opacity: .7; }
        p.plain { color: var(--text); font-size: 17px; font-weight: 500; cursor: default; margin-bottom: 6px; letter-spacing: -.012em; }
        p.src { font-size: 12px; font-weight: 500; color: var(--muted); margin-top: 28px; letter-spacing: 0; cursor: default; }
        p.msg { font-size: 14px; font-weight: 400; letter-spacing: 0; color: var(--muted); cursor: default; }
      `}</style>
    </>
  );
}

function Queue() {
  const localQueue = usePlayer((s) => s.queue);
  const localIndex = usePlayer((s) => s.index);
  const localPlaying = usePlayer((s) => s.playing);
  // While steering another device the list is that device's queue (its current song, then what comes next).
  const remote = useConnect((s) => remoteDevice(s));
  const queue: Track[] = remote ? [...(remote.track ? [remote.track] : []), ...(remote.queue ?? [])] : localQueue;
  const index = remote ? 0 : localIndex;
  const playing = remote ? !!remote.playing : localPlaying;
  const go = (i: number) => (remote ? void (i > 0 && sendCommand(remote.id, { type: 'skipto', offset: i })) : usePlayer.getState().jump(i));
  const autoplay = usePlayer((s) => s.autoplay);
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.querySelector('.q.cur')?.scrollIntoView({ block: 'center' });
  }, []);

  return (
    <>
      <div className="ph">
        <span className="eyebrow">Up next · {Math.max(0, queue.length - index - 1)}</span>
        <div className="row" style={{ gap: 4 }}>
          <button className={`icon-btn sm${shuffle ? ' on' : ''}`} aria-label="Shuffle" aria-pressed={shuffle} onClick={() => usePlayer.getState().toggleShuffle()}>
            <Icon name="shuffle" size={16} />
          </button>
          <button className={`icon-btn sm${repeat !== 'off' ? ' on' : ''}`} aria-label={`Repeat ${repeat}`} onClick={() => usePlayer.getState().cycleRepeat()}>
            <Icon name={repeat === 'one' ? 'repeatOne' : 'repeat'} size={16} />
          </button>
          <button className={`btn sm${autoplay ? ' primary' : ''}`} onClick={() => usePlayer.setState({ autoplay: !autoplay })}>
            Autoplay {autoplay ? 'on' : 'off'}
          </button>
          <button className="icon-btn sm" aria-label="Close" onClick={() => usePlayer.getState().setPanel('queue')}>
            <Icon name="close" size={16} />
          </button>
        </div>
      </div>
      <div className="list" ref={listRef}>
        {queue.map((t, i) => (
          <div key={`${t.id}-${i}`} className={`q${i === index ? ' cur' : ''}${i < index ? ' past' : ''}`} role="button" tabIndex={0} aria-label={`Play ${t.title}`} onClick={() => go(i)} onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); go(i); } }}>
            <Cover src={t.thumb} size={40} radius={8} />
            <div className="grow">
              <div className="clamp1" style={{ fontWeight: 500, fontSize: 13.5 }}>{t.title}</div>
              <div className="clamp1 muted" style={{ fontSize: 12.5 }}>{artistNames(t.artists)}</div>
            </div>
            {i === index ? (
              playing ? <Bars /> : null
            ) : remote ? null : (
              <button
                className="icon-btn sm x"
                aria-label="Remove from queue"
                onClick={(e) => {
                  e.stopPropagation();
                  usePlayer.getState().removeAt(i);
                }}
              >
                <Icon name="close" size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
      <style jsx>{`
        .ph { display: flex; align-items: center; justify-content: space-between; padding: 12px 12px 10px 22px; border-bottom: 1px solid var(--border); }
        .list { flex: 1; overflow-y: auto; padding: 8px 10px 20px; }
        .q { touch-action: manipulation; display: flex; align-items: center; gap: 12px; padding: 6px 10px; border-radius: 12px; cursor: pointer; transition: background .2s; }
        .q:hover { background: var(--surface-2); }
        .q.cur { background: var(--signal-soft); }
        .q.past { opacity: .5; }
        .x { opacity: 0; }
        .q:hover .x { opacity: 1; }
      `}</style>
    </>
  );
}
