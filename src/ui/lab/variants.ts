import { defaultParams, type AnyVariant, type Experiment } from "@/core/experiment";
import type { GridParams } from "@/core/grid/algorithms";
import { makeGrid } from "@/core/grid/terrain";
import { makeGraph } from "@/core/graph/graph";
import type { AlgoId } from "@/core/info";
import { makeRegression, type GradientParams } from "@/core/learn/gradient";
import { makeClusters, type KMeansParams } from "@/core/learn/kmeans";
import { makeSearchInput } from "@/core/search/search";
import type { SortParams } from "@/core/sort/algorithms";
import { makeSortInput } from "@/core/sort/input";

export function hasSettings(id: AlgoId) {
  return ["astar", "greedy", "quick", "kmeans", "gradient"].includes(id);
}

export function tweak(id: AlgoId, p: AnyVariant["params"]): AnyVariant["params"] {
  if (id === "astar")
    return { ...(p as GridParams), weight: (p as GridParams).weight === 1 ? 3 : 1 };
  if (id === "greedy")
    return {
      ...(p as GridParams),
      heuristic: (p as GridParams).heuristic === "euclidean" ? "manhattan" : "euclidean",
    };
  if (id === "quick") return { pivot: (p as SortParams).pivot === "median3" ? "last" : "median3" };
  if (id === "kmeans")
    return {
      ...(p as KMeansParams),
      init: (p as KMeansParams).init === "corner" ? "plusplus" : "corner",
      manual: [],
    };
  if (id === "gradient")
    return { ...(p as GradientParams), lr: (p as GradientParams).lr >= 0.8 ? 0.3 : 0.85 };
  return p;
}

const PARTNER: Partial<Record<AlgoId, AlgoId>> = {
  bfs: "dijkstra",
  dfs: "bfs",
  dijkstra: "astar",
  astar: "dijkstra",
  greedy: "astar",
  insertion: "merge",
  selection: "heap",
  bubble: "insertion",
  quick: "merge",
  merge: "quick",
  heap: "quick",
  linear: "binary",
  binary: "linear",
  jump: "binary",
  prim: "kruskal",
  kruskal: "prim",
};

export function suggestB(exp: Experiment): AnyVariant {
  const partner = PARTNER[exp.a.algo];
  if (partner)
    return {
      algo: partner,
      params: defaultParams(partner, exp.family === "grid" && exp.input.diagonal),
    } as AnyVariant;
  return { algo: exp.a.algo, params: tweak(exp.a.algo, exp.a.params) } as AnyVariant;
}

export function regenerate(e: Experiment, seed: number): Experiment {
  switch (e.family) {
    case "grid":
      return {
        ...e,
        input: makeGrid(
          e.input.size,
          e.input.terrain === "custom" ? "scatter" : e.input.terrain,
          seed,
          e.input.diagonal,
        ),
      };
    case "sort":
      return {
        ...e,
        input: makeSortInput(
          e.input.preset === "custom" ? "random" : e.input.preset,
          e.input.values.length,
          seed,
        ),
      };
    case "search":
      return { ...e, input: makeSearchInput(e.input.values.length, e.input.mode, seed) };
    case "graph":
      return { ...e, input: makeGraph(e.input.nodes.length, seed, e.input.density) };
    case "learn":
      return e.model === "kmeans"
        ? { ...e, input: makeClusters(e.input.dataset, e.input.n, seed) }
        : { ...e, input: makeRegression(e.input.dataset, e.input.n, seed) };
  }
}
