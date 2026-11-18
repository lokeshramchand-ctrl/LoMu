'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from './Icon';
import { useSettings } from '@/player/settings';

const ALL: { href: string; icon: IconName; label: string; flag?: 'explore' }[] = [
  { href: '/', icon: 'home', label: 'Home' },
  { href: '/search', icon: 'search', label: 'Search' },
  { href: '/explore', icon: 'planet', label: 'Explore', flag: 'explore' },
  { href: '/library', icon: 'bookmark', label: 'Library' },
];

export function Nav() {
  const path = usePathname();
  const dev = useSettings((s) => s.dev);
  const TABS = ALL.filter((t) => !t.flag || dev[t.flag]);
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));
  return (
    <>
      <nav className="rail" aria-label="Main">
        <Link href="/" className="logo" aria-label="LoMu home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" />
        </Link>
        <div className="rail-tabs neu">
          {TABS.map((t) => (
            <Link key={t.href} href={t.href} className={`tab${active(t.href) ? ' on' : ''}`} aria-label={t.label} title={t.label}>
              <Icon name={t.icon} size={23} />
            </Link>
          ))}
        </div>
        <Link href="/settings" className={`tab gear${active('/settings') ? ' on' : ''}`} aria-label="Settings" title="Settings">
          <Icon name="settings" size={21} />
        </Link>
      </nav>

      <nav className="bottom neu" aria-label="Main">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className={`btab${active(t.href) ? ' on' : ''}`} aria-label={t.label}>
            <Icon name={t.icon} size={24} />
          </Link>
        ))}
      </nav>

      <style jsx>{`
        .rail {
          position: fixed; left: 0; top: 0; bottom: 0; width: var(--nav-w); z-index: 40;
          display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 26px 0;
        }
        .logo img { width: 46px; height: 46px; border-radius: 15px; box-shadow: var(--neu-sm); }
        .rail-tabs { display: flex; flex-direction: column; gap: 10px; padding: 12px; border-radius: 999px; }
        :global(.tab) { width: 48px; height: 48px; border-radius: 50%; display: grid; place-items: center; color: var(--ink-3); transition: color .2s, box-shadow .25s, background .25s; }
        :global(.tab:hover) { color: var(--ink); }
        :global(.tab.on) { color: var(--ink); background: var(--surface); box-shadow: var(--neu-in); }
        :global(.gear) { color: var(--ink-3); }
        .bottom { display: none; }
        @media (max-width: 900px) {
          .rail { display: none; }
          .bottom {
            display: flex; justify-content: space-around; align-items: center;
            position: fixed; left: 14px; right: 14px; bottom: calc(10px + env(safe-area-inset-bottom)); height: 66px;
            border-radius: 26px; z-index: 40;
          }
          :global(.btab) { width: 64px; height: 50px; display: grid; place-items: center; color: var(--ink-3); border-radius: 18px; }
          :global(.btab.on) { color: var(--ink); }
        }
      `}</style>
    </>
  );
}
