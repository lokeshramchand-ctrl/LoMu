import { createInterface } from 'node:readline';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, '..', 'node_modules', 'bgutils-js', 'dist');
const ORIGIN = 'https://www.youtube.com';

let browser;
let page;

async function ensurePage() {
  if (page) return page;
  browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
  const ctx = await browser.newContext({ locale: 'en-US' });
  page = await ctx.newPage();
  await page.route(`${ORIGIN}/__lomu/**`, async (route) => {
    const rel = new URL(route.request().url()).pathname.replace('/__lomu/', '');
    try {
      const body = await readFile(path.join(dist, rel));
      await route.fulfill({ body, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' } });
    } catch {
      await route.fulfill({ status: 404, body: 'not found' });
    }
  });
  await page.route(`${ORIGIN}/__lomu_blank`, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><title></title></head><body></body></html>' }),
  );
  await page.goto(`${ORIGIN}/__lomu_blank`);
  await page.evaluate(async () => {
    const [bg, po, utils] = await Promise.all([
      import('/__lomu/exports/botguard.js'),
      import('/__lomu/exports/webpo.js'),
      import('/__lomu/exports/utils.js'),
    ]);
    window.__lomu = { bg, po, utils, minter: null };
  });
  return page;
}

async function init({ challenge, requestKey }) {
  const p = await ensurePage();
  if (!challenge.interpreterJavascript && challenge.interpreterUrl) {
    const url = challenge.interpreterUrl.startsWith('//') ? `https:${challenge.interpreterUrl}` : challenge.interpreterUrl;
    challenge = { ...challenge, interpreterJavascript: await (await fetch(url)).text() };
  }
  return p.evaluate(
    async ({ challenge, requestKey }) => {
      const { bg, po, utils } = window.__lomu;
      const js = challenge.interpreterJavascript
        ? challenge.interpreterJavascript
        : await (await fetch(challenge.interpreterUrl.startsWith('//') ? `https:${challenge.interpreterUrl}` : challenge.interpreterUrl)).text();
      new Function(js)();
      const botguard = await bg.BotGuardClient.create({ program: challenge.program, globalName: challenge.globalName, globalObject: window });
      const webPoSignalOutput = [];
      const snapshot = await botguard.snapshot({ webPoSignalOutput });
      const res = await fetch(utils.buildURL('GenerateIT', true), {
        method: 'POST',
        headers: { 'content-type': 'application/json+protobuf', 'x-goog-api-key': utils.GOOG_API_KEY, 'x-user-agent': 'grpc-web-javascript/0.1' },
        body: JSON.stringify([requestKey, snapshot]),
      });
      const data = await res.json();
      if (typeof data?.[0] !== 'string') throw new Error(`no integrity token (${res.status})`);
      window.__lomu.minter = await po.WebPoMinter.create({ integrityToken: data[0] }, webPoSignalOutput);
      return { ttl: Number(data[1]) || 6 * 3600 };
    },
    { challenge, requestKey },
  );
}

async function mint({ binding }) {
  const p = await ensurePage();
  return p.evaluate(async (binding) => {
    if (!window.__lomu.minter) throw new Error('not initialised');
    return { token: await window.__lomu.minter.mintAsWebsafeString(binding) };
  }, binding);
}

const rl = createInterface({ input: process.stdin });
rl.on('line', async (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  try {
    const out = msg.cmd === 'init' ? await init(msg) : msg.cmd === 'mint' ? await mint(msg) : { pong: true };
    process.stdout.write(JSON.stringify({ id: msg.id, ok: true, ...out }) + '\n');
  } catch (e) {
    process.stdout.write(JSON.stringify({ id: msg.id, ok: false, error: String(e?.message ?? e) }) + '\n');
  }
});
process.stdin.on('end', async () => {
  await browser?.close().catch(() => {});
  process.exit(0);
});
