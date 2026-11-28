'use client';

const done = new Map<string, number>();
const TTL = 20 * 60_000;

export function warm(id: string | undefined) {
  if (!id || typeof window === 'undefined') return;
  const at = done.get(id);
  if (at && Date.now() - at < TTL) return;
  done.set(id, Date.now());
  if (done.size > 300) done.delete(done.keys().next().value as string);
  fetch(`/api/stream/${encodeURIComponent(id)}?warm=1`).catch(() => done.delete(id));
}

export function warmProps(id: string | undefined) {
  let t: ReturnType<typeof setTimeout> | undefined;
  return {
    onPointerEnter: () => {
      t = setTimeout(() => warm(id), 90);
    },
    onPointerLeave: () => clearTimeout(t),
    onFocus: () => warm(id),
    onTouchStart: () => warm(id),
  };
}
