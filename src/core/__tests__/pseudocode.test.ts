import { describe, expect, it } from "vitest";
import { ALGOS, lineOf, type AlgoId } from "../info";
import { defaultExperiment, runVariant, type Experiment } from "../experiment";
import { SCENARIOS } from "../scenarios";
import { makeGrid } from "../grid/terrain";

const KEYWORDS: Record<string, RegExp> = {
  dequeue: /dequeue/,
  enqueue: /enqueue/,
  relax: /push/,
  settle: /settle/,
  close: /close/,
  skip: /continue/,
  found: /return|found/,
  nopath: /no path/,
  visit: /visited/,
  init: /←|sort|place|start/,
  compare: /if|while|larger|smaller|take/,
  swap: /swap/,
  write: /a\[k\]/,
  drain: /remaining/,
  pivot: /pivot/,
  place: /final place/,
  assign: /assign/,
  update: /mean|lr/,
  gradient: /∇/,
  accept: /add|union/,
  reject: /discard|skip/,
  probe: /mid|for i/,
};

function experimentsFor(id: AlgoId): Experiment[] {
  const base = defaultExperiment(id);
  const out = [base];
  if (base.family === "grid") {
    out.push({ ...base, input: makeGrid("S", "open", 1) });
    const blocked = makeGrid("S", "open", 1);
    blocked.cells[blocked.target - 1] = 0;
    blocked.cells[blocked.target + 1] = 0;
    blocked.cells[blocked.target - blocked.w] = 0;
    blocked.cells[blocked.target + blocked.w] = 0;
    out.push({ ...base, input: blocked });
  }
  for (const s of SCENARIOS) {
    const e = s.build(false);
    if (e.a.algo === id) out.push(e);
    if (e.b?.algo === id) out.push({ ...e, a: e.b } as Experiment);
  }
  return out;
}

describe("pseudocode synchronisation", () => {
  for (const info of ALGOS) {
    it(`${info.id}: every event points at an existing, matching line`, () => {
      const ops = new Set<string>();
      for (const exp of experimentsFor(info.id)) {
        const run = runVariant(exp, "a")!;
        for (const e of run.trace.events) {
          const line = lineOf(info, e.op);
          expect(line, `op "${e.op}" has no line in ${info.id}`).toBeGreaterThanOrEqual(0);
          ops.add(e.op);
        }
      }
      for (const op of ops) {
        const kw = KEYWORDS[op];
        if (!kw) continue;
        expect(info.code[lineOf(info, op)].text.toLowerCase(), `${info.id}:${op}`).toMatch(kw);
      }
    });
  }

  it("every anchor is unique within its algorithm", () => {
    for (const info of ALGOS) {
      const anchors = info.code.map((l) => l.op).filter(Boolean);
      expect(new Set(anchors).size).toBe(anchors.length);
    }
  });
});
