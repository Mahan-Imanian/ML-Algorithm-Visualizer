import { bench, describe } from "vitest";
import { DEFAULT_VIEW, runVariant, type Experiment } from "../experiment";
import type { GridAlgo } from "../grid/algorithms";
import { makeGrid } from "../grid/terrain";
import { GRAPH_DENSITY, GRAPH_MAX, makeGraph } from "../graph/graph";
import { GRADIENT_LIMITS, makeRegression, REGRESSION_POINTS } from "../learn/gradient";
import { CLUSTER_POINTS, K_RANGE, makeClusters } from "../learn/kmeans";
import { makeSearchInput, SEARCH_MAX } from "../search/search";
import type { SortAlgo } from "../sort/algorithms";
import { makeSortInput, SORT_MAX } from "../sort/input";

const SEED = 7;
const view = { ...DEFAULT_VIEW };
const record = (exp: Experiment) => () => {
  runVariant(exp, "a");
};

describe("record a run: trace plus keyframes, largest inputs", () => {
  const mud = makeGrid("L", "weighted", SEED, true);
  for (const algo of ["bfs", "dfs", "dijkstra", "astar", "greedy"] as GridAlgo[]) {
    const params = { heuristic: "octile", weight: 1 } as const;
    bench(
      `grid 61×37 mud, diagonal, ${algo}`,
      record({ family: "grid", input: mud, a: { algo, params }, b: null, view }),
    );
  }
  bench(
    "grid 61×37 maze, bfs",
    record({
      family: "grid",
      input: makeGrid("L", "maze", SEED),
      a: { algo: "bfs", params: { heuristic: "manhattan", weight: 1 } },
      b: null,
      view,
    }),
  );

  const reversed = makeSortInput("reversed", SORT_MAX, SEED);
  for (const algo of ["insertion", "selection", "bubble", "quick", "merge", "heap"] as SortAlgo[])
    bench(
      `sort ${SORT_MAX} reversed, ${algo}`,
      record({
        family: "sort",
        input: reversed,
        a: { algo, params: { pivot: "last" } },
        b: null,
        view,
      }),
    );

  const absent = makeSearchInput(SEARCH_MAX, "absent", SEED);
  for (const algo of ["linear", "binary", "jump"] as const)
    bench(
      `search ${SEARCH_MAX} absent, ${algo}`,
      record({ family: "search", input: absent, a: { algo, params: {} }, b: null, view }),
    );

  const graph = makeGraph(GRAPH_MAX, SEED, GRAPH_DENSITY.max);
  for (const algo of ["prim", "kruskal"] as const)
    bench(
      `graph ${GRAPH_MAX} nodes, ${GRAPH_DENSITY.max} edges per node, ${algo}`,
      record({ family: "graph", input: graph, a: { algo, params: {} }, b: null, view }),
    );

  const cloud = makeClusters("uniform", CLUSTER_POINTS.max, SEED);
  for (const init of ["plusplus", "random"] as const)
    bench(
      `k-means ${CLUSTER_POINTS.max} points, k ${K_RANGE.max}, ${init}`,
      record({
        family: "learn",
        model: "kmeans",
        input: cloud,
        a: { algo: "kmeans", params: { k: K_RANGE.max, init, manual: [] } },
        b: null,
        view,
      }),
    );

  bench(
    `gradient ${REGRESSION_POINTS.max} points, ${GRADIENT_LIMITS.steps.max} steps`,
    record({
      family: "learn",
      model: "gradient",
      input: makeRegression("valley", REGRESSION_POINTS.max, SEED),
      a: {
        algo: "gradient",
        params: { lr: 0.3, beta: 0.5, m0: -1, b0: 1, steps: GRADIENT_LIMITS.steps.max },
      },
      b: null,
      view,
    }),
  );
});

describe("seek to a random step", () => {
  const run = runVariant(
    {
      family: "grid",
      input: makeGrid("L", "weighted", SEED, true),
      a: { algo: "dijkstra", params: { heuristic: "octile", weight: 1 } },
      b: null,
      view,
    },
    "a",
  )!;
  const n = run.trace.events.length;
  let i = 0;
  bench(`grid 61×37 mud, dijkstra, ${n} events`, () => {
    i = (i * 7919 + 104729) % (n + 1);
    run.player.at(i);
  });
});
