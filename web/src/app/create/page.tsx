'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLibrary } from '@/player/library';
import { Icon, type IconName } from '@/components/Icon';
import { Bento } from '@/components/Bento';

const CARDS: { href: string; icon: IconName; title: string; line: string }[] = [
  { href: '/import', icon: 'download', title: 'Import from YouTube Music', line: 'Bring your playlists and likes over.' },
  { href: '/explore', icon: 'sparkles', title: 'New releases', line: 'What is new on YouTube Music.' },
  { href: '/insights', icon: 'pulse', title: 'Insights', line: 'What you listened to, and when.' },
  { href: '/wrapped', icon: 'sparkles', title: 'Wrapped', line: 'Your year in music: top songs, artists and habits.' },
  { href: '/settings', icon: 'sliders', title: 'Settings', line: 'Account, sync and appearance.' },
];

export default function Create() {
  const router = useRouter();
  const [name, setName] = useState('');
  const make = () => {
    const n = name.trim();
    if (!n) return;
    const id = useLibrary.getState().createPlaylist(n);
    setName('');
    router.push(`/library/playlist/${id}`);
  };
  return (
    <Bento className="fade-in">
      <div className="cr">
        <header>
          <h1>Create</h1>
          <p className="muted">Make something new</p>
        </header>
        <form className="cr-new" style={{ background: 'var(--tile-1)' }} onSubmit={(e) => (e.preventDefault(), make())}>
          <h2>New playlist</h2>
          <p className="muted">Give it a name, then add songs from any song menu (right-click, or long-press on a phone).</p>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Playlist name" aria-label="Playlist name" maxLength={60} />
          <button className="btn primary lg" disabled={!name.trim()}>Create playlist</button>
        </form>
        {CARDS.map((c, i) => (
          <Link key={c.href} href={c.href} className="cr-card" style={{ background: `var(--tile-${(i % 3) + 2})` }}>
            <span className="ci"><Icon name={c.icon} size={22} /></span>
            <span className="grow">
              <b>{c.title}</b>
              <span className="muted">{c.line}</span>
            </span>
            <Icon name="right" size={18} />
          </Link>
        ))}
      </div>
      <style jsx>{`
        .cr { grid-column: 1 / -1; width: 100%; max-width: 640px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; }
        .cr header { padding-bottom: 8px; }
        .cr h1 { font-size: clamp(2rem, 4vw, 2.5rem); }
        .cr-new { display: flex; flex-direction: column; gap: 10px; padding: 20px; border-radius: 26px; }
        .cr-new h2 { font-size: 1.375rem; }
        .cr-new input { height: 50px; padding: 0 18px; border-radius: 999px; border: 0; background: var(--bg); color: var(--ink); font-size: 1rem; outline: 0; }
        .cr-new input:focus-visible { outline: 2px solid var(--ink); outline-offset: 1px; }
        .cr-new .btn { border-radius: 999px; }
        :global(.cr-card) { display: flex; align-items: center; gap: 14px; padding: 16px; border-radius: 22px; color: var(--ink); transition: transform .1s ease-out; }
        :global(.cr-card:active) { transform: scale(.99); }
        :global(.cr-card) .ci { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: var(--bg); flex: none; }
        :global(.cr-card) b { display: block; font-weight: 600; }
        :global(.cr-card) .grow span { font-size: .875rem; }
      `}</style>
    </Bento>
  );
}
