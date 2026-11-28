'use client';
import { DevicesButton } from './Devices';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from './Icon';
import { useSettings, type Theme } from '@/player/settings';
import { useAuth } from '@/player/sync';

type Tab = { href: string; icon: IconName; active: IconName; label: string; flag?: 'explore' };
const TABS: Tab[] = [
  { href: '/', icon: 'waveform', active: 'waveform', label: 'Home' },
  { href: '/search', icon: 'search', active: 'searchBold', label: 'Search' },
  { href: '/explore', icon: 'compass', active: 'compass', label: 'Explore', flag: 'explore' },
  { href: '/library', icon: 'library', active: 'libraryFill', label: 'Media' },
  { href: '/create', icon: 'plus', active: 'plus', label: 'Create' },
];

function useTabs() {
  const dev = useSettings((s) => s.dev);
  return TABS.filter((t) => !t.flag || dev[t.flag]);
}
const isActive = (path: string, href: string) => (href === '/' ? path === '/' : path.startsWith(href));

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="LoMu, home">
      LoMu
      <style jsx>{`
        :global(.brand) { font-family: var(--font-display); font-weight: 700; font-size: 1.5rem; line-height: 1; letter-spacing: -.03em; color: var(--ink); padding-bottom: 3px; }
      `}</style>
    </Link>
  );
}

const THEMES: { id: Theme; label: string; dot: string }[] = [
  { id: 'dark', label: 'Dark', dot: 'var(--fixed-dark)' },
  { id: 'light', label: 'Light', dot: 'var(--fixed-light)' },
  { id: 'system', label: 'System', dot: 'var(--signal)' },
];

export function ThemeSelect({ up = false }: { up?: boolean }) {
  const theme = useSettings((s) => s.theme);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cur = THEMES.find((t) => t.id === theme) ?? THEMES[0];
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
  return (
    <div className="ts" ref={ref}>
      <button className="cur" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="aa"><i style={{ background: cur.dot }} />Aa</span>
        <span className="nm">{cur.label}</span>
        <Icon name="down" size={12} />
      </button>
      {open && (
        <div className={`pop${up ? ' up' : ''}`} role="listbox" aria-label="Interface theme">
          {THEMES.map((t) => (
            <button key={t.id} role="option" aria-selected={theme === t.id} className={theme === t.id ? 'on' : ''} onClick={() => (useSettings.getState().setTheme(t.id), setOpen(false))}>
              <span className="aa"><i style={{ background: t.dot }} />Aa</span>
              <span className="nm">{t.label}</span>
              {theme === t.id && <Icon name="check" size={14} />}
            </button>
          ))}
        </div>
      )}
      <style jsx>{`
        .ts { position: relative; }
        .cur { display: flex; align-items: center; gap: 8px; width: 100%; height: 36px; padding: 0 12px 0 6px; border-radius: var(--r); background: var(--surface-2); color: var(--text); font-size: .875rem; font-weight: 500; transition: background .15s; }
        .cur:hover { background: var(--card-hover); }
        .nm { flex: 1; text-align: start; }
        .aa { display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 7px; border-radius: var(--r-sm); background: var(--bg); font-size: .75rem; font-weight: 600; color: var(--text); }
        .aa i { width: 6px; height: 6px; border-radius: 50%; box-shadow: 0 0 0 1px var(--border-2); }
        .pop { position: absolute; inset-inline: 0; top: calc(100% + 4px); z-index: 90; padding: 4px; border-radius: var(--r); background: var(--card-hover); box-shadow: var(--lift-hi), 0 0 0 1px var(--border); animation: rise .15s var(--ease-out) both; }
        .pop.up { top: auto; bottom: calc(100% + 4px); }
        .pop button { display: flex; align-items: center; gap: 8px; width: 100%; height: 36px; padding: 0 8px; border-radius: var(--r-sm); font-size: .875rem; color: var(--text); text-align: start; }
        .pop button:hover, .pop button.on { background: var(--row-hover); }
      `}</style>
    </div>
  );
}

export function Topbar() {
  const router = useRouter();
  const path = usePathname();
  const tabs = useTabs().filter((t) => t.href !== '/search');
  const input = useRef<HTMLInputElement>(null);
  const bar = useRef<HTMLElement>(null);
  const [q, setQ] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const { user, sync, local } = useAuth();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !/INPUT|TEXTAREA/.test(t.tagName)) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    if (!path.startsWith('/search')) setQ('');
  }, [path]);
  useEffect(() => {
    const panel = bar.current?.closest('.panel');
    if (!panel) return;
    const on = () => setScrolled(panel.scrollTop > 8);
    panel.addEventListener('scroll', on, { passive: true });
    return () => panel.removeEventListener('scroll', on);
  }, []);

  const who = local ? 'This PC' : user;
  return (
    <header ref={bar} className={`top glass${scrolled ? ' edge' : ''}`}>
      <Brand />
      <nav className="links" aria-label="Main">
        {tabs.map((t) => {
          const on = isActive(path, t.href);
          return (
            <Link key={t.href} href={t.href} className={`lnk${on ? ' on' : ''}`} aria-current={on ? 'page' : undefined}>
              {t.label}
            </Link>
          );
        })}
      </nav>
      {local && (
        <div className="hist">
          <button className="icon-btn sm" aria-label="Go back" onClick={() => router.back()}><Icon name="chevL" size={16} /></button>
          <button className="icon-btn sm" aria-label="Go forward" onClick={() => window.history.forward()}><Icon name="chevR" size={16} /></button>
        </div>
      )}
      <div className="grow" />
      <form
        className={`search${path.startsWith('/search') ? ' gone' : ''}`}
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
        }}
      >
        <Icon name="search" size={18} />
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search songs, artists, albums" aria-label="Search" />
        {q ? (
          <button type="button" className="clr" aria-label="Clear" onClick={() => (setQ(''), input.current?.focus())}>
            <Icon name="close" size={14} />
          </button>
        ) : (
          <kbd>/</kbd>
        )}
      </form>
      <DevicesButton down />
      <Link href="/settings" className="avatar" aria-label="Account and settings" title={`${who ?? 'Settings'}${sync === 'live' ? ' · synced' : sync === 'error' ? ' · offline' : ''}`}>
        <span>{(who ?? 'L')[0]?.toUpperCase()}</span>
      </Link>
      <style jsx>{`
        .top { position: sticky; top: 0; z-index: 30; height: var(--top-h); display: flex; align-items: center; gap: 20px; padding: 0 var(--chrome-x); border-bottom: 1px solid transparent; transition: border-color .2s var(--ease); }
        .top.edge { border-bottom-color: var(--border); }
        .links { display: flex; align-items: center; gap: 4px; flex: none; }
        :global(.top .lnk) { position: relative; display: inline-flex; align-items: center; min-height: 36px; padding: 0 12px; border-radius: var(--r); white-space: nowrap; color: var(--muted); font-weight: 500; font-size: .9375rem; transition: color .15s, background .15s, transform .1s ease-out; }
        :global(.top .lnk:hover) { color: var(--text); background: var(--pill); }
        :global(.top .lnk:active) { transform: scale(.97); }
        :global(.top .lnk.on) { color: var(--ink); }
        :global(.top .lnk.on)::after { content: ''; position: absolute; inset-inline: 12px; bottom: 1px; height: 2px; border-radius: 1px; background: var(--signal); }
        .hist { display: flex; gap: 8px; }
        .search { display: flex; align-items: center; gap: 10px; min-height: 36px; flex: 0 1 340px; min-width: 120px; padding: 0 12px; border-radius: var(--r); background: var(--pill); color: var(--muted); transition: background .15s, box-shadow .15s; }
        .search.gone { display: none; } /* the Search page has its own field with live suggestions */
        .search:hover { background: var(--pill-hover); color: var(--text); }
        .search:focus-within { background: var(--pill-hover); color: var(--text); box-shadow: 0 0 0 2px var(--ink); }
        .search input { flex: 1; min-width: 0; background: none; border: 0; outline: none; font-size: .875rem; color: var(--ink); }
        .search input::placeholder { color: var(--muted); }
        kbd { font-family: var(--font-num); font-size: .6875rem; padding: 1px 6px; border-radius: var(--r-sm); box-shadow: inset 0 0 0 1px var(--border-2); color: var(--muted); }
        .clr { color: var(--muted); display: grid; place-items: center; }
        .clr:hover { color: var(--ink); }
        :global(.top .avatar) { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; background: var(--surface-2); color: var(--ink); font-weight: 600; font-size: .875rem; transition: transform .1s ease-out; }
        :global(.top .avatar:active) { transform: scale(.94); }
        @media (max-width: 900px) { .top { display: none; } }
      `}</style>
    </header>
  );
}

export function MobileTabs() {
  const path = usePathname();
  const tabs = useTabs();
  return (
    <nav className="tabs glass" aria-label="Main">
      {tabs.map((t) => {
        const on = isActive(path, t.href);
        return (
          <Link key={t.href} href={t.href} className={on ? 'on' : ''} aria-label={t.label} aria-current={on ? 'page' : undefined}>
            <Icon name={on ? t.active : t.icon} size={22} />
            <span>{t.label}</span>
          </Link>
        );
      })}
      <style jsx>{`
        .tabs { display: none; }
        @media (max-width: 900px) {
          .tabs { display: flex; position: fixed; left: 0; right: 0; bottom: 0; z-index: 45; height: calc(64px + env(safe-area-inset-bottom)); padding: 0 8px env(safe-area-inset-bottom); border-radius: 28px 28px 0 0; background: var(--surface); -webkit-backdrop-filter: none; backdrop-filter: none; box-shadow: 0 -1px 0 var(--border); }
          .tabs :global(a) { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; color: var(--muted); font-size: .75rem; font-weight: 500; transition: color .15s var(--ease), transform .1s ease-out; }
          .tabs :global(a:active) { transform: scale(.94); }
          .tabs :global(a.on) { color: var(--ink); }
          .tabs :global(a.on) { font-weight: 700; }
        }
      `}</style>
    </nav>
  );
}
