import { artist } from '@/server/catalog';
import { idParam, json } from '@/server/http';
export const dynamic = 'force-dynamic';
export const GET = async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const id = await idParam(ctx);
  const enrich = new URL(req.url).searchParams.get('enrich') !== '0';
  return json(() => artist(id, enrich), 600);
};
