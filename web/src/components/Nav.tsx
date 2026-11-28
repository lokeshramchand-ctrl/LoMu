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

/** The wordmark: bold sans, no logo artwork. */
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

/** Interface theme dropdown. */
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

// ---------------------------------------------------------------- top bar

/** One translucent bar: wordmark, the pages as text, search, devices, account. Content scrolls under it. */
export function Topbar() {
  const router = useRouter();
  const path = usePathname();
  const bar = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const { user, sync, local } = useAuth();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !/INPUT|TEXTAREA/.test(t.tagName)) {
        e.preventDefault();
        router.push('/search');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);
  // a hairline appears only once content has scrolled under the bar
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
      {local && (
        <div className="hist">
          <button className="icon-btn sm" aria-label="Go back" onClick={() => router.back()}><Icon name="chevL" size={16} /></button>
          <button className="icon-btn sm" aria-label="Go forward" onClick={() => window.history.forward()}><Icon name="chevR" size={16} /></button>
        </div>
      )}
      <div className="grow" />
      <div className="pillbtns">
        {!path.startsWith('/search') && (
          <Link href="/search" className="rb" aria-label="Search" title="Search ( / )"><Icon name="search" size={20} /></Link>
        )}
        <DevicesButton down />
        <Link href="/settings" className="avatar" aria-label="Account and settings" title={`${who ?? 'Settings'}${sync === 'live' ? ' · synced' : sync === 'error' ? ' · offline' : ''}`}>
          <span>{(who ?? 'L')[0]?.toUpperCase()}</span>
        </Link>
      </div>
      <style jsx>{`
        .top { position: sticky; top: 0; z-index: 30; height: var(--top-h); display: flex; align-items: center; gap: 16px; padding: 0 var(--chrome-x); border-bottom: 1px solid transparent; transition: border-color .2s var(--ease); }
        .top.edge { border-bottom-color: var(--border); }
        .hist { display: flex; gap: 8px; }
        /* one round grey capsule holds the buttons, as on the phone */
        .pillbtns { display: flex; align-items: center; gap: 2px; padding: 3px; border-radius: 99px; background: var(--surface-2); }
        :global(.top .rb) { width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; color: var(--ink); transition: background .15s, transform .1s ease-out; }
        :global(.top .rb:hover) { background: var(--pill-hover); }
        :global(.top .rb:active) { transform: scale(.94); }
        :global(.top .avatar) { width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; background: var(--signal); color: var(--on-signal); font-weight: 600; font-size: .875rem; transition: transform .1s ease-out; }
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
        .tabs { display: flex; position: fixed; left: 50%; transform: translateX(-50%); bottom: 12px; z-index: 45; width: min(var(--stack-w), calc(100% - 28px)); height: var(--tabs-h); padding: 0 8px; border-radius: 32px; background: var(--surface); -webkit-backdrop-filter: none; backdrop-filter: none; box-shadow: 0 0 0 1px var(--border), var(--lift-hi); }
        .tabs :global(a) { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; color: var(--muted); font-size: .75rem; font-weight: 500; transition: color .15s var(--ease), transform .1s ease-out; }
        .tabs :global(a:active) { transform: scale(.94); }
        .tabs :global(a.on) { color: var(--ink); font-weight: 700; }
        @media (max-width: 900px) {
          .tabs { left: 0; right: 0; bottom: 0; transform: none; width: auto; height: calc(var(--tabs-h) + env(safe-area-inset-bottom)); padding: 0 8px env(safe-area-inset-bottom); border-radius: 28px 28px 0 0; box-shadow: 0 -1px 0 var(--border); }
        }
      `}</style>
    </nav>
  );
}
