import type { PlayLike } from './insights';
import type { Track } from './types';

export type SleepPlay = PlayLike & { skipped?: boolean };

export type SleepSession = {
  start: number;
  end: number;
  plays: SleepPlay[];
  asleepFrom: number;
  lastAwake: Track;
  lastAwakeIndex: number;
  asleepMs: number;
  confidence: 'high' | 'medium' | 'low';
  corrected: boolean;
};

const MIN = 60_000;
export const MIN_RUN_MS = 75 * MIN;
export const MIN_RUN_SONGS = 10;
const NODDING_OFF_MS = 15 * MIN;

export function followsOn(a: SleepPlay, b: SleepPlay): boolean {
  if (!a.completed || b.skipped) return false;
  const delta = b.at - a.at;
  if (delta <= 0) return false;
  return Math.abs(delta - a.playedMs) <= Math.max(60_000, a.playedMs * 0.2) || Math.abs(delta - b.playedMs) <= Math.max(60_000, b.playedMs * 0.2);
}

const isNight = (t: number) => {
  const h = new Date(t).getHours();
  return h >= 21 || h < 9;
};

export function detectSleep(history: SleepPlay[], anchors: Record<string, number> = {}): SleepSession[] {
  const plays = [...history].sort((a, b) => a.at - b.at);
  const out: SleepSession[] = [];
  let run: SleepPlay[] = [];
  const flush = () => {
    if (run.length >= MIN_RUN_SONGS) {
      const last = run[run.length - 1];
      const start = run[0].at;
      const end = last.at + last.playedMs;
      if (end - start >= MIN_RUN_MS) out.push(session(run, start, end, anchors[String(start)]));
    }
    run = [];
  };
  for (const p of plays) {
    if (run.length && followsOn(run[run.length - 1], p)) run.push(p);
    else {
      flush();
      run = [p];
    }
  }
  flush();
  return out.reverse();
}

function session(run: SleepPlay[], start: number, end: number, anchor?: number): SleepSession {
  const span = end - start;
  let lastAwakeIndex = 0;
  let asleepFrom = start + Math.min(NODDING_OFF_MS, span * 0.25);
  let corrected = false;
  if (anchor != null) {
    const i = run.findIndex((p) => p.at === anchor);
    if (i >= 0) {
      lastAwakeIndex = i;
      asleepFrom = run[i].at + run[i].playedMs / 2;
      corrected = true;
    }
  }
  if (!corrected) {
    for (let i = 0; i < run.length; i++) {
      if (run[i].at + run[i].playedMs >= asleepFrom) {
        lastAwakeIndex = i;
        break;
      }
    }
  }
  const overnight = isNight(start) || isNight(start + span / 2);
  const confidence = overnight && span >= 3 * 60 * MIN ? 'high' : overnight || span >= 2 * 60 * MIN ? 'medium' : 'low';
  return { start, end, plays: run, asleepFrom, lastAwake: run[lastAwakeIndex].track, lastAwakeIndex, asleepMs: Math.max(0, end - asleepFrom), confidence, corrected };
}

export function formatSpan(ms: number): string {
  const m = Math.round(ms / MIN);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
}
