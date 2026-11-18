import { json } from '@/server/http';
import { buildMixes } from '@/server/recs';

export const dynamic = 'force-dynamic';

export const GET = () => json(buildMixes);
