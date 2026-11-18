import { album } from '@/server/catalog';
import { idParam, json } from '@/server/http';
export const dynamic = 'force-dynamic';
export const GET = async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const id = await idParam(ctx);
  return json(() => album(id), 600);
};
