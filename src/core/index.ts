import type { AlgorithmInfo, GridModel } from "./types";

export * from "./types";
export * from "./pathfinding";
export * from "./sorting";
export * from "./learning";

export const ALGORITHMS: AlgorithmInfo[] = [
  {
    id: "bfs",
    family: "pathfinding",
    name: "Breadth-first search",
    meta: "Unweighted · O(V + E)",
    blurb: "Explores in rings; shortest path on unweighted grids.",
    pseudocode: [
      "queue ← [start]",
      "while queue not empty:",
      "  cur ← dequeue()",
      "  mark cur visited",
      "  for n in neighbors(cur):",
      "    enqueue(n); came_from[n] ← cur",
      "  if cur = target:",
      "    return reconstruct(came_from)",
    ],
  },
  {
    id: "dfs",
    family: "pathfinding",
    name: "Depth-first search",
    meta: "Unweighted · O(V + E)",
    blurb: "Dives deep before backtracking; not shortest-path.",
    pseudocode: [
      "stack ← [start]",
      "while stack not empty:",
      "  cur ← pop()",
      "  mark cur visited",
      "  for n in neighbors(cur):",
      "    push(n); came_from[n] ← cur",
      "  if cur = target:",
      "    return reconstruct(came_from)",
    ],
  },
  {
    id: "dijkstra",
    family: "pathfinding",
    name: "Dijkstra",
    meta: "Weighted · O(E log V)",
    blurb: "Cheapest-cost frontier; respects cell weights.",
    pseudocode: [
      "dist[start] ← 0",
      "while open not empty:",
      "  cur ← min-dist node",
      "  mark cur visited",
      "  for n in neighbors(cur):",
      "    alt ← dist[cur] + cost(n)",
      "    if alt < dist[n]: relax n",
      "  if cur = target:",
      "    return reconstruct(came_from)",
    ],
  },
  {
    id: "astar",
    family: "pathfinding",
    name: "A* search",
    meta: "Weighted · O(E log V)",
    blurb: "Dijkstra guided by a Manhattan heuristic.",
    pseudocode: [
      "g[start] ← 0",
      "while open not empty:",
      "  cur ← min (g + h) node",
      "  mark cur visited",
      "  for n in neighbors(cur):",
      "    alt ← g[cur] + cost(n)",
      "    if alt < g[n]: relax n",
      "  if cur = target:",
      "    return reconstruct(came_from)",
    ],
  },
  {
    id: "insertion",
    family: "sorting",
    name: "Insertion sort",
    meta: "O(n²) · stable",
    blurb: "Grows a sorted prefix one element at a time.",
    pseudocode: [
      "for i in 1..n:",
      "  j ← i",
      "  while j > 0 and a[j-1] > a[j]:",
      "    swap(j-1, j); j ← j - 1",
    ],
  },
  {
    id: "selection",
    family: "sorting",
    name: "Selection sort",
    meta: "O(n²) · in-place",
    blurb: "Repeatedly selects the minimum of the rest.",
    pseudocode: [
      "for i in 0..n:",
      "  min ← i",
      "  for j in i+1..n:",
      "    if a[j] < a[min]: min ← j",
      "  swap(i, min)",
    ],
  },
  {
    id: "bubble",
    family: "sorting",
    name: "Bubble sort",
    meta: "O(n²) · stable",
    blurb: "Bubbles the largest value to the end each pass.",
    pseudocode: [
      "for i in 0..n-1:",
      "  for j in 0..n-1-i:",
      "    if a[j] > a[j+1]:",
      "      swap(j, j+1)",
      "  mark a[n-1-i] sorted",
    ],
  },
  {
    id: "quick",
    family: "sorting",
    name: "Quicksort",
    meta: "O(n log n) avg",
    blurb: "Partitions around a pivot, then recurses.",
    pseudocode: [
      "quicksort(lo, hi):",
      "  pivot ← a[hi]",
      "  partition so a[<i] < pivot",
      "  swap(i, hi)",
      "  quicksort(lo, i-1)",
      "  quicksort(i+1, hi)",
    ],
  },
  {
    id: "kmeans",
    family: "learning",
    name: "k-means clustering",
    meta: "Unsupervised · Lloyd's",
    blurb: "Assigns points to centroids, then moves the centroids.",
    pseudocode: [
      "init k centroids (k-means++)",
      "repeat:",
      "  assign each point to nearest centroid",
      "  move centroid to cluster mean",
      "until assignments stop changing",
    ],
  },
  {
    id: "gradient",
    family: "learning",
    name: "Gradient descent",
    meta: "Supervised · linear fit",
    blurb: "Fits y = mx + b by descending the loss gradient.",
    pseudocode: [
      "m, b ← 0, 0",
      "repeat for each step:",
      "  predict ŷ = m·x + b",
      "  gradient ← ∂(MSE)/∂(m, b)",
      "  m, b ← m, b − lr · gradient",
    ],
  },
];

export function getAlgorithm(id: string): AlgorithmInfo {
  const found = ALGORITHMS.find((a) => a.id === id);
  if (!found) throw new Error(`Unknown algorithm: ${id}`);
  return found;
}

export function algorithmsByFamily(family: string): AlgorithmInfo[] {
  return ALGORITHMS.filter((a) => a.family === family);
}

export function createGrid(width = 34, height = 20): GridModel {
  const midRow = Math.floor(height / 2);
  return {
    width,
    height,
    start: midRow * width + Math.floor(width / 5),
    target: midRow * width + width - Math.floor(width / 5) - 1,
    walls: new Set(),
    weights: new Map(),
  };
}
