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
        .toast {
          position: fixed; left: 50%; bottom: calc(var(--player-h) + 48px); transform: translateX(-50%); z-index: 90;
          background: var(--accent); color: var(--accent-ink); padding: 12px 20px; border-radius: 999px;
          font-weight: 600; font-size: 14px; box-shadow: 0 14px 30px -10px rgba(0,0,0,.45);
        }
        @media (max-width: 900px) { .toast { bottom: calc(var(--player-h) + 110px); } }
      `}</style>
    </div>
  );
}
