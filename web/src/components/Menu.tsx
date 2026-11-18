'use client';
import { create } from 'zustand';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Track } from '@/lib/types';
import { usePlayer } from '@/player/store';
import { useLibrary } from '@/player/library';
import { Icon, type IconName } from './Icon';
import { toast } from './Toast';

type MenuState = {
  track: Track | null;
  x: number;
  y: number;
  playlistId?: string;
  playlistIndex?: number;
  open: (t: Track, e: { clientX: number; clientY: number }, ctx?: { playlistId?: string; playlistIndex?: number }) => void;
  close: () => void;
};

export const useMenu = create<MenuState>((set) => ({
  track: null,
  x: 0,
  y: 0,
  open: (track, e, ctx) => set({ track, x: e.clientX, y: e.clientY, ...ctx }),
  close: () => set({ track: null, playlistId: undefined, playlistIndex: undefined }),
}));

export function TrackMenuHost() {
  const { track, x, y, close, playlistId, playlistIndex } = useMenu();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'main' | 'playlists'>('main');
  const lib = useLibrary();

  useEffect(() => {
    if (!track) return;
    setMode('main');
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && close();
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, [track, close]);

  if (!track) return null;
  const W = 260;
  const left = typeof window !== 'undefined' ? Math.min(x, window.innerWidth - W - 12) : x;
  const top = typeof window !== 'undefined' ? Math.min(y, window.innerHeight - 380) : y;
  const liked = lib.isLiked(track.id);
  const go = (href: string) => {
    close();
    router.push(href);
  };

  const Item = ({ icon, label, onClick }: { icon: IconName; label: string; onClick: () => void }) => (
    <button className="menu-item" onClick={onClick}>
      <Icon name={icon} size={19} />
      <span>{label}</span>
    </button>
  );

  return (
    <div ref={ref} className="menu neu fade-in" style={{ left, top, width: W }} role="menu">
      <div className="menu-head">
        <div className="clamp1" style={{ fontWeight: 700 }}>{track.title}</div>
        <div className="clamp1 muted" style={{ fontSize: 13 }}>{track.artists.map((a) => a.name).join(', ')}</div>
      </div>
      {mode === 'main' ? (
        <>
          <Item icon="radio" label="Start radio" onClick={() => (usePlayer.getState().playRadio(track), close())} />
          <Item icon="queue" label="Play next" onClick={() => (usePlayer.getState().playNext(track), toast('Playing next'), close())} />
          <Item icon="plus" label="Add to queue" onClick={() => (usePlayer.getState().enqueue([track]), toast('Added to queue'), close())} />
          <Item icon={liked ? 'heartFill' : 'heart'} label={liked ? 'Remove from liked' : 'Like'} onClick={() => (lib.toggleLike(track), close())} />
          <Item icon="bookmark" label="Add to playlist" onClick={() => setMode('playlists')} />
          {playlistId != null && playlistIndex != null && (
            <Item icon="close" label="Remove from this playlist" onClick={() => (lib.removeFromPlaylist(playlistId, playlistIndex), close())} />
          )}
          {track.artists[0]?.id && <Item icon="user" label="Go to artist" onClick={() => go(`/artist/${track.artists[0].id}`)} />}
          {track.album?.id && <Item icon="lyrics" label="Go to album" onClick={() => go(`/album/${track.album!.id}`)} />}
        </>
      ) : (
        <>
          <Item
            icon="plus"
            label="New playlist"
            onClick={() => {
              const name = prompt('Playlist name');
              if (name) {
                lib.createPlaylist(name, [track]);
                toast(`Added to ${name}`);
              }
              close();
            }}
          />
          {lib.playlists.map((p) => (
            <Item key={p.id} icon="bookmark" label={p.name} onClick={() => (lib.addToPlaylist(p.id, [track]), toast(`Added to ${p.name}`), close())} />
          ))}
        </>
      )}
      <style jsx>{`
        .menu { position: fixed; z-index: 80; border-radius: 22px; padding: 8px; }
        .menu-head { padding: 10px 12px 12px; border-bottom: 1px solid var(--line); margin-bottom: 6px; }
        :global(.menu-item) { display: flex; align-items: center; gap: 12px; width: 100%; padding: 11px 12px; border-radius: 14px; text-align: left; font-weight: 550; font-size: 14.5px; }
        :global(.menu-item:hover) { background: color-mix(in oklab, var(--ink) 6%, transparent); }
      `}</style>
    </div>
  );
}
