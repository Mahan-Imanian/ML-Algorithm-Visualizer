import type { Machine } from "../types";
import type { GridEvent } from "./algorithms";
import type { GridInput } from "./model";

export interface FrontierEntry {
  cell: number;
  from: number;
  g: number;
  h: number;
  pri: number;
  seq: number;
}

export interface GridState {
  status: Uint8Array;
  parent: Int32Array;
  g: Float64Array;
  discoveredAt: Int32Array;
  closedAt: Int32Array;
  frontier: FrontierEntry[];
  current: number;
  pushedNow: number[];
  path: number[];
  pathCost: number;
  outcome: "running" | "found" | "nopath";
  expanded: number;
  pushes: number;
  skips: number;
  relaxations: number;
  maxFrontier: number;
}

export const OPEN = 1;
export const CLOSED = 2;

export const gridMachine: Machine<GridInput, GridEvent, GridState> = {
  init(input) {
    const n = input.w * input.h;
    return {
      status: new Uint8Array(n),
      parent: new Int32Array(n).fill(-1),
      g: new Float64Array(n).fill(Infinity),
      discoveredAt: new Int32Array(n).fill(-1),
      closedAt: new Int32Array(n).fill(-1),
      frontier: [],
      current: -1,
      pushedNow: [],
      path: [],
      pathCost: 0,
      outcome: "running",
      expanded: 0,
      pushes: 0,
      skips: 0,
      relaxations: 0,
      maxFrontier: 0,
    };
  },

  apply(s, e, index) {
    switch (e.k) {
      case "push": {
        if (s.status[e.cell] !== CLOSED) {
          s.status[e.cell] = OPEN;
          s.parent[e.cell] = e.from;
          s.g[e.cell] = e.g;
        }
        if (s.discoveredAt[e.cell] < 0) s.discoveredAt[e.cell] = index + 1;
        if (e.prevG !== Infinity) s.relaxations++;
        s.frontier.push({ cell: e.cell, from: e.from, g: e.g, h: e.h, pri: e.pri, seq: e.seq });
        s.pushes++;
        if (s.frontier.length > s.maxFrontier) s.maxFrontier = s.frontier.length;
        s.pushedNow.push(e.cell);
        break;
      }
      case "pop":
      case "skip": {
        removeSeq(s.frontier, e.seq);
        s.pushedNow = [];
        if (e.k === "skip") {
          s.skips++;
          break;
        }
        s.status[e.cell] = CLOSED;
        s.parent[e.cell] = e.from;
        s.g[e.cell] = e.g;
        s.closedAt[e.cell] = index + 1;
        s.current = e.cell;
        s.expanded++;
        break;
      }
      case "found":
        s.path = e.path;
        s.pathCost = e.cost;
        s.outcome = "found";
        s.pushedNow = [];
        break;
      case "nopath":
        s.outcome = "nopath";
        s.current = -1;
        break;
    }
  },

  clone(s) {
    return {
      ...s,
      status: s.status.slice(),
      parent: s.parent.slice(),
      g: s.g.slice(),
      discoveredAt: s.discoveredAt.slice(),
      closedAt: s.closedAt.slice(),
      frontier: s.frontier.slice(),
      pushedNow: s.pushedNow.slice(),
    };
  },
};

function removeSeq(list: FrontierEntry[], seq: number) {
  if (list.length && list[0].seq === seq) {
    list.shift();
    return;
  }
  if (list.length && list[list.length - 1].seq === seq) {
    list.pop();
    return;
  }
  const i = list.findIndex((x) => x.seq === seq);
  if (i >= 0) list.splice(i, 1);
}

export function orderedFrontier(
  list: FrontierEntry[],
  kind: "queue" | "stack" | "pq",
): FrontierEntry[] {
  if (kind === "queue") return list;
  if (kind === "stack") return [...list].reverse();
  return [...list].sort((a, b) => a.pri - b.pri || a.h - b.h || b.seq - a.seq);
}
