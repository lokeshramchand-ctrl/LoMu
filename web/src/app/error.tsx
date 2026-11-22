'use client';
import { useEffect } from 'react';

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error); // the details stay in the console, not on the page
  }, [error]);
  return (
    <div className="empty" role="alert" style={{ minHeight: '60dvh', justifyContent: 'center' }}>
      <span className="display">This page did not load</span>
      <span style={{ maxWidth: 420 }}>Your library and queue are safe. Check your connection and try again.</span>
      <button className="btn primary" onClick={reset}>Try again</button>
    </div>
  );
}
