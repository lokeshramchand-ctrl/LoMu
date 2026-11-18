'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/player/sync';

/** Blocks the app behind the owner login (or first-run account creation). */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status, error, needsCode, refresh, submit } = useAuth();
  const [code, setCode] = useState('');
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (status === 'ready') return <>{children}</>;
  if (status === 'loading') return <div className="gate" />;
  const mode = status === 'setup' ? 'setup' : 'login';
  return (
    <div className="gate">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          await submit(mode, u, p, code);
          setBusy(false);
        }}
      >
        <h1>{mode === 'setup' ? 'Create your LoMu account' : 'Welcome back'}</h1>
        <p>{mode === 'setup' ? 'One account for you. It syncs this browser and your phone.' : 'Sign in to your LoMu.'}</p>
        <input autoFocus placeholder="Username" autoComplete="username" value={u} onChange={(e) => setU(e.target.value)} />
        <input
          type="password"
          placeholder={mode === 'setup' ? 'Password (8+ characters)' : 'Password'}
          autoComplete={mode === 'setup' ? 'new-password' : 'current-password'}
          value={p}
          onChange={(e) => setP(e.target.value)}
        />
        {mode === 'setup' && needsCode && <input placeholder="Setup code (from the server config)" value={code} onChange={(e) => setCode(e.target.value)} />}
        {error && <div className="err">{error}</div>}
        <button disabled={busy || !u || !p}>{mode === 'setup' ? 'Create account' : 'Sign in'}</button>
      </form>
      <style jsx>{`
        .gate { position: fixed; inset: 0; display: grid; place-items: center; background: var(--bg); padding: 24px; z-index: 100; }
        form { width: min(380px, 100%); display: flex; flex-direction: column; gap: 12px; }
        h1 { font-size: 34px; font-weight: 800; letter-spacing: -0.04em; line-height: 1; margin: 0; }
        p { color: var(--ink-2); margin: 0 0 8px; }
        input { padding: 14px 18px; border-radius: 999px; border: 1px solid var(--line); background: var(--surface-2); color: var(--ink); font: inherit; outline: none; }
        button { padding: 14px; border-radius: 999px; border: 0; background: var(--ink); color: var(--bg); font: inherit; font-weight: 700; cursor: pointer; }
        button:disabled { opacity: 0.4; }
        .err { color: #d33; font-size: 14px; }
      `}</style>
    </div>
  );
}
