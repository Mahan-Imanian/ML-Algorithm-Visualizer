import type { SortEvent, SortFrame } from "./types";

export type SortAlgo = "insertion" | "selection" | "bubble" | "quick";

/** Runs a sort over a copy of `input` and returns the ordered event trace. */
export function runSort(input: number[], algo: SortAlgo): SortEvent[] {
  const a = [...input];
  const events: SortEvent[] = [];
  const cmp = (i: number, j: number) =>
    events.push({ t: "compare", a: i, b: j, note: `Compare ${i} and ${j}`, line: 2 });
  const swap = (i: number, j: number) => {
    [a[i], a[j]] = [a[j], a[i]];
    events.push({ t: "swap", a: i, b: j, note: `Swap ${i} and ${j}`, line: 3 });
  };
  const sorted = (i: number) => events.push({ t: "sorted", index: i, note: `Index ${i} settled`, line: 5 });

  if (algo === "bubble") bubble(a, cmp, swap, sorted);
  else if (algo === "selection") selection(a, cmp, swap, sorted);
  else if (algo === "insertion") insertion(a, cmp, swap, sorted);
  else quick(a, 0, a.length - 1, events, cmp, swap, sorted);

  for (let i = 0; i < a.length; i++) events.push({ t: "sorted", index: i, note: "Sorted", line: 6 });
  return events;
}

type Cmp = (i: number, j: number) => void;
type Swap = (i: number, j: number) => void;
type Done = (i: number) => void;

function bubble(a: number[], cmp: Cmp, swap: Swap, done: Done) {
  for (let i = 0; i < a.length - 1; i++) {
    for (let j = 0; j < a.length - 1 - i; j++) {
      cmp(j, j + 1);
      if (a[j] > a[j + 1]) swap(j, j + 1);
    }
    done(a.length - 1 - i);
  }
}

function selection(a: number[], cmp: Cmp, swap: Swap, done: Done) {
  for (let i = 0; i < a.length; i++) {
    let min = i;
    for (let j = i + 1; j < a.length; j++) {
      cmp(min, j);
      if (a[j] < a[min]) min = j;
    }
    if (min !== i) swap(i, min);
    done(i);
  }
}

function insertion(a: number[], cmp: Cmp, swap: Swap, done: Done) {
  for (let i = 1; i < a.length; i++) {
    let j = i;
    while (j > 0) {
      cmp(j - 1, j);
      if (a[j - 1] <= a[j]) break;
      swap(j - 1, j);
      j--;
    }
  }
  done(0);
}

function quick(
  a: number[],
  lo: number,
  hi: number,
  events: SortEvent[],
  cmp: Cmp,
  swap: Swap,
  done: Done,
) {
  if (lo >= hi) {
    if (lo === hi) done(lo);
    return;
  }
  const pivot = a[hi];
  events.push({ t: "pivot", index: hi, note: `Pivot = index ${hi}`, line: 2 });
  let i = lo;
  for (let j = lo; j < hi; j++) {
    cmp(j, hi);
    if (a[j] < pivot) {
      if (i !== j) swap(i, j);
      i++;
    }
  }
  swap(i, hi);
  done(i);
  quick(a, lo, i - 1, events, cmp, swap, done);
  quick(a, i + 1, hi, events, cmp, swap, done);
}

/** Folds the trace up to `cursor` into the visual frame. */
export function deriveSort(initial: number[], events: SortEvent[], cursor: number): SortFrame {
  const array = [...initial];
  const sorted = new Set<number>();
  let comparing: number[] = [];
  let swapping: number[] = [];
  let pivot: number | null = null;
  let note = "Ready";
  let line = 0;

  for (let i = 0; i <= cursor && i < events.length; i++) {
    const e = events[i];
    note = e.note;
    line = e.line;
    comparing = [];
    swapping = [];
    if (e.t === "swap") {
      [array[e.a], array[e.b]] = [array[e.b], array[e.a]];
      swapping = [e.a, e.b];
    } else if (e.t === "compare") {
      comparing = [e.a, e.b];
    } else if (e.t === "pivot") {
      pivot = e.index;
    } else if (e.t === "sorted") {
      sorted.add(e.index);
    }
  }
  return { array, comparing, swapping, pivot, sorted, note, line };
}
