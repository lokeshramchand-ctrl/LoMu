'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Topbar, MobileTabs } from './Nav';
import { PlayerBar } from './PlayerBar';
import { FullPlayer } from './FullPlayer';
import { TrackMenuHost } from './Menu';
import { ToastHost } from './Toast';
import { ContinueBanner } from './ContinueBanner';
import { AuthGate } from './AuthGate';
import { ConnectHost } from './Devices';
import { DataToggle } from './DataToggle';

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }));

  return (
    <QueryClientProvider client={qc}>
      <AuthGate>
        <a href="#main" className="skip">Skip to content</a>
        <div className="app">
          <div className="col">
            <div className="panel">
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
        <DataToggle />
      </AuthGate>
    </QueryClientProvider>
  );
}
