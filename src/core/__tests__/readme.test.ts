import { describe, expect, it } from "vitest";
import { compareInsights, runVariant, variantLabel } from "../experiment";
import { getScenario, SCENARIOS } from "../scenarios";
import { ALGOS, FAMILIES } from "../info";

function pair(id: string) {
  const exp = getScenario(id)!.build(false);
  const a = runVariant(exp, "a")!;
  const b = runVariant(exp, "b")!;
  return { a, b, text: compareInsights(a, b, variantLabel(exp.a), variantLabel(exp.b!)) };
}

describe("figures quoted in the README come from the engine", () => {
  it("counts algorithms, families and prepared experiments", () => {
    expect(ALGOS).toHaveLength(18);
    expect(FAMILIES).toHaveLength(5);
    expect(SCENARIOS).toHaveLength(14);
  });

  it("A* against Dijkstra: cost 46, 295 vs 658 expansions, 55% fewer, diverging at (12, 4)", () => {
    const { text } = pair("astar-vs-dijkstra");
    expect(text.join(" ")).toContain("Both find a path of cost 46.");
    expect(text.join(" ")).toContain("expands 55% fewer cells (295 vs 658)");
    expect(text.join(" ")).toContain("then diverge at (12, 4)");
  });

  it("k-means++ settles at 1.657 after 2 iterations, the corner start at 7.718 after 4", () => {
    const { a, b } = pair("kmeans-init");
    if (a.family !== "kmeans" || b.family !== "kmeans") throw new Error("kmeans");
    const end = (r: typeof a) => r.player.at(r.trace.events.length).state;
    expect([end(a).inertia?.toFixed(3), end(a).iteration]).toEqual(["1.657", 2]);
    expect([end(b).inertia?.toFixed(3), end(b).iteration]).toEqual(["7.718", 4]);
  });
});
