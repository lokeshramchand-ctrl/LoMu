import type { NextConfig } from 'next';
import pkg from './package.json';

const config: NextConfig = {
  // Lets a second dev server (screenshots, e2e) run beside the main one without sharing a build cache.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Self-contained server bundle for the Docker image (Coolify).
  output: 'standalone',
  serverExternalPackages: ['youtubei.js', 'jsdom', 'bgutils-js', '@napi-rs/canvas'],
  images: { unoptimized: true },
  poweredByHeader: false,
  // Shown in Settings so the number can never drift from package.json.
  env: { NEXT_PUBLIC_APP_VERSION: pkg.version },
  reactStrictMode: true,
  // Forwarded browser logs land in .next/dev/logs; on Windows that write was being picked
  // up by the watcher and caused an endless reload loop in dev.
  logging: { browserToTerminal: false },
  agentRules: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        ],
      },
    ];
  },
};

export default config;
