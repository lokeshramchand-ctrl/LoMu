'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Sidebar, Topbar, MobileTabs } from './Nav';
import { PlayerBar } from './PlayerBar';
import { FullPlayer } from './FullPlayer';
import { TrackMenuHost } from './Menu';
import { ToastHost } from './Toast';
import { ContinueBanner } from './ContinueBanner';
import { AuthGate } from './AuthGate';
import { ConnectHost } from './Devices';
import { useSettings } from '@/player/settings';

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }));
  const mini = useSettings((s) => s.sideMini);

  return (
    <QueryClientProvider client={qc}>
      <AuthGate>
        <a href="#main" className="skip">Skip to content</a>
        <div className="app" style={mini ? ({ ['--side-w' as string]: '72px' } as React.CSSProperties) : undefined}>
          <Sidebar />
          <div className="col">
            <div className="panel">
              <div className="tint" aria-hidden />
              <Topbar />
              <main id="main" tabIndex={-1} className="content">{children}</main>
            </div>
          </div>
          <PlayerBar />
          <MobileTabs />
        </div>
        <ConnectHost />
        <FullPlayer />
        <TrackMenuHost />
        <ToastHost />
        <ContinueBanner />
      </AuthGate>
      <style jsx>{`
      `}</style>
    </QueryClientProvider>
  );
}
