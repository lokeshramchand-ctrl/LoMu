'use client';
import { useState } from 'react';
import { Icon } from './Icon';

function Img({ src, alt }: { src?: string; alt: string }) {
  const [ok, setOk] = useState(true);
  if (!src || !ok) return <div className="ph" style={{ width: '100%', height: '100%' }} aria-hidden><Icon name="note" size={20} /></div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} width={512} height={512} loading="lazy" decoding="async" draggable={false} onError={() => setOk(false)} referrerPolicy="no-referrer" />;
}

export function Cover({ src, size, radius, alt = '' }: { src?: string; size: number | string; radius?: number; alt?: string }) {
  return (
    <div className="cover" style={{ width: size, height: size, borderRadius: radius }}>
      <Img src={src} alt={alt} />
    </div>
  );
}

export function Avatar({ src, size, alt = '' }: { src?: string; size: number | string; alt?: string }) {
  return (
    <div className="cover round" style={{ width: size, height: size }}>
      <Img src={src} alt={alt} />
    </div>
  );
}
