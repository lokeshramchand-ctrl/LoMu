import { afterAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lomu-offline-test-'));
process.env.LOMU_AUDIO_CACHE_DIR = dir;
afterAll(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 }));

vi.mock('@/server/stream', async (orig) => ({
  ...(await orig<typeof import('@/server/stream')>()),
  proxyAudio: async () => new Response('abcdef', { headers: { 'x-lomu-length': '6' } }),
}));

describe('save offline', () => {
  it('downloads the queued songs once, ignores bad ids, and reports what is on disk', async () => {
    const { download, savedCount } = await import('@/server/audiocache');
    const ids = ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'not-an-id'];
    expect(download(ids, 'opus')).toBe(2);
    expect(download(ids, 'opus')).toBe(0);
    await vi.waitFor(() => expect(savedCount(ids, 'opus')).toBe(2));
    expect(fs.readFileSync(path.join(dir, 'aaaaaaaaaaa.opus'), 'utf8')).toBe('abcdef');
    expect(download(ids, 'opus')).toBe(0);
  });
});
