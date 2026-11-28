import { currentUser, hasOwner, isLocalMode, maxUsers, userCount } from '@/server/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await currentUser();
  return Response.json({
    setup: hasOwner(),
    user: user?.username ?? null,
    role: user?.role ?? null,
    needsCode: !hasOwner() && !!process.env.LOMU_SETUP_CODE,
    local: isLocalMode(),
    ...(user ? { seats: maxUsers() - userCount(), lan: process.env.LOMU_LAN_ADDRESS || null } : {}),
  });
}
