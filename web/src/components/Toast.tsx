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
        .toast { position: fixed; left: 50%; bottom: calc(var(--player-h) + 24px); transform: translateX(-50%); z-index: 90; background: var(--ink); color: var(--on-ink); padding: 10px 18px; border-radius: 999px; font-weight: 500; font-size: 13.5px; box-shadow: var(--lift-hi); }
        @media (max-width: 900px) { .toast { bottom: calc(var(--player-h) + 90px); } }
      `}</style>
    </div>
  );
}
