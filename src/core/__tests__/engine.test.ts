import { describe, expect, it } from "vitest";
import { runGrid, type GridAlgo, type GridParams } from "../grid/algorithms";
import { gridMachine } from "../grid/machine";
import { pathCost, type GridInput } from "../grid/model";
import { makeGrid, reachable } from "../grid/terrain";
import { Player } from "../player";
import { runSort, type SortAlgo } from "../sort/algorithms";
import { makeSortInput } from "../sort/input";
import { sortMachine } from "../sort/machine";
import {
  makeSearchInput,
  runSearch,
  searchMachine,
  type SearchAlgo,
  type TargetMode,
} from "../search/search";
import { addNode, components, hasEdge, removeNode, toggleEdge } from "../graph/edit";
import { graphMachine, makeGraph, runGraph } from "../graph/graph";
import { kmeansMachine, makeClusters, plusPlus, runKMeans } from "../learn/kmeans";
import { bestFit, gradientMachine, lossAt, makeRegression, runGradient } from "../learn/gradient";
import { mulberry32 } from "../rng";

const finalGrid = (
  g: GridInput,
  algo: GridAlgo,
  params: GridParams = { heuristic: "manhattan", weight: 1 },
) => {
  const trace = runGrid(g, algo, params);
  return { trace, state: new Player(gridMachine, g, trace.events).at(trace.events.length).state };
};

describe("pathfinding", () => {
  it("BFS returns the minimum number of moves on an open grid", () => {
    const g = makeGrid("S", "open", 1);
    const { state } = finalGrid(g, "bfs");
    const dc = Math.abs((g.start % g.w) - (g.target % g.w));
    const dr = Math.abs(Math.floor(g.start / g.w) - Math.floor(g.target / g.w));
    expect(state.outcome).toBe("found");
    expect(state.path.length - 1).toBe(dc + dr);
  });

  it("Dijkstra and A* agree on optimal cost on weighted terrain, and both beat BFS or tie", () => {
    for (const seed of [1, 2, 3, 8]) {
      const g = makeGrid("M", "weighted", seed);
      const d = finalGrid(g, "dijkstra").state;
      const a = finalGrid(g, "astar").state;
      const b = finalGrid(g, "bfs").state;
      expect(a.pathCost).toBeCloseTo(d.pathCost, 6);
      expect(d.pathCost).toBeLessThanOrEqual(pathCost(g, b.path) + 1e-9);
    }
  });

  it("A* expands no more cells than Dijkstra with an admissible heuristic", () => {
    const g = makeGrid("M", "scatter", 31);
    expect(finalGrid(g, "astar").state.expanded).toBeLessThanOrEqual(
      finalGrid(g, "dijkstra").state.expanded,
    );
  });

  it("weighted A* can return a costlier path than A*", () => {
    let worse = false;
    for (const seed of [21, 3, 5, 9, 14]) {
      const g = makeGrid("M", "weighted", seed);
      const a = finalGrid(g, "astar").state.pathCost;
      const w = finalGrid(g, "astar", { heuristic: "manhattan", weight: 3 }).state.pathCost;
      expect(w).toBeGreaterThanOrEqual(a - 1e-9);
      if (w > a + 1e-9) worse = true;
    }
    expect(worse).toBe(true);
  });

  it("greedy expands into the trap less efficiently than its path suggests", () => {
    const g = makeGrid("M", "trap", 4);
    const greedy = finalGrid(g, "greedy").state;
    const astar = finalGrid(g, "astar").state;
    expect(greedy.outcome).toBe("found");
    expect(greedy.pathCost).toBeGreaterThanOrEqual(astar.pathCost);
  });

  it("DFS finds a path in a maze and reports no path when walled off", () => {
    const g = makeGrid("S", "maze", 5);
    expect(finalGrid(g, "dfs").state.outcome).toBe("found");
    const blocked = makeGrid("S", "open", 1);
    const t = blocked.target;
    for (const n of [t - 1, t + 1, t - blocked.w, t + blocked.w]) blocked.cells[n] = 0;
    for (const algo of ["bfs", "dfs", "dijkstra", "astar", "greedy"] as GridAlgo[]) {
      expect(finalGrid(blocked, algo).state.outcome).toBe("nopath");
    }
  });

  it("every generated terrain is solvable", () => {
    for (const terrain of ["open", "maze", "rooms", "scatter", "weighted", "trap"] as const) {
      for (const size of ["S", "M", "L", "T"] as const) {
        for (const seed of [1, 2, 3]) expect(reachable(makeGrid(size, terrain, seed))).toBe(true);
      }
    }
  });

  it("diagonal moves never cut corners", () => {
    const g = makeGrid("S", "scatter", 9, true);
    const { state } = finalGrid(g, "astar", { heuristic: "octile", weight: 1 });
    for (let i = 1; i < state.path.length; i++) {
      const a = state.path[i - 1];
      const b = state.path[i];
      const dr = Math.floor(b / g.w) - Math.floor(a / g.w);
      const dc = (b % g.w) - (a % g.w);
      if (dr && dc) {
        expect(g.cells[a + dc]).toBeGreaterThan(0);
        expect(g.cells[a + dr * g.w]).toBeGreaterThan(0);
      }
    }
  });

  it("frontier and closed sets never overlap except for stale heap entries", () => {
    const g = makeGrid("M", "weighted", 2);
    const trace = runGrid(g, "dijkstra");
    const p = new Player(gridMachine, g, trace.events);
    for (const c of [5, 100, 700, trace.events.length]) {
      const s = p.at(c).state;
      for (const e of s.frontier)
        if (s.status[e.cell] === 2) expect(e.g).toBeGreaterThanOrEqual(s.g[e.cell]);
    }
  });
});

describe("sorting", () => {
  const algos: SortAlgo[] = ["insertion", "selection", "bubble", "quick", "merge", "heap"];
  const presets = ["random", "nearly", "reversed", "sorted", "few"] as const;
  for (const algo of algos) {
    it(`${algo} sorts every preset and marks every index sorted`, () => {
      for (const preset of presets) {
        for (const pivot of ["last", "median3", "random"] as const) {
          const input = makeSortInput(preset, 23, 4);
          const trace = runSort(input, algo, { pivot });
          const s = new Player(sortMachine, input, trace.events).at(trace.events.length).state;
          expect(s.order.map((id) => input.values[id])).toEqual(
            [...input.values].sort((a, b) => a - b),
          );
          expect(Array.from(s.sorted).every(Boolean)).toBe(true);
          expect(s.buffer).toBeNull();
          if (algo !== "quick") break;
        }
      }
    });
  }

  it("insertion and merge sort are stable", () => {
    const input = makeSortInput("few", 30, 2);
    for (const algo of ["insertion", "merge", "bubble"] as SortAlgo[]) {
      const trace = runSort(input, algo);
      const s = new Player(sortMachine, input, trace.events).at(trace.events.length).state;
      for (let i = 1; i < s.order.length; i++) {
        if (input.values[s.order[i]] === input.values[s.order[i - 1]])
          expect(s.order[i]).toBeGreaterThan(s.order[i - 1]);
      }
    }
  });

  it("quicksort on sorted input is quadratic with a last pivot and not with median-of-three", () => {
    const input = makeSortInput("sorted", 32, 1);
    const last = runSort(input, "quick", { pivot: "last" }).events.filter(
      (e) => e.k === "compare",
    ).length;
    const med = runSort(input, "quick", { pivot: "median3" }).events.filter(
      (e) => e.k === "compare",
    ).length;
    expect(last).toBe((32 * 31) / 2);
    expect(med).toBeLessThan(last / 2);
  });

  it("insertion sort is adaptive and bubble sort exits early on sorted input", () => {
    const sorted = makeSortInput("sorted", 40, 1);
    expect(runSort(sorted, "insertion").events.filter((e) => e.k === "compare").length).toBe(39);
    expect(runSort(sorted, "bubble").events.filter((e) => e.k === "compare").length).toBe(39);
  });

  it("each value exists exactly once at every step of a merge sort", () => {
    const input = makeSortInput("random", 17, 3);
    const trace = runSort(input, "merge");
    const p = new Player(sortMachine, input, trace.events);
    for (let c = 0; c <= trace.events.length; c += 7) {
      const s = p.at(c).state;
      const seen = [...s.order, ...(s.buffer ?? [])].filter((x) => x >= 0).sort((a, b) => a - b);
      expect(seen).toEqual(input.values.map((_, i) => i));
    }
  });
});

describe("searching", () => {
  const modes: TargetMode[] = ["first", "middle", "last", "absent", "random"];
  it("every algorithm finds present targets and rejects absent ones", () => {
    for (const algo of ["linear", "binary", "jump"] as SearchAlgo[]) {
      for (const mode of modes) {
        for (const n of [8, 9, 64, 100]) {
          const input = makeSearchInput(n, mode, 3);
          const trace = runSearch(input, algo);
          const s = new Player(searchMachine, input, trace.events).at(trace.events.length).state;
          if (mode === "absent") expect(s.found).toBe(-1);
          else expect(input.values[s.found]).toBe(input.target);
        }
      }
    }
  });

  it("binary search needs at most ⌈log2(n+1)⌉ probes", () => {
    for (const n of [8, 31, 64, 128]) {
      for (const mode of modes) {
        const input = makeSearchInput(n, mode, 9);
        const probes = runSearch(input, "binary").events.filter((e) => e.k === "probe").length;
        expect(probes).toBeLessThanOrEqual(Math.ceil(Math.log2(n + 1)));
      }
    }
  });
});

describe("spanning trees", () => {
  it("Prim and Kruskal produce trees of equal weight with V-1 edges", () => {
    for (const seed of [1, 4, 14, 22]) {
      const g = makeGraph(20, seed);
      const weights = (["prim", "kruskal"] as const).map((algo) => {
        const t = runGraph(g, algo);
        const s = new Player(graphMachine, g, t.events).at(t.events.length).state;
        expect(s.treeEdges).toBe(g.nodes.length - 1);
        return s.total;
      });
      expect(weights[0]).toBe(weights[1]);
    }
  });

  it("generated graphs are connected", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const g = makeGraph(30, seed, 1);
      const t = runGraph(g, "kruskal");
      const s = new Player(graphMachine, g, t.events).at(t.events.length).state;
      expect(s.treeEdges).toBe(29);
    }
  });

  it("edits graphs and reports a forest when the graph is disconnected", () => {
    let g = makeGraph(8, 3);
    const [a, b] = g.edges[0];
    expect(hasEdge(g, b, a)).toBe(true);
    g = toggleEdge(g, a, b);
    expect(hasEdge(g, a, b)).toBe(false);
    g = toggleEdge(g, a, b);
    expect(hasEdge(g, a, b)).toBe(true);
    expect(toggleEdge(g, a, a)).toBe(g);

    const grown = addNode(g, { x: 2, y: -1 }, 2);
    expect(grown.nodes).toHaveLength(9);
    expect(grown.nodes[8]).toEqual({ x: 0.98, y: 0.02 });
    expect(grown.edges.filter((e) => e[1] === 8)).toHaveLength(2);

    const shrunk = removeNode(grown, 0);
    expect(shrunk.nodes).toHaveLength(8);
    expect(shrunk.edges.every(([x, y]) => x < 8 && y < 8 && x < y)).toBe(true);

    const island = { ...g, edges: g.edges.filter((e) => e[0] !== 7 && e[1] !== 7) };
    expect(components(island)).toBe(2);
    for (const algo of ["prim", "kruskal"] as const) {
      const t = runGraph(island, algo);
      const s = new Player(graphMachine, island, t.events).at(t.events.length).state;
      expect(s.treeEdges).toBeLessThan(7);
      expect(t.checkpoints.map((c) => c.label)).toContain("Disconnected");
    }
  });
});

describe("k-means", () => {
  it("k-means++ picks the point where the cumulative weight crosses r", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0.5, y: 1 },
    ];
    const rng = mulberry32(1);
    const first = Math.floor(mulberry32(1)() * pts.length);
    const picked = plusPlus(pts, 2, rng);
    expect(picked[0]).toEqual(pts[first]);
    expect(picked[1]).not.toEqual(pts[first]);
  });

  it("alternates assign and update, with non-increasing inertia", () => {
    const input = makeClusters("overlap", 180, 5);
    const trace = runKMeans(input, { k: 3, init: "random", manual: [] });
    const kinds = trace.events.filter((e) => e.k === "assign" || e.k === "update").map((e) => e.k);
    for (let i = 1; i < kinds.length; i++) expect(kinds[i]).not.toBe(kinds[i - 1]);
    const s = new Player(kmeansMachine, input, trace.events).at(trace.events.length).state;
    for (let i = 1; i < s.history.length; i++)
      expect(s.history[i]).toBeLessThanOrEqual(s.history[i - 1] + 1e-12);
    expect(trace.groupEnds.length).toBeGreaterThan(4);
  });

  it("the corner initialisation is visibly worse than k-means++ on blobs", () => {
    const input = makeClusters("blobs", 200, 11);
    const end = (init: "plusplus" | "corner") => {
      const t = runKMeans(input, { k: 4, init, manual: [] });
      return new Player(kmeansMachine, input, t.events).at(t.events.length).state.inertia!;
    };
    expect(end("corner")).toBeGreaterThan(end("plusplus") * 1.2);
  });
});

describe("gradient descent", () => {
  it("keeps every dataset inside the unit square", () => {
    for (const ds of ["linear", "outliers", "valley"] as const) {
      for (const p of makeRegression(ds, 60, 3).points) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(1);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(1);
      }
    }
  });

  it("converges to the least-squares fit at the default learning rate", () => {
    const input = makeRegression("linear", 60, 4);
    const trace = runGradient(input, { lr: 0.6, beta: 0, m0: -1, b0: 1, steps: 300 });
    const start = { ...input, m0: -1, b0: 1 };
    const s = new Player(gradientMachine, start, trace.events).at(trace.events.length).state;
    const opt = bestFit(input.points);
    expect(s.m).toBeCloseTo(opt.m, 2);
    expect(s.b).toBeCloseTo(opt.b, 2);
  });

  it("diverges when the learning rate is too high", () => {
    const input = makeRegression("linear", 60, 4);
    const trace = runGradient(input, { lr: 0.85, beta: 0, m0: -1, b0: 1, steps: 300 });
    expect(trace.events.at(-1)!.k).toBe("diverged");
  });

  it("momentum beats plain descent in the narrow valley", () => {
    const input = makeRegression("valley", 60, 6);
    const plain = runGradient(input, { lr: 0.55, beta: 0, m0: -1, b0: 1, steps: 120 });
    const mom = runGradient(input, { lr: 0.3, beta: 0.8, m0: -1, b0: 1, steps: 120 });
    const last = (t: typeof plain) =>
      new Player(gradientMachine, { ...input, m0: -1, b0: 1 }, t.events).at(t.events.length).state
        .loss;
    expect(last(plain)).toBeGreaterThan(
      lossAt(input.points, bestFit(input.points).m, bestFit(input.points).b),
    );
    expect(last(mom)).toBeLessThan(last(plain));
  });
});

describe("player", () => {
  it("random access matches a fresh fold for every family", () => {
    const g = makeGrid("M", "weighted", 3);
    const trace = runGrid(g, "astar");
    const p = new Player(gridMachine, g, trace.events);
    const rng = mulberry32(5);
    for (let i = 0; i < 40; i++) {
      const c = Math.floor(rng() * (trace.events.length + 1));
      const fresh = new Player(gridMachine, g, trace.events.slice(0, c)).at(c).state;
      const s = p.at(c).state;
      expect(Array.from(s.status)).toEqual(Array.from(fresh.status));
      expect(s.frontier.map((e) => e.seq)).toEqual(fresh.frontier.map((e) => e.seq));
      expect(s.expanded).toBe(fresh.expanded);
    }
  });

  it("cursor 0 is the state before the first event", () => {
    const input = makeSortInput("random", 10, 1);
    const trace = runSort(input, "bubble");
    const s = new Player(sortMachine, input, trace.events).at(0).state;
    expect(s.compares).toBe(0);
    expect(s.order).toEqual(input.values.map((_, i) => i));
  });

  it("op hit counts add up to the cursor", () => {
    const input = makeSortInput("random", 12, 1);
    const trace = runSort(input, "quick");
    const f = new Player(sortMachine, input, trace.events).at(50);
    expect(Object.values(f.hits).reduce((a, b) => a + b, 0)).toBe(50);
  });
});
