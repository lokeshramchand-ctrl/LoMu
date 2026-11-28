import { json } from '@/server/http';
import { audioCacheEnabled, download, savedCount } from '@/server/audiocache';

export const dynamic = 'force-dynamic';

const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 500) : []);

export function GET(req: Request) {
  return json(async () => {
    const list = (new URL(req.url).searchParams.get('ids') ?? '').split(',').filter(Boolean).slice(0, 500);
    return { enabled: audioCacheEnabled(), saved: savedCount(list, 'opus') };
  });
}

export function POST(req: Request) {
  return json(async () => ({ queued: download(ids((await req.json().catch(() => ({}))).ids), 'opus') }));
}
