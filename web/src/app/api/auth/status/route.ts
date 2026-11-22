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
    // Only signed-in accounts learn how many seats are left, and the server's address on the home network
    // (LOMU_LAN_ADDRESS): a way in for clients that cannot reach the public name from inside the LAN.
    ...(user ? { seats: maxUsers() - userCount(), lan: process.env.LOMU_LAN_ADDRESS || null } : {}),
  });
}
