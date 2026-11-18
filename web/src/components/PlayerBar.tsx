'use client';
import { useRef, useState } from 'react';
import { currentTrack, usePlayer } from '@/player/store';
import { useLibrary } from '@/player/library';
import { artistNames, fmtTime } from '@/lib/format';
import { Disc } from './Art';
import { Icon } from './Icon';

export function Seek({ compact = false }: { compact?: boolean }) {
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration || currentTrack(s)?.duration || 0);
  const [drag, setDrag] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const shown = drag ?? position;
  const pct = duration ? Math.min(100, (shown / duration) * 100) : 0;

  const at = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * duration;
  };
  return (
    <div className={`seek${compact ? ' compact' : ''}`}>
      {!compact && <span className="time">{fmtTime(shown)}</span>}
      <div
        ref={ref}
        className="track neu-in"
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(shown)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') usePlayer.getState().seek(position + 5);
          if (e.key === 'ArrowLeft') usePlayer.getState().seek(Math.max(0, position - 5));
        }}
        onPointerDown={(e) => {
          if (!duration) return;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          setDrag(at(e.clientX));
        }}
        onPointerMove={(e) => drag != null && setDrag(at(e.clientX))}
        onPointerUp={(e) => {
          if (drag == null) return;
          usePlayer.getState().seek(at(e.clientX));
          setDrag(null);
        }}
      >
        <div className="fill" style={{ width: `${pct}%` }} />
        <div className="knob" style={{ left: `${pct}%` }} />
      </div>
      {!compact && <span className="time r">{fmtTime(duration)}</span>}
      <style jsx>{`
        .seek { display: flex; align-items: center; gap: 14px; width: 100%; }
        .time { font-size: 12.5px; color: var(--ink-2); font-variant-numeric: tabular-nums; width: 40px; }
        .time.r { text-align: right; }
        .track { position: relative; flex: 1; height: 8px; border-radius: 99px; cursor: pointer; touch-action: none; }
        .compact .track { height: 4px; box-shadow: none; background: color-mix(in oklab, var(--ink) 8%, transparent); }
        .fill { position: absolute; inset: 0 auto 0 0; border-radius: 99px; background: var(--ink); }
        .knob { position: absolute; top: 50%; width: 16px; height: 16px; border-radius: 50%; background: var(--surface); box-shadow: var(--neu-sm), 0 0 0 4px var(--ink) inset; transform: translate(-50%, -50%) scale(0); transition: transform .2s var(--ease); }
        .track:hover .knob, .track:active .knob { transform: translate(-50%, -50%) scale(1); }
        .compact .knob { display: none; }
      `}</style>
    </div>
  );
}

export function PlayerBar() {
  const track = usePlayer(currentTrack);
  const playing = usePlayer((s) => s.playing);
  const buffering = usePlayer((s) => s.buffering);
  const error = usePlayer((s) => s.error);
  const liked = useLibrary((s) => (track ? !!s.liked[track.id] : false));
  if (!track) return null;
  const P = usePlayer.getState();
  return (
    <div className="bar neu fade-in">
      <button className="meta" onClick={() => P.setExpanded(true)} aria-label="Open player">
        <Disc src={track.thumb} size={54} spin paused={!playing} />
        <div className="grow" style={{ textAlign: 'left' }}>
          <div className="t clamp1">{track.title}</div>
          <div className="s clamp1">{error ?? (buffering ? 'Loading…' : artistNames(track.artists))}</div>
        </div>
      </button>
      <div className="ctrls">
        <button className="icon-btn hide-sm" aria-label="Previous" onClick={() => P.prev()}>
          <Icon name="prev" size={20} />
        </button>
        <button className="play" aria-label={playing ? 'Pause' : 'Play'} onClick={() => P.toggle()}>
          <Icon name={playing ? 'pause' : 'play'} size={20} />
        </button>
        <button className="icon-btn" aria-label="Next" onClick={() => P.next()}>
          <Icon name="next" size={20} />
        </button>
      </div>
      <div className="mid hide-sm">
        <Seek />
      </div>
      <div className="right hide-sm">
        <button className={`icon-btn${liked ? ' on' : ''}`} aria-label="Like" onClick={() => useLibrary.getState().toggleLike(track)}>
          <Icon name={liked ? 'heartFill' : 'heart'} size={20} />
        </button>
        <button className="icon-btn" aria-label="Lyrics" onClick={() => (P.setExpanded(true), usePlayer.setState({ panel: 'lyrics' }))}>
          <Icon name="lyrics" size={20} />
        </button>
        <button className="icon-btn" aria-label="Queue" onClick={() => (P.setExpanded(true), usePlayer.setState({ panel: 'queue' }))}>
          <Icon name="queue" size={20} />
        </button>
      </div>
      <div className="mobile-progress">
        <Seek compact />
      </div>
      <style jsx>{`
        .bar {
          position: fixed; z-index: 50; bottom: 22px; left: calc(var(--nav-w) + var(--gutter)); right: var(--gutter);
          max-width: 1180px; margin: 0 auto; height: var(--player-h); border-radius: 999px;
          display: flex; align-items: center; gap: 18px; padding: 0 22px 0 14px;
        }
        .meta { display: flex; align-items: center; gap: 14px; min-width: 0; width: 280px; }
        .t { font-weight: 700; font-size: 15px; letter-spacing: -0.015em; }
        .s { color: var(--ink-2); font-size: 13px; margin-top: 2px; }
        .ctrls { display: flex; align-items: center; gap: 6px; }
        .play { width: 50px; height: 50px; border-radius: 50%; background: var(--accent); color: var(--accent-ink); display: grid; place-items: center; box-shadow: 0 10px 20px -8px rgba(0,0,0,.5); transition: transform .2s var(--ease); }
        .play:active { transform: scale(.92); }
        .mid { flex: 1; min-width: 160px; }
        .right { display: flex; gap: 2px; }
        .on { color: var(--ink); }
        .mobile-progress { display: none; }
        @media (max-width: 900px) {
          .bar { left: 14px; right: 14px; bottom: calc(86px + env(safe-area-inset-bottom)); height: 70px; border-radius: 24px; padding: 0 10px 0 8px; gap: 8px; }
          .meta { flex: 1; width: auto; }
          :global(.hide-sm) { display: none !important; }
          .mobile-progress { display: block; position: absolute; left: 22px; right: 22px; bottom: 6px; }
          .play { width: 44px; height: 44px; }
        }
      `}</style>
    </div>
  );
}
