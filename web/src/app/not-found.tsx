import Link from 'next/link';

export const metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <div className="empty" style={{ minHeight: '60dvh', justifyContent: 'center' }}>
      <b style={{ fontSize: 32, letterSpacing: '-.03em' }}>This page does not exist</b>
      <span style={{ maxWidth: 360 }}>The link may be old, or the song or playlist was removed.</span>
      <Link href="/" className="btn primary">Back to Home</Link>
    </div>
  );
}
