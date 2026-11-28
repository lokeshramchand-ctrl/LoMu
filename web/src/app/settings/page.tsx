'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLibrary } from '@/player/library';
import { usePlayer } from '@/player/store';
import { HOME_SECTIONS, useSettings } from '@/player/settings';
import { PageHeader, Toggle } from '@/components/ui';
import { ThemeSelect } from '@/components/Nav';
import { Bento, Tile } from '@/components/Bento';
import { toast } from '@/components/Toast';
import { useAuth } from '@/player/sync';

export default function SettingsPage() {
  const dev = useSettings((s) => s.dev);
  const setDev = useSettings((s) => s.setDev);
  const autoplay = usePlayer((s) => s.autoplay);
  const { user, sync, lastSync, logout, local, admin } = useAuth();
  const [confirmClear, setConfirmClear] = useState(false);
  const exportLibrary = () => {
    const { liked, history, playlists, albums, artists, savedPlaylists, recentSearches } = useLibrary.getState();
    const blob = new Blob([JSON.stringify({ app: 'lomu', exportedAt: new Date().toISOString(), liked, history, playlists, albums, artists, savedPlaylists, recentSearches }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lomu-library-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Library exported');
  };

  return (
    <Bento className="fade-in">
      <PageHeader  title="Settings" />
        {local && <HubGroup />}
        {!local && <Group span={7} title="Account">
          <Row
            label={user ? `Signed in as ${user}` : 'Not signed in'}
            hint={`Sync: ${sync === 'live' ? 'up to date' : sync}${lastSync ? ` · ${new Date(lastSync).toLocaleTimeString()}` : ''}`}
          >
            <button className="btn" onClick={() => logout()}>
              Sign out
            </button>
          </Row>
          <PasswordRow />
        </Group>}

        <BlockedGroup />

        <Group span={5} title="Appearance">
          <Row label="Interface theme">
            <div style={{ width: 168 }}><ThemeSelect /></div>
          </Row>
        </Group>

        {!local && admin && <AccountsGroup />}

        <Group span={6} tall title="Today">
          {HOME_SECTIONS.map((s) => (
            <HomeToggle key={s.id} id={s.id} label={s.label} />
          ))}
        </Group>

        <Group span={6} title="Playback">
          <Row label="Autoplay">
            <Switch on={autoplay} label="Autoplay" onChange={(v) => usePlayer.setState({ autoplay: v })} />
          </Row>
        </Group>

        <Group span={6} title="Library">
          <Row label="Export library">
            <button className="btn" onClick={exportLibrary}>
              Export
            </button>
          </Row>
          <Row label="Import from Google Takeout">
            <Link href="/import" className="btn">Import</Link>
          </Row>
          <Row label="Clear listening history">
            {confirmClear ? (
              <span className="row" style={{ gap: 8 }}>
                <button className="btn sm" onClick={() => setConfirmClear(false)}>
                  Cancel
                </button>
                <button
                  className="btn sm primary"
                  onClick={() => {
                    useLibrary.setState({ history: [] });
                    setConfirmClear(false);
                    toast('History cleared');
                  }}
                >
                  Yes, clear it
                </button>
              </span>
            ) : (
              <button className="btn" onClick={() => setConfirmClear(true)}>
                Clear
              </button>
            )}
          </Row>
        </Group>

        <AiGroup />

        <Group span={6} title="Developer">
          <Row label="Explore">
            <Switch on={dev.explore} label="Explore" onChange={(v) => setDev('explore', v)} />
          </Row>
          <Row label="Artist enrichment">
            <Switch on={dev.artistEnrichment} label="Artist enrichment" onChange={(v) => setDev('artistEnrichment', v)} />
          </Row>
          <Row label="Stream info">
            <Switch on={dev.streamInfo} label="Stream info" onChange={(v) => setDev('streamInfo', v)} />
          </Row>
        </Group>
    </Bento>
  );
}

type Hub = { local: boolean; url: string | null; user: string | null; state: 'off' | 'syncing' | 'online' | 'offline' | 'error'; lastSync: number | null; pending: number; error: string | null; lan: string | null; route: 'direct' | 'lan' | null };

function HubGroup() {
  const [hub, setHub] = useState<Hub | null>(null);
  const [url, setUrl] = useState('https://lomu.example.com');
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [lan, setLan] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const load = () => fetch('/api/hub', { cache: 'no-store' }).then((r) => r.json()).then((h) => live && setHub(h)).catch(() => {});
    load();
    const t = setInterval(load, 4000);
    return () => { live = false; clearInterval(t); };
  }, []);

  const call = async (method: string, body?: unknown) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/hub', { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      const j = await r.json();
      if (!r.ok) setErr(j.error ?? 'Something went wrong');
      else { setHub(j); setP(''); }
    } finally { setBusy(false); }
  };

  const connected = !!hub?.url;
  const label = !connected ? 'Not connected' : hub!.state === 'online' ? 'Up to date' : hub!.state === 'syncing' ? 'Syncing…' : hub!.state === 'offline' ? 'Home server unreachable' : 'Problem';
  const hint = !connected
    ? ''
    : hub!.state === 'offline'
      ? `Everything is saved on this PC and will sync when ${new URL(hub!.url!).host} is back${hub!.pending ? ` (${hub!.pending} ${hub!.pending === 1 ? 'change' : 'changes'} waiting)` : ''}.`
      : hub!.state === 'error'
        ? hub!.error ?? 'Sync failed.'
        : `${hub!.user} on ${new URL(hub!.url!).host}${hub!.lastSync ? ` · last sync ${new Date(hub!.lastSync).toLocaleTimeString()}` : ''}${hub!.pending ? ` · ${hub!.pending} waiting` : ''}${hub!.route === 'lan' ? ' · via home network' : ''}`;

  return (
    <Group span={7} title="Home server">
      <Row label={label} hint={hint}>
        {connected && (
          <span className="row" style={{ gap: 8 }}>
            <button className="btn sm" disabled={busy} onClick={() => call('POST', { action: 'sync' })}>Sync now</button>
            <button className="btn sm" disabled={busy} onClick={() => call('DELETE')}>Disconnect</button>
          </span>
        )}
      </Row>
      {(!connected || hub?.state === 'error') && (
        <form
          className="hubform"
          onSubmit={(e) => { e.preventDefault(); call('POST', { url, username: u, password: p, lan }); }}
        >
          <label><span>Server address</span><input type="url" name="server" spellCheck={false} autoComplete="url" placeholder="https://your-server.example" value={url} onChange={(e) => setUrl(e.target.value)} /></label>
          <label><span>Username</span><input name="username" spellCheck={false} autoComplete="username" value={u} onChange={(e) => setU(e.target.value)} /></label>
          <label><span>Password</span><input type="password" name="password" autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} /></label>
          <label><span>Home network address (optional)</span><input name="lan" spellCheck={false} autoComplete="off" placeholder="192.168.1.10" inputMode="decimal" value={lan} onChange={(e) => setLan(e.target.value)} style={{ flexBasis: '100%' }} /></label>
          <button className="btn primary" disabled={busy || !u || !p || !url}>{busy ? 'Connecting…' : 'Connect'}</button>
          {err && <div className="err">{err}</div>}
        </form>
      )}
      {connected && (
        <form className="hubform" onSubmit={(e) => { e.preventDefault(); call('POST', { action: 'lan', lan }); }}>
          <label><span>Home network address</span><input name="lan" spellCheck={false} autoComplete="off" placeholder={hub?.lan ? `Home network address: ${hub.lan}` : 'Home network address, like 192.168.1.10…'} inputMode="decimal" value={lan} onChange={(e) => setLan(e.target.value)} /></label>
          <button className="btn sm" disabled={busy}>{lan.trim() ? 'Save' : hub?.lan ? 'Clear' : 'Save'}</button>
          {err && <div className="err">{err}</div>}
        </form>
      )}
      <style jsx>{`
        .hubform { display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-end; padding: var(--sp-3) var(--sp-4); border-top: 1px solid var(--border); }
        .hubform input { width: 100%; height: 40px; padding: 0 12px; border-radius: var(--r-sm); border: 0; background: var(--surface-2); color: var(--ink); font: inherit; font-size: 14px; }
        .hubform label, .pwform label, .acform label { display: flex; flex-direction: column; gap: 4px; flex: 1 1 160px; min-width: 0; font-size: .8125rem; color: var(--muted); }
        .hubform input:focus-visible, .pwform input:focus-visible, .acform input:focus-visible { outline: 2px solid var(--ink); outline-offset: 1px; }
        .hubform input:focus { box-shadow: 0 0 0 2px var(--ink); }
        .err { flex-basis: 100%; color: var(--red-t); font-size: 13px; background: var(--red-soft); padding: 8px 10px; border-radius: var(--r-sm); }
      `}</style>
    </Group>
  );
}

function HomeToggle({ id, label }: { id: (typeof HOME_SECTIONS)[number]['id']; label: string }) {
  const on = useSettings((s) => s.home[id]);
  return (
    <div className="hp">
      <Toggle on={on} label={label} onChange={(v) => useSettings.getState().setHome(id, v)} />
      <style jsx>{`
        .hp { padding: 0 var(--sp-4); }
        .hp + .hp { border-top: 1px solid var(--border); }
        .hp :global(.tg) { border-bottom: 0; }
      `}</style>
    </div>
  );
}

type AiStatus = { configured: boolean; host: string | null; building: boolean; builtAt: number | null; title: string | null; songs: number; lastTry: number | null; lastError: string | null; shown: boolean };
type AiResult = { ok: boolean; error?: string; ms?: number; report?: { title: string; proposed: number; found: number; kept: number; ms: number }; status?: AiStatus };

function AiGroup() {
  const [st, setSt] = useState<AiStatus | null>(null);
  const [res, setRes] = useState<AiResult | null>(null);
  const [busy, setBusy] = useState<'test' | 'build' | null>(null);

  const load = () => fetch('/api/ai', { cache: 'no-store' }).then((r) => r.json()).then(setSt).catch(() => {});
  useEffect(() => { load(); }, []);

  const run = async (action: 'test' | 'build') => {
    setBusy(action);
    setRes(null);
    try {
      const r = await fetch('/api/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }) });
      const j = (await r.json()) as AiResult;
      setRes(r.ok ? j : { ok: false, error: (j as { error?: string }).error ?? 'Something went wrong' });
      if (j.status) setSt(j.status);
    } catch {
      setRes({ ok: false, error: 'Could not reach the LoMu server.' });
    } finally {
      setBusy(null);
    }
  };

  const when = (t: number | null) => (t ? new Date(t).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : null);
  const state = !st ? 'Checking…' : !st.configured ? 'Not set up' : st.building ? "Building today's mix…" : st.shown ? `Today's mix: ${st.title}` : st.lastError ? 'Not working' : 'Waiting for the first mix';
  const hint = !st
    ? ''
    : !st.configured
      ? ''
      : [`Model server ${st.host}`, st.builtAt ? `last built ${when(st.builtAt)} · ${st.songs} songs` : null, st.lastError && !st.shown ? st.lastError : null].filter(Boolean).join(' · ');

  return (
    <Group span={6} title="AI mix">
      <Row label={state} hint={hint}>
        <span className="row" style={{ gap: 8 }}>
          <button className="btn sm" disabled={!st?.configured || !!busy} onClick={() => run('test')}>{busy === 'test' ? 'Testing…' : 'Test connection'}</button>
          <button className="btn sm" disabled={!st?.configured || !!busy || st.building} onClick={() => run('build')}>{busy === 'build' ? 'Building…' : 'Build now'}</button>
        </span>
      </Row>
      {busy === 'build' && <div className="aires">Asking the model, then looking each song up. This can take a minute or two.</div>}
      {res && (
        <div className={`aires${res.ok ? '' : ' bad'}`} role="status">
          {res.ok
            ? res.report
              ? `Built "${res.report.title}": the model proposed ${res.report.proposed} songs, ${res.report.found} exist on YouTube Music, ${res.report.kept} kept. ${(res.report.ms / 1000).toFixed(0)} s. It will show on Home within a few minutes.`
              : `The model answered in ${((res.ms ?? 0) / 1000).toFixed(1)} s. The connection works.`
            : res.error}
        </div>
      )}
      <style jsx>{`
        .aires { padding: 12px var(--sp-4); border-top: 1px solid var(--border); font-size: 13px; color: var(--muted); line-height: 1.45; }
        .aires.bad { color: var(--red-t); background: var(--red-soft); }
      `}</style>
    </Group>
  );
}

function BlockedGroup() {
  const blocked = useLibrary((s) => s.blocked);
  const unblock = useLibrary((s) => s.unblockArtist);
  const list = Object.entries(blocked).sort((a, b) => b[1].at - a[1].at);
  return (
    <Group span={6} title="Never recommend" sub="Artists you blocked from a song's menu. They are dropped from every mix.">
      {!list.length && <Row label="Nothing blocked" hint="Open a song's menu and choose Never recommend." />}
      {list.map(([key, v]) => (
        <Row key={key} label={v.name}>
          <button className="btn" onClick={() => unblock(key)}>Allow again</button>
        </Row>
      ))}
    </Group>
  );
}

function Group({ title, sub, span = 6, tall, children }: { title: string; sub?: string; span?: number; tall?: boolean; children: React.ReactNode }) {
  return (
    <Tile span={span} md={12} flush tone="card" className={tall ? 'rs2' : undefined} title={title} sub={sub} label={title}>
      <div className="grp">{children}</div>
      <style jsx>{`
        .grp { border-top: 1px solid var(--border); }
      `}</style>
    </Tile>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="r">
      <div className="grow">
        <div className="l">{label}</div>
        {hint && <div className="h">{hint}</div>}
      </div>
      {children}
      <style jsx>{`
        .r { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3) var(--sp-4); }
        .r + .r { border-top: 1px solid var(--border); }
        .l { font-weight: 500; font-size: 15px; color: var(--ink); }
        .h { color: var(--muted); font-size: 13px; margin-top: 2px; line-height: 1.4; }
        @media (max-width: 600px) { .r { flex-wrap: wrap; } }
      `}</style>
    </div>
  );
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} className={`sw${on ? ' on' : ''}`} onClick={() => onChange(!on)}>
      <i />
      <style jsx>{`
                .sw { width: 40px; height: 24px; border-radius: 999px; background: var(--border-2); position: relative; flex: none; transition: background .2s var(--ease); }
                @media (pointer: coarse) { .sw::after { content: ''; position: absolute; inset: -10px -4px; } }
                .sw i { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: var(--ink); transition: transform .2s var(--ease); }
                .sw.on { background: var(--signal); }
                .sw.on i { transform: translateX(16px); background: var(--on-signal); }
      `}</style>
    </button>
  );
}

function PasswordRow() {
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/auth/password', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ current: cur, next }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return setErr(j.error ?? 'Could not change the password');
      setOpen(false);
      setCur('');
      setNext('');
      toast('Password changed. LoMu signed out your other devices.');
    } finally { setBusy(false); }
  };
  return (
    <>
      <Row label="Password">
        <button className="btn" onClick={() => setOpen((o) => !o)}>{open ? 'Cancel' : 'Change'}</button>
      </Row>
      {open && (
        <form className="pwform" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <label><span>Current password</span><input type="password" name="current-password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></label>
          <label><span>New password, at least 8 characters</span><input type="password" name="new-password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></label>
          <button className="btn primary" disabled={busy || !cur || next.length < 8}>{busy ? 'Saving…' : 'Save'}</button>
          {err && <div className="err">{err}</div>}
        </form>
      )}
      <style jsx>{`
        .pwform { display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-end; padding: var(--sp-3) var(--sp-4); border-top: 1px solid var(--border); }
        .pwform input { width: 100%; height: 40px; padding: 0 12px; border-radius: var(--r-sm); border: 0; background: var(--surface-2); color: var(--ink); font: inherit; font-size: 14px; }
        .hubform input:focus-visible, .pwform input:focus-visible, .acform input:focus-visible { outline: 2px solid var(--ink); outline-offset: 1px; }
        .pwform input:focus { box-shadow: 0 0 0 2px var(--ink); }
        .err { flex-basis: 100%; color: var(--red-t); font-size: 13px; background: var(--red-soft); padding: 8px 10px; border-radius: var(--r-sm); }
      `}</style>
    </>
  );
}

type Acct = { id: number; username: string; role: 'admin' | 'user'; disabled: boolean; created: number; devices: number };

function AccountsGroup() {
  const me = useAuth((s) => s.user);
  const [users, setUsers] = useState<Acct[]>([]);
  const [max, setMax] = useState(4);
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<number | null>(null);

  const load = () => fetch('/api/users', { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (j.users) { setUsers(j.users); setMax(j.max); } }).catch(() => {});
  useEffect(() => { load(); }, []);

  const call = async (method: string, body?: unknown, query = '') => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/users' + query, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return setErr(j.error ?? 'Something went wrong');
      await load();
      return true;
    } finally { setBusy(false); }
  };

  const full = users.length >= max;
  return (
    <Group span={12} title="Accounts">
      {users.map((a) => (
        <Row key={a.id} label={`${a.username}${a.username === me ? ' (you)' : ''}${a.role === 'admin' ? ' · admin' : ''}${a.disabled ? ' · paused' : ''}`} hint={`${a.devices} signed-in ${a.devices === 1 ? 'device' : 'devices'} · since ${new Date(a.created).toLocaleDateString()}`}>
          {a.username !== me && (
            <span className="row" style={{ gap: 8 }}>
              <button className="btn sm" disabled={busy} onClick={() => call('PATCH', { id: a.id, disabled: !a.disabled })}>{a.disabled ? 'Resume' : 'Pause'}</button>
              {confirm === a.id ? (
                <button className="btn sm primary" disabled={busy} onClick={async () => { if (await call('DELETE', undefined, `?id=${a.id}`)) setConfirm(null); }}>Delete everything</button>
              ) : (
                <button className="btn sm" disabled={busy} onClick={() => setConfirm(a.id)}>Remove</button>
              )}
            </span>
          )}
        </Row>
      ))}
      <form className="acform" onSubmit={async (e) => { e.preventDefault(); if (await call('POST', { username: name, password: pw })) { setName(''); setPw(''); toast('Account added'); } }}>
        <label><span>Username</span><input name="new-username" spellCheck={false} autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} disabled={full} /></label>
        <label><span>Password, at least 8 characters</span><input type="password" name="new-account-password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} disabled={full} /></label>
        <button className="btn primary" disabled={busy || full || name.trim().length < 2 || pw.length < 8}>{full ? 'Full' : 'Add account'}</button>
        {err && <div className="err">{err}</div>}
      </form>
      <style jsx>{`
        .acform { display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-end; padding: var(--sp-3) var(--sp-4); border-top: 1px solid var(--border); }
        .acform input { width: 100%; height: 40px; padding: 0 12px; border-radius: var(--r-sm); border: 0; background: var(--surface-2); color: var(--ink); font: inherit; font-size: 14px; }
        .hubform input:focus-visible, .pwform input:focus-visible, .acform input:focus-visible { outline: 2px solid var(--ink); outline-offset: 1px; }
        .acform input:focus { box-shadow: 0 0 0 2px var(--ink); }
        .err { flex-basis: 100%; color: var(--red-t); font-size: 13px; background: var(--red-soft); padding: 8px 10px; border-radius: var(--r-sm); }
      `}</style>
    </Group>
  );
}
