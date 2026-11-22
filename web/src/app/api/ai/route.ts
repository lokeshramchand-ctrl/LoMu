import { json } from '@/server/http';
import { readJson } from '@/server/body';
import { aiConfigured, explain, ping } from '@/server/ai';
import { aiStatus, buildAiMixNow } from '@/server/ai-recs';
import { userAffinity } from '@/server/recs';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Status of the daily AI mix (never includes the key), and the two Settings actions: test the connection, build now. */
export const GET = () => json(async (u) => aiStatus(u.id));

export const POST = (req: Request) =>
  json(async (u) => {
    const b = (await readJson(req)) as { action?: string };
    if (!aiConfigured()) return { ok: false, error: 'LOMU_AI_URL is not set on this server.', status: aiStatus(u.id) };
    try {
      if (b.action === 'test') return { ok: true, ...(await ping()), status: aiStatus(u.id) };
      if (b.action === 'build') return { ok: true, report: await buildAiMixNow(u.id, userAffinity(u.id)), status: aiStatus(u.id) };
      return { ok: false, error: 'Unknown action', status: aiStatus(u.id) };
    } catch (e) {
      return { ok: false, error: explain(e), status: aiStatus(u.id) };
    }
  });
