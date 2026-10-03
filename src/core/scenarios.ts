import { defaultExperiment, type Experiment, type GridExp } from "./experiment";
import { makeGraph } from "./graph/graph";
import { makeGrid } from "./grid/terrain";
import type { AlgoId } from "./info";
import { makeRegression } from "./learn/gradient";
import { makeClusters } from "./learn/kmeans";
import { makeSearchInput } from "./search/search";
import { makeSortInput } from "./sort/input";
import { DEFAULT_VIEW } from "./experiment";

export interface Scenario {
  id: string;
  title: string;
  question: string;
  algos: AlgoId[];
  build(compact: boolean): Experiment;
}

const view = () => ({ ...DEFAULT_VIEW });

export const SCENARIOS: Scenario[] = [
  {
    id: "bfs-maze",
    title: "BFS floods a maze",
    question: "Why does breadth-first search always find the fewest moves?",
    algos: ["bfs"],
    build: (compact) => ({
      ...(defaultExperiment("bfs") as GridExp),
      input: makeGrid(compact ? "T" : "M", "maze", 12),
    }),
  },
  {
    id: "astar-vs-dijkstra",
    title: "A* vs Dijkstra",
    question: "Same path cost. How many fewer cells does a heuristic need?",
    algos: ["dijkstra", "astar"],
    build: (compact) => ({
      family: "grid",
      input: makeGrid(compact ? "T" : "M", "scatter", 31),
      a: { algo: "dijkstra", params: { heuristic: "manhattan", weight: 1 } },
      b: { algo: "astar", params: { heuristic: "manhattan", weight: 1 } },
      view: view(),
    }),
  },
  {
    id: "greedy-trap",
    title: "Greedy walks into the trap",
    question: "What happens when a search trusts its heuristic too much?",
    algos: ["greedy", "astar"],
    build: (compact) => ({
      family: "grid",
      input: makeGrid(compact ? "T" : "M", "trap", 4),
      a: { algo: "astar", params: { heuristic: "manhattan", weight: 1 } },
      b: { algo: "greedy", params: { heuristic: "manhattan", weight: 1 } },
      view: view(),
    }),
  },
  {
    id: "weights",
    title: "Weights change the answer",
    question: "BFS and Dijkstra on muddy ground. Which path would you rather walk?",
    algos: ["bfs", "dijkstra"],
    build: (compact) => ({
      family: "grid",
      input: makeGrid(compact ? "T" : "M", "weighted", compact ? 11 : 15),
      a: { algo: "bfs", params: { heuristic: "manhattan", weight: 1 } },
      b: { algo: "dijkstra", params: { heuristic: "manhattan", weight: 1 } },
      view: view(),
    }),
  },
  {
    id: "weighted-astar",
    title: "An overconfident heuristic",
    question: "Multiply h by 3: far fewer cells, but is the path still the cheapest?",
    algos: ["astar"],
    build: (compact) => ({
      family: "grid",
      input: makeGrid(compact ? "T" : "M", "weighted", 3),
      a: { algo: "astar", params: { heuristic: "manhattan", weight: 1 } },
      b: { algo: "astar", params: { heuristic: "manhattan", weight: 3 } },
      view: view(),
    }),
  },
  {
    id: "quick-worst",
    title: "Quicksort's worst case",
    question: "Sorted input and a last-element pivot. Where does O(n log n) go?",
    algos: ["quick"],
    build: (compact) => ({
      family: "sort",
      input: makeSortInput("sorted", compact ? 20 : 32, 3),
      a: { algo: "quick", params: { pivot: "last" } },
      b: { algo: "quick", params: { pivot: "median3" } },
      view: view(),
    }),
  },
  {
    id: "insertion-nearly",
    title: "Insertion sort's best day",
    question: "On nearly sorted data, can a quadratic sort beat merge sort?",
    algos: ["insertion", "merge"],
    build: (compact) => ({
      family: "sort",
      input: makeSortInput("nearly", compact ? 24 : 40, 5),
      a: { algo: "insertion", params: { pivot: "last" } },
      b: { algo: "merge", params: { pivot: "last" } },
      view: view(),
    }),
  },
  {
    id: "n2-vs-nlogn",
    title: "n² against n log n",
    question: "Selection sort vs heapsort on 48 random values.",
    algos: ["selection", "heap"],
    build: () => ({
      family: "sort",
      input: makeSortInput("random", 48, 9),
      a: { algo: "selection", params: { pivot: "last" } },
      b: { algo: "heap", params: { pivot: "last" } },
      view: view(),
    }),
  },
  {
    id: "binary-search",
    title: "Eight probes for 128 values",
    question: "Linear search checks everything. Binary search halves the problem.",
    algos: ["linear", "binary"],
    build: () => ({
      family: "search",
      input: makeSearchInput(128, "last", 2),
      a: { algo: "linear", params: {} },
      b: { algo: "binary", params: {} },
      view: view(),
    }),
  },
  {
    id: "mst",
    title: "Prim and Kruskal agree",
    question: "One grows a tree, the other merges fragments. Same total weight?",
    algos: ["prim", "kruskal"],
    build: (compact) => ({
      family: "graph",
      input: makeGraph(compact ? 12 : 20, 14),
      a: { algo: "prim", params: {} },
      b: { algo: "kruskal", params: {} },
      view: view(),
    }),
  },
  {
    id: "kmeans-init",
    title: "Bad starting centroids",
    question: "k-means always converges. Does it always converge to the right answer?",
    algos: ["kmeans"],
    build: () => ({
      family: "learn",
      model: "kmeans",
      input: makeClusters("blobs", 200, 11),
      a: { algo: "kmeans", params: { k: 4, init: "plusplus", manual: [] } },
      b: { algo: "kmeans", params: { k: 4, init: "corner", manual: [] } },
      view: view(),
    }),
  },
  {
    id: "kmeans-moons",
    title: "k-means can't see moons",
    question: "Clusters that are not round break the distance-to-centroid rule.",
    algos: ["kmeans"],
    build: () => ({
      family: "learn",
      model: "kmeans",
      input: makeClusters("moons", 220, 3),
      a: { algo: "kmeans", params: { k: 2, init: "plusplus", manual: [] } },
      b: null,
      view: view(),
    }),
  },
  {
    id: "lr-too-high",
    title: "Learning rate too high",
    question: "0.6 settles into the valley. 0.85 bounces out of it.",
    algos: ["gradient"],
    build: () => ({
      family: "learn",
      model: "gradient",
      input: makeRegression("linear", 60, 4),
      a: { algo: "gradient", params: { lr: 0.6, beta: 0, m0: -1, b0: 1, steps: 80 } },
      b: { algo: "gradient", params: { lr: 0.85, beta: 0, m0: -1, b0: 1, steps: 80 } },
      view: view(),
    }),
  },
  {
    id: "momentum",
    title: "Momentum in a narrow valley",
    question: "Plain descent zig-zags. A running velocity cuts straight through.",
    algos: ["gradient"],
    build: () => ({
      family: "learn",
      model: "gradient",
      input: makeRegression("valley", 60, 6),
      a: { algo: "gradient", params: { lr: 0.55, beta: 0, m0: -1, b0: 1, steps: 120 } },
      b: { algo: "gradient", params: { lr: 0.3, beta: 0.8, m0: -1, b0: 1, steps: 120 } },
      view: view(),
    }),
  },
];

export function getScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
