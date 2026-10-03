import {
  DEFAULT_GRID_PARAMS,
  runGrid,
  type GridAlgo,
  type GridEvent,
  type GridParams,
} from "./grid/algorithms";
import { gridMachine, type GridState } from "./grid/machine";
import { hasWeights, type GridInput, type GridSize, type Heuristic } from "./grid/model";
import { makeGrid } from "./grid/terrain";
import {
  graphMachine,
  makeGraph,
  runGraph,
  type GraphAlgo,
  type GraphEvent,
  type GraphInput,
  type GraphState,
} from "./graph/graph";
import { getAlgo, type AlgoId } from "./info";
import {
  DEFAULT_GRADIENT_PARAMS,
  gradientMachine,
  makeRegression,
  runGradient,
  type GradientEvent,
  type GradientParams,
  type GradientState,
  type RegressionInput,
} from "./learn/gradient";
import {
  DEFAULT_KMEANS_PARAMS,
  kmeansMachine,
  makeClusters,
  runKMeans,
  type ClusterInput,
  type KMeansEvent,
  type KMeansParams,
  type KMeansState,
} from "./learn/kmeans";
import { Player } from "./player";
import {
  makeSearchInput,
  runSearch,
  searchMachine,
  type SearchAlgo,
  type SearchEvent,
  type SearchInput,
  type SearchState,
} from "./search/search";
import {
  DEFAULT_SORT_PARAMS,
  runSort,
  type SortAlgo,
  type SortEvent,
  type SortParams,
} from "./sort/algorithms";
import { makeSortInput, type SortInput } from "./sort/input";
import { sortMachine, type SortState } from "./sort/machine";
import type { Family, Metric, Trace } from "./types";

export interface ViewSettings {
  values: boolean;
  overlay: boolean;
}

export const DEFAULT_VIEW: ViewSettings = { values: false, overlay: false };

interface Variant<A extends AlgoId, P> {
  algo: A;
  params: P;
}

export type GridExp = {
  family: "grid";
  input: GridInput;
  a: Variant<GridAlgo, GridParams>;
  b: Variant<GridAlgo, GridParams> | null;
  view: ViewSettings;
};
export type SortExp = {
  family: "sort";
  input: SortInput;
  a: Variant<SortAlgo, SortParams>;
  b: Variant<SortAlgo, SortParams> | null;
  view: ViewSettings;
};
export type SearchExp = {
  family: "search";
  input: SearchInput;
  a: Variant<SearchAlgo, Record<string, never>>;
  b: Variant<SearchAlgo, Record<string, never>> | null;
  view: ViewSettings;
};
export type GraphExp = {
  family: "graph";
  input: GraphInput;
  a: Variant<GraphAlgo, Record<string, never>>;
  b: Variant<GraphAlgo, Record<string, never>> | null;
  view: ViewSettings;
};
export type KMeansExp = {
  family: "learn";
  model: "kmeans";
  input: ClusterInput;
  a: Variant<"kmeans", KMeansParams>;
  b: Variant<"kmeans", KMeansParams> | null;
  view: ViewSettings;
};
export type GradientExp = {
  family: "learn";
  model: "gradient";
  input: RegressionInput;
  a: Variant<"gradient", GradientParams>;
  b: Variant<"gradient", GradientParams> | null;
  view: ViewSettings;
};

export type Experiment = GridExp | SortExp | SearchExp | GraphExp | KMeansExp | GradientExp;
export type AnyVariant = Experiment["a"];

export type Run =
  | {
      family: "grid";
      algo: GridAlgo;
      params: GridParams;
      input: GridInput;
      trace: Trace<GridEvent>;
      player: Player<GridInput, GridEvent, GridState>;
    }
  | {
      family: "sort";
      algo: SortAlgo;
      params: SortParams;
      input: SortInput;
      trace: Trace<SortEvent>;
      player: Player<SortInput, SortEvent, SortState>;
    }
  | {
      family: "search";
      algo: SearchAlgo;
      params: Record<string, never>;
      input: SearchInput;
      trace: Trace<SearchEvent>;
      player: Player<SearchInput, SearchEvent, SearchState>;
    }
  | {
      family: "graph";
      algo: GraphAlgo;
      params: Record<string, never>;
      input: GraphInput;
      trace: Trace<GraphEvent>;
      player: Player<GraphInput, GraphEvent, GraphState>;
    }
  | {
      family: "kmeans";
      algo: "kmeans";
      params: KMeansParams;
      input: ClusterInput;
      trace: Trace<KMeansEvent>;
      player: Player<ClusterInput, KMeansEvent, KMeansState>;
    }
  | {
      family: "gradient";
      algo: "gradient";
      params: GradientParams;
      input: RegressionInput;
      trace: Trace<GradientEvent>;
      player: Player<RegressionInput, GradientEvent, GradientState>;
    };

export function familyOfAlgo(id: AlgoId): Family {
  return getAlgo(id).family;
}

export function defaultParams(algo: AlgoId, diagonal = false): AnyVariant["params"] {
  const f = familyOfAlgo(algo);
  if (f === "grid")
    return { ...DEFAULT_GRID_PARAMS, heuristic: (diagonal ? "octile" : "manhattan") as Heuristic };
  if (f === "sort") return { ...DEFAULT_SORT_PARAMS };
  if (algo === "kmeans") return { ...DEFAULT_KMEANS_PARAMS, manual: [] };
  if (algo === "gradient") return { ...DEFAULT_GRADIENT_PARAMS };
  return {};
}

export function defaultExperiment(
  algo: AlgoId,
  opts: { compact?: boolean; seed?: number } = {},
): Experiment {
  const seed = opts.seed ?? 7;
  const f = familyOfAlgo(algo);
  const view = { ...DEFAULT_VIEW };
  if (f === "grid") {
    const size: GridSize = opts.compact ? "T" : "M";
    const input = makeGrid(size, algo === "dfs" || algo === "bfs" ? "maze" : "scatter", seed);
    return {
      family: "grid",
      input,
      a: { algo: algo as GridAlgo, params: defaultParams(algo) as GridParams },
      b: null,
      view,
    };
  }
  if (f === "sort") {
    return {
      family: "sort",
      input: makeSortInput("random", opts.compact ? 16 : 32, seed),
      a: { algo: algo as SortAlgo, params: { ...DEFAULT_SORT_PARAMS } },
      b: null,
      view,
    };
  }
  if (f === "search") {
    return {
      family: "search",
      input: makeSearchInput(opts.compact ? 32 : 64, "last", seed),
      a: { algo: algo as SearchAlgo, params: {} },
      b: null,
      view,
    };
  }
  if (f === "graph") {
    return {
      family: "graph",
      input: makeGraph(opts.compact ? 12 : 18, seed),
      a: { algo: algo as GraphAlgo, params: {} },
      b: null,
      view,
    };
  }
  if (algo === "kmeans") {
    return {
      family: "learn",
      model: "kmeans",
      input: makeClusters("blobs", 200, seed),
      a: { algo: "kmeans", params: { ...DEFAULT_KMEANS_PARAMS, manual: [] } },
      b: null,
      view,
    };
  }
  return {
    family: "learn",
    model: "gradient",
    input: makeRegression("linear", 60, seed),
    a: { algo: "gradient", params: { ...DEFAULT_GRADIENT_PARAMS } },
    b: null,
    view,
  };
}

export function withAlgo(exp: Experiment, algo: AlgoId, compact = false): Experiment {
  const f = familyOfAlgo(algo);
  const sameFamily =
    f === exp.family && (f !== "learn" || (exp.family === "learn" && exp.model === algo));
  if (!sameFamily) return defaultExperiment(algo, { compact });
  const keep =
    exp.a.algo === algo
      ? exp.a.params
      : defaultParams(algo, exp.family === "grid" && exp.input.diagonal);
  const b = exp.b && exp.b.algo === algo && sameParams(exp.b.params, keep) ? null : exp.b;
  return { ...exp, a: { algo, params: keep }, b } as Experiment;
}

function sameParams(x: unknown, y: unknown): boolean {
  return JSON.stringify(x) === JSON.stringify(y);
}

export function variantLabel(v: AnyVariant): string {
  const info = getAlgo(v.algo);
  const p = v.params as Partial<GridParams & SortParams & KMeansParams & GradientParams>;
  if (v.algo === "astar")
    return `${info.short} · ${p.heuristic}${p.weight && p.weight !== 1 ? ` ×${p.weight}` : ""}`;
  if (v.algo === "greedy") return `${info.short} · ${p.heuristic}`;
  if (v.algo === "quick")
    return `${info.short} · ${p.pivot === "median3" ? "median-of-3" : p.pivot === "random" ? "random pivot" : "last pivot"}`;
  if (v.algo === "kmeans")
    return `${info.short} · k ${p.k} · ${p.init === "plusplus" ? "k-means++" : p.init}`;
  if (v.algo === "gradient") return `${info.short} · lr ${p.lr}${p.beta ? ` · β ${p.beta}` : ""}`;
  return info.short;
}

export function runVariant(exp: Experiment, which: "a" | "b"): Run | null {
  const v = which === "a" ? exp.a : exp.b;
  if (!v) return null;
  switch (exp.family) {
    case "grid": {
      const vv = v as GridExp["a"];
      const trace = runGrid(exp.input, vv.algo, vv.params);
      return {
        family: "grid",
        algo: vv.algo,
        params: vv.params,
        input: exp.input,
        trace,
        player: new Player(gridMachine, exp.input, trace.events),
      };
    }
    case "sort": {
      const vv = v as SortExp["a"];
      const trace = runSort(exp.input, vv.algo, vv.params);
      return {
        family: "sort",
        algo: vv.algo,
        params: vv.params,
        input: exp.input,
        trace,
        player: new Player(sortMachine, exp.input, trace.events),
      };
    }
    case "search": {
      const vv = v as SearchExp["a"];
      const trace = runSearch(exp.input, vv.algo);
      return {
        family: "search",
        algo: vv.algo,
        params: {},
        input: exp.input,
        trace,
        player: new Player(searchMachine, exp.input, trace.events),
      };
    }
    case "graph": {
      const vv = v as GraphExp["a"];
      const trace = runGraph(exp.input, vv.algo);
      return {
        family: "graph",
        algo: vv.algo,
        params: {},
        input: exp.input,
        trace,
        player: new Player(graphMachine, exp.input, trace.events),
      };
    }
    case "learn":
      if (exp.model === "kmeans") {
        const vv = v as KMeansExp["a"];
        const trace = runKMeans(exp.input, vv.params);
        return {
          family: "kmeans",
          algo: "kmeans",
          params: vv.params,
          input: exp.input,
          trace,
          player: new Player(kmeansMachine, exp.input, trace.events, 8),
        };
      } else {
        const vv = v as GradientExp["a"];
        const trace = runGradient(exp.input, vv.params);
        return {
          family: "gradient",
          algo: "gradient",
          params: vv.params,
          input: exp.input,
          trace,
          player: new Player(gradientMachine, exp.input, trace.events, 32),
        };
      }
  }
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function metricsAt(run: Run, cursor: number): Metric[] {
  switch (run.family) {
    case "grid": {
      const s = run.player.at(cursor).state;
      return [
        { label: "Expanded", value: s.expanded, better: "lower" },
        { label: "Frontier", value: s.frontier.length },
        { label: "Moves", value: s.outcome === "found" ? s.path.length - 1 : "—", better: "lower" },
        { label: "Cost", value: s.outcome === "found" ? r2(s.pathCost) : "—", better: "lower" },
      ];
    }
    case "sort": {
      const s = run.player.at(cursor).state;
      return [
        { label: "Comparisons", value: s.compares, better: "lower" },
        { label: "Swaps", value: s.swaps, better: "lower" },
        { label: "Writes", value: s.writes, better: "lower" },
        { label: "Sorted", value: `${s.sorted.reduce((a, b) => a + b, 0)}/${s.values.length}` },
      ];
    }
    case "search": {
      const s = run.player.at(cursor).state;
      return [
        { label: "Probes", value: s.probes, better: "lower" },
        { label: "Candidates", value: s.done ? 0 : Math.max(0, s.hi - s.lo + 1) },
        { label: "Result", value: s.found >= 0 ? `index ${s.found}` : s.done ? "absent" : "…" },
      ];
    }
    case "graph": {
      const s = run.player.at(cursor).state;
      return [
        { label: "Tree weight", value: s.total, better: "lower" },
        { label: "Tree edges", value: `${s.treeEdges}/${run.input.nodes.length - 1}` },
        { label: "Rejected", value: s.rejected, better: "lower" },
      ];
    }
    case "kmeans": {
      const s = run.player.at(cursor).state;
      return [
        { label: "Iteration", value: s.iteration, better: "lower" },
        {
          label: "Inertia",
          value: s.inertia === null ? "—" : s.inertia.toFixed(3),
          better: "lower",
        },
        { label: "Switched", value: s.assign ? s.changed : "—" },
      ];
    }
    case "gradient": {
      const s = run.player.at(cursor).state;
      return [
        { label: "Step", value: s.step, better: "lower" },
        {
          label: "Loss",
          value:
            s.phase === "diverged"
              ? "∞"
              : s.loss < 1000
                ? s.loss.toFixed(4)
                : s.loss.toExponential(1),
          better: "lower",
        },
        { label: "m", value: s.m.toFixed(3) },
        { label: "b", value: s.b.toFixed(3) },
      ];
    }
  }
}

export function finalMetrics(run: Run): Metric[] {
  return [
    ...metricsAt(run, run.trace.events.length),
    { label: "Operations", value: run.trace.events.length, better: "lower" },
  ];
}

export function compareInsights(a: Run, b: Run, la: string, lb: string): string[] {
  const out: string[] = [];
  const pct = (x: number, y: number) =>
    Math.round((Math.abs(x - y) / Math.max(1, Math.max(x, y))) * 100);
  if (a.family === "grid" && b.family === "grid") {
    const sa = a.player.at(a.trace.events.length).state;
    const ea = sa.expanded;
    const ca = sa.outcome === "found" ? sa.pathCost : null;
    const sb = b.player.at(b.trace.events.length).state;
    const eb = sb.expanded;
    const cb = sb.outcome === "found" ? sb.pathCost : null;
    if (ca === null && cb === null) out.push("Neither run reaches the target: it is walled off.");
    else if (ca !== null && cb !== null) {
      if (Math.abs(ca - cb) < 1e-6) out.push(`Both find a path of cost ${r2(ca)}.`);
      else {
        const cheaper = ca < cb ? la : lb;
        out.push(
          `${cheaper} finds a cheaper path: ${r2(Math.min(ca, cb))} vs ${r2(Math.max(ca, cb))} (${pct(ca, cb)}% less).`,
        );
      }
    }
    if (ea !== eb) {
      const fewer = ea < eb ? la : lb;
      out.push(
        `${fewer} expands ${pct(ea, eb)}% fewer cells (${Math.min(ea, eb)} vs ${Math.max(ea, eb)}).`,
      );
    } else out.push(`Both expand ${ea} cells.`);
    if (
      hasWeights(a.input) &&
      (a.algo === "bfs" || b.algo === "bfs" || a.algo === "dfs" || b.algo === "dfs")
    ) {
      out.push(
        "BFS and DFS ignore cell costs, so their path cost is whatever the terrain charges.",
      );
    }
    return out;
  }
  if (a.family === "sort" && b.family === "sort") {
    const sa = a.player.at(a.trace.events.length).state;
    const ca = sa.compares;
    const wa = sa.swaps + sa.writes;
    const sb = b.player.at(b.trace.events.length).state;
    const cb = sb.compares;
    const wb = sb.swaps + sb.writes;
    if (ca !== cb)
      out.push(
        `${ca < cb ? la : lb} needs ${pct(ca, cb)}% fewer comparisons (${Math.min(ca, cb)} vs ${Math.max(ca, cb)}).`,
      );
    else out.push(`Both make ${ca} comparisons.`);
    if (wa !== wb)
      out.push(
        `${wa < wb ? la : lb} moves data less: ${Math.min(wa, wb)} vs ${Math.max(wa, wb)} swaps and writes.`,
      );
    const n = sa.values.length;
    out.push(
      `For n = ${n}: n² / 2 ≈ ${Math.round((n * n) / 2)}, n·log₂n ≈ ${Math.round(n * Math.log2(n))}.`,
    );
    return out;
  }
  if (a.family === "search" && b.family === "search") {
    const pa = a.player.at(a.trace.events.length).state.probes;
    const pb = b.player.at(b.trace.events.length).state.probes;
    out.push(
      pa === pb
        ? `Both need ${pa} probes.`
        : `${pa < pb ? la : lb} needs ${Math.min(pa, pb)} probes; ${pa < pb ? lb : la} needs ${Math.max(pa, pb)}.`,
    );
    const n = a.input.values.length;
    out.push(`log₂(${n}) ≈ ${Math.ceil(Math.log2(n + 1))}, √${n} ≈ ${Math.round(Math.sqrt(n))}.`);
    return out;
  }
  if (a.family === "graph" && b.family === "graph") {
    const sa = a.player.at(a.trace.events.length).state;
    const ta = sa.total;
    const ra = sa.rejected;
    const sb = b.player.at(b.trace.events.length).state;
    const tb = sb.total;
    const rb = sb.rejected;
    out.push(
      ta === tb
        ? `Both trees weigh ${ta}. A minimum spanning tree's weight is unique.`
        : `Tree weights differ (${ta} vs ${tb}): ties between equal edges.`,
    );
    out.push(`${la} discards ${ra} edges; ${lb} discards ${rb}.`);
    return out;
  }
  if (a.family === "kmeans" && b.family === "kmeans") {
    const sa = a.player.at(a.trace.events.length).state;
    const sb = b.player.at(b.trace.events.length).state;
    const ia = sa.inertia ?? 0;
    const ib = sb.inertia ?? 0;
    out.push(
      `${ia <= ib ? la : lb} ends with lower inertia: ${Math.min(ia, ib).toFixed(3)} vs ${Math.max(ia, ib).toFixed(3)}.`,
    );
    out.push(`Iterations to converge: ${sa.iteration} vs ${sb.iteration}.`);
    if (Math.abs(ia - ib) > 0.02 * Math.max(ia, ib))
      out.push(
        "Different starting centroids led to different final clusterings: k-means only finds a local optimum.",
      );
    return out;
  }
  if (a.family === "gradient" && b.family === "gradient") {
    const sa = a.player.at(a.trace.events.length).state;
    const sb = b.player.at(b.trace.events.length).state;
    const da = sa.phase === "diverged";
    const db = sb.phase === "diverged";
    if (da || db)
      out.push(
        `${da && db ? "Both runs" : da ? la : lb} diverged: the learning rate is too large for this loss surface.`,
      );
    if (!da && !db)
      out.push(
        `${sa.loss <= sb.loss ? la : lb} reaches the lower loss: ${Math.min(sa.loss, sb.loss).toFixed(4)} vs ${Math.max(sa.loss, sb.loss).toFixed(4)}.`,
      );
    const fa = a.trace.checkpoints.find((c) => c.label.startsWith("Within"));
    const fb = b.trace.checkpoints.find((c) => c.label.startsWith("Within"));
    if (fa && fb)
      out.push(
        `Within 1% of the best fit after ${a.trace.events[fa.at - 1]?.group ?? 0} vs ${b.trace.events[fb.at - 1]?.group ?? 0} steps.`,
      );
    return out;
  }
  return out;
}

export function runKey(run: Run): string {
  return run.family;
}
