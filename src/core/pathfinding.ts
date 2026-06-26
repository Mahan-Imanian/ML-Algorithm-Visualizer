import type { GridModel, GridEvent, GridFrame } from "./types";

export type PathAlgo = "bfs" | "dfs" | "dijkstra" | "astar";

const WEIGHT_COST = 5;

function neighbors(cell: number, g: GridModel): number[] {
  const r = Math.floor(cell / g.width);
  const c = cell % g.width;
  const out: number[] = [];
  if (r > 0) out.push(cell - g.width);
  if (r < g.height - 1) out.push(cell + g.width);
  if (c > 0) out.push(cell - 1);
  if (c < g.width - 1) out.push(cell + 1);
  return out.filter((n) => !g.walls.has(n));
}

function cost(cell: number, g: GridModel): number {
  return g.weights.get(cell) ? WEIGHT_COST : 1;
}

function manhattan(a: number, b: number, width: number): number {
  return Math.abs((a % width) - (b % width)) + Math.abs(Math.floor(a / width) - Math.floor(b / width));
}

function rebuild(cameFrom: Map<number, number>, target: number): number[] {
  const path: number[] = [];
  let cur: number | undefined = target;
  while (cur !== undefined) {
    path.unshift(cur);
    cur = cameFrom.get(cur);
  }
  return path;
}

export function runPathfinder(g: GridModel, algo: PathAlgo): GridEvent[] {
  if (algo === "bfs" || algo === "dfs") return runUnweighted(g, algo);
  return runWeighted(g, algo);
}

function runUnweighted(g: GridModel, algo: "bfs" | "dfs"): GridEvent[] {
  const events: GridEvent[] = [];
  const cameFrom = new Map<number, number>();
  const seen = new Set<number>([g.start]);
  const stack: number[] = [g.start];

  while (stack.length) {
    const cur = algo === "bfs" ? stack.shift()! : stack.pop()!;
    events.push({ t: "current", cell: cur, note: `Examine cell ${cur}`, line: 2 });
    events.push({ t: "visit", cell: cur, note: `Mark ${cur} visited`, line: 3 });

    if (cur === g.target) {
      events.push({ t: "path", cells: rebuild(cameFrom, g.target), note: "Target reached", line: 7 });
      return events;
    }
    for (const n of neighbors(cur, g)) {
      if (seen.has(n)) continue;
      seen.add(n);
      cameFrom.set(n, cur);
      stack.push(n);
      events.push({ t: "frontier", cell: n, note: `Queue ${n}`, line: 5 });
    }
  }
  events.push({ t: "path", cells: [], note: "No path to target", line: 7 });
  return events;
}

function runWeighted(g: GridModel, algo: "dijkstra" | "astar"): GridEvent[] {
  const events: GridEvent[] = [];
  const cameFrom = new Map<number, number>();
  const dist = new Map<number, number>([[g.start, 0]]);
  const settled = new Set<number>();
  const open = new Set<number>([g.start]);

  const priority = (cell: number) => {
    const d = dist.get(cell) ?? Infinity;
    return algo === "astar" ? d + manhattan(cell, g.target, g.width) : d;
  };

  while (open.size) {
    let cur = -1;
    let best = Infinity;
    for (const cell of open) {
      const p = priority(cell);
      if (p < best) {
        best = p;
        cur = cell;
      }
    }
    open.delete(cur);
    if (settled.has(cur)) continue;
    settled.add(cur);

    events.push({ t: "current", cell: cur, note: `Settle ${cur} (cost ${dist.get(cur)})`, line: 3 });
    events.push({ t: "visit", cell: cur, note: `Mark ${cur} visited`, line: 4 });

    if (cur === g.target) {
      events.push({ t: "path", cells: rebuild(cameFrom, g.target), note: "Shortest path found", line: 9 });
      return events;
    }
    for (const n of neighbors(cur, g)) {
      if (settled.has(n)) continue;
      const tentative = (dist.get(cur) ?? Infinity) + cost(n, g);
      if (tentative < (dist.get(n) ?? Infinity)) {
        dist.set(n, tentative);
        cameFrom.set(n, cur);
        open.add(n);
        events.push({ t: "frontier", cell: n, note: `Relax ${n} -> ${tentative}`, line: 7 });
      }
    }
  }
  events.push({ t: "path", cells: [], note: "No path to target", line: 9 });
  return events;
}

export function deriveGrid(events: GridEvent[], cursor: number): GridFrame {
  const visited = new Set<number>();
  const frontier = new Set<number>();
  let current: number | null = null;
  let path: number[] = [];
  let note = "Ready";
  let line = 0;

  for (let i = 0; i <= cursor && i < events.length; i++) {
    const e = events[i];
    note = e.note;
    line = e.line;
    if (e.t === "frontier") frontier.add(e.cell);
    else if (e.t === "current") current = e.cell;
    else if (e.t === "visit") {
      frontier.delete(e.cell);
      visited.add(e.cell);
    } else if (e.t === "path") path = e.cells;
  }
  return { visited, frontier, current, path, note, line };
}
