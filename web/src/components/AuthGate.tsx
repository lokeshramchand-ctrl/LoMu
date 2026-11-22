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
        <div className="mk"><span className="mark" /><b>LoMu</b></div>
        <h1>{mode === 'setup' ? 'Create your account' : 'Welcome back'}</h1>
        {mode === 'setup' && <p>One account for you. It syncs this browser and your phone.</p>}
        <input autoFocus name="username" aria-label="Username" spellCheck={false} placeholder="Username…" autoComplete="username" value={u} onChange={(e) => setU(e.target.value)} />
        <input
          type="password"
          name="password"
          aria-label="Password"
          placeholder={mode === 'setup' ? 'Password (8+ characters)…' : 'Password…'}
          autoComplete={mode === 'setup' ? 'new-password' : 'current-password'}
          value={p}
          onChange={(e) => setP(e.target.value)}
        />
        {mode === 'setup' && needsCode && <input name="setup-code" aria-label="Setup code" spellCheck={false} autoComplete="off" placeholder="Setup code from the server config…" value={code} onChange={(e) => setCode(e.target.value)} />}
        {error && <div className="err" role="alert">{error}</div>}
        <button disabled={busy || !u || !p}>{mode === 'setup' ? 'Create account' : 'Sign in'}</button>
      </form>
      <style jsx>{`
        .gate { position: fixed; inset: 0; display: grid; place-items: center; background: var(--bg); padding: 24px; z-index: 100; }
        form { width: min(360px, 100%); display: flex; flex-direction: column; gap: 8px; padding: 24px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); box-shadow: var(--lift-hi); }
        .mk { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
        .mark { width: 24px; height: 24px; border-radius: var(--r-sm); background: var(--signal); }
        .mk b { font-family: var(--font-display); font-size: 1.5rem; font-weight: 400; letter-spacing: -.02em; line-height: 1; color: var(--ink); }
        h1 { font-size: 1.75rem; font-weight: 400; line-height: 1.1; margin: 0; letter-spacing: -.02em; }
        p { color: var(--muted); margin: 0 0 8px; }
        input { height: 36px; padding: 0 12px; border-radius: var(--r-sm); font-size: 13px; border: 1px solid var(--border-2); background: var(--surface); color: var(--text); font: inherit; transition: border-color .2s, box-shadow .2s; }
        input:focus-visible { outline: 2px solid var(--ink); outline-offset: 1px; }
        input:focus { border-color: var(--signal); box-shadow: 0 0 0 2px var(--signal-soft); }
        button { height: 36px; border-radius: var(--r); border: 0; background: var(--signal); color: var(--on-signal); font: inherit; font-weight: 600; cursor: pointer; margin-top: 4px; transition: background .15s, transform .1s ease-out; }
        button:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
        button:active { transform: scale(.97); }
        button:disabled { opacity: .4; cursor: not-allowed; }
        .err { color: var(--red-t); font-size: 13px; background: var(--red-soft); padding: 8px 10px; border-radius: var(--r-sm); }
      `}</style>
    </div>
  );
}
