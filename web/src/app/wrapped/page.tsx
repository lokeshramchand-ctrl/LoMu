'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useWrapped } from '@/lib/api';
import { usePlayer } from '@/player/store';
import { artistNames } from '@/lib/format';
import { Avatar } from '@/components/Art';
import { EmptyState, PageHeader } from '@/components/ui';

const hourLabel = (h: number) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;
const long = (min: number) => (min >= 120 ? { n: (min / 60).toLocaleString('en', { maximumFractionDigits: 0 }), u: 'hours' } : { n: String(min), u: min === 1 ? 'minute' : 'minutes' });

export default function WrappedPage() {
  const [year, setYear] = useState<number | null | undefined>(undefined); // undefined: newest year with listening
  const first = useWrapped(year === undefined ? new Date().getFullYear() : year);
  const w = first.data?.wrapped;
  const picked = year === undefined ? (w?.label === 'All time' ? null : Number(w?.label ?? NaN)) : year;
  const years = w?.years ?? [];

  if (first.isLoading) return <PageHeader title="Your Wrapped" sub="Counting every song..." />;
  if (!w) {
    // The current year has nothing yet: fall back to all time rather than an empty page.
    if (year === undefined) return <Fallback onPick={() => setYear(null)} />;
    return (
      <>
        <PageHeader title="Your Wrapped" />
        <EmptyState title="Nothing in this period" hint="Pick another year, or listen a little and come back." action={<button className="btn" onClick={() => setYear(null)}>All time</button>} />
      </>
    );
  }
  const time = long(w.minutes);
  const top = w.topArtists[0];
  const songs = w.topSongs.map((s) => s.track);

  return (
    <div className="wrapped fade-in">
      <PageHeader
        title="Your Wrapped"
        sub={w.label === 'All time' ? 'Everything you have played' : `Your ${w.label} in music`}
        actions={<Link href="/insights" className="btn ghost">Insights</Link>}
      />
      <div className="chips" role="tablist" aria-label="Period">
        {years.map((y) => (
          <button key={y} role="tab" aria-selected={picked === y} className={picked === y ? 'on' : ''} onClick={() => setYear(y)}>{y}</button>
        ))}
        <button role="tab" aria-selected={picked === null} className={picked === null ? 'on' : ''} onClick={() => setYear(null)}>All time</button>
      </div>

      <section className="panel hero">
        <span className="eyebrow">You listened for</span>
        <div className="huge">{time.n}<small> {time.u}</small></div>
        <p>{w.plays.toLocaleString()} songs finished across {w.activeDays.toLocaleString()} days, {w.songs.toLocaleString()} different songs by {w.artists.toLocaleString()} artists.</p>
      </section>

      {top && (
        <section className="panel">
          <span className="eyebrow">Your top artist</span>
          <div className="artist">
            <Avatar src={top.thumb} size={96} />
            <div>
              {top.id ? <Link href={`/artist/${top.id}`} className="big">{top.name}</Link> : <span className="big">{top.name}</span>}
              <p>{Math.round(w.topArtistShare * 100)}% of all your listening time, {top.plays.toLocaleString()} finished songs.</p>
            </div>
          </div>
          <ol className="rank">
            {w.topArtists.slice(1).map((a, i) => (
              <li key={a.name}><span className="i">{i + 2}</span><span className="clamp1 grow">{a.name}</span><span className="muted">{a.plays.toLocaleString()} songs</span></li>
            ))}
          </ol>
        </section>
      )}

      {songs.length > 0 && (
        <section className="panel">
          <span className="eyebrow">Your top songs</span>
          <ol className="rank">
            {w.topSongs.map((s, i) => (
              <li key={s.track.id}>
                <span className="i">{i + 1}</span>
                <button className="clamp1 grow link" onClick={() => usePlayer.getState().play(songs, i, { source: 'wrapped' })}>
                  {s.track.title} <span className="muted">· {artistNames(s.track.artists)}</span>
                </button>
                <span className="muted">{s.plays}×</span>
              </li>
            ))}
          </ol>
          <button className="btn" onClick={() => usePlayer.getState().play(songs, 0, { source: 'wrapped' })}>Play my top {songs.length}</button>
        </section>
      )}

      <section className="panel">
        <span className="eyebrow">You are a</span>
        <div className="huge small">{w.persona.title}</div>
        <p>{w.persona.line}{w.peakHour != null && ` Your busiest hour is ${hourLabel(w.peakHour)}.`}</p>
        <div className="bars" role="img" aria-label="Listening by hour of day">
          {w.hourMs.map((v, h) => (
            <i key={h} className={h === w.peakHour ? 'hot' : ''} style={{ height: `${Math.max(3, (v / Math.max(...w.hourMs, 1)) * 100)}%` }} title={hourLabel(h)} />
          ))}
        </div>
      </section>

      <section className="panel facts">
        <div><b>{w.longestStreak.toLocaleString()}</b><span>day streak, your longest</span></div>
        {w.busiestMonth && <div><b>{w.busiestMonth.month}</b><span>your biggest month, {long(w.busiestMonth.minutes).n} {long(w.busiestMonth.minutes).u}</span></div>}
        {w.busiestDay && <div><b>{w.busiestDay.day}</b><span>your biggest day, {long(w.busiestDay.minutes).n} {long(w.busiestDay.minutes).u}</span></div>}
        <div><b>{w.newArtists.toLocaleString()}</b><span>{w.label === 'All time' ? 'artists you have played' : 'new artists discovered'}</span></div>
        <div><b>{Math.round(w.skipRate * 100)}%</b><span>of songs skipped early</span></div>
      </section>

      <style jsx>{`
        .wrapped { display: flex; flex-direction: column; gap: 16px; max-width: 880px; }
        .chips button.on { background: var(--signal); color: var(--on-signal); }
        .panel { border-radius: var(--r); background: var(--surface); padding: 24px; display: flex; flex-direction: column; gap: 12px; }
        .panel p { margin: 0; color: var(--muted); }
        .hero { background: var(--tile-1); }
        .eyebrow { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); font-weight: 600; }
        .huge { font-family: var(--serif, inherit); font-size: clamp(3rem, 12vw, 6.5rem); font-weight: 800; line-height: 1; letter-spacing: -.03em; }
        .huge small { font-size: .3em; letter-spacing: 0; font-weight: 600; }
        .huge.small { font-size: clamp(2.4rem, 8vw, 4rem); }
        .artist { display: flex; gap: 20px; align-items: center; }
        .big { font-size: clamp(1.8rem, 6vw, 3rem); font-weight: 800; letter-spacing: -.02em; color: inherit; }
        .rank { list-style: none; margin: 0; padding: 0; }
        .rank li { display: flex; align-items: center; gap: 12px; padding: 8px 4px; border-radius: 8px; }
        .rank li:hover { background: var(--card-hover); }
        .rank .i { width: 20px; text-align: right; color: var(--muted); font-variant-numeric: tabular-nums; }
        .rank .grow { flex: 1; min-width: 0; text-align: left; }
        .rank .link { background: none; border: 0; color: inherit; cursor: pointer; padding: 0; font: inherit; }
        .bars { display: flex; align-items: flex-end; gap: 3px; height: 90px; margin-top: 8px; }
        .bars i { flex: 1; border-radius: 3px 3px 1px 1px; background: var(--card-hover); }
        .bars i.hot { background: var(--signal); }
        .facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 20px; }
        .facts div { display: flex; flex-direction: column; gap: 4px; }
        .facts b { font-size: 1.9rem; letter-spacing: -.02em; }
        .facts span { color: var(--muted); font-size: 13px; }
      `}</style>
    </div>
  );
}

function Fallback({ onPick }: { onPick: () => void }) {
  return (
    <>
      <PageHeader title="Your Wrapped" />
      <EmptyState title="Nothing listened to this year yet" hint="Showing all your listening instead." action={<button className="btn" onClick={onPick}>Show all time</button>} />
    </>
  );
}
