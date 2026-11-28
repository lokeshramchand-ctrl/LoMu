export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.LOMU_LOCAL_TOKEN) {
    const { startHub } = await import('./server/hub');
    startHub();
  }
}
