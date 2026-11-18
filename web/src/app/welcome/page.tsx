'use client';
import { useRouter } from 'next/navigation';
import { useExplore } from '@/lib/api';

export default function Welcome() {
  const router = useRouter();
  const { data } = useExplore();
  const art = data?.newReleases?.[0]?.thumb ?? data?.trending?.[0]?.thumb;

  const start = () => {
    try {
      localStorage.setItem('lomu-welcomed', '1');
    } catch {}
    router.replace('/');
  };

  return (
    <div className="wrap">
      <div className="card neu">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" />
          <span>LoMu</span>
        </div>

        <div className="discs" aria-hidden>
          <div className="half clear" />
          <div className="half clear two" />
          <div className="cd">
            {art && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={art} alt="" referrerPolicy="no-referrer" />
            )}
            <span className="cd-hole" />
          </div>
          <div className="shadow" />
        </div>

        <div className="cassette" aria-hidden>
          <div className="label">
            <b>B</b>
            <span>TYPE I / IEC I NORMAL</span>
          </div>
          <div className="reels">
            <i />
            <i />
          </div>
          <span className="n">90</span>
        </div>

        <h1 className="display headline">
          New
          <br />
          <span className="dim">Age Of</span>
          <br />
          Music
        </h1>

        <button className="go" onClick={start}>
          Get Started
        </button>
      </div>

      <style jsx>{`
        .wrap { min-height: 100dvh; display: grid; place-items: center; padding: 24px; }
        .card {
          position: relative; overflow: hidden; width: min(440px, 100%); height: min(860px, calc(100dvh - 48px)); min-height: 640px;
          border-radius: 40px; padding: 30px 26px 26px; display: flex; flex-direction: column; justify-content: flex-end;
          background: linear-gradient(180deg, var(--surface-2), var(--surface));
        }
        .brand { position: absolute; top: 26px; left: 26px; display: flex; align-items: center; gap: 10px; font-weight: 800; letter-spacing: -0.03em; font-size: 18px; z-index: 3; }
        .brand img { width: 34px; height: 34px; border-radius: 11px; }
        .discs { position: absolute; top: 70px; left: 6%; right: 4%; height: 230px; }
        .half {
          position: absolute; top: 10px; width: 210px; height: 210px; border-radius: 50%;
          clip-path: inset(0 50% 0 0);
          background:
            radial-gradient(circle, rgba(255,255,255,.95) 0 17%, transparent 17.5%),
            repeating-radial-gradient(circle, rgba(255,255,255,.65) 0 2px, rgba(225,228,238,.55) 2.5px 4px),
            radial-gradient(circle, #f3f4f8, #dfe2ec);
          box-shadow: -10px 14px 30px -12px rgba(80,86,120,.35), inset 0 0 0 1px rgba(255,255,255,.7);
        }
        .half.clear { left: 0; }
        .half.two { left: 26%; }
        .cd {
          position: absolute; left: 47%; top: 0; width: 230px; height: 230px; border-radius: 50%; overflow: hidden;
          background: conic-gradient(from 30deg, #e9eef6, #f7e9f3, #e2f2ef, #f1f0e2, #e7e9f7, #e9eef6);
          box-shadow: 14px 18px 34px -12px rgba(40,44,70,.45), inset 0 0 0 2px rgba(255,255,255,.6);
          animation: spin 22s linear infinite;
        }
        .cd img { width: 100%; height: 100%; object-fit: cover; mix-blend-mode: multiply; opacity: .85; filter: grayscale(.35) contrast(1.05); }
        .cd::after { content: ''; position: absolute; inset: 0; background: conic-gradient(from 200deg, rgba(255,255,255,.35), transparent 20%, transparent 50%, rgba(255,255,255,.3) 65%, transparent 80%); }
        .cd-hole { position: absolute; left: 50%; top: 50%; width: 52px; height: 52px; transform: translate(-50%,-50%); border-radius: 50%; background: radial-gradient(circle, var(--surface) 0 30%, rgba(255,255,255,.75) 31% 100%); box-shadow: inset 0 0 0 1px rgba(0,0,0,.08); z-index: 2; }
        .shadow { position: absolute; left: 6%; right: 6%; top: 250px; height: 40px; border-radius: 50%; background: radial-gradient(closest-side, rgba(120,126,160,.18), transparent); }
        .cassette {
          position: absolute; right: -40px; top: 52%; transform: translateY(-50%) rotate(-1deg); width: 250px; height: 168px; border-radius: 16px;
          background: linear-gradient(160deg, rgba(255,255,255,.85), rgba(222,226,236,.75));
          box-shadow: 10px 16px 30px -14px rgba(60,66,100,.4), inset 0 0 0 1.5px rgba(255,255,255,.8);
          padding: 14px; backdrop-filter: blur(4px);
        }
        .label { display: flex; align-items: center; gap: 12px; background: #fff; border-radius: 6px; padding: 6px 10px; font-size: 9px; font-weight: 700; letter-spacing: .04em; color: #333; }
        .label b { font-size: 20px; font-weight: 800; }
        .reels { display: flex; gap: 46px; padding: 18px 26px 0; }
        .reels i { width: 54px; height: 54px; border-radius: 50%; background: repeating-conic-gradient(#fff 0 10deg, #e5e7ee 10deg 20deg); box-shadow: inset 0 0 0 9px #fff, inset 0 0 0 10px #d9dce6, 0 2px 6px rgba(0,0,0,.1); animation: spin 6s linear infinite; }
        .n { position: absolute; left: 14px; bottom: 12px; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: #fff; font-weight: 700; font-size: 12px; color: #333; }
        .headline { font-size: 64px; position: relative; z-index: 3; margin-bottom: 34px; }
        .go {
          height: 64px; border-radius: 999px; font-weight: 650; font-size: 17px; letter-spacing: -0.01em;
          background: var(--surface); box-shadow: var(--neu-md), inset 0 0 0 1px rgba(255,255,255,.6); position: relative; z-index: 3;
          transition: transform .2s var(--ease), box-shadow .2s;
        }
        .go:hover { transform: translateY(-2px); }
        .go:active { box-shadow: var(--neu-in); transform: none; }
        @media (max-width: 480px) {
          .wrap { padding: 0; }
          .card { width: 100%; height: 100dvh; min-height: 0; border-radius: 0; box-shadow: none; padding-bottom: calc(26px + env(safe-area-inset-bottom)); }
          .headline { font-size: 58px; }
          .half { width: 170px; height: 170px; }
          .cd { width: 190px; height: 190px; }
          .cassette { width: 220px; height: 150px; }
        }
      `}</style>
    </div>
  );
}
