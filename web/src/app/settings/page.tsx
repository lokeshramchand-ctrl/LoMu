'use client';
import { useLibrary } from '@/player/library';
import { usePlayer } from '@/player/store';
import { useSettings, type Theme } from '@/player/settings';
import { Icon } from '@/components/Icon';
import { toast } from '@/components/Toast';
import { useAuth } from '@/player/sync';

export default function SettingsPage() {
  const theme = useSettings((s) => s.theme);
  const dev = useSettings((s) => s.dev);
  const setDev = useSettings((s) => s.setDev);
  const autoplay = usePlayer((s) => s.autoplay);
  const { user, sync, lastSync, logout } = useAuth();

  return (
    <div className="wrap">
      <h1 className="display h1">
        Settings
        <br />
        <span className="dim">&amp; more</span>
      </h1>

      <Group title="Account">
        <Row label={user ? `Signed in as ${user}` : 'Not signed in'} hint={`Sync: ${sync === 'live' ? 'up to date' : sync}${lastSync ? ` · ${new Date(lastSync).toLocaleTimeString()}` : ''}. Likes, playlists and history follow you to your other devices.`}>
          <button className="pill-btn" onClick={() => logout()}>
            Sign out
          </button>
        </Row>
      </Group>

      <Group title="Appearance">
        <Row label="Theme" hint="Follow the system, or force light / dark.">
          <div className="seg neu-in">
            {(['system', 'light', 'dark'] as Theme[]).map((t) => (
              <button key={t} className={theme === t ? 'on' : ''} onClick={() => useSettings.getState().setTheme(t)}>
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </Row>
      </Group>

      <Group title="Playback">
        <Row label="Autoplay" hint="When the queue ends, keep going with songs like the last one.">
          <Toggle on={autoplay} onChange={(v) => usePlayer.setState({ autoplay: v })} />
        </Row>
        <Row label="Audio quality" hint="Always the best stream YouTube offers without Premium (Opus ~160 kbps, AAC fallback).">
          <span className="pill muted">Best</span>
        </Row>
      </Group>

      <Group title="Library">
        <Row label="Clear listening history" hint="Recommendations start learning again from scratch.">
          <button
            className="pill-btn"
            onClick={() => {
              if (confirm('Clear your whole listening history?')) {
                useLibrary.setState({ history: [] });
                toast('History cleared');
              }
            }}
          >
            Clear
          </button>
        </Row>
      </Group>

      <Group title="Developer" icon="settings">
        <Row label="Explore" hint="Show the Explore tab (trending wheel, new releases, moods).">
          <Toggle on={dev.explore} onChange={(v) => setDev('explore', v)} />
        </Row>
        <Row label="Artist enrichment" hint="Sharper artist photos, fan counts and bios from Deezer and Wikipedia.">
          <Toggle on={dev.artistEnrichment} onChange={(v) => setDev('artistEnrichment', v)} />
        </Row>
        <Row label="Stream info" hint="Show codec, bitrate and source client in the player.">
          <Toggle on={dev.streamInfo} onChange={(v) => setDev('streamInfo', v)} />
        </Row>
        <Row label="Replay welcome screen" hint="Show the Get Started screen again on next load.">
          <button
            className="pill-btn"
            onClick={() => {
              try {
                localStorage.removeItem('lomu-welcomed');
              } catch {}
              location.href = '/welcome';
            }}
          >
            Show
          </button>
        </Row>
      </Group>

      <p className="muted foot">LoMu · web player</p>

      <style jsx>{`
        .wrap { max-width: 860px; }
        .foot { margin-top: 40px; font-size: 13px; font-weight: 600; }
        .seg { display: flex; gap: 4px; padding: 5px; border-radius: 999px; }
        .seg button { height: 36px; padding: 0 16px; border-radius: 999px; font-weight: 650; font-size: 13.5px; color: var(--ink-2); }
        .seg button.on { background: var(--surface); box-shadow: var(--neu-sm); color: var(--ink); }
        .pill { font-weight: 700; font-size: 14px; padding: 8px 14px; border-radius: 999px; box-shadow: var(--neu-in); }
      `}</style>
    </div>
  );
}

function Group({ title, icon, children }: { title: string; icon?: 'settings'; children: React.ReactNode }) {
  return (
    <section className="g fade-in">
      <div className="eyebrow gt">
        {icon && <Icon name={icon} size={14} />} {title}
      </div>
      <div className="box neu">{children}</div>
      <style jsx>{`
        .g { margin-top: 38px; }
        .gt { display: flex; align-items: center; gap: 6px; margin: 0 0 14px 6px; }
        .box { border-radius: 28px; padding: 6px 0; }
      `}</style>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="r">
      <div className="grow">
        <div className="l">{label}</div>
        {hint && <div className="h">{hint}</div>}
      </div>
      {children}
      <style jsx>{`
        .r { display: flex; align-items: center; gap: 18px; padding: 18px 24px; }
        .r + .r { border-top: 1px solid var(--line); }
        .l { font-weight: 700; letter-spacing: -0.015em; }
        .h { color: var(--ink-2); font-size: 13.5px; margin-top: 3px; line-height: 1.4; }
      `}</style>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={on} className={`sw${on ? ' on' : ''}`} onClick={() => onChange(!on)}>
      <span />
      <style jsx>{`
        .sw { position: relative; width: 58px; height: 32px; border-radius: 999px; background: var(--surface); box-shadow: var(--neu-in); flex: none; transition: background .25s; }
        .sw span { position: absolute; top: 4px; left: 4px; width: 24px; height: 24px; border-radius: 50%; background: var(--surface-2); box-shadow: var(--neu-sm); transition: transform .3s var(--ease), background .25s; }
        .sw.on { background: var(--accent); box-shadow: none; }
        .sw.on span { transform: translateX(26px); background: var(--accent-ink); }
      `}</style>
    </button>
  );
}
