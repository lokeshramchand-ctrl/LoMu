'use client';
import { create } from 'zustand';

const useToast = create<{ msg: string | null; key: number }>(() => ({ msg: null, key: 0 }));
let timer: ReturnType<typeof setTimeout> | undefined;

export function toast(msg: string) {
  clearTimeout(timer);
  useToast.setState((s) => ({ msg, key: s.key + 1 }));
  timer = setTimeout(() => useToast.setState({ msg: null }), 2200);
}

export function ToastHost() {
  const { msg, key } = useToast();
  if (!msg) return null;
  return (
    <div key={key} className="toast fade-in" role="status">
      {msg}
      <style jsx>{`
        .toast { position: fixed; left: 50%; bottom: calc(var(--player-h) + var(--tabs-h) + 36px); transform: translateX(-50%); z-index: 90; background: var(--ink); color: var(--on-ink); padding: 12px 20px; border-radius: var(--r); font-weight: 600; font-size: .875rem; box-shadow: var(--lift-hi); }
        @media (max-width: 900px) { .toast { bottom: calc(var(--player-h) + var(--tabs-h) + 36px); } }
      `}</style>
    </div>
  );
}
