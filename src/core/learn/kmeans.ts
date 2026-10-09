import { gaussian, mulberry32 } from "../rng";
import { TraceBuilder } from "../trace";
import type { BaseEvent, Machine, Range, Trace } from "../types";

export interface Point {
  x: number;
  y: number;
}

export type ClusterData = "blobs" | "overlap" | "uneven" | "moons" | "uniform";
export type KInit = "plusplus" | "random" | "corner" | "manual";

export interface ClusterInput {
  points: Point[];
  dataset: ClusterData;
  n: number;
  seed: number;
}

export interface KMeansParams {
  k: number;
  init: KInit;
  manual: Point[];
}

export const DEFAULT_KMEANS_PARAMS: KMeansParams = { k: 4, init: "plusplus", manual: [] };

export const K_RANGE: Range = { min: 1, max: 8, step: 1 };
export const CLUSTER_POINTS: Range = { min: 60, max: 400, step: 10 };
export const DEFAULT_CLUSTER_POINTS = 200;
export const KMEANS_MAX_ITERATIONS = 40;

export const CLUSTER_DATASETS: { id: ClusterData; label: string; hint: string }[] = [
  {
    id: "blobs",
    label: "Four blobs",
    hint: "Well separated, round clusters: the case k-means handles well.",
  },
  { id: "overlap", label: "Overlapping", hint: "Three clusters bleed into each other." },
  {
    id: "uneven",
    label: "Uneven sizes",
    hint: "One dense cluster and two small ones. k-means splits the big one.",
  },
  { id: "moons", label: "Two moons", hint: "Curved clusters. k-means cannot follow the shape." },
  { id: "uniform", label: "No structure", hint: "Uniform noise. k-means still draws borders." },
];

export const K_INITS: { id: KInit; label: string; hint: string }[] = [
  {
    id: "plusplus",
    label: "k-means++",
    hint: "Spread the starting centroids out, weighted by distance.",
  },
  { id: "random", label: "Random points", hint: "Pick k data points at random (Forgy)." },
  { id: "corner", label: "Bad: one corner", hint: "Every centroid starts in the same corner." },
  { id: "manual", label: "Place by hand", hint: "Click or tap the plot to place centroids." },
];

const clamp01 = (v: number) => Math.min(0.98, Math.max(0.02, v));

export function makeClusters(dataset: ClusterData, n: number, seed: number): ClusterInput {
  const rng = mulberry32(seed);
  const size = Math.max(CLUSTER_POINTS.min, Math.min(CLUSTER_POINTS.max, Math.round(n)));
  const pts: Point[] = [];
  const blob = (cx: number, cy: number, sd: number, count: number) => {
    for (let i = 0; i < count; i++)
      pts.push({ x: clamp01(cx + gaussian(rng) * sd), y: clamp01(cy + gaussian(rng) * sd) });
  };
  if (dataset === "blobs") {
    const centers = [
      [0.22, 0.25],
      [0.75, 0.24],
      [0.3, 0.76],
      [0.77, 0.72],
    ];
    centers.forEach(([x, y], i) =>
      blob(
        x + (rng() - 0.5) * 0.06,
        y + (rng() - 0.5) * 0.06,
        0.06,
        Math.round(size / 4) + (i === 0 ? size % 4 : 0),
      ),
    );
  } else if (dataset === "overlap") {
    blob(0.35, 0.4, 0.12, Math.round(size / 3));
    blob(0.62, 0.55, 0.12, Math.round(size / 3));
    blob(0.45, 0.72, 0.11, size - 2 * Math.round(size / 3));
  } else if (dataset === "uneven") {
    blob(0.38, 0.45, 0.14, Math.round(size * 0.7));
    blob(0.82, 0.2, 0.035, Math.round(size * 0.15));
    blob(0.82, 0.82, 0.035, size - Math.round(size * 0.7) - Math.round(size * 0.15));
  } else if (dataset === "moons") {
    const half = Math.floor(size / 2);
    for (let i = 0; i < size; i++) {
      const t = rng() * Math.PI;
      const upper = i < half;
      const x = upper ? 0.32 + 0.24 * Math.cos(t) : 0.56 - 0.24 * Math.cos(t);
      const y = upper ? 0.42 + 0.24 * Math.sin(t) : 0.58 - 0.24 * Math.sin(t);
      pts.push({ x: clamp01(x + gaussian(rng) * 0.025), y: clamp01(y + gaussian(rng) * 0.025) });
    }
  } else {
    for (let i = 0; i < size; i++) pts.push({ x: clamp01(rng()), y: clamp01(rng()) });
  }
  return { points: pts, dataset, n: size, seed };
}

const d2 = (a: Point, b: Point) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export function plusPlus(
  points: Point[],
  k: number,
  rng: () => number,
  seed: Point[] = [],
): Point[] {
  const out = seed.slice(0, k).map((p) => ({ ...p }));
  if (!out.length) out.push({ ...points[Math.floor(rng() * points.length)] });
  while (out.length < k) {
    const d = points.map((p) => Math.min(...out.map((c) => d2(p, c))));
    const total = d.reduce((s, v) => s + v, 0);
    if (total === 0) {
      out.push({ ...points[Math.floor(rng() * points.length)] });
      continue;
    }
    let r = rng() * total;
    let pick = points.length - 1;
    for (let i = 0; i < points.length; i++) {
      r -= d[i];
      if (r <= 0) {
        pick = i;
        break;
      }
    }
    out.push({ ...points[pick] });
  }
  return out;
}

export type KMeansEvent = BaseEvent &
  (
    | { k: "centroid"; c: number; x: number; y: number }
    | { k: "assign"; assign: Int16Array; changed: number; inertia: number; sizes: number[] }
    | { k: "update"; centroids: Point[]; shift: number; inertia: number; empty: number[] }
    | { k: "converged" }
  );

function inertiaOf(points: Point[], assign: Int16Array, cents: Point[]): number {
  let s = 0;
  for (let i = 0; i < points.length; i++) s += d2(points[i], cents[assign[i]]);
  return s;
}

export function runKMeans(
  input: ClusterInput,
  params: KMeansParams,
  maxIter = KMEANS_MAX_ITERATIONS,
): Trace<KMeansEvent> {
  const { points } = input;
  const k = Math.max(K_RANGE.min, Math.min(K_RANGE.max, Math.round(params.k)));
  const rng = mulberry32(input.seed * 31 + k * 7 + params.init.length);
  const tb = new TraceBuilder<KMeansEvent>("inertia");
  let cents: Point[];
  if (params.init === "plusplus") cents = plusPlus(points, k, rng);
  else if (params.init === "random") {
    const idx = new Set<number>();
    while (idx.size < Math.min(k, points.length)) idx.add(Math.floor(rng() * points.length));
    cents = [...idx].map((i) => ({ ...points[i] }));
  } else if (params.init === "corner") {
    cents = Array.from({ length: k }, (_, i) => ({
      x: 0.04 + i * 0.012,
      y: 0.04 + ((i * 7) % 5) * 0.01,
    }));
  } else {
    cents = plusPlus(points, k, rng, params.manual);
  }
  tb.checkpoint("Start");
  cents.forEach((c, i) =>
    tb.emit({
      k: "centroid",
      c: i,
      x: c.x,
      y: c.y,
      op: "init",
      note: `Centroid ${i + 1} starts at (${c.x.toFixed(2)}, ${c.y.toFixed(2)})`,
    }),
  );
  tb.endGroup(0);

  let assign = new Int16Array(points.length).fill(-1);
  let inertia = 0;
  for (let iter = 0; iter < maxIter; iter++) {
    const next = new Int16Array(points.length);
    let changed = 0;
    const sizes = new Array(k).fill(0);
    for (let i = 0; i < points.length; i++) {
      let best = 0;
      let bd = Infinity;
      for (let c = 0; c < k; c++) {
        const dd = d2(points[i], cents[c]);
        if (dd < bd) {
          bd = dd;
          best = c;
        }
      }
      next[i] = best;
      sizes[best]++;
      if (assign[i] !== best) changed++;
    }
    assign = next;
    inertia = inertiaOf(points, assign, cents);
    tb.emit({
      k: "assign",
      assign: assign.slice(),
      changed,
      inertia,
      sizes,
      op: "assign",
      note:
        iter === 0
          ? `Assign all ${points.length} points to their nearest centroid`
          : `Iteration ${iter + 1}: ${changed} point${changed === 1 ? "" : "s"} switched cluster`,
    });
    tb.endGroup(inertia);
    if (iter === 0) tb.checkpoint("First assignment");
    if (changed === 0 && iter > 0) {
      tb.emit({
        k: "converged",
        op: "converged",
        note: `Converged after ${iter + 1} iterations: no point changed cluster`,
      });
      tb.checkpoint("Converged");
      return tb.finish(inertia);
    }
    const sums = cents.map(() => ({ x: 0, y: 0, n: 0 }));
    for (let i = 0; i < points.length; i++) {
      const s = sums[assign[i]];
      s.x += points[i].x;
      s.y += points[i].y;
      s.n++;
    }
    let shift = 0;
    const empty: number[] = [];
    cents = cents.map((c, i) => {
      const s = sums[i];
      if (!s.n) {
        empty.push(i);
        return c;
      }
      const nc = { x: s.x / s.n, y: s.y / s.n };
      shift = Math.max(shift, Math.sqrt(d2(c, nc)));
      return nc;
    });
    inertia = inertiaOf(points, assign, cents);
    tb.emit({
      k: "update",
      centroids: cents.map((c) => ({ ...c })),
      shift,
      inertia,
      empty,
      op: "update",
      note: empty.length
        ? `Move centroids; cluster ${empty.map((e) => e + 1).join(", ")} is empty and stays put`
        : `Move each centroid to its cluster mean (largest move ${shift.toFixed(3)})`,
    });
    tb.endGroup(inertia);
  }
  tb.checkpoint("Iteration limit");
  return tb.finish(inertia);
}

export interface KMeansState {
  points: Point[];
  centroids: Point[];
  trails: Point[][];
  assign: Int16Array | null;
  sizes: number[];
  inertia: number | null;
  history: number[];
  iteration: number;
  changed: number;
  phase: "init" | "assign" | "update" | "converged";
  empty: number[];
}

export const kmeansMachine: Machine<ClusterInput, KMeansEvent, KMeansState> = {
  init(input) {
    return {
      points: input.points,
      centroids: [],
      trails: [],
      assign: null,
      sizes: [],
      inertia: null,
      history: [],
      iteration: 0,
      changed: 0,
      phase: "init",
      empty: [],
    };
  },
  apply(s, e) {
    if (e.k === "centroid") {
      s.centroids[e.c] = { x: e.x, y: e.y };
      s.trails[e.c] = [{ x: e.x, y: e.y }];
    } else if (e.k === "assign") {
      s.assign = e.assign;
      s.changed = e.changed;
      s.inertia = e.inertia;
      s.sizes = e.sizes;
      s.history.push(e.inertia);
      s.iteration++;
      s.phase = "assign";
      s.empty = [];
    } else if (e.k === "update") {
      s.centroids = e.centroids.map((c) => ({ ...c }));
      e.centroids.forEach((c, i) => s.trails[i].push({ ...c }));
      s.inertia = e.inertia;
      s.history.push(e.inertia);
      s.phase = "update";
      s.empty = e.empty;
    } else {
      s.phase = "converged";
    }
  },
  clone(s) {
    return {
      ...s,
      centroids: s.centroids.map((c) => ({ ...c })),
      trails: s.trails.map((t) => t.slice()),
      history: s.history.slice(),
      sizes: s.sizes.slice(),
      empty: s.empty.slice(),
    };
  },
};
