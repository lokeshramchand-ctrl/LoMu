'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { useHome } from '@/lib/api';
import { artistNames, greeting } from '@/lib/format';
import type { Track } from '@/lib/types';
import { ShelfRow, ShelfSkeleton } from '@/components/Cards';
import { Disc } from '@/components/Art';
import { Icon } from '@/components/Icon';
import { useLibrary } from '@/player/library';
import { currentTrack, usePlayer } from '@/player/store';

export default function Home() {
  const { data, isLoading, error, refetch } = useHome();
  const history = useLibrary((s) => s.history);
  const [g1, g2] = greeting();

  const recent = useMemo(() => {
    const seen = new Set<string>();
    const out: Track[] = [];
    for (const p of history) {
      if (seen.has(p.track.id)) continue;
      seen.add(p.track.id);
      out.push(p.track);
      if (out.length >= 14) break;
    }
    return out;
  }, [history]);

  return (
    <div>
      <header className="hero fade-in">
        <h1 className="display h1">
          {g1}
          <br />
          <span className="dim">{g2}</span>
        </h1>
        <Link href="/search" className="search neu-in">
          <Icon name="search" size={20} />
          <span>Songs, artists, albums…</span>
        </Link>
      </header>

      {recent.length > 0 && <JumpBackIn tracks={recent} />}

      {isLoading && (
        <>
          <ShelfSkeleton />
          <ShelfSkeleton />
        </>
      )}
      {error && (
        <div className="err neu-sm">
          <span>Couldn&apos;t load your feed. {(error as Error).message}</span>
          <button className="pill-btn" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      )}
      {data?.shelves.map((s) => <ShelfRow key={s.title} shelf={s} />)}

      <style jsx>{`
        .hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
        .search { display: flex; align-items: center; gap: 12px; height: 54px; padding: 0 22px; border-radius: 999px; color: var(--ink-2); width: min(380px, 100%); font-weight: 500; }
        .err { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 22px; border-radius: 22px; margin-top: 30px; color: var(--ink-2); }
        @media (max-width: 900px) { .search { width: 100%; } }
      `}</style>
    </div>
  );
}

function JumpBackIn({ tracks }: { tracks: Track[] }) {
  const cur = usePlayer((s) => currentTrack(s)?.id);
  const playing = usePlayer((s) => s.playing);
  const [lead, ...rest] = tracks;
  return (
    <section className="section fade-in">
      <div className="section-head">
        <h2 className="h3">Jump back in</h2>
      </div>
      <div className="jb">
        <button className="lead neu" onClick={() => usePlayer.getState().playRadio(lead)}>
          <Disc src={lead.thumb} size={132} spin={cur === lead.id} paused={!playing} />
          <div className="grow" style={{ textAlign: 'left' }}>
            <div className="eyebrow">Last played</div>
            <div className="lt clamp2">{lead.title}</div>
            <div className="muted clamp1">{artistNames(lead.artists)}</div>
            <span className="pill-btn solid sm">
              <Icon name="radio" size={16} /> Play its radio
            </span>
          </div>
        </button>
        <div className="mini">
          {rest.slice(0, 8).map((t) => (
            <button key={t.id} className="m" onClick={() => usePlayer.getState().playRadio(t)} title={t.title}>
              <Disc src={t.thumb} size={56} spin={cur === t.id} paused={!playing} />
              <div className="grow" style={{ textAlign: 'left', minWidth: 0 }}>
                <div className="clamp1" style={{ fontWeight: 650, fontSize: 14.5 }}>{t.title}</div>
                <div className="clamp1 muted" style={{ fontSize: 13 }}>{artistNames(t.artists)}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
      <style jsx>{`
        .jb { display: grid; grid-template-columns: minmax(300px, 420px) 1fr; gap: 26px; align-items: stretch; }
        .lead { display: flex; align-items: center; gap: 22px; padding: 22px; border-radius: 30px; }
        .lt { font-size: 24px; font-weight: 800; letter-spacing: -0.035em; line-height: 1.05; margin: 6px 0 4px; }
        :global(.pill-btn.sm) { height: 38px; padding: 0 16px; font-size: 13.5px; margin-top: 14px; }
        .mini { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 8px 18px; align-content: center; }
        .m { display: flex; align-items: center; gap: 12px; padding: 8px; border-radius: 18px; }
        .m:hover { background: color-mix(in oklab, var(--ink) 4%, transparent); }
        @media (max-width: 900px) { .jb { grid-template-columns: 1fr; } .mini { grid-template-columns: 1fr 1fr; } .mini :global(.m:nth-child(n + 5)) { display: none; } }
      `}</style>
    </section>
  );
}
