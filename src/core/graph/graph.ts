import { MinHeap } from "../heap";
import { mulberry32 } from "../rng";
import { TraceBuilder } from "../trace";
import type { BaseEvent, Machine, Trace } from "../types";

export type GraphAlgo = "prim" | "kruskal";

export interface GraphNode {
  x: number;
  y: number;
}

export interface GraphInput {
  nodes: GraphNode[];
  edges: [number, number, number][];
  root: number;
  seed: number;
  density: number;
}

export const GRAPH_MIN = 5;
export const GRAPH_MAX = 30;

export const round3 = (v: number) => Math.round(v * 1000) / 1000;

export function edgeWeight(a: GraphNode, b: GraphNode): number {
  return Math.max(1, Math.round(Math.hypot(a.x - b.x, a.y - b.y) * 100));
}

export function makeGraph(n: number, seed: number, density = 3): GraphInput {
  const size = Math.max(GRAPH_MIN, Math.min(GRAPH_MAX, Math.round(n)));
  const rng = mulberry32(seed);
  const nodes: GraphNode[] = [];
  const minGap = 0.5 / Math.sqrt(size);
  let guard = 0;
  while (nodes.length < size && guard++ < 5000) {
    const p = { x: round3(0.06 + rng() * 0.88), y: round3(0.08 + rng() * 0.84) };
    if (nodes.every((q) => Math.hypot(p.x - q.x, p.y - q.y) >= minGap) || guard > 4000)
      nodes.push(p);
  }
  return { nodes, edges: connectEdges(nodes, density), root: 0, seed, density };
}

export function connectEdges(nodes: GraphNode[], density: number): [number, number, number][] {
  const n = nodes.length;
  const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const set = new Map<string, [number, number, number]>();
  const add = (a: number, b: number) => {
    if (a === b) return;
    const k = key(a, b);
    if (!set.has(k)) set.set(k, [Math.min(a, b), Math.max(a, b), edgeWeight(nodes[a], nodes[b])]);
  };
  for (let i = 0; i < n; i++) {
    const near = nodes
      .map((p, j) => ({ j, d: Math.hypot(p.x - nodes[i].x, p.y - nodes[i].y) }))
      .filter((o) => o.j !== i)
      .sort((x, y) => x.d - y.d)
      .slice(0, density);
    for (const o of near) add(i, o.j);
  }
  const parent = nodes.map((_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (const [a, b] of set.values()) parent[find(a)] = find(b);
  for (;;) {
    const roots = new Set(nodes.map((_, i) => find(i)));
    if (roots.size <= 1) break;
    let best: [number, number, number] | null = null;
    for (let a = 0; a < n; a++) {
      for (let b = 0; b < n; b++) {
        if (find(a) === find(b)) continue;
        const d = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y);
        if (!best || d < best[2]) best = [a, b, d];
      }
    }
    if (!best) break;
    add(best[0], best[1]);
    parent[find(best[0])] = find(best[1]);
  }
  return [...set.values()].sort((x, y) => x[0] - y[0] || x[1] - y[1]);
}

export function sortedEdgeOrder(input: GraphInput): number[] {
  return input.edges
    .map((_, i) => i)
    .sort((a, b) => input.edges[a][2] - input.edges[b][2] || a - b);
}

export type GraphEvent = BaseEvent &
  (
    | { k: "tree"; node: number }
    | { k: "push"; edge: number }
    | { k: "consider"; edge: number }
    | { k: "accept"; edge: number; node: number }
    | { k: "reject"; edge: number }
    | { k: "done" }
  );

export function runGraph(input: GraphInput, algo: GraphAlgo): Trace<GraphEvent> {
  const tb = new TraceBuilder<GraphEvent>("tree weight");
  const { nodes, edges } = input;
  const n = nodes.length;
  const label = (e: number) => `${edges[e][0]}–${edges[e][1]} (w ${edges[e][2]})`;
  let total = 0;
  let count = 0;
  tb.checkpoint("Start");

  if (algo === "prim") {
    const inTree = new Uint8Array(n);
    const adj: number[][] = nodes.map(() => []);
    edges.forEach(([a, b], i) => {
      adj[a].push(i);
      adj[b].push(i);
    });
    const heap = new MinHeap<{ e: number; to: number }>(
      (x, y) => edges[x.e][2] < edges[y.e][2] || (edges[x.e][2] === edges[y.e][2] && x.e < y.e),
    );
    const root = Math.min(Math.max(0, input.root), n - 1);
    inTree[root] = 1;
    tb.emit({ k: "tree", node: root, op: "init", note: `Start the tree at node ${root}` });
    for (const e of adj[root]) {
      const to = edges[e][0] === root ? edges[e][1] : edges[e][0];
      heap.push({ e, to });
      tb.emit({ k: "push", edge: e, op: "init", note: `Candidate ${label(e)}` });
    }
    tb.endGroup(0);
    while (heap.size && count < n - 1) {
      const { e, to } = heap.pop()!;
      if (inTree[to]) {
        tb.emit({
          k: "reject",
          edge: e,
          op: "reject",
          note: `Discard ${label(e)}: both ends already in the tree`,
        });
        continue;
      }
      inTree[to] = 1;
      total += edges[e][2];
      count++;
      tb.emit({
        k: "accept",
        edge: e,
        node: to,
        op: "accept",
        note: `Add ${label(e)}, the cheapest edge leaving the tree`,
      });
      for (const x of adj[to]) {
        const other = edges[x][0] === to ? edges[x][1] : edges[x][0];
        if (inTree[other]) continue;
        heap.push({ e: x, to: other });
        tb.emit({ k: "push", edge: x, op: "push", note: `Candidate ${label(x)}` });
      }
      tb.endGroup(total);
      if (count === Math.floor((n - 1) / 2)) tb.checkpoint("Half the tree");
    }
  } else {
    const order = sortedEdgeOrder(input);
    const parent = nodes.map((_, i) => i);
    const size = nodes.map(() => 1);
    const find = (x: number) => {
      while (parent[x] !== x) x = parent[x];
      return x;
    };
    tb.emit({ k: "done", op: "init", note: `Sort ${edges.length} edges by weight` });
    tb.endGroup(0);
    for (const e of order) {
      if (count === n - 1) break;
      const [a, b] = edges[e];
      tb.emit({ k: "consider", edge: e, op: "consider", note: `Next lightest: ${label(e)}` });
      const ra = find(a);
      const rb = find(b);
      if (ra === rb) {
        tb.emit({
          k: "reject",
          edge: e,
          op: "reject",
          note: `Skip ${label(e)}: ${a} and ${b} are already connected`,
        });
        tb.endGroup(total);
        continue;
      }
      const [big, small] = size[ra] >= size[rb] ? [ra, rb] : [rb, ra];
      parent[small] = big;
      size[big] += size[small];
      total += edges[e][2];
      count++;
      tb.emit({
        k: "accept",
        edge: e,
        node: small,
        op: "accept",
        note: `Union: ${label(e)} joins two fragments`,
      });
      tb.endGroup(total);
      if (count === Math.floor((n - 1) / 2)) tb.checkpoint("Half the tree");
    }
  }
  if (count === n - 1) {
    tb.emit({
      k: "done",
      op: "done",
      note: `Spanning tree complete: ${n - 1} edges, total weight ${total}`,
    });
    tb.checkpoint("Spanning tree");
  } else {
    tb.emit({
      k: "done",
      op: "done",
      note:
        algo === "prim"
          ? `Heap empty with ${count + 1} of ${n} nodes in the tree: the rest are unreachable from the root`
          : `Edges exhausted after ${count} of ${n - 1}: the graph is disconnected, so the result is a spanning forest`,
    });
    tb.checkpoint("Disconnected");
  }
  return tb.finish(total);
}

export interface GraphState {
  edges: [number, number, number][];
  edgeState: Uint8Array;
  inTree: Uint8Array;
  uf: Int32Array;
  ufSize: Int32Array;
  candidates: number[];
  current: number;
  total: number;
  treeEdges: number;
  considered: number;
  rejected: number;
  order: number[];
  done: boolean;
}

export const EDGE_IDLE = 0;
export const EDGE_CANDIDATE = 1;
export const EDGE_TREE = 2;
export const EDGE_REJECTED = 3;

export function findRoot(uf: Int32Array, x: number): number {
  while (uf[x] !== x) x = uf[x];
  return x;
}

export const graphMachine: Machine<GraphInput, GraphEvent, GraphState> = {
  init(input) {
    const n = input.nodes.length;
    return {
      edges: input.edges,
      edgeState: new Uint8Array(input.edges.length),
      inTree: new Uint8Array(n),
      uf: Int32Array.from({ length: n }, (_, i) => i),
      ufSize: new Int32Array(n).fill(1),
      candidates: [],
      current: -1,
      total: 0,
      treeEdges: 0,
      considered: 0,
      rejected: 0,
      order: sortedEdgeOrder(input),
      done: false,
    };
  },
  apply(s, e) {
    switch (e.k) {
      case "tree":
        s.inTree[e.node] = 1;
        break;
      case "push":
        s.candidates.push(e.edge);
        if (s.edgeState[e.edge] === EDGE_IDLE) s.edgeState[e.edge] = EDGE_CANDIDATE;
        break;
      case "consider":
        s.current = e.edge;
        s.considered++;
        break;
      case "accept":
      case "reject": {
        s.current = e.edge;
        const i = s.candidates.indexOf(e.edge);
        if (i >= 0) s.candidates.splice(i, 1);
        if (e.k === "reject") {
          if (s.edgeState[e.edge] !== EDGE_TREE) s.edgeState[e.edge] = EDGE_REJECTED;
          s.rejected++;
          break;
        }
        s.edgeState[e.edge] = EDGE_TREE;
        s.treeEdges++;
        {
          const [a, b, w] = s.edges[e.edge];
          s.total += w;
          const ra = findRoot(s.uf, a);
          const rb = findRoot(s.uf, b);
          if (ra !== rb) {
            const [big, small] = s.ufSize[ra] >= s.ufSize[rb] ? [ra, rb] : [rb, ra];
            s.uf[small] = big;
            s.ufSize[big] += s.ufSize[small];
          }
        }
        s.inTree[e.node] = 1;
        break;
      }
      case "done":
        if (e.op === "done") s.done = true;
        break;
    }
  },
  clone(s) {
    return {
      ...s,
      edgeState: s.edgeState.slice(),
      inTree: s.inTree.slice(),
      uf: s.uf.slice(),
      ufSize: s.ufSize.slice(),
      candidates: s.candidates.slice(),
    };
  },
};
