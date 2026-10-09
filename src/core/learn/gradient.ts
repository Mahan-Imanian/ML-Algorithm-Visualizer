import { gaussian, mulberry32 } from "../rng";
import { TraceBuilder } from "../trace";
import type { BaseEvent, Machine, Range, Trace } from "../types";
import type { Point } from "./kmeans";

export type RegressionData = "linear" | "outliers" | "valley";

export interface RegressionInput {
  points: Point[];
  dataset: RegressionData;
  n: number;
  seed: number;
}

export interface GradientParams {
  lr: number;
  beta: number;
  m0: number;
  b0: number;
  steps: number;
}

export const DEFAULT_GRADIENT_PARAMS: GradientParams = {
  lr: 0.6,
  beta: 0,
  m0: -1,
  b0: 1,
  steps: 80,
};

export const GRADIENT_LIMITS: Record<keyof GradientParams, Range> = {
  lr: { min: 0.01, max: 1.5, step: 0.01 },
  beta: { min: 0, max: 0.95, step: 0.05 },
  m0: { min: -1.5, max: 2.3, step: 0.1 },
  b0: { min: -1, max: 1.4, step: 0.1 },
  steps: { min: 10, max: 300, step: 10 },
};

export const REGRESSION_POINTS: Range = { min: 10, max: 200, step: 5 };
export const DEFAULT_REGRESSION_POINTS = 60;

export const REGRESSION_DATASETS: { id: RegressionData; label: string; hint: string }[] = [
  { id: "linear", label: "Clean line", hint: "A straight trend with light noise." },
  { id: "outliers", label: "With outliers", hint: "Four points far off the line pull the fit." },
  {
    id: "valley",
    label: "Narrow valley",
    hint: "x is far from 0, so the m and b gradients are strongly coupled. Plain descent zig-zags.",
  },
];

export const M_RANGE: [number, number] = [-1.6, 2.4];
export const B_RANGE: [number, number] = [-1.1, 1.5];

export function makeRegression(dataset: RegressionData, n: number, seed: number): RegressionInput {
  const rng = mulberry32(seed);
  const size = Math.max(REGRESSION_POINTS.min, Math.min(REGRESSION_POINTS.max, Math.round(n)));
  const points: Point[] = [];
  const lo = dataset === "valley" ? 0.62 : 0.05;
  const hi = dataset === "valley" ? 0.98 : 0.95;
  const m = 0.7;
  const b = dataset === "valley" ? -0.15 : 0.15;
  for (let i = 0; i < size; i++) {
    const x = lo + rng() * (hi - lo);
    points.push({ x, y: Math.min(0.98, Math.max(0.02, m * x + b + gaussian(rng) * 0.04)) });
  }
  if (dataset === "outliers") {
    for (let i = 0; i < 4; i++) points[i] = { x: 0.15 + i * 0.07, y: 0.88 - i * 0.03 };
  }
  return { points, dataset, n: size, seed };
}

export function lossAt(points: Point[], m: number, b: number): number {
  let s = 0;
  for (const p of points) s += (m * p.x + b - p.y) ** 2;
  return s / points.length;
}

export function bestFit(points: Point[]): { m: number; b: number } {
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  const m = den ? num / den : 0;
  return { m, b: my - m * mx };
}

export type GradientEvent = BaseEvent &
  (
    | { k: "start"; m: number; b: number; loss: number }
    | { k: "gradient"; gm: number; gb: number; loss: number }
    | { k: "update"; m: number; b: number; vm: number; vb: number; loss: number }
    | { k: "diverged" }
  );

const fx = (v: number) => (Math.abs(v) >= 1000 ? v.toExponential(1) : v.toFixed(3));

export function runGradient(input: RegressionInput, params: GradientParams): Trace<GradientEvent> {
  const { points } = input;
  const n = points.length;
  const tb = new TraceBuilder<GradientEvent>("loss");
  let m = params.m0;
  let b = params.b0;
  let vm = 0;
  let vb = 0;
  const { min, max } = GRADIENT_LIMITS.steps;
  const steps = Math.max(min, Math.min(max, Math.round(params.steps)));
  const opt = bestFit(points);
  const minLoss = lossAt(points, opt.m, opt.b);
  let loss = lossAt(points, m, b);
  tb.checkpoint("Start");
  tb.emit({
    k: "start",
    m,
    b,
    loss,
    op: "init",
    note: `Start at m = ${fx(m)}, b = ${fx(b)} · loss ${fx(loss)}`,
  });
  tb.endGroup(loss);
  let near = false;
  for (let i = 0; i < steps; i++) {
    let gm = 0;
    let gb = 0;
    for (const p of points) {
      const err = m * p.x + b - p.y;
      gm += (2 / n) * err * p.x;
      gb += (2 / n) * err;
    }
    tb.emit({
      k: "gradient",
      gm,
      gb,
      loss,
      op: "gradient",
      note: `Step ${i + 1}: gradient (${fx(gm)}, ${fx(gb)})`,
    });
    vm = params.beta * vm + gm;
    vb = params.beta * vb + gb;
    m -= params.lr * vm;
    b -= params.lr * vb;
    loss = lossAt(points, m, b);
    if (!Number.isFinite(loss) || loss > 1e6 || Math.abs(m) > 1e4 || Math.abs(b) > 1e4) {
      tb.emit({
        k: "diverged",
        op: "diverged",
        note: `Diverged at step ${i + 1}: each step overshoots further than the last`,
      });
      tb.checkpoint("Diverged");
      return tb.finish(loss);
    }
    tb.emit({
      k: "update",
      m,
      b,
      vm,
      vb,
      loss,
      op: "update",
      note: `Update: m = ${fx(m)}, b = ${fx(b)} · loss ${fx(loss)}`,
    });
    tb.endGroup(loss);
    if (!near && loss - minLoss < 0.01 * Math.max(minLoss, 1e-4) + 1e-4) {
      near = true;
      tb.checkpoint("Within 1% of best fit");
    }
  }
  tb.checkpoint("Final step");
  return tb.finish(loss);
}

export interface GradientState {
  points: Point[];
  m: number;
  b: number;
  gm: number;
  gb: number;
  vm: number;
  vb: number;
  loss: number;
  step: number;
  path: { m: number; b: number; loss: number }[];
  phase: "start" | "gradient" | "update" | "diverged";
}

export type GradientStart = RegressionInput & Pick<GradientParams, "m0" | "b0">;

export const gradientMachine: Machine<GradientStart, GradientEvent, GradientState> = {
  init(input) {
    return {
      points: input.points,
      m: input.m0,
      b: input.b0,
      gm: 0,
      gb: 0,
      vm: 0,
      vb: 0,
      loss: lossAt(input.points, input.m0, input.b0),
      step: 0,
      path: [],
      phase: "start",
    };
  },
  apply(s, e) {
    if (e.k === "start") {
      s.m = e.m;
      s.b = e.b;
      s.loss = e.loss;
      s.path = [{ m: e.m, b: e.b, loss: e.loss }];
      s.phase = "start";
    } else if (e.k === "gradient") {
      s.gm = e.gm;
      s.gb = e.gb;
      s.phase = "gradient";
    } else if (e.k === "update") {
      s.m = e.m;
      s.b = e.b;
      s.vm = e.vm;
      s.vb = e.vb;
      s.loss = e.loss;
      s.step++;
      s.path.push({ m: e.m, b: e.b, loss: e.loss });
      s.phase = "update";
    } else {
      s.phase = "diverged";
    }
  },
  clone(s) {
    return { ...s, path: s.path.slice() };
  },
};
