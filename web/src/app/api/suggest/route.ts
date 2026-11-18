import { suggestions } from '@/server/catalog';
import { json } from '@/server/http';
export const dynamic = 'force-dynamic';
export const GET = (req: Request) => json(() => suggestions(new URL(req.url).searchParams.get('q') ?? ''), 300);
