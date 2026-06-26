import { describe, it, expect } from "vitest";
import { runKMeans, runGradientDescent, makeLinear, mulberry32 } from "../index";
import type { Point } from "../learning";

function twoClusters(): { points: Point[]; aCount: number } {
  const rng = mulberry32(11);
  const pts: Point[] = [];
  for (let i = 0; i < 30; i++) pts.push({ x: 0.2 + (rng() - 0.5) * 0.1, y: 0.2 + (rng() - 0.5) * 0.1 });
  const aCount = pts.length;
  for (let i = 0; i < 30; i++) pts.push({ x: 0.8 + (rng() - 0.5) * 0.1, y: 0.8 + (rng() - 0.5) * 0.1 });
  return { points: pts, aCount };
}

describe("k-means", () => {
  it("separates two obvious clusters", () => {
    const { points, aCount } = twoClusters();
    const frames = runKMeans(points, 2, 7);
    const final = frames.at(-1)!;
    const labelA = final.assignments[0];
    const labelB = final.assignments[aCount];
    expect(labelA).not.toBe(labelB);
    for (let i = 0; i < aCount; i++) expect(final.assignments[i]).toBe(labelA);
    for (let i = aCount; i < points.length; i++) expect(final.assignments[i]).toBe(labelB);
  });

  it("inertia never increases across the trace", () => {
    const { points } = twoClusters();
    const frames = runKMeans(points, 2, 7);
    for (let i = 1; i < frames.length; i++) {
      expect(frames[i].inertia).toBeLessThanOrEqual(frames[i - 1].inertia + 1e-9);
    }
  });
});

describe("gradient descent", () => {
  it("recovers a known line y = 2x + 1", () => {
    const points = makeLinear(3, 60, 2, 1);
    const final = runGradientDescent(points, 0.3, 800).at(-1)!;
    expect(final.m).toBeCloseTo(2, 1);
    expect(final.b).toBeCloseTo(1, 1);
  });

  it("loss is monotonically non-increasing", () => {
    const points = makeLinear(3, 60, 2, 1);
    const frames = runGradientDescent(points, 0.3, 800);
    for (let i = 1; i < frames.length; i++) {
      expect(frames[i].loss).toBeLessThanOrEqual(frames[i - 1].loss + 1e-9);
    }
  });
});
