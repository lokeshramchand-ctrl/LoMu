'use client';
import { use } from 'react';
import { usePlaylist } from '@/lib/api';
import { Collection, PageError, PageSkeleton } from '@/components/Collection';
import { Icon } from '@/components/Icon';
import { useLibrary } from '@/player/library';
import { toast } from '@/components/Toast';

export default function PlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent(use(params).id);
  const { data, isLoading, error, refetch } = usePlaylist(id);
  const saved = useLibrary((s) => !!s.savedPlaylists[id]);
  if (isLoading) return <PageSkeleton />;
  if (error || !data) return <PageError error={error} retry={() => refetch()} />;
  return (
    <Collection
      kind="Playlist"
      title={data.title}
      thumb={data.thumb}
      meta={[data.author, data.trackCount].filter(Boolean).join(' · ')}
      description={data.description}
      tracks={data.tracks}
      source={`playlist:${id}`}
      actions={
        <>
          <button
            className="btn"
            onClick={() => useLibrary.getState().toggleSaved({ kind: 'playlist', id, title: data.title, subtitle: data.author, thumb: data.thumb })}
          >
            <Icon name={saved ? 'check' : 'plus'} size={16} /> {saved ? 'Saved' : 'Save'}
          </button>
          <button
            className="btn"
            onClick={() => {
              useLibrary.getState().createPlaylist(data.title, data.tracks);
              toast(`Imported ${data.tracks.length} songs into your library`);
            }}
          >
            <Icon name="download" size={16} /> Import
          </button>
        </>
      }
    />
  );
}
