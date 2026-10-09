import { describe, expect, it } from "vitest";
import { defaultExperiment, runVariant, type Experiment, type KMeansExp } from "../experiment";
import { ALGOS } from "../info";
import { DEFAULT_GRADIENT_PARAMS, GRADIENT_LIMITS } from "../learn/gradient";
import { CLUSTER_POINTS, DEFAULT_KMEANS_PARAMS, K_RANGE } from "../learn/kmeans";
import { SCENARIOS } from "../scenarios";
import { decode, encode, fromFile, toFile, toPlain } from "../share";
import { parseCustomValues } from "../sort/input";

function sameRun(a: Experiment, b: Experiment) {
  const ra = runVariant(a, "a")!;
  const rb = runVariant(b, "a")!;
  expect(rb.trace.events.length).toBe(ra.trace.events.length);
  expect(rb.trace.events.map((e) => e.note)).toEqual(ra.trace.events.map((e) => e.note));
  if (a.b)
    expect(runVariant(b, "b")!.trace.events.length).toBe(runVariant(a, "b")!.trace.events.length);
}

describe("share links", () => {
  it("round-trips every scenario and reproduces identical traces", () => {
    for (const s of SCENARIOS) {
      for (const compact of [false, true]) {
        const exp = s.build(compact);
        const r = decode(encode(exp, 17));
        expect(r.ok, s.id).toBe(true);
        if (!r.ok) continue;
        expect(r.cursor).toBe(17);
        expect(toPlain(r.exp)).toEqual(toPlain(exp));
        sameRun(exp, r.exp);
      }
    }
  });

  it("round-trips the default experiment of every algorithm", () => {
    for (const a of ALGOS) {
      const exp = defaultExperiment(a.id);
      const r = decode(encode(exp));
      expect(r.ok, a.id).toBe(true);
      if (r.ok) sameRun(exp, r.exp);
    }
  });

  it("preserves hand-edited grids, custom arrays and dragged graph nodes", () => {
    const grid = defaultExperiment("astar");
    if (grid.family !== "grid") throw new Error("expected grid");
    grid.input.cells[grid.input.start + 1] = 0;
    grid.input.cells[grid.input.start + 2] = 7;
    grid.input.terrain = "custom";
    const g = decode(encode(grid));
    expect(g.ok && g.exp.family === "grid" && Array.from(g.exp.input.cells)).toEqual(
      Array.from(grid.input.cells),
    );

    const sort = defaultExperiment("merge");
    if (sort.family !== "sort") throw new Error("expected sort");
    sort.input = { values: [5, 1, 4, 999, 2], preset: "custom", seed: 0 };
    const s = decode(encode(sort));
    expect(s.ok && s.exp.family === "sort" && s.exp.input.values).toEqual([5, 1, 4, 999, 2]);

    const graph = defaultExperiment("prim");
    if (graph.family !== "graph") throw new Error("expected graph");
    graph.input.nodes[0] = { x: 0.5, y: 0.5 };
    const r = decode(encode(graph));
    expect(r.ok && r.exp.family === "graph" && r.exp.input.nodes[0]).toEqual({ x: 0.5, y: 0.5 });
  });

  it("rejects damaged, foreign and future links with a readable error", () => {
    expect(decode("not-base64!!").ok).toBe(false);
    const bad = decode(
      btoa(JSON.stringify({ v: 3, f: "grid", a: { algo: "quick", params: {} } })).replace(
        /=+$/,
        "",
      ),
    );
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toMatch(/could not be loaded/);
    const future = decode(btoa(JSON.stringify({ v: 99, f: "sort" })).replace(/=+$/, ""));
    expect(future.ok).toBe(false);
    if (!future.ok) expect(future.error).toMatch(/newer version/);
  });

  it("clamps out-of-range parameters instead of trusting them", () => {
    const exp = defaultExperiment("gradient");
    const plain = toPlain(exp) as { a: { params: { lr: number } } };
    plain.a.params.lr = 1e9;
    const code = btoa(JSON.stringify({ v: 3, ...plain }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const r = decode(code);
    expect(r.ok).toBe(true);
    if (r.ok && r.exp.family === "learn" && r.exp.model === "gradient")
      expect(r.exp.a.params.lr).toBe(0.6);
  });
});

const codeOf = (plain: unknown) =>
  btoa(JSON.stringify(plain)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

describe("hand-edited and malformed links", () => {
  it("keeps a graph whose edges were all removed", () => {
    const exp = defaultExperiment("kruskal");
    if (exp.family !== "graph") throw new Error("expected graph");
    exp.input = { ...exp.input, edges: [] };
    const r = decode(encode(exp));
    expect(r.ok && r.exp.family === "graph" && r.exp.input.edges).toEqual([]);
  });

  it("drops duplicate and reversed edges", () => {
    const plain = toPlain(defaultExperiment("prim")) as { in: { e: number[][] } };
    plain.in.e = [
      [0, 1],
      [1, 0],
      [0, 1],
      [3, 2],
    ];
    const r = decode(codeOf({ v: 3, ...plain }));
    expect(r.ok && r.exp.family === "graph" && r.exp.input.edges.map(([a, b]) => [a, b])).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  it("rejects grid run lengths with trailing or leading junk", () => {
    const plain = toPlain(defaultExperiment("bfs")) as { in: { c: string } };
    const [first, ...rest] = plain.in.c.split(".");
    for (const bad of [
      `${first}!`,
      `${first[0]} ${first.slice(1)}`,
      `${first[0]}+${first.slice(1)}`,
    ]) {
      const r = decode(
        codeOf({ v: 3, ...plain, in: { ...plain.in, c: [bad, ...rest].join(".") } }),
      );
      expect(r.ok, bad).toBe(false);
    }
  });

  it("decodes a minimal link that leaves every optional field out", () => {
    const r = decode(codeOf({ f: "sort", a: { algo: "merge" }, in: { v: [4, 3, 2, 1] } }));
    expect(r.ok).toBe(true);
    if (r.ok && r.exp.family === "sort") {
      expect(r.exp.input.values).toEqual([4, 3, 2, 1]);
      expect(r.exp.b).toBeNull();
      expect(r.exp.view).toEqual({ values: false, overlay: true });
      expect(r.cursor).toBe(0);
    }
  });

  it("accepts parameters only inside the ranges the editor offers", () => {
    const plain = toPlain(defaultExperiment("gradient")) as { a: { params: object } };
    const defaults: Record<string, number> = { ...DEFAULT_GRADIENT_PARAMS };
    for (const [key, range] of Object.entries(GRADIENT_LIMITS)) {
      const at = (value: number) => {
        const params = { ...plain.a.params, [key]: value };
        const r = decode(codeOf({ v: 3, ...plain, a: { ...plain.a, params } }));
        if (!r.ok) throw new Error(key);
        return (r.exp.a.params as Record<string, number>)[key];
      };
      expect(at(range.min), key).toBe(range.min);
      expect(at(range.max), key).toBe(range.max);
      expect(at(range.max + range.step), key).toBe(defaults[key]);
      expect(at(range.min - range.step), key).toBe(defaults[key]);
    }
  });

  it("accepts k-means and dataset sizes only inside the editor's ranges", () => {
    const exp = defaultExperiment("kmeans") as KMeansExp;
    const plain = toPlain(exp) as { a: { params: object }; in: object };
    const decodeWith = (k: number, n: number) => {
      const a = { ...plain.a, params: { ...plain.a.params, k } };
      const r = decode(codeOf({ v: 3, ...plain, a, in: { ...plain.in, n } }));
      if (!r.ok || r.exp.family !== "learn" || r.exp.model !== "kmeans") throw new Error("kmeans");
      return [r.exp.a.params.k, r.exp.input.n];
    };
    expect(decodeWith(K_RANGE.max, CLUSTER_POINTS.min)).toEqual([K_RANGE.max, CLUSTER_POINTS.min]);
    expect(decodeWith(K_RANGE.max + 1, CLUSTER_POINTS.min - 1)).toEqual([
      DEFAULT_KMEANS_PARAMS.k,
      exp.input.n,
    ]);
  });
});

describe("export and import files", () => {
  it("imports exactly what it exports", () => {
    const exp = SCENARIOS.find((s) => s.id === "greedy-trap")!.build(false);
    const r = fromFile(toFile(exp, 42));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.cursor).toBe(42);
      sameRun(exp, r.exp);
    }
  });

  it("explains why a file cannot be imported", () => {
    const notJson = fromFile("{oops");
    expect(!notJson.ok && notJson.error).toMatch(/not valid JSON/);
    const other = fromFile(JSON.stringify({ hello: 1 }));
    expect(!other.ok && other.error).toMatch(/not an Algoscope experiment/);
    const newer = fromFile(
      JSON.stringify({ format: "algoscope.experiment", version: 99, experiment: {} }),
    );
    expect(!newer.ok && newer.error).toMatch(/newer version/);
  });

  it("does not blame a newer version for a missing or malformed version", () => {
    const exp = toPlain(defaultExperiment("bfs"));
    for (const version of [undefined, "3", 0, -1, 2.5]) {
      const r = fromFile(
        JSON.stringify({ format: "algoscope.experiment", version, experiment: exp }),
      );
      expect(r.ok, String(version)).toBe(false);
      if (!r.ok) expect(r.error, String(version)).not.toMatch(/newer version/);
    }
  });
});

describe("custom sort input", () => {
  it("accepts commas and spaces and rejects bad values with a reason", () => {
    expect(parseCustomValues("5, 3 8;1")).toEqual({ values: [5, 3, 8, 1] });
    expect(parseCustomValues("1 2")).toEqual({ error: "Enter at least 4 numbers." });
    expect(parseCustomValues("1 2 3 x")).toEqual({ error: '"x" is not a whole number.' });
    expect(parseCustomValues("1 2 3 0")).toEqual({ error: "Use whole numbers from 1 to 999." });
    for (const bad of ["0x10", "1e2", "0b11", "NaN", "Infinity"])
      expect(parseCustomValues(`1 2 3 ${bad}`)).toEqual({
        error: `"${bad}" is not a whole number.`,
      });
    expect(parseCustomValues("")).toEqual({ error: "Enter at least 4 numbers." });
    expect(parseCustomValues("7 7 7 7")).toEqual({ values: [7, 7, 7, 7] });
  });
});
