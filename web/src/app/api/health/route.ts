import { db, lastBackup } from '@/server/db';
import { userCount } from '@/server/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  let dbOk = true;
  let accounts = 0;
  try {
    db().prepare('SELECT 1').get();
    accounts = userCount();
  } catch {
    dbOk = false;
  }
  return Response.json(
    {
      ok: dbOk,
      db: dbOk ? 'ok' : 'error',
      version: (process.env.SOURCE_COMMIT || process.env.LOMU_VERSION || 'dev').slice(0, 12),
      accounts,
      lastBackup: lastBackup(),
      uptime: Math.round(process.uptime()),
    },
    { status: dbOk ? 200 : 503, headers: { 'cache-control': 'no-store' } },
  );
}
