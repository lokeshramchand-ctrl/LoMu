import { home } from '@/server/catalog';
import { json } from '@/server/http';
export const dynamic = 'force-dynamic';
export const GET = () => json(home, 300);
