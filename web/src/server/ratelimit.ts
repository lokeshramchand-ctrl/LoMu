import 'server-only';

type Entry = { n: number; until: number };

export function limiter(max: number, windowMs: number, cap = 5000) {
  const m = new Map<string, Entry>();
  const live = (k: string): Entry | undefined => {
    const e = m.get(k);
    if (e && e.until <= Date.now()) {
      m.delete(k);
      return undefined;
    }
    return e;
  };
  return {
    blocked(k: string): number {
      const e = live(k);
      return e && e.n >= max ? Math.ceil((e.until - Date.now()) / 1000) : 0;
    },
    fail(k: string) {
      const e = live(k);
      if (e) e.n++;
      else {
        if (m.size >= cap) m.delete(m.keys().next().value as string);
        m.set(k, { n: 1, until: Date.now() + windowMs });
      }
    },
    clear(k: string) {
      m.delete(k);
    },
    size: () => m.size,
  };
}

export function clientIp(req: Request): string {
  const hops = Math.max(1, Number(process.env.LOMU_PROXY_HOPS) || 1);
  const parts = (req.headers.get('x-forwarded-for') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts[Math.max(0, parts.length - hops)] : 'local';
}
