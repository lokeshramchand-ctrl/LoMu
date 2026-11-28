import { chromium } from '@playwright/test';
import fs from 'node:fs';

const out = process.argv[2] ?? 'shots';
const base = process.argv[3] ?? 'http://localhost:4100';
const USER = 'lo';
const PASS = 'screenshot-password';
fs.mkdirSync(out, { recursive: true });

async function session() {
  const st = await (await fetch(`${base}/api/auth/status`)).json();
  const res = await fetch(`${base}/api/auth/${st.setup ? 'login' : 'setup'}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASS, code: process.env.LOMU_SETUP_CODE }),
  });
  if (!res.ok) throw new Error(`could not sign in: ${await res.text()}`);
  return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
}
const cookie = await session();
const album = await (await fetch(`${base}/api/album/MPREb_FWIMEPTHFsY`, { headers: { cookie } })).json().catch(() => null);
if (!album?.tracks) throw new Error('could not load the seed album (needs network, and the server must be open or have no owner yet)');
const tracks = album.tracks.slice(0, 10);
const now = Date.now();
const DAY = 86_400_000;
const history = tracks.flatMap((t, i) => [
  { track: t, at: now - i * 3_600_000, playedMs: 190_000, completed: true, skipped: false },
  { track: t, at: now - (i % 5) * DAY - 5_000_000, playedMs: 200_000, completed: true, skipped: false },
]);
const seed = {
  'lomu-library': JSON.stringify({
    state: {
      liked: Object.fromEntries(tracks.slice(0, 6).map((t, i) => [t.id, { track: t, at: now - i * 1000 }])),
      history,
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

async function shot(name, path, { mobile = false, dark = false, before } = {}) {
  const ctx = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    deviceScaleFactor: mobile ? 2 : 1,
    colorScheme: dark ? 'dark' : 'light',
    isMobile: mobile,
    hasTouch: mobile,
  });
  const status = await (await ctx.request.get(`${base}/api/auth/status`)).json();
  if (!status.setup) await ctx.request.post(`${base}/api/auth/setup`, { data: { username: USER, password: PASS, code: process.env.LOMU_SETUP_CODE } });
  else await ctx.request.post(`${base}/api/auth/login`, { data: { username: USER, password: PASS } });
  await ctx.addInitScript((s) => {
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, seed);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
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

await shot('01-home', '/');
await shot('02-home-dark', '/', { dark: true });
await shot('03-home-mobile', '/', { mobile: true });
await shot('04-home-customise', '/', { before: (p) => p.getByRole('button', { name: 'Customise' }).click() });
await shot('05-search', '/search?q=the%20weeknd');
await shot('06-album', '/album/MPREb_FWIMEPTHFsY');
await shot('07-artist', '/artist/UClYV6hHlupm_S_ObS1W-DYw');
await shot('08-library', '/library');
await shot('09-player', '/', { before: (p) => p.getByRole('button', { name: 'Open player' }).click() });
await shot('10-player-lyrics', '/', {
  before: async (p) => {
    await p.getByRole('button', { name: 'Open player' }).click();
    await p.getByRole('button', { name: 'Lyrics' }).last().click();
    await p.waitForTimeout(2500);
  },
});
await shot('11-settings', '/settings');
await shot('12-library-mobile', '/library', { mobile: true });
await browser.close();
