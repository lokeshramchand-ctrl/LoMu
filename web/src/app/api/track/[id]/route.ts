import { radio } from '@/server/catalog';
import { idParam, json } from '@/server/http';
export const dynamic = 'force-dynamic';

export const GET = async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const id = await idParam(ctx);
  return json(async () => (await radio(id)).find((t) => t.id === id) ?? null, 3600);
};
