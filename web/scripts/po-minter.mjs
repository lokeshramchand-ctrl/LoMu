import { createInterface } from 'node:readline';
import { JSDOM } from 'jsdom';
import { BotGuardClient } from 'bgutils-js/botguard';
import { WebPoMinter } from 'bgutils-js/webpo';
import { buildURL, GOOG_API_KEY, USER_AGENT } from 'bgutils-js/utils';

const dom = new JSDOM('<!DOCTYPE html><html lang="en"><head><title></title></head><body></body></html>', {
  url: 'https://www.youtube.com/',
  referrer: 'https://www.youtube.com/',
  userAgent: USER_AGENT,
});
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  location: dom.window.location,
  origin: dom.window.origin,
});
if (!Reflect.has(globalThis, 'navigator')) {
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator });
}

let minter = null;

async function init({ challenge, requestKey }) {
  const js = challenge.interpreterJavascript
    ? challenge.interpreterJavascript
    : await (await fetch(challenge.interpreterUrl.startsWith('//') ? `https:${challenge.interpreterUrl}` : challenge.interpreterUrl)).text();
  if (!js) throw new Error('could not load BotGuard interpreter');
  new Function(js)();
  const botguard = await BotGuardClient.create({ program: challenge.program, globalName: challenge.globalName, globalObject: globalThis });
  const webPoSignalOutput = [];
  const snapshot = await botguard.snapshot({ webPoSignalOutput });
  const res = await fetch(buildURL('GenerateIT', true), {
    method: 'POST',
    headers: {
      'content-type': 'application/json+protobuf',
      'x-goog-api-key': GOOG_API_KEY,
      'x-user-agent': 'grpc-web-javascript/0.1',
      'user-agent': USER_AGENT,
    },
    body: JSON.stringify([requestKey, snapshot]),
  });
  const data = await res.json();
  if (typeof data?.[0] !== 'string') throw new Error(`no integrity token (${res.status})`);
  minter = await WebPoMinter.create({ integrityToken: data[0] }, webPoSignalOutput);
  return { ttl: Number(data[1]) || 6 * 3600 };
}

async function mint({ binding }) {
  if (!minter) throw new Error('not initialised');
  return { token: await minter.mintAsWebsafeString(binding) };
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
process.stdin.on('end', () => process.exit(0));
