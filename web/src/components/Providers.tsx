'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Nav } from './Nav';
import { PlayerBar } from './PlayerBar';
import { FullPlayer } from './FullPlayer';
import { TrackMenuHost } from './Menu';
import { ToastHost } from './Toast';
import { AuthGate } from './AuthGate';

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }),
  );
  const path = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const bare = path.startsWith('/welcome');

  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem('lomu-welcomed') === '1';
    } catch {}
    if (!seen && !bare) router.replace('/welcome');
    setReady(true);
  }, [bare, router]);

  return (
    <QueryClientProvider client={qc}>
      <AuthGate>
      {bare ? (
        children
      ) : (
        <div className="shell" style={{ visibility: ready ? 'visible' : 'hidden' }}>
          <Nav />
          <main className="main">{children}</main>
          <PlayerBar />
          <FullPlayer />
          <TrackMenuHost />
          <ToastHost />
        </div>
      )}
      </AuthGate>
    </QueryClientProvider>
  );
}
