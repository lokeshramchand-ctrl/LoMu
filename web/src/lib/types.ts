export type ArtistRef = { id?: string; name: string };

export type Track = {
  kind: 'song';
  id: string; // YouTube videoId
  title: string;
  artists: ArtistRef[];
  album?: { id?: string; name: string };
  duration?: number; // seconds
  thumb?: string;
  explicit?: boolean;
  video?: boolean; // music video rather than an audio track
};

export type AlbumCard = {
  kind: 'album';
  id: string; // browseId
  title: string;
  subtitle?: string;
  artists: ArtistRef[];
  year?: string;
  thumb?: string;
};

export type PlaylistCard = {
  kind: 'playlist';
  id: string; // playlist id (without the VL prefix)
  title: string;
  subtitle?: string;
  thumb?: string;
};

export type ArtistCard = {
  kind: 'artist';
  id: string; // channel/browse id
  title: string;
  subtitle?: string;
  thumb?: string;
};

export type Item = Track | AlbumCard | PlaylistCard | ArtistCard;

export type Shelf = { title: string; subtitle?: string; items: Item[] };

export type HomeData = { shelves: Shelf[] };

export type ExploreData = {
  trending: Track[];
  newReleases: AlbumCard[];
  moods: { title: string; params: string; browseId: string; color?: string }[];
  shelves: Shelf[];
};

export type SearchData = { top?: Item; songs: Track[]; albums: AlbumCard[]; artists: ArtistCard[]; playlists: PlaylistCard[]; videos: Track[] };

export type AlbumData = {
  id: string;
  title: string;
  artists: ArtistRef[];
  year?: string;
  thumb?: string;
  playlistId?: string;
  description?: string;
  tracks: Track[];
  duration?: string;
  more: Shelf[];
};

export type ArtistData = {
  id: string;
  name: string;
  thumb?: string;
  description?: string;
  subscribers?: string;
  image?: string; // square, high-res (enrichment)
  banner?: string;
  genre?: string;
  origin?: string;
  since?: string;
  bioSource?: string;
  topSongs: Track[];
  shelves: Shelf[];
};

export type PlaylistData = {
  id: string;
  title: string;
  author?: string;
  thumb?: string;
  description?: string;
  trackCount?: string;
  tracks: Track[];
};

export type LyricsLine = { t: number; text: string }; // t in ms; -1 for unsynced
export type LyricsData = { synced: boolean; lines: LyricsLine[]; source: string } | null;
