import { expect, test, type Page } from '@playwright/test';

/* Several accounts on one server and one browser: the admin adds a guest in Settings, and the two take turns on the same
   browser without ever seeing (or uploading) each other's library. Runs after the other specs, so the owner may exist. */

const OWNER = 'owner';
const OWNER_PW = 'e2e-correct-horse';
const GUEST = 'guest1';
const GUEST_PW = 'guest-password-1';

test.describe.configure({ mode: 'serial' });

async function signIn(page: Page, user: string, pw: string) {
  await page.getByLabel('Username', { exact: true }).fill(user);
  await page.getByLabel('Password', { exact: true }).fill(pw);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeHidden({ timeout: 15_000 });
}

const signOut = async (page: Page) => {
  await page.goto('/settings');
  await page.getByRole('main').getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
};

const pushLike = (page: Page, id: string) =>
  page.evaluate(async (key) => {
    const r = await fetch('/api/sync', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ docs: [{ kind: 'like', key, value: { track: { kind: 'song', id: key, title: key, artists: [{ name: 'A' }] }, at: Date.now() }, updated: Date.now() }] }) });
    return r.status;
  }, id);

const serverLikes = (page: Page) =>
  page.evaluate(async () => ((await (await fetch('/api/sync?since=0', { cache: 'no-store' })).json()) as { docs: { key: string }[] }).docs.map((d) => d.key).sort());

const localLibrary = (page: Page) => page.evaluate(() => localStorage.getItem('lomu-library') ?? '');

test('the owner exists (set up here if no earlier spec did)', async ({ request }) => {
  const login = await request.post('/api/auth/login', { data: { username: OWNER, password: OWNER_PW } });
  if (login.status() === 401) {
    const setup = await request.post('/api/auth/setup', { data: { username: OWNER, password: OWNER_PW } });
    expect(setup.ok()).toBeTruthy();
  }
});

test('admin adds a guest account from Settings', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lomu-welcomed', '1'));
  await page.goto('/settings');
  await signIn(page, OWNER, OWNER_PW);
  await expect(page.getByText(/\d of 4 accounts/)).toBeVisible();
  await page.getByLabel('Username', { exact: true }).fill(GUEST);
  await page.getByLabel('Password, at least 8 characters', { exact: true }).fill(GUEST_PW);
  await page.getByRole('button', { name: 'Add account' }).click();
  await expect(page.getByText(`${GUEST}`, { exact: false }).first()).toBeVisible();
  await expect(page.getByText('Account added')).toBeVisible();
  // a duplicate (other letter case) is refused with a message
  await page.getByLabel('Username', { exact: true }).fill('GUEST1');
  await page.getByLabel('Password, at least 8 characters', { exact: true }).fill(GUEST_PW);
  await page.getByRole('button', { name: 'Add account' }).click();
  await expect(page.getByText('that username is taken')).toBeVisible();
});

test('two accounts on one browser never see each other’s library', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lomu-welcomed', '1'));
  await page.goto('/');
  await signIn(page, OWNER, OWNER_PW);
  expect(await pushLike(page, 'owner-only-song')).toBe(200);
  await page.reload();
  await expect.poll(() => localLibrary(page), { timeout: 15_000 }).toContain('owner-only-song');
  await signOut(page);

  // the guest signs in on the same browser: the page reloads clean, nothing of the owner's is there
  await signIn(page, GUEST, GUEST_PW);
  await page.goto('/');
  expect(await localLibrary(page)).not.toContain('owner-only-song');
  expect(await serverLikes(page)).not.toContain('owner-only-song');
  expect(await pushLike(page, 'guest-only-song')).toBe(200);
  expect(await serverLikes(page)).toEqual(['guest-only-song']);
  // a guest has no Accounts card, and the API refuses them
  await page.goto('/settings');
  await expect(page.getByText(/accounts\. Everyone gets/)).toHaveCount(0);
  expect(await page.evaluate(async () => (await fetch('/api/users')).status)).toBe(403);
  await signOut(page);

  // back to the owner: their library is intact and the guest's song never arrived
  await signIn(page, OWNER, OWNER_PW);
  await page.goto('/');
  await expect.poll(() => localLibrary(page), { timeout: 15_000 }).toContain('owner-only-song');
  expect(await localLibrary(page)).not.toContain('guest-only-song');
  const likes = await serverLikes(page);
  expect(likes).toContain('owner-only-song');
  expect(likes).not.toContain('guest-only-song');
});

test('a paused account is locked out, and removing it deletes its data', async ({ page, request }) => {
  await page.addInitScript(() => localStorage.setItem('lomu-welcomed', '1'));
  await page.goto('/settings');
  await signIn(page, OWNER, OWNER_PW);
  const row = page.locator('.r', { hasText: GUEST });
  await row.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByText(`${GUEST} · paused`)).toBeVisible();
  expect((await request.post('/api/auth/login', { data: { username: GUEST, password: GUEST_PW } })).status()).toBe(401);
  await page.locator('.r', { hasText: GUEST }).getByRole('button', { name: 'Remove' }).click();
  await page.getByRole('button', { name: 'Delete everything' }).click();
  await expect(page.getByText(GUEST)).toHaveCount(0);
  expect((await request.post('/api/auth/login', { data: { username: GUEST, password: GUEST_PW } })).status()).toBe(401);
});
