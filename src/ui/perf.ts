import { useEffect } from "react";
import { onFrame } from "./clock";

const SIZE = 720;
const intervals = new Float32Array(SIZE);
let count = 0;
let head = 0;
let last = 0;
const commits = new Map<string, number>();
let commitStart = 0;
let stop: (() => void) | null = null;
const draws = new Map<string, { sum: number; n: number; max: number }>();

export interface PerfSnapshot {
  samples: number;
  refreshHz: number;
  fps: number;
  median: number;
  p95: number;
  p99: number;
  worst: number;
  droppedPct: number;
  commitsPerSec: { name: string; perSec: number }[];
  draws: { name: string; avg: number; max: number; n: number }[];
  heapMB: number | null;
}

export const perf = {
  get active() {
    return stop !== null;
  },
  start() {
    if (stop) return;
    perf.reset();
    stop = onFrame((t) => {
      if (last) {
        intervals[head] = t - last;
        head = (head + 1) % SIZE;
        count = Math.min(SIZE, count + 1);
      }
      last = t;
    });
  },
  end() {
    stop?.();
    stop = null;
  },
  reset() {
    count = 0;
    head = 0;
    last = 0;
    commits.clear();
    commitStart = performance.now();
    draws.clear();
  },
  draw(name: string, ms: number) {
    if (!stop) return;
    const d = draws.get(name) ?? { sum: 0, n: 0, max: 0 };
    d.sum += ms;
    d.n++;
    d.max = Math.max(d.max, ms);
    draws.set(name, d);
  },
  commit(name: string) {
    if (stop) commits.set(name, (commits.get(name) ?? 0) + 1);
  },
  snapshot(): PerfSnapshot {
    const xs = Array.from(intervals.slice(0, count)).sort((a, b) => a - b);
    const q = (p: number) =>
      xs.length ? xs[Math.min(xs.length - 1, Math.floor(xs.length * p))] : 0;
    const median = q(0.5);
    const refresh = q(0.25) || median;
    const dropped = xs.filter((x) => x > refresh * 1.5).length;
    const mean = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
    const secs = Math.max(0.001, (performance.now() - commitStart) / 1000);
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    return {
      samples: xs.length,
      refreshHz: refresh ? Math.round(1000 / refresh) : 0,
      fps: mean ? Math.round(1000 / mean) : 0,
      median,
      p95: q(0.95),
      p99: q(0.99),
      worst: xs.length ? xs[xs.length - 1] : 0,
      droppedPct: xs.length ? (dropped / xs.length) * 100 : 0,
      commitsPerSec: [...commits.entries()].map(([name, n]) => ({ name, perSec: n / secs })),
      draws: [...draws.entries()].map(([name, d]) => ({
        name,
        avg: d.sum / d.n,
        max: d.max,
        n: d.n,
      })),
      heapMB: mem ? mem.usedJSHeapSize / 1048576 : null,
    };
  },
};

export function useCommitCounter(name: string) {
  useEffect(() => perf.commit(name));
}

export function timed<T>(name: string, fn: () => T): T {
  if (!perf.active) return fn();
  const t0 = performance.now();
  const out = fn();
  perf.draw(name, performance.now() - t0);
  return out;
}
