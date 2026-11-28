import { expect, test, type Page } from '@playwright/test';

const USER = 'owner';
const PASS = 'e2e-correct-horse';
const VIDEO = 'kJQP7kiw5Fk';
const PHONE = 'android-e2e-0001';
const ROUNDS = Number(process.env.CONNECT_ROUNDS ?? 6);

test.describe.configure({ mode: 'serial' });

type Dev = { id: string; name: string; track?: { id: string; title: string }; playing?: boolean; position?: number };

class FakePhone {
  devices: Dev[] = [];
  cmds: Record<string, any>[] = [];
  private ctl = new AbortController();
  constructor(private base: string, private cookie: string, readonly id = PHONE) {}
  async connect() {
    const r = await fetch(`${this.base}/api/connect/events?id=${this.id}&name=Pixel%20E2E&kind=android`, { headers: { cookie: this.cookie }, signal: this.ctl.signal });
    const reader = r.body!.getReader();
    const dec = new TextDecoder();
    let buf = '';
    (async () => {
      for (;;) {
        const { value, done } = await reader.read().catch(() => ({ value: undefined, done: true }));
        if (done) return;
        buf += dec.decode(value);
        for (let i = buf.indexOf('\n\n'); i >= 0; i = buf.indexOf('\n\n')) {
          const block = buf.slice(0, i);
          buf = buf.slice(i + 2);
          const ev = /event: (\w+)/.exec(block)?.[1];
          const data = /data: (.*)/.exec(block)?.[1];
          if (!ev || !data) continue;
          if (ev === 'devices') this.devices = JSON.parse(data).devices;
          if (ev === 'command') this.cmds.push(JSON.parse(data).cmd);
        }
      }
    })();
  }
  close() {
    this.ctl.abort();
  }
  post(path: string, body: unknown) {
    return fetch(`${this.base}${path}`, { method: 'POST', headers: { cookie: this.cookie, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  }
  send(to: string, cmd: Record<string, unknown>) {
    return this.post('/api/connect/command', { from: this.id, to, cmd });
  }
  report(playing: boolean, position = 30, volume = 1) {
    return this.post('/api/connect/state', {
      id: this.id,
      state: { track: { id: 'phone-song', title: 'Phone Song', artists: [{ name: 'X' }] }, playing, position, duration: 200, volume, shuffle: false, repeat: 'off', queueLen: 1 },
    });
  }
  webId: string | null = null;
  web = () => this.devices.find((d) => (this.webId ? d.id === this.webId : d.id !== this.id));
}

async function login(page: Page) {
  await page.addInitScript(() => localStorage.setItem('lomu-welcomed', '1'));
  await page.goto('/');
  await page.getByLabel('Username', { exact: true }).fill(USER, { timeout: 45_000 });
  await page.getByLabel('Password', { exact: true }).fill(PASS);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByLabel('Username', { exact: true })).toBeHidden({ timeout: 15_000 });
}

test('web and phone stay in sync, both directions', async ({ page, request, baseURL }) => {
  await request.post('/api/auth/setup', { data: { username: USER, password: PASS } });
  await login(page);
  const cookie = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join('; ');
  const phone = new FakePhone(baseURL!, cookie, 'android-e2e-0001');
  phone.webId = await page.evaluate(() => sessionStorage.getItem('lomu-device'));
  await phone.connect();
  await expect.poll(() => phone.devices.length >= 2 && !!phone.web(), { timeout: 15_000 }).toBe(true);

  await page.goto('/search?q=despacito');
  const row = page.locator('[role="button"]').filter({ hasText: /Despacito/i }).first();
  await expect(row).toBeVisible({ timeout: 45_000 });
  await row.click();
  await page.getByRole('button', { name: 'Pause' }).waitFor({ timeout: 30_000 });

  await expect.poll(() => phone.web()?.playing, { timeout: 15_000 }).toBe(true);
  const p0 = phone.web()!.position!;
  await expect.poll(() => phone.web()!.position!, { timeout: 15_000 }).toBeGreaterThan(p0);
  const webId = phone.web()!.id;
  expect(phone.web()!.track?.id).toBeTruthy();

  for (let i = 0; i < ROUNDS; i++) {
    await phone.send(webId, { type: 'pause' });
    await expect(page.getByRole('button', { name: 'Play', exact: true }).first()).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => phone.web()?.playing, { timeout: 10_000 }).toBe(false);
    await phone.send(webId, { type: 'play' });
    await expect(page.getByRole('button', { name: 'Pause', exact: true }).first()).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => phone.web()?.playing, { timeout: 10_000 }).toBe(true);
  }

  await phone.send(webId, { type: 'seek', position: 100 });
  const seek = page.getByRole('slider', { name: 'Seek' }).first();
  await expect.poll(async () => Number(await seek.getAttribute('aria-valuenow')), { timeout: 15_000 }).toBeGreaterThan(95);
  await expect.poll(() => phone.web()!.position!, { timeout: 15_000 }).toBeGreaterThan(95);

  await phone.report(true);
  await expect(page.getByText('Playing on Pixel E2E')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Play', exact: true }).first()).toBeHidden();

  for (let i = 0; i < ROUNDS; i++) {
    phone.cmds.length = 0;
    await page.getByRole('button', { name: i % 2 ? 'Play' : 'Pause', exact: true }).first().click();
    await expect.poll(() => phone.cmds.some((c) => c.type === 'toggle'), { timeout: 10_000 }).toBe(true);
    await phone.report(i % 2 === 1);
    await expect(page.getByText('Playing on Pixel E2E')).toBeVisible({ timeout: 10_000 });
  }
  await phone.report(false);
  await expect(page.getByRole('button', { name: 'Play', exact: true }).first()).toBeVisible();
  await expect(page.getByText('Playing on Pixel E2E')).toBeVisible();

  phone.cmds.length = 0;
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect.poll(() => phone.cmds.some((c) => c.type === 'next'), { timeout: 10_000 }).toBe(true);

  phone.cmds.length = 0;
  await page.getByRole('button', { name: 'Devices' }).first().click();
  await page.getByRole('button', { name: /This device/ }).click();
  await expect.poll(() => phone.cmds.find((c) => c.type === 'handoff')?.to, { timeout: 10_000 }).toBe(webId);
  await phone.send(webId, { type: 'load', tracks: [{ kind: 'song', id: VIDEO, title: 'Handed Off', artists: [{ name: 'X' }] }], index: 0, position: 5, play: true });
  await expect(page.getByText('Playing on Pixel E2E')).toBeHidden({ timeout: 10_000 });
  await expect(page.getByText('Handed Off').first()).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => phone.web()?.playing, { timeout: 20_000 }).toBe(true);

  phone.cmds.length = 0;
  await page.getByRole('button', { name: 'Devices' }).first().click();
  await page.getByRole('button', { name: /Pixel E2E/ }).click();
  await expect.poll(() => phone.cmds.find((c) => c.type === 'load')?.tracks?.[0]?.id, { timeout: 10_000 }).toBe(VIDEO);
  await expect(page.getByText('Playing on Pixel E2E')).toBeVisible({ timeout: 10_000 });

  phone.close();
});

test('song menu: every entry works, and queue actions follow the steered device', async ({ page, request, baseURL }) => {
  await request.post('/api/auth/setup', { data: { username: USER, password: PASS } });
  await login(page);
  await page.goto('/search?q=despacito');
  const row = page.locator('[role="button"]').filter({ hasText: /Despacito/i }).first();
  await expect(row).toBeVisible({ timeout: 45_000 });
  const open = async () => {
    await row.hover();
    await row.getByRole('button', { name: 'More' }).click();
    await expect(page.getByRole('menu')).toBeVisible();
  };

  await open();
  for (const name of ['Start radio', 'Play next', 'Add to queue', 'Like', 'Add to playlist', 'Go to album', 'Share']) {
    await expect(page.getByRole('menu').getByText(name, { exact: false }).first()).toBeVisible();
  }
  await expect(page.getByRole('menu').getByText(/^Go to (?!album)/).first()).toBeVisible();
  const box = (await page.getByRole('menu').boundingBox())!;
  const vp = page.viewportSize()!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height);

  await page.getByRole('menu').getByText('Like', { exact: true }).click();
  await open();
  await expect(page.getByRole('menu').getByText('Remove from liked')).toBeVisible();
  await page.getByRole('menu').getByText('Remove from liked').click();

  await open();
  await page.getByRole('menu').getByText('Add to playlist').click();
  await page.getByRole('menu').getByText('New playlist').click();
  await page.getByLabel('Playlist name').fill('Menu Test');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Added to Menu Test')).toBeVisible();

  await open();
  await page.getByRole('menu').getByText('Go to album').click();
  await expect(page).toHaveURL(/\/album\//);
  await page.goBack();
  await expect(row).toBeVisible({ timeout: 30_000 });

  const cookie = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join('; ');
  const phone = new FakePhone(baseURL!, cookie, 'android-e2e-0002');
  phone.webId = await page.evaluate(() => sessionStorage.getItem('lomu-device'));
  await phone.connect();
  await expect.poll(() => phone.devices.length >= 2 && !!phone.web(), { timeout: 15_000 }).toBe(true);
  await phone.report(true);
  await expect(page.getByText('Playing on Pixel E2E')).toBeVisible({ timeout: 10_000 });
  await open();
  await page.getByRole('menu').getByText('Play next').click();
  await expect.poll(() => phone.cmds.find((c) => c.type === 'enqueue' && c.next)?.tracks?.length, { timeout: 10_000 }).toBe(1);
  await open();
  await page.getByRole('menu').getByText('Add to queue').click();
  await expect.poll(() => phone.cmds.some((c) => c.type === 'enqueue' && !c.next), { timeout: 10_000 }).toBe(true);
  phone.close();
});
