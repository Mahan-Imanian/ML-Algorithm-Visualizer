import { describe, it, expect } from "vitest";
import { createGrid, runPathfinder, deriveGrid } from "../index";
import type { GridModel } from "../types";

const manhattan = (a: number, b: number, w: number) =>
  Math.abs((a % w) - (b % w)) + Math.abs(Math.floor(a / w) - Math.floor(b / w));

function finalFrame(g: GridModel, algo: Parameters<typeof runPathfinder>[1]) {
  const events = runPathfinder(g, algo);
  return { events, frame: deriveGrid(events, events.length - 1) };
}

describe("pathfinding", () => {
  it("BFS finds the shortest path on an open grid", () => {
    const g = createGrid(12, 7);
    const { frame } = finalFrame(g, "bfs");
    expect(frame.path[0]).toBe(g.start);
    expect(frame.path.at(-1)).toBe(g.target);
    expect(frame.path.length).toBe(manhattan(g.start, g.target, g.width) + 1);
  });

  it("A* matches BFS path length on an open grid", () => {
    const g = createGrid(12, 7);
    const bfs = finalFrame(g, "bfs").frame.path.length;
    const astar = finalFrame(g, "astar").frame.path.length;
    expect(astar).toBe(bfs);
  });

  it("DFS reaches the target", () => {
    const g = createGrid(12, 7);
    const { frame } = finalFrame(g, "dfs");
    expect(frame.path[0]).toBe(g.start);
    expect(frame.path.at(-1)).toBe(g.target);
  });

  it("reports no path when the target is walled off", () => {
    const g = createGrid(12, 7);
    for (const n of [g.target - 1, g.target + 1, g.target - g.width, g.target + g.width]) {
      g.walls.add(n);
    }
    const { frame } = finalFrame(g, "bfs");
    expect(frame.path).toHaveLength(0);
    expect(frame.note.toLowerCase()).toContain("no path");
  });

  it("never reports a cell as frontier and visited at the same cursor", () => {
    const g = createGrid(10, 6);
    const events = runPathfinder(g, "dijkstra");
    const mid = deriveGrid(events, Math.floor(events.length / 2));
    for (const cell of mid.visited) expect(mid.frontier.has(cell)).toBe(false);
  });
});
