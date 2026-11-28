import 'server-only';

export type Json = Record<string, unknown>;

export type RemoteState = {
  track: Json | null;
  playing: boolean;
  position: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';
  queueLen: number;
  queue: Json[];
};

export type DeviceInfo = { id: string; name: string; kind: 'web' | 'android' } & Partial<RemoteState> & { stateAge: number | null };

type Send = (event: string, data: unknown) => void;
type Device = {
  id: string;
  name: string;
  kind: 'web' | 'android';
  conns: Set<Send>;
  state: RemoteState | null;
  stateAt: number;
  drop?: ReturnType<typeof setTimeout>;
};

const COMMANDS = new Set([
  'play', 'pause', 'toggle', 'next', 'prev', 'seek', 'volume', 'shuffle', 'repeat',
  'load',
  'radio',
  'enqueue',
  'handoff',
  'skipto',
]);

type G = typeof globalThis & { __lomuConnect2?: Map<number, Map<string, Device>> };
const rooms: Map<number, Map<string, Device>> = ((globalThis as G).__lomuConnect2 ??= new Map());
const room = (uid: number): Map<string, Device> => {
  let r = rooms.get(uid);
  if (!r) rooms.set(uid, (r = new Map()));
  return r;
};

const MAX_DEVICES = 16;
const MAX_CONNS = 6;

const GRACE_MS = 6000;

function cleanState(s: Partial<RemoteState> | null | undefined): RemoteState | null {
  if (!s || typeof s !== 'object') return null;
  const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const track = s.track && typeof s.track === 'object' && typeof (s.track as Json).id === 'string' ? (s.track as Json) : null;
  return {
    track,
    playing: !!s.playing && !!track,
    position: Math.max(0, num(s.position)),
    duration: Math.max(0, num(s.duration)),
    volume: Math.min(1, Math.max(0, num(s.volume, 1))),
    shuffle: !!s.shuffle,
    repeat: s.repeat === 'all' || s.repeat === 'one' ? s.repeat : 'off',
    queueLen: Math.max(0, Math.round(num(s.queueLen))),
    queue: Array.isArray(s.queue) ? (s.queue.filter((t) => t && typeof t === 'object' && typeof (t as Json).id === 'string') as Json[]).slice(0, 30) : [],
  };
}

export function snapshot(uid: number) {
  const devices = room(uid);
  const now = Date.now();
  const list: DeviceInfo[] = [...devices.values()].map((d) => ({
    id: d.id,
    name: d.name,
    kind: d.kind,
    ...(d.state ?? {}),
    position: d.state ? d.state.position + (d.state.playing ? (now - d.stateAt) / 1000 : 0) : undefined,
    stateAge: d.state ? now - d.stateAt : null,
  }));
  list.sort((a, b) => a.name.localeCompare(b.name));
  const playing = [...devices.values()].filter((d) => d.state?.playing).sort((a, b) => b.stateAt - a.stateAt)[0];
  const recent = [...devices.values()].filter((d) => d.state?.track && now - d.stateAt < 10 * 60_000).sort((a, b) => b.stateAt - a.stateAt)[0];
  return { devices: list, active: (playing ?? recent)?.id ?? null, now };
}

function broadcast(uid: number) {
  const snap = snapshot(uid);
  for (const d of room(uid).values()) for (const send of d.conns) send('devices', snap);
}

function sendTo(uid: number, id: string, event: string, data: unknown): boolean {
  const d = room(uid).get(id);
  if (!d || !d.conns.size) return false;
  for (const send of d.conns) send(event, data);
  return true;
}

export function connect(uid: number, id: string, name: string, kind: 'web' | 'android', send: Send): () => void {
  const devices = room(uid);
  let d = devices.get(id);
  if (!d) {
    if (devices.size >= MAX_DEVICES) throw new Error('too many devices');
    devices.set(id, (d = { id, name, kind, conns: new Set(), state: null, stateAt: 0 }));
  }
  if (d.conns.size >= MAX_CONNS) throw new Error('too many connections for this device');
  if (d.drop) clearTimeout(d.drop);
  d.name = name;
  d.kind = kind;
  d.conns.add(send);
  broadcast(uid);
  return () => {
    const cur = devices.get(id);
    if (!cur) return;
    cur.conns.delete(send);
    if (cur.conns.size) return;
    cur.drop = setTimeout(() => {
      if (devices.get(id)?.conns.size === 0) {
        devices.delete(id);
        if (!devices.size) rooms.delete(uid);
        broadcast(uid);
      }
    }, GRACE_MS);
  };
}

export function report(uid: number, id: string, raw: Partial<RemoteState>): boolean {
  const devices = room(uid);
  const d = devices.get(id);
  if (!d) return false;
  const was = d.state?.playing ?? false;
  d.state = cleanState(raw);
  d.stateAt = Date.now();
  if (d.state?.playing && !was) {
    for (const o of devices.values()) if (o.id !== id && o.state?.playing) sendTo(uid, o.id, 'command', { from: id, cmd: { type: 'pause', reason: 'other-device' } });
  }
  broadcast(uid);
  return true;
}

export function command(uid: number, from: string, to: string, cmd: Json): 'ok' | 'offline' | 'invalid' {
  const type = typeof cmd?.type === 'string' ? cmd.type : '';
  if (!COMMANDS.has(type)) return 'invalid';
  if (JSON.stringify(cmd).length > 400_000) return 'invalid';
  return sendTo(uid, to, 'command', { from, cmd }) ? 'ok' : 'offline';
}

export function revokeDevices(uid: number) {
  const r = rooms.get(uid);
  if (!r) return;
  for (const d of r.values()) {
    if (d.drop) clearTimeout(d.drop);
    for (const send of d.conns) send('revoked', {});
  }
  rooms.delete(uid);
}
