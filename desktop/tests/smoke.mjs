import fs from 'node:fs';
import path from 'node:path';
import { expect, launch, quit, results, sleep, step, summary } from './harness.mjs';

const c = await launch('smoke', { fresh: true });
const { app, page, api, base, ud } = c;

await step('app starts with its own server and no login screen', async () => {
  const s = (await api('/api/auth/status')).j;
  expect(s.local && s.setup && s.user === 'local', JSON.stringify(s));
});

for (const p of ['/', '/search', '/explore', '/library', '/settings']) {
  await step(`page ${p} renders`, async () => {
    await page.goto(base + p);
    await sleep(2500);
    const t = await page.evaluate(() => document.body.innerText);
    expect(t.length > 60 && !/Application error|This page couldn't load/i.test(t), 'page looks empty or crashed');
  });
}

await step('API routes load their dependencies (youtubei.js, sqlite, canvas)', async () => {
  await api('/api/search?q=test');
  await api('/api/home');
  await api('/api/stream/dQw4w9WgXcQ?warm=1');
  await api('/api/sync?since=0');
  await sleep(1500);
  const log = fs.readFileSync(path.join(ud, 'logs', 'server.log'), 'utf8');
  const bad = log.split('\n').filter((l) => /ERR_MODULE_NOT_FOUND|Cannot find (module|package)|Failed to load external module/.test(l));
  expect(bad.length === 0, bad[0]);
  const docs = (await api('/api/sync?since=0')).j;
  expect(Array.isArray(docs.docs), 'sync endpoint broken');
});

await step('local database file was created', async () => {
  expect(fs.existsSync(path.join(ud, 'data', 'lomu.db')), 'no lomu.db');
});

await quit(app);
process.exit(summary() ? 1 : 0);
