import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/prod',
  timeout: 240_000,
  workers: 1,
  retries: 0,
  use: { baseURL: process.env.LOMU_URL ?? 'https://lomu.example.com', viewport: { width: 1360, height: 860 } },
});
