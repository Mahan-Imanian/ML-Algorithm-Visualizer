import { describe, expect, it } from "vitest";
import { compareInsights, DEFAULT_VIEW, runVariant, type Experiment } from "../experiment";
import { runGrid, type GridAlgo, type GridParams } from "../grid/algorithms";
import { gridMachine } from "../grid/machine";
import type { GridInput, GridSize, Heuristic } from "../grid/model";
import { makeGrid } from "../grid/terrain";
import { EDGE_TREE, graphMachine, runGraph, type GraphInput } from "../graph/graph";
import { getAlgo } from "../info";
import {
  gradientMachine,
  makeRegression,
  runGradient,
  type RegressionData,
} from "../learn/gradient";
import {
  kmeansMachine,
  makeClusters,
  runKMeans,
  type ClusterData,
  type KInit,
  type Point,
} from "../learn/kmeans";
import { Player } from "../player";
import { mulberry32 } from "../rng";
import { runSearch, searchMachine, type SearchAlgo, type SearchInput } from "../search/search";
import { runSort, type PivotRule, type SortAlgo } from "../sort/algorithms";
import type { SortInput } from "../sort/input";
import { sortMachine } from "../sort/machine";

const int = (rng: () => number, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));

function randomGrid(seed: number): GridInput {
  const rng = mulberry32(seed);
  const w = int(rng, 1, 16);
  const h = int(rng, 1, 12);
  const n = w * h;
  const walls = rng() * 0.45;
  const weighted = rng() < 0.5;
  const cells = Uint8Array.from({ length: n }, () =>
    rng() < walls ? 0 : weighted ? int(rng, 1, 9) : 1,
  );
  const start = int(rng, 0, n - 1);
  const target = rng() < 0.1 ? start : int(rng, 0, n - 1);
  cells[start] = cells[start] || 1;
  cells[target] = cells[target] || 1;
  return {
    w,
    h,
    cells,
    start,
    target,
    diagonal: seed % 2 === 0,
    terrain: "custom",
    seed,
    size: "S",
  };
}

const GRIDS: GridInput[] = [
  ...Array.from({ length: 160 }, (_, i) => randomGrid(i + 1)),
  ...(["S", "M", "L", "T"] as GridSize[]).flatMap((size, i) =>
    (["open", "maze", "rooms", "scatter", "weighted", "trap"] as const).flatMap((terrain) =>
      [false, true].map((diagonal) => makeGrid(size, terrain, 11 + i, diagonal)),
    ),
  ),
];

function moves(g: GridInput, cell: number): [number, number][] {
  const r = Math.floor(cell / g.w);
  const c = cell % g.w;
  const free = (rr: number, cc: number) =>
    rr >= 0 && rr < g.h && cc >= 0 && cc < g.w && g.cells[rr * g.w + cc] > 0;
  const out: [number, number][] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const diag = dr !== 0 && dc !== 0;
      if ((!dr && !dc) || (diag && !g.diagonal) || !free(r + dr, c + dc)) continue;
      if (diag && !(free(r + dr, c) && free(r, c + dc))) continue;
      const to = (r + dr) * g.w + c + dc;
      out.push([to, g.cells[to] * (diag ? Math.SQRT2 : 1)]);
    }
  }
  return out;
}

function distances(g: GridInput, weighted: boolean): Float64Array {
  const n = g.w * g.h;
  const dist = new Float64Array(n).fill(Infinity);
  const done = new Uint8Array(n);
  dist[g.start] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++)
      if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0) return dist;
    done[u] = 1;
    for (const [v, cost] of moves(g, u))
      dist[v] = Math.min(dist[v], dist[u] + (weighted ? cost : 1));
  }
}

function walk(g: GridInput, path: number[]): number {
  if (path[0] !== g.start || path[path.length - 1] !== g.target) return NaN;
  let cost = 0;
  for (let i = 1; i < path.length; i++) {
    const step = moves(g, path[i - 1]).find(([to]) => to === path[i]);
    if (!step) return NaN;
    cost += step[1];
  }
  return cost;
}

function solve(g: GridInput, algo: GridAlgo, params: GridParams) {
  const trace = runGrid(g, algo, params);
  return new Player(gridMachine, g, trace.events).at(trace.events.length).state;
}

const admissible = (g: GridInput): Heuristic[] =>
  g.diagonal ? ["euclidean", "octile", "zero"] : ["manhattan", "euclidean", "octile", "zero"];

describe("pathfinding against a reference Dijkstra", () => {
  it("every algorithm and heuristic returns a valid path exactly when one exists", () => {
    for (const g of GRIDS) {
      const reachable = distances(g, true)[g.target] < Infinity;
      for (const algo of ["bfs", "dfs", "dijkstra", "astar", "greedy"] as GridAlgo[]) {
        for (const heuristic of ["manhattan", "euclidean", "octile", "zero"] as Heuristic[]) {
          const s = solve(g, algo, { heuristic, weight: 1 });
          if (!reachable) {
            expect(s.outcome).toBe("nopath");
            expect(s.path).toEqual([]);
            continue;
          }
          expect(s.outcome).toBe("found");
          const cost = walk(g, s.path);
          expect(cost, `${algo} ${heuristic} seed ${g.seed}`).not.toBeNaN();
          expect(Math.abs(s.pathCost - cost)).toBeLessThanOrEqual(0.005 + 1e-9);
        }
      }
    }
  });

  it("BFS returns the fewest moves", () => {
    for (const g of GRIDS) {
      const best = distances(g, false)[g.target];
      if (best === Infinity) continue;
      expect(solve(g, "bfs", { heuristic: "zero", weight: 1 }).path.length - 1).toBe(best);
    }
  });

  it("Dijkstra and A* with every admissible heuristic return the cheapest path", () => {
    for (const g of GRIDS) {
      const best = distances(g, true)[g.target];
      if (best === Infinity) continue;
      const d = solve(g, "dijkstra", { heuristic: "zero", weight: 1 });
      expect(walk(g, d.path), `dijkstra seed ${g.seed}`).toBeCloseTo(best, 9);
      for (const heuristic of admissible(g)) {
        const a = solve(g, "astar", { heuristic, weight: 1 });
        expect(walk(g, a.path), `A* ${heuristic} seed ${g.seed}`).toBeCloseTo(best, 9);
      }
    }
  });

  it("weighted A* stays within w times the cheapest cost", () => {
    for (const g of GRIDS) {
      const best = distances(g, true)[g.target];
      if (best === Infinity) continue;
      for (const heuristic of admissible(g)) {
        for (const weight of [1.5, 2, 3, 5]) {
          const cost = walk(g, solve(g, "astar", { heuristic, weight }).path);
          expect(cost).toBeLessThanOrEqual(weight * best + 1e-9);
        }
      }
    }
  });

  it("start equal to target is a one-cell path of cost 0", () => {
    const g = makeGrid("S", "open", 1);
    const same = { ...g, target: g.start };
    for (const algo of ["bfs", "dfs", "dijkstra", "astar", "greedy"] as GridAlgo[]) {
      const s = solve(same, algo, { heuristic: "octile", weight: 2 });
      expect(s.outcome).toBe("found");
      expect(s.path).toEqual([g.start]);
      expect(s.pathCost).toBe(0);
    }
  });
});

const SORTS: SortAlgo[] = ["insertion", "selection", "bubble", "quick", "merge", "heap"];
const PIVOTS: PivotRule[] = ["last", "median3", "random"];

function randomValues(seed: number): SortInput {
  const rng = mulberry32(seed);
  const n = seed <= 3 ? seed - 1 : int(rng, 0, 70);
  const top = rng() < 0.5 ? 4 : 999;
  return { values: Array.from({ length: n }, () => int(rng, 1, top)), preset: "custom", seed };
}

function sortedBy(input: SortInput, algo: SortAlgo, pivot: PivotRule) {
  const trace = runSort(input, algo, { pivot });
  return new Player(sortMachine, input, trace.events).at(trace.events.length).state;
}

const isStable = (input: SortInput, order: number[]) =>
  order.every(
    (id, i) => i === 0 || input.values[order[i - 1]] !== input.values[id] || order[i - 1] < id,
  );

describe("sorting against Array.prototype.sort", () => {
  const inputs = Array.from({ length: 120 }, (_, i) => randomValues(i + 1));

  for (const algo of SORTS) {
    it(`${algo} returns a sorted permutation for every pivot rule, including n = 0 and 1`, () => {
      for (const input of inputs) {
        for (const pivot of algo === "quick" ? PIVOTS : (["last"] as PivotRule[])) {
          const s = sortedBy(input, algo, pivot);
          expect([...s.order].sort((a, b) => a - b)).toEqual(input.values.map((_, i) => i));
          expect(s.order.map((id) => input.values[id])).toEqual(
            [...input.values].sort((a, b) => a - b),
          );
          expect(Array.from(s.sorted).every(Boolean)).toBe(true);
        }
      }
    });
  }

  it("stability matches what each About panel claims", () => {
    for (const algo of SORTS) {
      const claimed = getAlgo(algo).props.find((p) => p.label === "Stable")!.value;
      const results = inputs.flatMap((input) =>
        (algo === "quick" ? PIVOTS : (["last"] as PivotRule[])).map((pivot) =>
          isStable(input, sortedBy(input, algo, pivot).order),
        ),
      );
      if (claimed) expect(results.every(Boolean), algo).toBe(true);
      else
        expect(
          results.some((r) => !r),
          algo,
        ).toBe(true);
    }
  });

  it("selection sort always compares n(n-1)/2 times and swaps at most n-1 times", () => {
    for (const input of inputs) {
      const n = input.values.length;
      const s = sortedBy(input, "selection", "last");
      expect(s.compares).toBe((n * Math.max(0, n - 1)) / 2);
      expect(s.swaps).toBeLessThanOrEqual(Math.max(0, n - 1));
    }
  });
});

function randomSearch(seed: number): SearchInput {
  const rng = mulberry32(seed);
  const n = seed <= 2 ? seed - 1 : int(rng, 0, 140);
  const values: number[] = [];
  let v = int(rng, 0, 5);
  for (let i = 0; i < n; i++) {
    values.push(v);
    v += int(rng, 0, 3);
  }
  const absent = !n || rng() < 0.35;
  let target = absent ? int(rng, 0, v + 2) : values[int(rng, 0, n - 1)];
  while (absent && values.includes(target)) target++;
  return { values, target, mode: "random", seed };
}

describe("searching against indexOf", () => {
  const inputs = Array.from({ length: 300 }, (_, i) => randomSearch(i + 1));
  for (const algo of ["linear", "binary", "jump"] as SearchAlgo[]) {
    it(`${algo} finds the target or reports it absent, with duplicates and n = 0`, () => {
      for (const input of inputs) {
        const { values, target } = input;
        const trace = runSearch(input, algo);
        const s = new Player(searchMachine, input, trace.events).at(trace.events.length).state;
        for (const e of trace.events)
          if (e.k === "probe") expect(e.i >= 0 && e.i < values.length, `probe ${e.i}`).toBe(true);
        const first = values.indexOf(target);
        if (first < 0) {
          expect(s.found).toBe(-1);
          expect(trace.events.at(-1)!.k).toBe("absent");
        } else if (algo === "binary") expect(values[s.found]).toBe(target);
        else expect(s.found).toBe(first);
        const n = values.length;
        const bound =
          algo === "binary"
            ? Math.ceil(Math.log2(n + 1))
            : algo === "jump"
              ? 2 * Math.ceil(Math.sqrt(n)) + 1
              : n;
        expect(s.probes).toBeLessThanOrEqual(bound);
      }
    });
  }
});

function randomGraph(seed: number): GraphInput {
  const rng = mulberry32(seed);
  const n = seed <= 2 ? seed : int(rng, 1, 30);
  const nodes = Array.from({ length: n }, () => ({ x: rng(), y: rng() }));
  const edges: [number, number, number][] = [];
  const m = n < 2 ? 0 : int(rng, 0, Math.min(90, (n * (n - 1)) / 2 + 3));
  for (let i = 0; i < m; i++) {
    const a = int(rng, 0, n - 1);
    const b = int(rng, 0, n - 1);
    if (a !== b) edges.push([Math.min(a, b), Math.max(a, b), int(rng, 1, 12)]);
  }
  edges.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  return { nodes, edges, root: int(rng, 0, n - 1), seed, density: 3 };
}

function referenceForest(g: GraphInput) {
  const n = g.nodes.length;
  const w = Array.from({ length: n }, () => new Array<number>(n).fill(Infinity));
  for (const [a, b, c] of g.edges) w[a][b] = w[b][a] = Math.min(w[a][b], c);
  const comp = new Array<number>(n).fill(-1);
  const weight: number[] = [];
  const size: number[] = [];
  for (let s = 0; s < n; s++) {
    if (comp[s] >= 0) continue;
    const id = weight.length;
    const key = new Array<number>(n).fill(Infinity);
    key[s] = 0;
    let total = 0;
    let count = 0;
    for (;;) {
      let u = -1;
      for (let i = 0; i < n; i++)
        if (comp[i] < 0 && key[i] < Infinity && (u < 0 || key[i] < key[u])) u = i;
      if (u < 0) break;
      comp[u] = id;
      total += key[u];
      count++;
      for (let v = 0; v < n; v++) if (comp[v] < 0) key[v] = Math.min(key[v], w[u][v]);
    }
    weight.push(total);
    size.push(count);
  }
  return { comp, weight, size };
}

describe("spanning trees against a reference Prim", () => {
  const graphs = Array.from({ length: 200 }, (_, i) => randomGraph(i + 1));
  for (const algo of ["prim", "kruskal"] as const) {
    it(`${algo} returns a minimum spanning ${algo === "prim" ? "tree of the root's component" : "forest"}`, () => {
      for (const g of graphs) {
        const ref = referenceForest(g);
        const trace = runGraph(g, algo);
        const s = new Player(graphMachine, g, trace.events).at(trace.events.length).state;
        const accepted = trace.events.flatMap((e) => (e.k === "accept" ? [e.edge] : []));
        const uf = g.nodes.map((_, i) => i);
        const find = (x: number): number => (uf[x] === x ? x : (uf[x] = find(uf[x])));
        for (const e of accepted) {
          const [a, b] = g.edges[e];
          expect(find(a)).not.toBe(find(b));
          uf[find(a)] = find(b);
        }
        const expected =
          algo === "prim"
            ? { total: ref.weight[ref.comp[g.root]], edges: ref.size[ref.comp[g.root]] - 1 }
            : {
                total: ref.weight.reduce((x, y) => x + y, 0),
                edges: g.nodes.length - ref.weight.length,
              };
        expect(s.total, `seed ${g.seed}`).toBe(expected.total);
        expect(s.treeEdges).toBe(expected.edges);
        expect(Array.from(s.edgeState).filter((x) => x === EDGE_TREE)).toHaveLength(expected.edges);
        expect(trace.checkpoints.at(-1)!.label).toBe(
          expected.edges === g.nodes.length - 1 ? "Spanning tree" : "Disconnected",
        );
      }
    });
  }

  it("the compare panel blames differing weights on a disconnected graph, not on ties", () => {
    for (const g of graphs) {
      const exp: Experiment = {
        family: "graph",
        input: g,
        a: { algo: "prim", params: {} },
        b: { algo: "kruskal", params: {} },
        view: { ...DEFAULT_VIEW },
      };
      const a = runVariant(exp, "a")!;
      const b = runVariant(exp, "b")!;
      const [line] = compareInsights(a, b, "Prim", "Kruskal");
      const connected = referenceForest(g).weight.length === 1;
      if (connected) expect(line).toMatch(/^Both trees weigh/);
      else if (!line.startsWith("Both")) expect(line).toMatch(/disconnected/);
    }
  });
});

const sq = (a: Point, b: Point) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

describe("k-means against Lloyd's invariants", () => {
  const datasets: ClusterData[] = ["blobs", "overlap", "uneven", "moons", "uniform"];
  const inits: KInit[] = ["plusplus", "random", "corner", "manual"];
  it("inertia never increases and every run converges to a fixed point", () => {
    let runs = 0;
    for (const dataset of datasets) {
      for (const init of inits) {
        for (const k of [1, 2, 3, 5, 8]) {
          for (const seed of [1, 2, 3]) {
            const rng = mulberry32(seed * 101 + k);
            const input = makeClusters(dataset, int(rng, 30, 400), seed);
            const manual = Array.from({ length: int(rng, 0, k) }, () => ({ x: rng(), y: rng() }));
            const trace = runKMeans(input, { k, init, manual });
            const s = new Player(kmeansMachine, input, trace.events).at(trace.events.length).state;
            const tag = `${dataset} ${init} k${k} seed ${seed}`;
            for (let i = 1; i < s.history.length; i++)
              expect(s.history[i], tag).toBeLessThanOrEqual(s.history[i - 1] + 1e-12);
            expect(s.phase, tag).toBe("converged");
            const sums = s.centroids.map(() => ({ x: 0, y: 0, n: 0 }));
            input.points.forEach((p, i) => {
              const own = sq(p, s.centroids[s.assign![i]]);
              for (const c of s.centroids) expect(own).toBeLessThanOrEqual(sq(p, c) + 1e-12);
              const t = sums[s.assign![i]];
              t.x += p.x;
              t.y += p.y;
              t.n++;
            });
            sums.forEach((t, c) => {
              if (!t.n) return;
              expect(s.centroids[c].x).toBeCloseTo(t.x / t.n, 9);
              expect(s.centroids[c].y).toBeCloseTo(t.y / t.n, 9);
            });
            runs++;
          }
        }
      }
    }
    expect(runs).toBe(300);
  });
});

function curvature(points: Point[]): number {
  const n = points.length;
  const xx = points.reduce((s, p) => s + p.x * p.x, 0) / n;
  const x = points.reduce((s, p) => s + p.x, 0) / n;
  return xx + 1 + Math.sqrt((xx - 1) ** 2 + 4 * x * x);
}

describe("gradient descent against the loss curvature", () => {
  const datasets: RegressionData[] = ["linear", "outliers", "valley"];
  const cases = datasets.flatMap((ds) =>
    [10, 60, 200].flatMap((n) => [1, 2, 3].map((seed) => makeRegression(ds, n, seed))),
  );

  it("loss falls at every step when the learning rate is below 2 / λmax", () => {
    for (const input of cases) {
      const limit = 2 / curvature(input.points);
      const rng = mulberry32(input.seed + input.n);
      for (const lr of [0.01, limit / 4, limit / 2, limit * 0.95]) {
        const params = { lr, beta: 0, m0: -1.5 + rng() * 3.8, b0: -1 + rng() * 2.4, steps: 200 };
        const trace = runGradient(input, params);
        const s = new Player(gradientMachine, input, trace.events).at(trace.events.length).state;
        expect(s.phase).not.toBe("diverged");
        for (let i = 1; i < s.path.length; i++)
          expect(s.path[i].loss).toBeLessThanOrEqual(s.path[i - 1].loss + 1e-12);
      }
    }
  });

  it("diverges above 2 / λmax and for every learning rate past 1, as the About panel says", () => {
    for (const input of cases) {
      const limit = 2 / curvature(input.points);
      expect(limit).toBeLessThan(1);
      for (const lr of [limit * 1.1, 1.01, 1.25, 1.5]) {
        const trace = runGradient(input, { lr, beta: 0, m0: -1, b0: 1, steps: lr > 1 ? 80 : 400 });
        expect(trace.events.at(-1)!.k, `${input.dataset} lr ${lr}`).toBe("diverged");
      }
    }
  });
});
