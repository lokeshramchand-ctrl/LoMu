import { expect, test } from '@playwright/test';

const USER = 'owner';
const PASS = 'e2e-correct-horse';
const VIDEO = 'kJQP7kiw5Fk';

test.describe.configure({ mode: 'serial' });

test('first run: API is open, then creating the owner locks it down', async ({ request }) => {
  expect((await (await request.get('/api/auth/status')).json()).setup).toBe(false);
  const bad = await request.post('/api/auth/setup', { data: { username: USER, password: 'short' } });
  expect(bad.status()).toBe(400);
  const ok = await request.post('/api/auth/setup', { data: { username: USER, password: PASS } });
  expect(ok.ok()).toBe(true);
  const anon = await (await import('@playwright/test')).request.newContext({ baseURL: test.info().project.use.baseURL });
  expect((await anon.get('/api/home')).status()).toBe(401);
  expect((await anon.get(`/api/stream/${VIDEO}`)).status()).toBe(401);
  expect((await anon.post('/api/auth/login', { data: { username: USER, password: 'wrong' } })).status()).toBe(401);
  await anon.dispose();
});

test('the stream proxy delivers the whole file, not just the first MiB', async ({ request }) => {
  await request.post('/api/auth/login', { data: { username: USER, password: PASS } });
  const res = await request.get(`/api/stream/${VIDEO}`);
  expect(res.status()).toBe(200);
  const len = Number(res.headers()['x-lomu-length']);
  const body = await res.body();
  expect(len).toBeGreaterThan(2 * 1024 * 1024);
  expect(body.length).toBe(len);

  const seek = await request.get(`/api/stream/${VIDEO}`, { headers: { range: `bytes=${len - 100_000}-` } });
  expect(seek.status()).toBe(206);
  expect((await seek.body()).length).toBe(100_000);
});

test('sync: pushed docs come back, and old writes do not overwrite new ones', async ({ request }) => {
  await request.post('/api/auth/login', { data: { username: USER, password: PASS } });
  const track = { kind: 'song', id: VIDEO, title: 'Test', artists: [{ name: 'Someone' }] };
  const push = await request.post('/api/sync', { data: { docs: [{ kind: 'like', key: VIDEO, value: { track, at: 2000 }, updated: 2000 }] } });
  expect((await push.json()).applied).toBe(1);
  const stale = await request.post('/api/sync', { data: { docs: [{ kind: 'like', key: VIDEO, value: null, updated: 1000, deleted: true }] } });
  expect((await stale.json()).applied).toBe(0);
  const pulled = await (await request.get('/api/sync?since=0')).json();
  expect(pulled.docs.find((d: { key: string }) => d.key === VIDEO).deleted).toBe(false);
});

test('UI: sign in, search, play a song and watch the clock pass the first MiB', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lomu-welcomed', '1'));
  await page.goto('/');
  await page.getByLabel('Username', { exact: true }).fill(USER);
  await page.getByLabel('Password', { exact: true }).fill(PASS);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByLabel('Username', { exact: true })).toBeHidden({ timeout: 15_000 });

  await page.goto('/search?q=despacito');
  const row = page.locator('[role="button"]').filter({ hasText: /Despacito/i }).first();
  await expect(row).toBeVisible({ timeout: 45_000 });
  await row.click();

  const seek = page.getByRole('slider', { name: 'Seek' }).first();
  await expect(seek).toBeVisible({ timeout: 30_000 });
  const now = async () => Number(await seek.getAttribute('aria-valuenow'));
  await page.getByRole('button', { name: 'Pause' }).waitFor({ timeout: 30_000 });
  await expect.poll(now, { timeout: 40_000, intervals: [1000] }).toBeGreaterThan(3);
  await seek.focus();
  const before = await now();
  for (let i = 0; i < 14; i++) await page.keyboard.press('ArrowRight');
  await expect.poll(now, { timeout: 40_000, intervals: [1000] }).toBeGreaterThan(before + 60);
  const t1 = await now();
  await page.waitForTimeout(4000);
  expect(await now()).toBeGreaterThan(t1);
});

test('UI: signing out returns to the login screen', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lomu-welcomed', '1'));
  await page.goto('/settings');
  await page.getByLabel('Username', { exact: true }).fill(USER);
  await page.getByLabel('Password', { exact: true }).fill(PASS);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('main').getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
});
