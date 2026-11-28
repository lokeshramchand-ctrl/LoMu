'use client';
import { create } from 'zustand';
import { useLibrary, HISTORY_CAP, type Play, type UserPlaylist } from './library';
import { noteQueueRows, startQueueSync } from './queue-sync';
import type { AlbumCard, ArtistCard, PlaylistCard, Track } from '@/lib/types';

type Doc = { kind: string; key: string; value: unknown | null; updated: number; deleted?: boolean };
type Row = Doc & { deleted: boolean; seq: number };

type AuthState = {
  status: 'loading' | 'setup' | 'login' | 'ready';
  user: string | null;
  needsCode: boolean;
  admin: boolean;
  local: boolean;
  error: string | null;
  sync: 'off' | 'syncing' | 'live' | 'error';
  lastSync: number | null;
  refresh: () => Promise<void>;
  submit: (mode: 'setup' | 'login', username: string, password: string, code?: string) => Promise<void>;
  logout: () => Promise<void>;
};

const ACCOUNT_KEY = 'lomu-account';
const PER_ACCOUNT_KEYS = ['lomu-library', 'lomu-sync-seq', 'lomu-sleep', 'lomu-player', 'lomu-queue-at', 'lomu-queue-seen'];

export function adoptAccount(user: string): boolean {
  if (typeof localStorage === 'undefined') return false;
  const owner = localStorage.getItem(ACCOUNT_KEY);
  if (owner === user.toLowerCase()) return false;
  const reset = owner !== null;
  if (reset) for (const k of PER_ACCOUNT_KEYS) localStorage.removeItem(k);
  localStorage.setItem(ACCOUNT_KEY, user.toLowerCase());
  return reset;
}

export const useAuth = create<AuthState>((set, get) => ({
  status: 'loading',
  user: null,
  needsCode: false,
  admin: false,
  local: false,
  error: null,
  sync: 'off',
  lastSync: null,
  async refresh() {
    try {
      const r = await fetch('/api/auth/status', { cache: 'no-store' });
      const s = (await r.json()) as { setup: boolean; user: string | null; role?: 'admin' | 'user' | null; needsCode?: boolean; local?: boolean };
      set({ local: !!s.local, admin: s.role === 'admin' });
      if (!s.setup) return set({ status: 'setup', user: null, needsCode: !!s.needsCode });
      if (s.user) {
        if (!s.local && adoptAccount(s.user)) return location.reload();
        set({ status: 'ready', user: s.user });
        startSync();
        return;
      }
      const rr = await fetch('/api/auth/refresh', { method: 'POST' });
      if (rr.ok) return get().refresh();
      set({ status: 'login', user: null });
    } catch {
      set({ status: 'ready', user: get().user });
    }
  },
  async submit(mode, username, password, code) {
    set({ error: null });
    const r = await fetch(`/api/auth/${mode}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password, code }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return set({ error: j.error ?? 'Something went wrong' });
    if (!get().local && adoptAccount(j.user ?? username)) return location.reload();
    set({ status: 'ready', user: j.user ?? username, admin: j.role === 'admin' });
    startSync();
  },
  async logout() {
    stopSync();
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    set({ status: 'login', user: null, admin: false, sync: 'off' });
  },
}));

export async function api(input: string, init?: RequestInit): Promise<Response> {
  let r = await fetch(input, init);
  if (r.status === 401) {
    const rr = await fetch('/api/auth/refresh', { method: 'POST' });
    if (rr.ok) r = await fetch(input, init);
    else useAuth.setState({ status: 'login' });
  }
  return r;
}

const playKey = (p: Play) => `${p.at}:${p.track.id}`;

export function toDocs(prev: Snapshot | null, s = useLibrary.getState(), now = Date.now()): { docs: Doc[]; snap: Snapshot } {
  const snap: Snapshot = {
    likes: new Map(Object.entries(s.liked).map(([id, v]) => [id, v.at])),
    playlists: new Map(s.playlists.map((p) => [p.id, p.updatedAt])),
    saved: new Map(
      [...Object.entries(s.albums), ...Object.entries(s.artists), ...Object.entries(s.savedPlaylists)].map(([id, v]) => [id, (v as { at: number }).at]),
    ),
    plays: new Set(s.history.map(playKey)),
    blocked: new Map(Object.entries(s.blocked ?? {}).map(([k, v]) => [k, v.at])),
  };
  const docs: Doc[] = [];
  if (!prev) {
    for (const [id, v] of Object.entries(s.liked)) docs.push({ kind: 'like', key: id, value: v, updated: v.at });
    for (const p of s.playlists) docs.push({ kind: 'playlist', key: p.id, value: p, updated: p.updatedAt });
    for (const [id, v] of [...Object.entries(s.albums), ...Object.entries(s.artists), ...Object.entries(s.savedPlaylists)])
      docs.push({ kind: 'saved', key: id, value: v, updated: (v as { at: number }).at });
    for (const p of s.history) docs.push({ kind: 'play', key: playKey(p), value: p, updated: p.at });
    for (const [k, v] of Object.entries(s.blocked ?? {})) docs.push({ kind: 'block', key: k, value: v, updated: v.at });
    return { docs, snap };
  }
  for (const [id, at] of snap.likes) if (!prev.likes.has(id)) docs.push({ kind: 'like', key: id, value: s.liked[id], updated: at });
  for (const id of prev.likes.keys()) if (!snap.likes.has(id)) docs.push({ kind: 'like', key: id, value: null, updated: now, deleted: true });
  for (const p of s.playlists) if (prev.playlists.get(p.id) !== p.updatedAt) docs.push({ kind: 'playlist', key: p.id, value: p, updated: p.updatedAt });
  for (const id of prev.playlists.keys()) if (!snap.playlists.has(id)) docs.push({ kind: 'playlist', key: id, value: null, updated: now, deleted: true });
  const savedAll: Record<string, unknown> = { ...s.albums, ...s.artists, ...s.savedPlaylists };
  for (const [id, at] of snap.saved) if (!prev.saved.has(id)) docs.push({ kind: 'saved', key: id, value: savedAll[id], updated: at });
  for (const id of prev.saved.keys()) if (!snap.saved.has(id)) docs.push({ kind: 'saved', key: id, value: null, updated: now, deleted: true });
  for (const p of s.history) if (!prev.plays.has(playKey(p))) docs.push({ kind: 'play', key: playKey(p), value: p, updated: p.at });
  for (const [k, at] of snap.blocked) if (!prev.blocked.has(k)) docs.push({ kind: 'block', key: k, value: s.blocked?.[k], updated: at });
  for (const k of prev.blocked.keys()) if (!snap.blocked.has(k)) docs.push({ kind: 'block', key: k, value: null, updated: now, deleted: true });
  return { docs, snap };
}

export type Snapshot = { likes: Map<string, number>; playlists: Map<string, number>; saved: Map<string, number>; plays: Set<string>; blocked: Map<string, number> };

export function applyRows(rows: Row[]) {
  if (!rows.length) return;
  noteQueueRows(rows);
  useLibrary.setState((s) => {
    const liked = { ...s.liked };
    const albums = { ...s.albums };
    const artists = { ...s.artists };
    const savedPlaylists = { ...s.savedPlaylists };
    const blocked = { ...s.blocked };
    let playlists = [...s.playlists];
    const history = [...s.history];
    const have = new Set(history.map(playKey));
    for (const r of rows) {
      if (r.kind === 'like') {
        if (r.deleted) delete liked[r.key];
        else liked[r.key] = r.value as { track: Track; at: number };
      } else if (r.kind === 'playlist') {
        const i = playlists.findIndex((p) => p.id === r.key);
        if (r.deleted) playlists = playlists.filter((p) => p.id !== r.key);
        else if (i < 0) playlists.unshift(r.value as UserPlaylist);
        else if (playlists[i].updatedAt <= r.updated) playlists[i] = r.value as UserPlaylist;
      } else if (r.kind === 'saved') {
        const v = r.value as { item: AlbumCard | ArtistCard | PlaylistCard; at: number } | null;
        const kind = v?.item.kind ?? (albums[r.key] ? 'album' : artists[r.key] ? 'artist' : 'playlist');
        const map = kind === 'album' ? albums : kind === 'artist' ? artists : savedPlaylists;
        if (r.deleted || !v) delete map[r.key];
        else (map as Record<string, unknown>)[r.key] = v;
      } else if (r.kind === 'block') {
        if (r.deleted || !r.value) delete blocked[r.key];
        else blocked[r.key] = r.value as { name: string; at: number };
      } else if (r.kind === 'play' && !r.deleted && !have.has(r.key)) {
        history.push(r.value as Play);
        have.add(r.key);
      }
    }
    history.sort((a, b) => b.at - a.at);
    return { liked, albums, artists, savedPlaylists, playlists, blocked, history: history.slice(0, HISTORY_CAP) };
  });
}

let started = false;
let applying = false;
let snap: Snapshot | null = null;
let unsub: (() => void) | null = null;
let stopQueue: (() => void) | null = null;
let events: EventSource | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let pulling: Promise<void> | null = null;
const SEQ_KEY = 'lomu-sync-seq';

const getSeq = () => Number(localStorage.getItem(SEQ_KEY) ?? 0) || 0;

async function pull() {
  if (pulling) return pulling;
  pulling = (async () => {
    try {
      useAuth.setState({ sync: 'syncing' });
      for (;;) {
        const r = await api(`/api/sync?since=${getSeq()}`, { cache: 'no-store' });
        if (!r.ok) throw new Error(String(r.status));
        const { seq, docs } = (await r.json()) as { seq: number; docs: Row[] };
        if (!docs.length) break;
        applying = true;
        try {
          applyRows(docs);
        } finally {
          applying = false;
        }
        snap = toDocs(snap ?? emptySnap(), useLibrary.getState()).snap;
        localStorage.setItem(SEQ_KEY, String(seq));
        if (docs.length < 2000) break;
      }
      useAuth.setState({ sync: 'live', lastSync: Date.now() });
    } catch {
      useAuth.setState({ sync: 'error' });
    } finally {
      pulling = null;
    }
  })();
  return pulling;
}

const emptySnap = (): Snapshot => ({ likes: new Map(), playlists: new Map(), saved: new Map(), plays: new Set(), blocked: new Map() });

async function pushPending() {
  const { docs, snap: next } = toDocs(snap);
  if (!docs.length) return;
  for (let i = 0; i < docs.length; i += 1000) {
    const r = await api('/api/sync', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ docs: docs.slice(i, i + 1000) }) });
    if (!r.ok) throw new Error(String(r.status));
    const { seq } = (await r.json()) as { seq: number };
    if (seq - getSeq() === docs.length) localStorage.setItem(SEQ_KEY, String(seq));
  }
  snap = next;
  useAuth.setState({ sync: 'live', lastSync: Date.now() });
}

function schedulePush() {
  if (applying) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    pushPending().catch(() => useAuth.setState({ sync: 'error' }));
  }, 800);
}

export async function startSync() {
  if (started || typeof window === 'undefined') return;
  started = true;
  await pull();
  snap = null;
  await pushPending().catch(() => {});
  unsub = useLibrary.subscribe(schedulePush);
  stopQueue = startQueueSync(async (doc) => {
    const r = await api('/api/sync', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ docs: [doc] }) });
    if (!r.ok) throw new Error(String(r.status));
    const { seq } = (await r.json()) as { seq: number };
    if (seq - getSeq() === 1) localStorage.setItem(SEQ_KEY, String(seq));
  });
  const open = () => {
    events = new EventSource('/api/sync/events');
    events.addEventListener('seq', (e) => {
      if (Number((e as MessageEvent).data) > getSeq()) pull();
    });
    events.onerror = () => {
      events?.close();
      setTimeout(() => started && open(), 5000);
    };
  };
  open();
}

export function stopSync() {
  started = false;
  unsub?.();
  stopQueue?.();
  stopQueue = null;
  events?.close();
  if (timer) clearTimeout(timer);
}
