'use client';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useLibrary } from '@/player/library';
import { Collection } from '@/components/Collection';
import { Mosaic } from '@/components/Mosaic';
import { Icon } from '@/components/Icon';

export default function UserPlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const p = useLibrary((s) => s.playlists.find((x) => x.id === id));
  if (!p) return <p className="muted">This playlist no longer exists.</p>;
  return (
    <Collection
      kind="Your playlist"
      title={p.name}
      thumb={p.tracks[0]?.thumb}
      cover={<Mosaic tracks={p.tracks} size={260} />}
      meta={`${p.tracks.length} songs`}
      tracks={p.tracks}
      source={`user:${p.id}`}
      playlistId={p.id}
      actions={
        <>
          <button
            className="pill-btn"
            onClick={() => {
              const name = prompt('Rename playlist', p.name);
              if (name) useLibrary.getState().renamePlaylist(p.id, name);
            }}
          >
            Rename
          </button>
          <button
            className="pill-btn"
            onClick={() => {
              if (confirm(`Delete “${p.name}”?`)) {
                useLibrary.getState().deletePlaylist(p.id);
                router.replace('/library');
              }
            }}
          >
            <Icon name="close" size={16} /> Delete
          </button>
        </>
      }
    />
  );
}
