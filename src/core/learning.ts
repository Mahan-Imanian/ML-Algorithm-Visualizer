import type { KMeansFrame, GradientFrame } from "./types";

export interface Point {
  x: number;
  y: number;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dist2 = (a: Point, b: Point) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export function makeClusters(seed = 7, perCluster = 40): Point[] {
  const rng = mulberry32(seed);
  const centers: Point[] = [
    { x: 0.25, y: 0.3 },
    { x: 0.75, y: 0.7 },
    { x: 0.3, y: 0.8 },
  ];
  const pts: Point[] = [];
  for (const c of centers) {
    for (let i = 0; i < perCluster; i++) {
      pts.push({ x: c.x + (rng() - 0.5) * 0.18, y: c.y + (rng() - 0.5) * 0.18 });
    }
  }
  return pts;
}

export function runKMeans(points: Point[], k = 3, seed = 7, maxIter = 12): KMeansFrame[] {
  const rng = mulberry32(seed);
  const centroids: Point[] = [points[Math.floor(rng() * points.length)]];
  while (centroids.length < k) {
    const d = points.map((p) => Math.min(...centroids.map((c) => dist2(p, c))));
    const total = d.reduce((s, v) => s + v, 0);
    let r = rng() * total;
    let idx = 0;
    while (r > 0 && idx < points.length - 1) r -= d[idx++];
    centroids.push(points[idx]);
  }

  const frames: KMeansFrame[] = [];
  let prev: number[] = [];
  for (let iter = 0; iter < maxIter; iter++) {
    const assignments = points.map((p) => {
      let best = 0;
      let bd = Infinity;
      centroids.forEach((c, ci) => {
        const dd = dist2(p, c);
        if (dd < bd) {
          bd = dd;
          best = ci;
        }
      });
      return best;
    });

    for (let ci = 0; ci < k; ci++) {
      const members = points.filter((_, i) => assignments[i] === ci);
      if (members.length) {
        centroids[ci] = {
          x: members.reduce((s, p) => s + p.x, 0) / members.length,
          y: members.reduce((s, p) => s + p.y, 0) / members.length,
        };
      }
    }

    const inertia = points.reduce((s, p, i) => s + dist2(p, centroids[assignments[i]]), 0);
    frames.push({
      kind: "kmeans",
      points: points.map((p) => ({ ...p })),
      assignments: [...assignments],
      centroids: centroids.map((c) => ({ ...c })),
      iteration: iter,
      inertia,
      note: `Iteration ${iter + 1} · inertia ${inertia.toFixed(3)}`,
      line: 3,
    });

    if (prev.length && assignments.every((a, i) => a === prev[i])) break;
    prev = assignments;
  }
  return frames;
}

export function makeLinear(seed = 3, n = 40, m = 2, b = 1): Point[] {
  const rng = mulberry32(seed);
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const x = rng();
    pts.push({ x, y: m * x + b + (rng() - 0.5) * 0.1 });
  }
  return pts;
}

export function runGradientDescent(points: Point[], lr = 0.1, steps = 200): GradientFrame[] {
  let m = 0;
  let b = 0;
  const n = points.length;
  const frames: GradientFrame[] = [];
  const loss = () => points.reduce((s, p) => s + (p.y - (m * p.x + b)) ** 2, 0) / n;

  for (let i = 0; i < steps; i++) {
    let gm = 0;
    let gb = 0;
    for (const p of points) {
      const err = m * p.x + b - p.y;
      gm += (2 / n) * err * p.x;
      gb += (2 / n) * err;
    }
    m -= lr * gm;
    b -= lr * gb;
    const l = loss();
    frames.push({
      kind: "gradient",
      points: points.map((p) => ({ ...p })),
      m,
      b,
      loss: l,
      iteration: i,
      note: `Step ${i + 1} · loss ${l.toFixed(4)} · y = ${m.toFixed(2)}x + ${b.toFixed(2)}`,
      line: 4,
    });
  }
  return frames;
}
