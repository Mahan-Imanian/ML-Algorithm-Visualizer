import { MinHeap } from "../heap";
import { TraceBuilder } from "../trace";
import type { BaseEvent, Trace } from "../types";
import {
  fmtCell,
  heuristic,
  moveCost,
  neighbors,
  round2,
  type GridInput,
  type Heuristic,
} from "./model";

export type GridAlgo = "bfs" | "dfs" | "dijkstra" | "astar" | "greedy";
export type FrontierKind = "queue" | "stack" | "pq";

export interface GridParams {
  heuristic: Heuristic;
  weight: number;
}

export const DEFAULT_GRID_PARAMS: GridParams = { heuristic: "manhattan", weight: 1 };

export type GridEvent = BaseEvent &
  (
    | {
        k: "push";
        cell: number;
        from: number;
        g: number;
        h: number;
        pri: number;
        seq: number;
        prevG: number;
      }
    | { k: "pop"; cell: number; seq: number; from: number; g: number }
    | { k: "skip"; cell: number; seq: number }
    | { k: "found"; path: number[]; cost: number }
    | { k: "nopath" }
  );

interface Entry {
  cell: number;
  from: number;
  g: number;
  h: number;
  pri: number;
  seq: number;
}

export function frontierKind(algo: GridAlgo): FrontierKind {
  return algo === "bfs" ? "queue" : algo === "dfs" ? "stack" : "pq";
}

export function runGrid(
  g: GridInput,
  algo: GridAlgo,
  params: GridParams = DEFAULT_GRID_PARAMS,
): Trace<GridEvent> {
  const tb = new TraceBuilder<GridEvent>("frontier size");
  const n = g.w * g.h;
  const fmt = (c: number) => fmtCell(c, g.w);
  const hOf = (c: number) =>
    algo === "astar" || algo === "greedy"
      ? round2(heuristic(params.heuristic, c, g.target, g.w))
      : 0;
  const w = algo === "astar" ? params.weight : 1;
  const priority = (gv: number, hv: number) =>
    algo === "greedy" ? hv : algo === "astar" ? round2(gv + w * hv) : gv;

  const best = new Float64Array(n).fill(Infinity);
  const parent = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const seen = new Uint8Array(n);
  let seq = 0;
  let size = 0;
  let targetSeen = false;

  const push = (
    cell: number,
    from: number,
    gv: number,
    op: string,
    note: string,
    prevG = Infinity,
  ) => {
    const hv = hOf(cell);
    const entry: Entry = {
      cell,
      from,
      g: round2(gv),
      h: hv,
      pri: priority(round2(gv), hv),
      seq: seq++,
    };
    tb.emit({ k: "push", op, note, ...entry, prevG });
    size++;
    if (cell === g.target && !targetSeen) {
      targetSeen = true;
      tb.checkpoint("Target discovered");
    }
    return entry;
  };

  const finishFound = (op: string) => {
    const path: number[] = [];
    for (let c = g.target; c !== -1; c = parent[c]) path.unshift(c);
    let cost = 0;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];
      const diag = Math.abs(a - b) !== 1 && Math.abs(a - b) !== g.w;
      cost += g.cells[b] * (diag ? Math.SQRT2 : 1);
    }
    tb.emit({
      k: "found",
      op,
      note: `Target reached. The reconstructed path has ${path.length - 1} edges and costs ${round2(cost)}`,
      path,
      cost: round2(cost),
    });
    tb.checkpoint("Path found");
  };

  tb.checkpoint("Start");

  if (algo === "bfs") {
    const queue: Entry[] = [];
    seen[g.start] = 1;
    best[g.start] = 0;
    queue.push(push(g.start, -1, 0, "init", `Enqueue start ${fmt(g.start)}`));
    tb.endGroup(size);
    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      size--;
      tb.emit({
        k: "pop",
        op: "dequeue",
        note: `Dequeue ${fmt(cur.cell)}`,
        cell: cur.cell,
        seq: cur.seq,
        from: cur.from,
        g: cur.g,
      });
      if (cur.cell === g.target) {
        finishFound("found");
        return tb.finish(size);
      }
      for (const s of neighbors(g, cur.cell)) {
        if (seen[s.to]) continue;
        seen[s.to] = 1;
        parent[s.to] = cur.cell;
        best[s.to] = cur.g + 1;
        queue.push(
          push(
            s.to,
            cur.cell,
            cur.g + 1,
            "enqueue",
            `Enqueue ${fmt(s.to)} · ${cur.g + 1} moves from start`,
          ),
        );
      }
      tb.endGroup(size);
    }
  } else if (algo === "dfs") {
    const stack: Entry[] = [push(g.start, -1, 0, "init", `Push start ${fmt(g.start)}`)];
    tb.endGroup(size);
    while (stack.length) {
      const cur = stack.pop()!;
      size--;
      if (closed[cur.cell]) {
        tb.emit({
          k: "skip",
          op: "skip",
          note: `Skip ${fmt(cur.cell)}: already visited`,
          cell: cur.cell,
          seq: cur.seq,
        });
        continue;
      }
      closed[cur.cell] = 1;
      parent[cur.cell] = cur.from;
      best[cur.cell] = cur.g;
      tb.emit({
        k: "pop",
        op: "visit",
        note: `Pop and visit ${fmt(cur.cell)}`,
        cell: cur.cell,
        seq: cur.seq,
        from: cur.from,
        g: cur.g,
      });
      if (cur.cell === g.target) {
        finishFound("found");
        return tb.finish(size);
      }
      const next = neighbors(g, cur.cell).reverse();
      for (const s of next) {
        if (closed[s.to]) continue;
        stack.push(push(s.to, cur.cell, cur.g + 1, "push", `Push ${fmt(s.to)} onto the stack`));
      }
      tb.endGroup(size);
    }
  } else {
    const heap = new MinHeap<Entry>((a, b) =>
      a.pri !== b.pri ? a.pri < b.pri : a.h !== b.h ? a.h < b.h : a.seq > b.seq,
    );
    best[g.start] = 0;
    seen[g.start] = 1;
    heap.push(
      push(
        g.start,
        -1,
        0,
        "init",
        `Push start ${fmt(g.start)} with priority ${priority(0, hOf(g.start))}`,
      ),
    );
    tb.endGroup(size);
    const popOp = algo === "dijkstra" ? "settle" : "close";
    while (heap.size) {
      const cur = heap.pop()!;
      size--;
      if (closed[cur.cell]) {
        tb.emit({
          k: "skip",
          op: "skip",
          note: `Skip stale entry ${fmt(cur.cell)} (${algo === "dijkstra" ? "dist" : "f"} ${cur.pri})`,
          cell: cur.cell,
          seq: cur.seq,
        });
        continue;
      }
      closed[cur.cell] = 1;
      parent[cur.cell] = cur.from;
      const label =
        algo === "dijkstra"
          ? `dist ${cur.g}`
          : algo === "astar"
            ? `f ${cur.pri} = g ${cur.g} + h ${cur.h}`
            : `h ${cur.h}`;
      tb.emit({
        k: "pop",
        op: popOp,
        note: `${algo === "dijkstra" ? "Settle" : "Close"} ${fmt(cur.cell)} · ${label}`,
        cell: cur.cell,
        seq: cur.seq,
        from: cur.from,
        g: cur.g,
      });
      if (cur.cell === g.target) {
        finishFound("found");
        return tb.finish(size);
      }
      for (const s of neighbors(g, cur.cell)) {
        if (closed[s.to]) continue;
        if (algo === "greedy") {
          if (seen[s.to]) continue;
          seen[s.to] = 1;
          parent[s.to] = cur.cell;
          const gv = cur.g + moveCost(g, s);
          best[s.to] = gv;
          heap.push(push(s.to, cur.cell, gv, "push", `Push ${fmt(s.to)} · h ${hOf(s.to)}`));
          continue;
        }
        const alt = round2(cur.g + moveCost(g, s));
        if (alt < best[s.to]) {
          const before = best[s.to];
          best[s.to] = alt;
          parent[s.to] = cur.cell;
          seen[s.to] = 1;
          const what = algo === "dijkstra" ? "dist" : "g";
          const note =
            before === Infinity
              ? `Discover ${fmt(s.to)} · ${what} ${alt}`
              : `Relax ${fmt(s.to)} · ${what} ${before} → ${alt}`;
          heap.push(push(s.to, cur.cell, alt, "relax", note, before));
        }
      }
      tb.endGroup(size);
    }
  }

  tb.emit({
    k: "nopath",
    op: "nopath",
    note: "Frontier empty and the target never reached: no route exists",
  });
  tb.checkpoint("No path");
  return tb.finish(size);
}
