import { explore } from '@/server/catalog';
import { json } from '@/server/http';
export const dynamic = 'force-dynamic';
export const GET = () => json(explore, 600);
