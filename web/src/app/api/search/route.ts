import { search } from '@/server/catalog';
import { json } from '@/server/http';
export const dynamic = 'force-dynamic';
export const GET = (req: Request) => json(() => search(new URL(req.url).searchParams.get('q') ?? ''), 300);
