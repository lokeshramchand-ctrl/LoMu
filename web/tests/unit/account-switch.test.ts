import { beforeEach, describe, expect, it } from 'vitest';
import { adoptAccount } from '@/player/sync';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage;
});

describe('adoptAccount', () => {
  it('keeps pre-existing local data for the first account after an update (nobody owned it yet)', () => {
    store.set('lomu-library', '{"liked":1}');
    expect(adoptAccount('Owner')).toBe(false);
    expect(store.get('lomu-library')).toBe('{"liked":1}');
    expect(store.get('lomu-account')).toBe('owner');
  });

  it('keeps the data when the same account comes back (any letter case)', () => {
    adoptAccount('owner');
    store.set('lomu-library', 'mine');
    expect(adoptAccount('OWNER')).toBe(false);
    expect(store.get('lomu-library')).toBe('mine');
  });

  it('wipes the previous account data, sync cursor and queue when a different account signs in', () => {
    adoptAccount('owner');
    for (const k of ['lomu-library', 'lomu-sync-seq', 'lomu-sleep', 'lomu-player', 'lomu-queue-at', 'lomu-queue-seen']) store.set(k, 'x');
    store.set('lomu-device', 'dev123');
    store.set('lomu-settings', '{"theme":"dark"}');
    expect(adoptAccount('guest1')).toBe(true);
    for (const k of ['lomu-library', 'lomu-sync-seq', 'lomu-sleep', 'lomu-player', 'lomu-queue-at', 'lomu-queue-seen']) expect(store.has(k), k).toBe(false);
    expect(store.get('lomu-device')).toBe('dev123');
    expect(store.get('lomu-settings')).toBe('{"theme":"dark"}');
    expect(store.get('lomu-account')).toBe('guest1');
    store.set('lomu-library', 'guest data');
    expect(adoptAccount('owner')).toBe(true);
    expect(store.has('lomu-library')).toBe(false);
  });
});
