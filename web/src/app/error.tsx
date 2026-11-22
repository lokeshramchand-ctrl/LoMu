'use client';

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="empty" role="alert" style={{ minHeight: '60dvh', justifyContent: 'center' }}>
      <b style={{ fontSize: 32, letterSpacing: '-.03em' }}>Something went wrong</b>
      <span style={{ maxWidth: 420 }}>{error.message || 'The page failed to load.'} Try again, and if it keeps happening, reload LoMu.</span>
      <button className="btn primary" onClick={reset}>Try again</button>
    </div>
  );
}
