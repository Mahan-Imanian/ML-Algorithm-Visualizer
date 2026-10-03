import { describe, expect, it } from "vitest";
import { defaultExperiment, runVariant, type Experiment } from "../experiment";
import { ALGOS } from "../info";
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
});

describe("custom sort input", () => {
  it("accepts commas and spaces and rejects bad values with a reason", () => {
    expect(parseCustomValues("5, 3 8;1")).toEqual({ values: [5, 3, 8, 1] });
    expect(parseCustomValues("1 2")).toEqual({ error: "Enter at least 4 numbers." });
    expect(parseCustomValues("1 2 3 x")).toEqual({ error: '"x" is not a whole number.' });
    expect(parseCustomValues("1 2 3 0")).toEqual({ error: "Use whole numbers from 1 to 999." });
  });
});
