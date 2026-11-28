'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Icon } from './Icon';
import { useAuth } from '@/player/sync';

export function Sheet({
  open,
  onClose,
  title,
  sub,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  sub?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const closeBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="sheet-wrap">
      <div className="scrim" aria-hidden onClick={onClose} />
      <aside className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <div className="grow">
            <h2>{title}</h2>
            {sub && <p className="muted">{sub}</p>}
          </div>
          <button ref={closeBtn} className="icon-btn bordered" aria-label="Close" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </header>
        <div className="body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </aside>
      <style jsx>{`
        .sheet-wrap { position: fixed; inset: 0; z-index: 110; }
        .scrim { position: absolute; inset: 0; background: var(--scrim); animation: fade .25s var(--ease) both; }
        .sheet { position: absolute; top: 0; right: 0; bottom: 0; width: min(460px, 100%); display: flex; flex-direction: column; background: var(--card-hover); box-shadow: var(--shadow-lg); animation: slide .4s var(--ease-out) both; }
        header { display: flex; align-items: flex-start; gap: 12px; padding: 22px 22px 16px; }
        h2 { font-size: 1.75rem; font-weight: 400; margin-top: 2px; }
        header p { margin-top: 6px; font-size: 13px; }
        .body { flex: 1; overflow-y: auto; overscroll-behavior: contain; padding: 8px 22px 22px; }
        footer { padding: 14px 22px; display: flex; gap: 10px; justify-content: flex-end; }
        @keyframes fade { from { opacity: 0; } }
        @keyframes slide { from { transform: translateX(24px); opacity: 0; } }
        @media (max-width: 900px) {
          .sheet { top: auto; left: 0; width: 100%; max-height: 86dvh; border-left: 0; border-top: 1px solid var(--border); border-radius: 8px 8px 0 0; animation-name: up; }
          @keyframes up { from { transform: translateY(40px); opacity: 0; } }
        }
      `}</style>
    </div>
  );
}

export function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <div className="tg">
      <div className="grow">
        <div className="l">{label}</div>
        {hint && <div className="h">{hint}</div>}
      </div>
      <button className={`sw${on ? ' on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}>
        <i />
      </button>
      <style jsx>{`
        .tg { display: flex; align-items: center; gap: var(--sp-4); padding: var(--sp-3) 0; border-bottom: 1px solid var(--border); }
        .tg:last-child { border-bottom: 0; }
        .l { font-weight: 500; font-size: 14px; }
        .h { color: var(--muted); font-size: 12.5px; margin-top: 2px; }
                .sw { width: 40px; height: 24px; border-radius: 999px; background: var(--border-2); position: relative; flex: none; transition: background .2s var(--ease); }
                .sw i { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: var(--ink); transition: transform .2s var(--ease); }
                .sw.on { background: var(--signal); }
                .sw.on i { transform: translateX(16px); background: var(--on-signal); }
      `}</style>
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <b>{title}</b>
      {hint && <span style={{ maxWidth: 360 }}>{hint}</span>}
      {action}
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: React.ReactNode; sub?: string; actions?: React.ReactNode }) {
  const user = useAuth((s) => s.user);
  return (
    <header className="page-head fade-in">
      <Link href="/settings" className="avatar-link" aria-label="Account and settings">{(user ?? 'L')[0]?.toUpperCase()}</Link>
      <div>
        <h1 className="h1">{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </header>
  );
}
