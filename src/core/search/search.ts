import { mulberry32 } from "../rng";
import { TraceBuilder } from "../trace";
import type { BaseEvent, Machine, Trace } from "../types";

export type SearchAlgo = "linear" | "binary" | "jump";
export type TargetMode = "middle" | "first" | "last" | "absent" | "random";

export interface SearchInput {
  values: number[];
  target: number;
  mode: TargetMode;
  seed: number;
}

export const SEARCH_MIN = 8;
export const SEARCH_MAX = 128;

export const TARGET_MODES: { id: TargetMode; label: string; hint: string }[] = [
  { id: "first", label: "First element", hint: "Best case for linear search." },
  { id: "middle", label: "Middle element", hint: "Best case for binary search." },
  { id: "last", label: "Last element", hint: "Worst case for linear search." },
  { id: "absent", label: "Not present", hint: "Every algorithm must prove a negative." },
  { id: "random", label: "Random element", hint: "A typical lookup." },
];

export function makeSearchInput(n: number, mode: TargetMode, seed: number): SearchInput {
  const size = Math.max(SEARCH_MIN, Math.min(SEARCH_MAX, Math.round(n)));
  const rng = mulberry32(seed);
  const values: number[] = [];
  let v = 2 + Math.floor(rng() * 4);
  for (let i = 0; i < size; i++) {
    values.push(v);
    v += 2 + Math.floor(rng() * 6);
  }
  let target: number;
  if (mode === "first") target = values[0];
  else if (mode === "last") target = values[size - 1];
  else if (mode === "middle") target = values[(size - 1) >> 1];
  else if (mode === "random") target = values[Math.floor(rng() * size)];
  else {
    const i = Math.floor(size * 0.6);
    target = values[i] + 1;
    while (values.includes(target)) target++;
  }
  return { values, target, mode, seed };
}

export type SearchEvent = BaseEvent &
  (
    | { k: "probe"; i: number; cmp: "<" | "=" | ">" }
    | { k: "range"; lo: number; hi: number }
    | { k: "found"; i: number }
    | { k: "absent" }
  );

export interface SearchState {
  values: number[];
  target: number;
  lo: number;
  hi: number;
  probe: number;
  cmp: "<" | "=" | ">" | null;
  probed: Uint8Array;
  found: number;
  done: boolean;
  probes: number;
}

export function runSearch(input: SearchInput, algo: SearchAlgo): Trace<SearchEvent> {
  const { values, target } = input;
  const n = values.length;
  const tb = new TraceBuilder<SearchEvent>("candidates left");
  const cmpOf = (i: number) => (values[i] < target ? "<" : values[i] > target ? ">" : "=");
  let left = n;
  tb.checkpoint("Start");

  if (algo === "linear") {
    for (let i = 0; i < n; i++) {
      const c = cmpOf(i);
      tb.emit({
        k: "probe",
        i,
        cmp: c,
        op: "probe",
        note: `a[${i}] = ${values[i]} ${c === "=" ? "=" : c === "<" ? "<" : ">"} ${target}`,
      });
      left = n - i - 1;
      if (c === "=") {
        tb.emit({
          k: "found",
          i,
          op: "found",
          note: `Found ${target} at index ${i} after ${i + 1} probes`,
        });
        tb.endGroup(0);
        tb.checkpoint("Found");
        return tb.finish(0);
      }
      if (c === ">") {
        tb.emit({
          k: "range",
          lo: i,
          hi: i - 1,
          op: "past",
          note: `${values[i]} > ${target}: the target cannot appear later`,
        });
        break;
      }
      tb.endGroup(left);
    }
  } else if (algo === "binary") {
    let lo = 0;
    let hi = n - 1;
    tb.emit({ k: "range", lo, hi, op: "init", note: `Search all ${n} slots` });
    tb.endGroup(n);
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const c = cmpOf(mid);
      tb.emit({
        k: "probe",
        i: mid,
        cmp: c,
        op: "probe",
        note: `mid = ${mid}: a[${mid}] = ${values[mid]}`,
      });
      if (c === "=") {
        tb.emit({ k: "found", i: mid, op: "found", note: `Found ${target} at index ${mid}` });
        tb.endGroup(0);
        tb.checkpoint("Found");
        return tb.finish(0);
      }
      if (c === "<") {
        lo = mid + 1;
        tb.emit({
          k: "range",
          lo,
          hi,
          op: "right",
          note: `${values[mid]} < ${target}: discard the left half`,
        });
      } else {
        hi = mid - 1;
        tb.emit({
          k: "range",
          lo,
          hi,
          op: "left",
          note: `${values[mid]} > ${target}: discard the right half`,
        });
      }
      tb.endGroup(Math.max(0, hi - lo + 1));
    }
  } else {
    const jump = Math.max(1, Math.floor(Math.sqrt(n)));
    let prev = 0;
    let step = jump;
    tb.emit({ k: "range", lo: 0, hi: n - 1, op: "init", note: `Block size ⌊√${n}⌋ = ${jump}` });
    tb.endGroup(n);
    for (;;) {
      const at = Math.min(step, n) - 1;
      const c = cmpOf(at);
      tb.emit({
        k: "probe",
        i: at,
        cmp: c,
        op: "jump",
        note: `Block end a[${at}] = ${values[at]}`,
      });
      if (c !== "<" || step >= n) {
        tb.emit({
          k: "range",
          lo: prev,
          hi: at,
          op: "jump",
          note: `Target must be in ${prev}..${at}`,
        });
        tb.endGroup(at - prev + 1);
        break;
      }
      prev = step;
      step += jump;
      tb.emit({
        k: "range",
        lo: prev,
        hi: n - 1,
        op: "jump",
        note: `Jump to block starting at ${prev}`,
      });
      tb.endGroup(n - prev);
      if (prev >= n) break;
    }
    tb.checkpoint("Block located");
    for (let i = prev; i < Math.min(step, n); i++) {
      const c = cmpOf(i);
      tb.emit({ k: "probe", i, cmp: c, op: "probe", note: `Scan a[${i}] = ${values[i]}` });
      if (c === "=") {
        tb.emit({ k: "found", i, op: "found", note: `Found ${target} at index ${i}` });
        tb.endGroup(0);
        tb.checkpoint("Found");
        return tb.finish(0);
      }
      if (c === ">") break;
      tb.endGroup(Math.min(step, n) - i - 1);
    }
  }
  tb.emit({ k: "absent", op: "absent", note: `${target} is not in the array` });
  tb.checkpoint("Absent");
  return tb.finish(0);
}

export const searchMachine: Machine<SearchInput, SearchEvent, SearchState> = {
  init(input) {
    return {
      values: input.values,
      target: input.target,
      lo: 0,
      hi: input.values.length - 1,
      probe: -1,
      cmp: null,
      probed: new Uint8Array(input.values.length),
      found: -1,
      done: false,
      probes: 0,
    };
  },
  apply(s, e) {
    if (e.k === "probe") {
      s.probe = e.i;
      s.cmp = e.cmp;
      s.probed[e.i] = 1;
      s.probes++;
    } else if (e.k === "range") {
      s.lo = e.lo;
      s.hi = e.hi;
    } else if (e.k === "found") {
      s.found = e.i;
      s.done = true;
    } else {
      s.done = true;
      s.lo = 0;
      s.hi = -1;
    }
  },
  clone(s) {
    return { ...s, probed: s.probed.slice() };
  },
};
