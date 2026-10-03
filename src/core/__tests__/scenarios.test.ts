import { describe, expect, it } from "vitest";
import { runVariant, type Run } from "../experiment";
import { getScenario } from "../scenarios";

function end<R extends Run>(run: R): ReturnType<R["player"]["at"]>["state"] {
  return run.player.at(run.trace.events.length).state as ReturnType<R["player"]["at"]>["state"];
}

function pair(id: string, compact: boolean) {
  const exp = getScenario(id)!.build(compact);
  return [runVariant(exp, "a")!, runVariant(exp, "b")!] as const;
}

describe("prepared experiments demonstrate what their titles claim", () => {
  for (const compact of [false, true]) {
    const tag = compact ? " (phone)" : "";
    it(`A* matches Dijkstra's cost with fewer expansions${tag}`, () => {
      const [d, a] = pair("astar-vs-dijkstra", compact);
      if (d.family !== "grid" || a.family !== "grid") throw new Error("grid");
      expect(end(a).pathCost).toBeCloseTo(end(d).pathCost, 6);
      expect(end(a).expanded).toBeLessThan(end(d).expanded);
    });
    it(`greedy pays more than A* in the trap${tag}`, () => {
      const [a, g] = pair("greedy-trap", compact);
      if (a.family !== "grid" || g.family !== "grid") throw new Error("grid");
      expect(end(g).pathCost).toBeGreaterThan(end(a).pathCost);
    });
    it(`BFS walks a costlier path than Dijkstra on mud${tag}`, () => {
      const [b, d] = pair("weights", compact);
      if (b.family !== "grid" || d.family !== "grid") throw new Error("grid");
      expect(end(b).pathCost).toBeGreaterThan(end(d).pathCost * 1.5);
    });
    it(`weighted A* is faster but costlier${tag}`, () => {
      const [a, w] = pair("weighted-astar", compact);
      if (a.family !== "grid" || w.family !== "grid") throw new Error("grid");
      expect(end(w).expanded).toBeLessThan(end(a).expanded);
      expect(end(w).pathCost).toBeGreaterThanOrEqual(end(a).pathCost);
    });
    it(`median-of-three rescues quicksort on sorted input${tag}`, () => {
      const [last, med] = pair("quick-worst", compact);
      if (last.family !== "sort" || med.family !== "sort") throw new Error("sort");
      expect(end(med).compares).toBeLessThan(end(last).compares / 2);
    });
    it(`insertion sort beats merge sort on nearly sorted data${tag}`, () => {
      const [ins, mer] = pair("insertion-nearly", compact);
      if (ins.family !== "sort" || mer.family !== "sort") throw new Error("sort");
      expect(end(ins).compares).toBeLessThan(end(mer).compares);
    });
  }

  it("binary search uses eight probes on 128 values", () => {
    const [lin, bin] = pair("binary-search", false);
    if (lin.family !== "search" || bin.family !== "search") throw new Error("search");
    expect(end(bin).probes).toBe(8);
    expect(end(lin).probes).toBe(128);
  });

  it("Prim and Kruskal agree on the tree weight", () => {
    const [p, k] = pair("mst", false);
    if (p.family !== "graph" || k.family !== "graph") throw new Error("graph");
    expect(end(p).total).toBe(end(k).total);
  });

  it("the corner start ends in a worse clustering", () => {
    const [good, bad] = pair("kmeans-init", false);
    if (good.family !== "kmeans" || bad.family !== "kmeans") throw new Error("kmeans");
    expect(end(bad).inertia!).toBeGreaterThan(end(good).inertia! * 1.2);
  });

  it("the high learning rate diverges and momentum wins the valley", () => {
    const [, high] = pair("lr-too-high", false);
    if (high.family !== "gradient") throw new Error("gradient");
    expect(end(high).phase).toBe("diverged");
    const [plain, mom] = pair("momentum", false);
    if (plain.family !== "gradient" || mom.family !== "gradient") throw new Error("gradient");
    expect(end(mom).loss).toBeLessThan(end(plain).loss);
  });
});
