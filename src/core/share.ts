import type { Experiment, ViewSettings } from "./experiment";
import { connectEdges, edgeWeight, GRAPH_MAX, GRAPH_MIN, type GraphInput } from "./graph/graph";
import {
  GRID_SIZES,
  type GridInput,
  type GridSize,
  type Heuristic,
  type Terrain,
} from "./grid/model";
import { getAlgo, isAlgoId } from "./info";
import { makeRegression, type RegressionData } from "./learn/gradient";
import { makeClusters, type ClusterData, type KInit } from "./learn/kmeans";
import { SEARCH_MAX, SEARCH_MIN, type TargetMode } from "./search/search";
import { SORT_MAX, SORT_MIN, type SortPreset } from "./sort/input";

export const FORMAT = "algoscope.experiment";
export const VERSION = 3;

type Json = Record<string, unknown>;

export interface Snapshot {
  exp: Experiment;
  cursor: number;
}

export type DecodeResult =
  | { ok: true; exp: Experiment; cursor: number }
  | { ok: false; error: string };

function rle(cells: Uint8Array): string {
  let out = "";
  let i = 0;
  while (i < cells.length) {
    let j = i;
    while (j < cells.length && cells[j] === cells[i]) j++;
    out += `${cells[i]}${(j - i).toString(36)}.`;
    i = j;
  }
  return out;
}

function unrle(text: string, length: number): Uint8Array | null {
  const out = new Uint8Array(length);
  let at = 0;
  for (const part of text.split(".")) {
    if (!part) continue;
    const d = Number(part[0]);
    const count = parseInt(part.slice(1), 36);
    if (
      !Number.isInteger(d) ||
      d < 0 ||
      d > 9 ||
      !Number.isInteger(count) ||
      count < 1 ||
      at + count > length
    )
      return null;
    out.fill(d, at, at + count);
    at += count;
  }
  return at === length ? out : null;
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;

export function toPlain(exp: Experiment, cursor = 0): Json {
  const base: Json = { f: exp.family, a: exp.a, b: exp.b, view: exp.view, cur: cursor };
  switch (exp.family) {
    case "grid": {
      const g = exp.input;
      return {
        ...base,
        in: {
          sz: g.size,
          w: g.w,
          h: g.h,
          s: g.start,
          t: g.target,
          d: g.diagonal ? 1 : 0,
          tr: g.terrain,
          sd: g.seed,
          c: rle(g.cells),
        },
      };
    }
    case "sort":
      return { ...base, in: { v: exp.input.values, p: exp.input.preset, sd: exp.input.seed } };
    case "search":
      return {
        ...base,
        in: { v: exp.input.values, t: exp.input.target, m: exp.input.mode, sd: exp.input.seed },
      };
    case "graph":
      return {
        ...base,
        in: {
          n: exp.input.nodes.map((p) => [round3(p.x), round3(p.y)]),
          e: exp.input.edges.map(([a, b]) => [a, b]),
          r: exp.input.root,
          sd: exp.input.seed,
          dn: exp.input.density,
        },
      };
    case "learn":
      return {
        ...base,
        m: exp.model,
        in: { ds: exp.input.dataset, n: exp.input.n, sd: exp.input.seed },
      };
  }
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function encode(exp: Experiment, cursor = 0): string {
  return bytesToB64url(
    new TextEncoder().encode(JSON.stringify({ v: VERSION, ...toPlain(exp, cursor) })),
  );
}

export function decode(code: string): DecodeResult {
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(b64urlToBytes(code)));
  } catch {
    return { ok: false, error: "This link is incomplete or was changed after it was copied." };
  }
  return fromPlain(raw);
}

export function toFile(exp: Experiment, cursor: number): string {
  return JSON.stringify(
    {
      format: FORMAT,
      version: VERSION,
      exported: new Date().toISOString(),
      experiment: toPlain(exp, cursor),
    },
    null,
    2,
  );
}

export function fromFile(text: string): DecodeResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file is not valid JSON." };
  }
  if (!isObj(raw) || raw.format !== FORMAT)
    return { ok: false, error: "That file is not an Algoscope experiment." };
  if (typeof raw.version !== "number" || raw.version > VERSION)
    return { ok: false, error: "That file was made by a newer version of Algoscope." };
  return fromPlain({ v: raw.version, ...(isObj(raw.experiment) ? raw.experiment : {}) });
}

function isObj(v: unknown): v is Json {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const int = (v: unknown, lo: number, hi: number): number | null =>
  typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi ? v : null;
const num = (v: unknown, lo: number, hi: number): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : null;
const oneOf = <T extends string>(v: unknown, opts: readonly T[]): T | null =>
  typeof v === "string" && (opts as readonly string[]).includes(v) ? (v as T) : null;

class Invalid extends Error {}
function need<T>(v: T | null | undefined, what: string): T {
  if (v === null || v === undefined) throw new Invalid(what);
  return v;
}

function variant(raw: unknown, family: string, model?: string): Experiment["a"] {
  if (!isObj(raw) || !isAlgoId(raw.algo)) throw new Invalid("unknown algorithm");
  const info = getAlgo(raw.algo);
  if (info.family !== family || (model && raw.algo !== model))
    throw new Invalid("algorithm does not match the experiment");
  const p = isObj(raw.params) ? raw.params : {};
  if (family === "grid") {
    return {
      algo: raw.algo,
      params: {
        heuristic:
          oneOf<Heuristic>(p.heuristic, ["manhattan", "euclidean", "octile", "zero"]) ??
          "manhattan",
        weight: num(p.weight, 1, 5) ?? 1,
      },
    } as Experiment["a"];
  }
  if (family === "sort")
    return {
      algo: raw.algo,
      params: { pivot: oneOf(p.pivot, ["last", "median3", "random"] as const) ?? "last" },
    } as Experiment["a"];
  if (raw.algo === "kmeans") {
    const manual = Array.isArray(p.manual)
      ? p.manual
          .filter(
            (q): q is { x: number; y: number } =>
              isObj(q) && num(q.x, 0, 1) !== null && num(q.y, 0, 1) !== null,
          )
          .slice(0, 8)
          .map((q) => ({ x: q.x, y: q.y }))
      : [];
    return {
      algo: "kmeans",
      params: {
        k: int(p.k, 1, 8) ?? 4,
        init: oneOf<KInit>(p.init, ["plusplus", "random", "corner", "manual"]) ?? "plusplus",
        manual,
      },
    } as Experiment["a"];
  }
  if (raw.algo === "gradient") {
    return {
      algo: "gradient",
      params: {
        lr: num(p.lr, 0.001, 3) ?? 0.6,
        beta: num(p.beta, 0, 0.99) ?? 0,
        m0: num(p.m0, -1.5, 2.3) ?? -1,
        b0: num(p.b0, -1, 1.4) ?? 1,
        steps: int(p.steps, 1, 500) ?? 80,
      },
    } as Experiment["a"];
  }
  return { algo: raw.algo, params: {} } as Experiment["a"];
}

function view(raw: unknown): ViewSettings {
  const v = isObj(raw) ? raw : {};
  return { values: v.values === true, overlay: v.overlay !== false };
}

export function fromPlain(raw: unknown): DecodeResult {
  try {
    if (!isObj(raw)) throw new Invalid("not an object");
    if (typeof raw.v === "number" && raw.v > VERSION)
      return { ok: false, error: "This experiment was made by a newer version of Algoscope." };
    const family = oneOf(raw.f, ["grid", "sort", "search", "graph", "learn"] as const);
    if (!family) throw new Invalid("unknown family");
    const inp = isObj(raw.in) ? raw.in : {};
    const model =
      family === "learn" ? need(oneOf(raw.m, ["kmeans", "gradient"] as const), "model") : undefined;
    const a = variant(raw.a, family, model);
    const b = raw.b === null || raw.b === undefined ? null : variant(raw.b, family, model);
    const vw = view(raw.view);
    let exp: Experiment;

    if (family === "grid") {
      const size = need(oneOf<GridSize>(inp.sz, ["S", "M", "L", "T"]), "grid size");
      const { w, h } = GRID_SIZES[size];
      if (inp.w !== w || inp.h !== h) throw new Invalid("grid dimensions");
      const cells = need(typeof inp.c === "string" ? unrle(inp.c, w * h) : null, "grid cells");
      const start = need(int(inp.s, 0, w * h - 1), "start");
      const target = need(int(inp.t, 0, w * h - 1), "target");
      if (start === target) throw new Invalid("start equals target");
      cells[start] = Math.max(1, cells[start]);
      cells[target] = Math.max(1, cells[target]);
      const input: GridInput = {
        w,
        h,
        cells,
        start,
        target,
        diagonal: inp.d === 1,
        terrain:
          oneOf<Terrain>(inp.tr, [
            "open",
            "maze",
            "rooms",
            "scatter",
            "weighted",
            "trap",
            "custom",
          ]) ?? "custom",
        seed: int(inp.sd, 0, 1e9) ?? 0,
        size,
      };
      exp = { family, input, a, b, view: vw } as Experiment;
    } else if (family === "sort") {
      const values = need(
        Array.isArray(inp.v) &&
          inp.v.length >= SORT_MIN &&
          inp.v.length <= SORT_MAX &&
          inp.v.every((x) => int(x, 1, 999) !== null)
          ? (inp.v as number[])
          : null,
        "values",
      );
      exp = {
        family,
        input: {
          values,
          preset:
            oneOf<SortPreset>(inp.p, ["random", "nearly", "reversed", "sorted", "few", "custom"]) ??
            "custom",
          seed: int(inp.sd, 0, 1e9) ?? 0,
        },
        a,
        b,
        view: vw,
      } as Experiment;
    } else if (family === "search") {
      const values = need(
        Array.isArray(inp.v) &&
          inp.v.length >= SEARCH_MIN &&
          inp.v.length <= SEARCH_MAX &&
          inp.v.every(
            (x, i, arr) =>
              int(x, 0, 1e6) !== null && (i === 0 || (x as number) >= (arr[i - 1] as number)),
          )
          ? (inp.v as number[])
          : null,
        "values",
      );
      exp = {
        family,
        input: {
          values,
          target: need(int(inp.t, 0, 1e6), "target"),
          mode:
            oneOf<TargetMode>(inp.m, ["middle", "first", "last", "absent", "random"]) ?? "random",
          seed: int(inp.sd, 0, 1e9) ?? 0,
        },
        a,
        b,
        view: vw,
      } as Experiment;
    } else if (family === "graph") {
      const nodesRaw = need(
        Array.isArray(inp.n) && inp.n.length >= GRAPH_MIN && inp.n.length <= GRAPH_MAX
          ? inp.n
          : null,
        "nodes",
      );
      const nodes = nodesRaw.map((p) => {
        if (!Array.isArray(p) || num(p[0], 0, 1) === null || num(p[1], 0, 1) === null)
          throw new Invalid("node position");
        return { x: p[0] as number, y: p[1] as number };
      });
      const density = int(inp.dn, 1, 6) ?? 3;
      let edges: GraphInput["edges"];
      if (Array.isArray(inp.e) && inp.e.length) {
        edges = inp.e.map((e) => {
          if (
            !Array.isArray(e) ||
            int(e[0], 0, nodes.length - 1) === null ||
            int(e[1], 0, nodes.length - 1) === null ||
            e[0] === e[1]
          )
            throw new Invalid("edge");
          const x = e[0] as number;
          const y = e[1] as number;
          return [Math.min(x, y), Math.max(x, y), edgeWeight(nodes[x], nodes[y])] as [
            number,
            number,
            number,
          ];
        });
      } else edges = connectEdges(nodes, density);
      exp = {
        family,
        input: {
          nodes,
          edges,
          root: int(inp.r, 0, nodes.length - 1) ?? 0,
          seed: int(inp.sd, 0, 1e9) ?? 0,
          density,
        },
        a,
        b,
        view: vw,
      } as Experiment;
    } else {
      const seed = int(inp.sd, 0, 1e9) ?? 0;
      if (model === "kmeans") {
        const ds = need(
          oneOf<ClusterData>(inp.ds, ["blobs", "overlap", "uneven", "moons", "uniform"]),
          "dataset",
        );
        exp = {
          family,
          model,
          input: makeClusters(ds, int(inp.n, 30, 400) ?? 200, seed),
          a,
          b,
          view: vw,
        } as Experiment;
      } else {
        const ds = need(oneOf<RegressionData>(inp.ds, ["linear", "outliers", "valley"]), "dataset");
        exp = {
          family,
          model: "gradient",
          input: makeRegression(ds, int(inp.n, 10, 200) ?? 60, seed),
          a,
          b,
          view: vw,
        } as Experiment;
      }
    }
    return { ok: true, exp, cursor: int(raw.cur, 0, 1e7) ?? 0 };
  } catch (err) {
    const what = err instanceof Invalid ? err.message : "unreadable data";
    return { ok: false, error: `This experiment could not be loaded (${what}).` };
  }
}
