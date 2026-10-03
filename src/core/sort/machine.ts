import type { Machine } from "../types";
import type { Pointers, SortEvent } from "./algorithms";
import type { SortInput } from "./input";

export interface SortState {
  values: number[];
  order: number[];
  buffer: number[] | null;
  bufferLo: number;
  sorted: Uint8Array;
  ptr: Pointers;
  compare: { i: number; j: number; res: boolean; buf: boolean } | null;
  swap: [number, number] | null;
  write: number | null;
  stack: { lo: number; hi: number }[];
  compares: number;
  swaps: number;
  writes: number;
}

export const sortMachine: Machine<SortInput, SortEvent, SortState> = {
  init(input) {
    return {
      values: input.values,
      order: input.values.map((_, i) => i),
      buffer: null,
      bufferLo: 0,
      sorted: new Uint8Array(input.values.length),
      ptr: {},
      compare: null,
      swap: null,
      write: null,
      stack: [],
      compares: 0,
      swaps: 0,
      writes: 0,
    };
  },

  apply(s, e) {
    s.compare = null;
    s.swap = null;
    s.write = null;
    if (e.ptr) s.ptr = { ...s.ptr, ...e.ptr };
    switch (e.k) {
      case "compare":
        s.compare = { i: e.i, j: e.j, res: e.res, buf: !!e.buf };
        s.compares++;
        break;
      case "swap":
        [s.order[e.i], s.order[e.j]] = [s.order[e.j], s.order[e.i]];
        s.swap = [e.i, e.j];
        s.swaps++;
        break;
      case "copy":
        s.buffer = s.order.slice(e.lo, e.hi + 1);
        s.bufferLo = e.lo;
        for (let i = e.lo; i <= e.hi; i++) s.order[i] = -1;
        break;
      case "write":
        s.order[e.at] = e.item;
        if (s.buffer) {
          const idx = s.buffer.indexOf(e.item);
          if (idx >= 0) s.buffer[idx] = -1;
        }
        s.write = e.at;
        s.writes++;
        break;
      case "sorted":
        for (let i = e.lo; i <= e.hi; i++) s.sorted[i] = 1;
        break;
      case "range":
        if (e.push) s.stack.push({ lo: e.lo, hi: e.hi });
        else {
          s.stack.pop();
          if (s.buffer && s.bufferLo === e.lo) s.buffer = null;
        }
        break;
      case "mark":
        break;
    }
  },

  clone(s) {
    return {
      ...s,
      order: s.order.slice(),
      buffer: s.buffer ? s.buffer.slice() : null,
      sorted: s.sorted.slice(),
      ptr: { ...s.ptr },
      stack: s.stack.slice(),
    };
  },
};
