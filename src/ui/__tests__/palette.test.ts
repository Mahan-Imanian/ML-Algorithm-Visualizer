import { beforeEach, describe, expect, it } from "vitest";
import { defaultExperiment } from "@/core/experiment";
import { useLab } from "@/store/lab";
import { buildCommands, searchCommands } from "../commands";

const top = (q: string) => searchCommands(buildCommands(), q)[0]?.id;

describe("command palette on the real command list", () => {
  beforeEach(() => {
    window.location.hash = "";
  });

  it("finds BFS however it is typed, from the explore page", () => {
    for (const q of ["BFS", "bfs", "Bfs", " BFS ", "breadth", "Breadth-first search"])
      expect(top(q), q).toBe("algo-bfs");
  });

  it("finds BFS from inside the lab, ahead of the compare command", () => {
    window.location.hash = "#/lab";
    useLab.getState().load(defaultExperiment("dfs"));
    expect(top("BFS")).toBe("algo-bfs");
    expect(searchCommands(buildCommands(), "BFS").map((c) => c.id)).toContain("cmp-bfs");
  });

  it("finds every algorithm by its short name", () => {
    const cases: Record<string, string> = {
      DFS: "algo-dfs",
      Dijkstra: "algo-dijkstra",
      "A*": "algo-astar",
      astar: "algo-astar",
      quicksort: "algo-quick",
      "merge sort": "algo-merge",
      "binary search": "algo-binary",
      "k-means": "algo-kmeans",
    };
    for (const [q, id] of Object.entries(cases)) expect(top(q), q).toBe(id);
  });
});
