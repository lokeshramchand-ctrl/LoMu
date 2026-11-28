'use client';
import { dataMode, MODES } from '@/lib/worst';

/** Dev-only switch, fixed top-centre, clear of the tab bar: Demo data / Worst case / Empty / One. Reloads so every query refetches through the same boundary. */
export function DataToggle() {
  if (process.env.NODE_ENV === 'production') return null;
  const cur = dataMode();
  const pick = (id: string) => {
    window.sessionStorage.setItem('lomu-data', id);
    const u = new URL(window.location.href);
    u.searchParams.set('data', id);
    window.location.href = u.toString();
  };
  return (
    <div role="group" aria-label="Data set" style={{ position: 'fixed', left: '50%', top: 6, transform: 'translateX(-50%)', zIndex: 200, display: 'flex', gap: 2, padding: 2, borderRadius: 99, background: '#8884', font: '11px system-ui, sans-serif', whiteSpace: 'nowrap' }}>
      {MODES.map((m) => (
        <button key={m.id} aria-pressed={cur === m.id} onClick={() => pick(m.id)} style={{ padding: '3px 10px', borderRadius: 99, background: cur === m.id ? '#fff' : 'transparent', color: cur === m.id ? '#000' : '#888', fontWeight: 600 }}>
          {m.label}
        </button>
      ))}
    </div>
  );
}
