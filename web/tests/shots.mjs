// Screenshot tour of the web player. Usage: node tests/shots.mjs <outDir> [baseUrl]
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const out = process.argv[2] ?? 'shots';
const base = process.argv[3] ?? 'http://localhost:4100';
fs.mkdirSync(out, { recursive: true });

const album = await (await fetch(`${base}/api/album/MPREb_FWIMEPTHFsY`)).json();
const tracks = album.tracks.slice(0, 8);
const now = Date.now();
const seed = {
  'lomu-welcomed': '1',
  'lomu-library': JSON.stringify({
    state: {
      liked: Object.fromEntries(tracks.slice(0, 5).map((t, i) => [t.id, { track: t, at: now - i * 1000 }])),
      history: tracks.map((t, i) => ({ track: t, at: now - i * 600000, playedMs: 180000, completed: true, skipped: false })),
      playlists: [{ id: 'p1', name: 'Late night drive', tracks, createdAt: now, updatedAt: now }],
      albums: {},
      artists: {},
      savedPlaylists: {},
      recentSearches: ['the weeknd', 'anirudh'],
    },
    version: 1,
  }),
  'lomu-player': JSON.stringify({ state: { queue: tracks, index: 0, position: 42, volume: 1, muted: false, shuffle: false, repeat: 'off', autoplay: true, original: null, source: null }, version: 1 }),
};

const browser = await chromium.launch();
async function shot(name, path, { mobile = false, dark = false, welcome = false, before } = {}) {
  const ctx = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    deviceScaleFactor: mobile ? 2 : 1,
    colorScheme: dark ? 'dark' : 'light',
    isMobile: mobile,
    hasTouch: mobile,
  });
  await ctx.addInitScript((s) => {
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, welcome ? {} : seed);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(base + path, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  if (before) await before(page);
  await page.waitForTimeout(1800);
  let ok = false;
  for (let i = 0; i < 3 && !ok; i++) {
    try {
      await page.screenshot({ path: `${out}/${name}.png`, animations: 'disabled', timeout: 20000 });
      ok = true;
    } catch (e) {
      errors.push('screenshot: ' + String(e.message).split(/\r?\n/)[0]);
      await page.waitForTimeout(1000);
    }
  }
  console.log(name, ok ? 'saved' : 'FAILED', errors.length ? `| ${errors.slice(0, 3).join(' | ')}` : '');
  await ctx.close();
}

await shot('01-welcome-mobile', '/welcome', { mobile: true, welcome: true });
await shot('02-home', '/');
await shot('03-search', '/search?q=the%20weeknd');
await shot('04-album', '/album/MPREb_FWIMEPTHFsY');
await shot('05-artist', '/artist/UClYV6hHlupm_S_ObS1W-DYw');
await shot('06-library', '/library');
await shot('07-player', '/', { before: (p) => p.getByRole('button', { name: 'Open player' }).click() });
await shot('08-player-lyrics', '/', {
  before: async (p) => {
    await p.getByRole('button', { name: 'Lyrics' }).first().click();
    await p.waitForTimeout(2500);
  },
});
await shot('09-settings', '/settings');
await shot('10-home-mobile', '/', { mobile: true });
await shot('11-home-dark', '/', { dark: true });
await browser.close();
