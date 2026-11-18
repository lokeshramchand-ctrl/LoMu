'use client';
import { useState } from 'react';

function Img({ src, alt }: { src?: string; alt: string }) {
  const [ok, setOk] = useState(true);
  if (!src || !ok) return <div className="ph" style={{ width: '100%', height: '100%' }} aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" decoding="async" draggable={false} onError={() => setOk(false)} referrerPolicy="no-referrer" />;
}

/** Square artwork with a hairline edge. */
export function Cover({ src, size, radius, alt = '' }: { src?: string; size: number | string; radius?: number; alt?: string }) {
  return (
    <div className="cover" style={{ width: size, height: size, borderRadius: radius }}>
      <Img src={src} alt={alt} />
    </div>
  );
}

/** Round artwork, used for artists. */
export function Avatar({ src, size, alt = '' }: { src?: string; size: number | string; alt?: string }) {
  return (
    <div className="cover round" style={{ width: size, height: size }}>
      <Img src={src} alt={alt} />
    </div>
  );
}
