import type { NextConfig } from 'next';

const config: NextConfig = {
  serverExternalPackages: ['youtubei.js', 'jsdom', 'bgutils-js', '@napi-rs/canvas'],
  images: { unoptimized: true },
  poweredByHeader: false,
  reactStrictMode: true,
  // Forwarded browser logs land in .next/dev/logs; on Windows that write was being picked
  // up by the watcher and caused an endless reload loop in dev.
  logging: { browserToTerminal: false },
  agentRules: false,
};

export default config;
