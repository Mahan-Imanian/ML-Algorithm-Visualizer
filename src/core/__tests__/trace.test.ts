import { describe, expect, it } from "vitest";
import { explain } from "@/ui/lab/explain";
import { defaultExperiment, metricsAt, runVariant, type Experiment, type Run } from "../experiment";
import { graphMachine } from "../graph/graph";
import { frontierKind } from "../grid/algorithms";
import { gridMachine, orderedFrontier } from "../grid/machine";
import { fmtCell, type Heuristic } from "../grid/model";
import { ALGOS, lineOf, type AlgoId } from "../info";
import { gradientMachine } from "../learn/gradient";
import { kmeansMachine } from "../learn/kmeans";
import { Player } from "../player";
import { mulberry32 } from "../rng";
import { SCENARIOS } from "../scenarios";
import { searchMachine } from "../search/search";
import { sortMachine } from "../sort/machine";

const fx = (v: number) => (Math.abs(v) >= 1000 ? v.toExponential(1) : v.toFixed(3));

function experimentsFor(id: AlgoId): Experiment[] {
  const out: Experiment[] = [
    defaultExperiment(id),
    defaultExperiment(id, { compact: true }),
    defaultExperiment(id, { seed: 3 }),
  ];
  const base = out[0];
  if (base.family === "grid") {
    for (const diagonal of [false, true]) {
      for (const heuristic of ["manhattan", "euclidean", "octile", "zero"] as Heuristic[]) {
        out.push({
          ...base,
          input: { ...base.input, diagonal },
          a: { algo: base.a.algo, params: { heuristic, weight: heuristic === "zero" ? 1 : 2 } },
        });
      }
    }
    const walled = { ...base.input, cells: base.input.cells.slice() };
    const t = walled.target;
    for (const c of [t - 1, t + 1, t - walled.w, t + walled.w]) walled.cells[c] = 0;
    out.push({ ...base, input: walled });
  }
  if (base.family === "sort" && base.a.algo === "quick") {
    for (const pivot of ["median3", "random"] as const)
      out.push({ ...base, a: { algo: "quick", params: { pivot } } });
  }
  if (base.family === "search") {
    for (const target of [base.input.values[0], base.input.values[20], -1, 10 ** 6])
      out.push({ ...base, input: { ...base.input, target } });
  }
  if (base.family === "learn" && base.model === "kmeans") {
    for (const init of ["random", "corner", "manual"] as const)
      out.push({
        ...base,
        a: { algo: "kmeans", params: { k: 3, init, manual: [{ x: 0.5, y: 0.5 }] } },
      });
  }
  if (base.family === "learn" && base.model === "gradient") {
    for (const [lr, beta] of [
      [0.2, 0.8],
      [1.2, 0],
    ])
      out.push({ ...base, a: { algo: "gradient", params: { ...base.a.params, lr, beta } } });
  }
  for (const s of SCENARIOS) {
    const e = s.build(false);
    if (e.a.algo === id) out.push(e);
    if (e.b?.algo === id) out.push({ ...e, a: e.b } as Experiment);
  }
  return out;
}

function freshAt(run: Run, c: number) {
  const events = run.trace.events.slice(0, c);
  switch (run.family) {
    case "grid":
      return new Player(gridMachine, run.input, events as typeof run.trace.events).at(c);
    case "sort":
      return new Player(sortMachine, run.input, events as typeof run.trace.events).at(c);
    case "search":
      return new Player(searchMachine, run.input, events as typeof run.trace.events).at(c);
    case "graph":
      return new Player(graphMachine, run.input, events as typeof run.trace.events).at(c);
    case "kmeans":
      return new Player(kmeansMachine, run.input, events as typeof run.trace.events).at(c);
    case "gradient":
      return new Player(gradientMachine, run.input, events as typeof run.trace.events).at(c);
  }
}

const copy = (v: unknown): unknown =>
  ArrayBuffer.isView(v)
    ? (v as Uint8Array).slice()
    : Array.isArray(v)
      ? v.map(copy)
      : v && typeof v === "object"
        ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, copy(x)]))
        : v;

const lastOf = <E extends { k: string }>(events: E[], k: string) =>
  [...events].reverse().find((e) => e.k === k);

function checkResult(run: Run) {
  const end = run.trace.events.length;
  switch (run.family) {
    case "grid": {
      const s = run.player.at(end).state;
      const last = run.trace.events[end - 1];
      if (last.k === "found") {
        expect(s.outcome).toBe("found");
        expect(s.path).toEqual(last.path);
        expect(s.pathCost).toBe(last.cost);
      } else expect(s.outcome).toBe("nopath");
      break;
    }
    case "sort": {
      const s = run.player.at(end).state;
      const count = (k: string) => run.trace.events.filter((e) => e.k === k).length;
      expect(s.order.map((id) => s.values[id])).toEqual([...s.values].sort((a, b) => a - b));
      expect([s.compares, s.swaps, s.writes]).toEqual([
        count("compare"),
        count("swap"),
        count("write"),
      ]);
      break;
    }
    case "search": {
      const s = run.player.at(end).state;
      const last = run.trace.events[end - 1];
      expect(s.done).toBe(true);
      expect(s.found).toBe(last.k === "found" ? last.i : -1);
      break;
    }
    case "graph": {
      const s = run.player.at(end).state;
      expect(s.total).toBe(run.trace.series.at(-1));
      expect(s.treeEdges).toBe(run.trace.events.filter((e) => e.k === "accept").length);
      break;
    }
    case "kmeans": {
      const s = run.player.at(end).state;
      const update = lastOf(run.trace.events, "update");
      expect(s.inertia).toBe(run.trace.series.at(-1));
      if (update?.k === "update") expect(s.centroids).toEqual(update.centroids);
      break;
    }
    case "gradient": {
      const s = run.player.at(end).state;
      const update = lastOf(run.trace.events, "update");
      if (update?.k === "update")
        expect([s.m, s.b, s.loss]).toEqual([update.m, update.b, update.loss]);
      expect(s.phase === "diverged").toBe(run.trace.events[end - 1].k === "diverged");
      break;
    }
  }
}

function checkEvent(run: Run, k: number) {
  switch (run.family) {
    case "grid": {
      const e = run.trace.events[k];
      const next = orderedFrontier(run.player.at(k).state.frontier, frontierKind(run.algo))[0];
      const s = run.player.at(k + 1).state;
      if (e.k === "push" || e.k === "pop" || e.k === "skip")
        expect(e.note).toContain(fmtCell(e.cell, run.input.w));
      if (e.k === "pop" || e.k === "skip") expect(next.seq, "the panel's first entry").toBe(e.seq);
      if (e.k === "push") {
        expect(s.frontier.some((x) => x.seq === e.seq && x.g === e.g)).toBe(true);
        if (Number.isFinite(e.prevG)) expect(e.note).toContain(`${e.prevG} → ${e.g}`);
      }
      if (e.k === "pop") {
        expect(s.current).toBe(e.cell);
        expect(s.g[e.cell]).toBe(e.g);
        if (run.algo === "dijkstra") expect(e.note).toContain(`dist ${e.g}`);
      }
      break;
    }
    case "sort": {
      const e = run.trace.events[k];
      const s0 = run.player.at(k).state;
      const v0 = s0.order.map((id) => (id < 0 ? -1 : s0.values[id]));
      const s = run.player.at(k + 1).state;
      const v1 = (pos: number) => s.values[s.order[pos]];
      if (e.k === "compare" && !e.buf) {
        expect(e.note).toContain(String(v0[e.i]));
        expect(e.note).toContain(String(v0[e.j]));
        expect(s.compare).toEqual({ i: e.i, j: e.j, res: e.res, buf: false });
      }
      if (e.k === "swap") {
        expect([v1(e.i), v1(e.j)]).toEqual([v0[e.j], v0[e.i]]);
        expect(e.note).toBe(`Swap ${v0[e.i]} and ${v0[e.j]}`);
      }
      if (e.k === "write") expect(e.note).toContain(`${v1(e.at)} to index ${e.at}`);
      const final = [...s.values].sort((a, b) => a - b);
      const marked = Array.from(s.sorted.keys()).filter((i) => s.sorted[i]);
      if (run.algo === "insertion") {
        if (e.k === "sorted") expect(marked.map(v1)).toEqual(marked.map(v1).sort((a, b) => a - b));
      } else for (const i of marked) expect(v1(i), `index ${i} is marked final`).toBe(final[i]);
      break;
    }
    case "search": {
      const e = run.trace.events[k];
      const s = run.player.at(k + 1).state;
      const { values, target } = run.input;
      if (e.k === "probe") expect(e.note).toContain(`a[${e.i}] = ${values[e.i]}`);
      if (e.k === "range") expect([s.lo, s.hi]).toEqual([e.lo, e.hi]);
      if (e.k === "found") {
        expect(values[e.i]).toBe(target);
        expect(e.note).toContain(`Found ${target} at index ${e.i}`);
      }
      break;
    }
    case "graph": {
      const e = run.trace.events[k];
      const total = run.player.at(k).state.total;
      const s = run.player.at(k + 1).state;
      if ("edge" in e) {
        const [a, b, w] = run.input.edges[e.edge];
        expect(e.note).toContain(`${a}–${b} (w ${w})`);
        if (e.k === "accept") expect(s.total).toBe(total + w);
      }
      if (e.k === "done" && e.note.startsWith("Spanning"))
        expect(e.note).toContain(`total weight ${s.total}`);
      break;
    }
    case "kmeans": {
      const e = run.trace.events[k];
      const s = run.player.at(k + 1).state;
      if (e.k === "centroid") expect(e.note).toContain(`(${e.x.toFixed(2)}, ${e.y.toFixed(2)})`);
      if (e.k === "assign") {
        expect(s.changed).toBe(e.changed);
        if (s.iteration > 1)
          expect(e.note).toContain(`Iteration ${s.iteration}: ${e.changed} point`);
      }
      if (e.k === "update" && !e.empty.length) expect(e.note).toContain(e.shift.toFixed(3));
      break;
    }
    case "gradient": {
      const e = run.trace.events[k];
      const s0 = run.player.at(k).state;
      if (e.k === "start")
        expect(e.note).toBe(`Start at m = ${fx(s0.m)}, b = ${fx(s0.b)} · loss ${fx(s0.loss)}`);
      const s = run.player.at(k + 1).state;
      if (e.k === "gradient") expect(e.note).toContain(`Step ${s.step + 1}:`);
      if (e.k === "update")
        expect(e.note).toBe(`Update: m = ${fx(s.m)}, b = ${fx(s.b)} · loss ${fx(s.loss)}`);
      break;
    }
  }
}

describe("trace integrity", () => {
  for (const info of ALGOS) {
    describe(info.id, () => {
      const runs = experimentsFor(info.id).map((exp) => runVariant(exp, "a")!);

      it("every event names an existing pseudocode line", () => {
        for (const run of runs)
          for (const e of run.trace.events)
            expect(lineOf(info, e.op), `op "${e.op}"`).toBeGreaterThanOrEqual(0);
      });

      it("replaying the trace reaches the algorithm's own result", () => {
        for (const run of runs) checkResult(run);
      });

      it("stepping back then forward reproduces identical state", () => {
        for (const run of runs) {
          const n = run.trace.events.length;
          const rng = mulberry32(n);
          const cursors = [0, n, ...Array.from({ length: 10 }, () => Math.floor(rng() * (n + 1)))];
          for (const c of cursors) {
            const frame = run.player.at(c);
            const snap = copy({ state: frame.state, hits: frame.hits }) as typeof frame;
            for (let back = 1; back <= 70 && c - back >= 0; back += 23) run.player.at(c - back);
            run.player.at(Math.min(n, c + 1));
            const again = run.player.at(c);
            expect({ state: again.state, hits: again.hits }).toEqual(snap);
            expect(freshAt(run, c).state).toEqual(snap.state);
          }
        }
      });

      it("captions and metrics agree with the state at every step", () => {
        for (const run of runs) {
          const n = run.trace.events.length;
          for (let k = 0; k < n; k++) checkEvent(run, k);
          for (let k = 0; k <= n; k++) {
            const x = explain(run, k);
            expect(`${x.now} ${x.why} ${x.next ?? ""}`, `cursor ${k}`).not.toMatch(
              /undefined|NaN|null|\[object/,
            );
            if (run.algo === "insertion" && k && k < n && run.trace.events[k - 1].k === "sorted")
              expect(x.why).not.toMatch(/not change again|final/);
            for (const m of metricsAt(run, k)) expect(String(m.value)).not.toMatch(/NaN|undefined/);
          }
        }
      });
    });
  }
});
