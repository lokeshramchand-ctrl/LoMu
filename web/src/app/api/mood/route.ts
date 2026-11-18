import { moodPlaylists } from '@/server/catalog';
import { json } from '@/server/http';
export const dynamic = 'force-dynamic';
export const GET = (req: Request) => {
  const u = new URL(req.url);
  return json(() => moodPlaylists(u.searchParams.get('browseId') ?? 'FEmusic_moods_and_genres_category', u.searchParams.get('params') ?? ''), 1800);
};
