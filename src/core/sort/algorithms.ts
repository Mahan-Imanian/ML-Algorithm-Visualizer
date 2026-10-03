import { mulberry32 } from "../rng";
import { TraceBuilder } from "../trace";
import type { BaseEvent, Trace } from "../types";
import type { SortInput } from "./input";

export type SortAlgo = "insertion" | "selection" | "bubble" | "quick" | "merge" | "heap";
export type PivotRule = "last" | "median3" | "random";

export interface SortParams {
  pivot: PivotRule;
}

export const DEFAULT_SORT_PARAMS: SortParams = { pivot: "last" };

export type Pointers = Record<string, number | null>;

export type SortEvent = BaseEvent & { ptr?: Pointers } & (
    | { k: "compare"; i: number; j: number; res: boolean; buf?: boolean }
    | { k: "swap"; i: number; j: number }
    | { k: "copy"; lo: number; hi: number }
    | { k: "write"; at: number; item: number }
    | { k: "sorted"; lo: number; hi: number }
    | { k: "range"; lo: number; hi: number; push: boolean }
    | { k: "mark" }
  );

export function runSort(
  input: SortInput,
  algo: SortAlgo,
  params: SortParams = DEFAULT_SORT_PARAMS,
): Trace<SortEvent> {
  const vals = input.values;
  const n = vals.length;
  const a = vals.map((_, i) => i);
  const v = (pos: number) => vals[a[pos]];
  const tb = new TraceBuilder<SortEvent>("values out of place");
  const finalOrder = a.slice().sort((x, y) => vals[x] - vals[y] || x - y);
  const finalValues = finalOrder.map((id) => vals[id]);
  const misplaced = () => {
    let c = 0;
    for (let i = 0; i < n; i++) if (vals[a[i]] !== finalValues[i]) c++;
    return c;
  };
  const end = () => tb.endGroup(misplaced());

  const compare = (i: number, j: number, res: boolean, op: string, note: string, ptr?: Pointers) =>
    tb.emit({ k: "compare", i, j, res, op, note, ptr });
  const swap = (i: number, j: number, op: string, ptr?: Pointers) => {
    const vi = v(i);
    const vj = v(j);
    [a[i], a[j]] = [a[j], a[i]];
    tb.emit({ k: "swap", i, j, op, note: `Swap ${vi} and ${vj}`, ptr });
  };
  const sorted = (lo: number, hi: number, op: string, note: string, ptr?: Pointers) =>
    tb.emit({ k: "sorted", lo, hi, op, note, ptr });
  const mark = (op: string, note: string, ptr?: Pointers) => tb.emit({ k: "mark", op, note, ptr });

  tb.checkpoint("Start");

  if (algo === "insertion") {
    if (n) sorted(0, 0, "sorted", "A single value is trivially sorted");
    for (let i = 1; i < n; i++) {
      mark("outer", `Take ${v(i)} at index ${i}`, { i, j: i });
      let j = i;
      while (j > 0) {
        const res = v(j - 1) > v(j);
        compare(
          j - 1,
          j,
          res,
          "compare",
          `${v(j - 1)} > ${v(j)}? ${res ? "yes, keep sliding" : "no, it fits here"}`,
          { i, j },
        );
        if (!res) break;
        swap(j - 1, j, "swap", { i, j: j - 1 });
        j--;
      }
      sorted(0, i, "sorted", `First ${i + 1} values are in order`, { i, j: null });
      end();
      if (i === Math.floor(n / 2)) tb.checkpoint("Half the prefix sorted");
    }
  } else if (algo === "selection") {
    for (let i = 0; i < n - 1; i++) {
      let min = i;
      mark("outer", `Pass ${i + 1}: find the smallest of indices ${i}..${n - 1}`, {
        i,
        min,
        j: null,
      });
      for (let j = i + 1; j < n; j++) {
        const res = v(j) < v(min);
        const before = min;
        if (res) min = j;
        compare(
          j,
          before,
          res,
          "compare",
          res ? `${v(j)} < ${v(before)}: new minimum` : `${v(j)} ≥ ${v(before)}: keep minimum`,
          { i, j, min },
        );
      }
      if (min !== i) swap(i, min, "swap", { i, min, j: null });
      sorted(i, i, "sorted", `${v(i)} is in its final place`, { i, min: null, j: null });
      end();
    }
    if (n)
      sorted(n - 1, n - 1, "sorted", "Last value is in place by elimination", {
        i: null,
        min: null,
        j: null,
      });
  } else if (algo === "bubble") {
    let doneTo = n;
    for (let pass = 0; pass < n - 1; pass++) {
      mark("outer", `Pass ${pass + 1}`, { j: 0, end: n - 1 - pass });
      let swapped = false;
      for (let j = 0; j < n - 1 - pass; j++) {
        const res = v(j) > v(j + 1);
        compare(j, j + 1, res, "compare", `${v(j)} > ${v(j + 1)}? ${res ? "yes" : "no"}`, {
          j,
          end: n - 1 - pass,
        });
        if (res) {
          swap(j, j + 1, "swap", { j, end: n - 1 - pass });
          swapped = true;
        }
      }
      sorted(
        n - 1 - pass,
        n - 1 - pass,
        "sorted",
        `${v(n - 1 - pass)} bubbled to index ${n - 1 - pass}`,
        { j: null },
      );
      doneTo = n - 1 - pass;
      end();
      if (!swapped) {
        sorted(0, doneTo - 1, "early", "No swaps this pass: everything is already in order", {
          j: null,
          end: null,
        });
        tb.checkpoint("Early exit");
        doneTo = 0;
        end();
        break;
      }
    }
    if (doneTo > 0) sorted(0, 0, "sorted", "First value is in place", { j: null, end: null });
  } else if (algo === "quick") {
    const rng = mulberry32(input.seed + 17);
    const qs = (lo: number, hi: number, depth: number) => {
      tb.emit({
        k: "range",
        lo,
        hi,
        push: true,
        op: "range",
        note: `quicksort(${lo}, ${hi})${depth ? ` at depth ${depth}` : ""}`,
        ptr: { lo, hi, i: null, j: null, pivot: null },
      });
      if (lo >= hi) {
        if (lo === hi) sorted(lo, lo, "place", `${v(lo)} alone is in place`);
        tb.emit({ k: "range", lo, hi, push: false, op: "recurse", note: "Return" });
        return;
      }
      let p = hi;
      if (params.pivot === "median3") {
        const mid = (lo + hi) >> 1;
        const trio = [lo, mid, hi].sort((x, y) => v(x) - v(y));
        p = trio[1];
        mark("pivot", `Median of ${v(lo)}, ${v(mid)}, ${v(hi)} is ${v(p)}`, { lo, hi, pivot: p });
      } else if (params.pivot === "random") {
        p = lo + Math.floor(rng() * (hi - lo + 1));
        mark("pivot", `Random pivot ${v(p)} at index ${p}`, { lo, hi, pivot: p });
      } else {
        mark("pivot", `Pivot is the last value, ${v(hi)}`, { lo, hi, pivot: hi });
      }
      if (p !== hi) swap(p, hi, "pivot", { lo, hi, pivot: hi });
      const pv = v(hi);
      let i = lo;
      for (let j = lo; j < hi; j++) {
        const res = v(j) < pv;
        compare(j, hi, res, "compare", `${v(j)} < pivot ${pv}? ${res ? "yes, move left" : "no"}`, {
          lo,
          hi,
          i,
          j,
          pivot: hi,
        });
        if (res) {
          if (i !== j) swap(i, j, "swap", { lo, hi, i, j, pivot: hi });
          i++;
        }
      }
      if (i !== hi) swap(i, hi, "place", { lo, hi, i, j: null, pivot: i });
      sorted(i, i, "place", `Pivot ${pv} lands at index ${i}`, { lo, hi, i, j: null, pivot: i });
      end();
      if (depth === 0) tb.checkpoint("First partition done");
      qs(lo, i - 1, depth + 1);
      qs(i + 1, hi, depth + 1);
      tb.emit({
        k: "range",
        lo,
        hi,
        push: false,
        op: "recurse",
        note: `Both sides of ${lo}..${hi} sorted`,
      });
    };
    qs(0, n - 1, 0);
  } else if (algo === "merge") {
    const ms = (lo: number, hi: number, depth: number) => {
      tb.emit({
        k: "range",
        lo,
        hi,
        push: true,
        op: "range",
        note: `mergesort(${lo}, ${hi})`,
        ptr: { lo, hi },
      });
      if (hi - lo < 1) {
        tb.emit({
          k: "range",
          lo,
          hi,
          push: false,
          op: "range",
          note: "One value: already sorted",
        });
        return;
      }
      const mid = (lo + hi) >> 1;
      ms(lo, mid, depth + 1);
      ms(mid + 1, hi, depth + 1);
      const buffer = a.slice(lo, hi + 1);
      tb.emit({
        k: "copy",
        lo,
        hi,
        op: "copy",
        note: `Copy ${lo}..${hi} into the buffer`,
        ptr: { lo, mid, hi },
      });
      let i = lo;
      let j = mid + 1;
      let k = lo;
      const bv = (pos: number) => vals[buffer[pos - lo]];
      while (i <= mid && j <= hi) {
        const takeLeft = bv(i) <= bv(j);
        tb.emit({
          k: "compare",
          i,
          j,
          res: !takeLeft,
          buf: true,
          op: "compare",
          note: `${bv(i)} vs ${bv(j)}: take ${takeLeft ? bv(i) : bv(j)}`,
          ptr: { lo, mid, hi, k },
        });
        const item = takeLeft ? buffer[i++ - lo] : buffer[j++ - lo];
        a[k] = item;
        tb.emit({
          k: "write",
          at: k,
          item,
          op: "write",
          note: `Write ${vals[item]} to index ${k}`,
          ptr: { lo, mid, hi, k },
        });
        k++;
      }
      while (i <= mid || j <= hi) {
        const item = i <= mid ? buffer[i++ - lo] : buffer[j++ - lo];
        a[k] = item;
        tb.emit({
          k: "write",
          at: k,
          item,
          op: "drain",
          note: `Copy leftover ${vals[item]} to index ${k}`,
          ptr: { lo, mid, hi, k },
        });
        k++;
      }
      tb.emit({
        k: "range",
        lo,
        hi,
        push: false,
        op: "sorted",
        note: `Run ${lo}..${hi} is sorted`,
        ptr: { lo: null, mid: null, hi: null, k: null },
      });
      end();
      if (depth === 1) tb.checkpoint("Half merged");
    };
    ms(0, n - 1, 0);
    if (n) sorted(0, n - 1, "sorted", "All values sorted");
  } else {
    const siftDown = (start: number, size: number) => {
      let i = start;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= size) break;
        let c = l;
        const r = l + 1;
        if (r < size) {
          const res = v(r) > v(l);
          compare(
            r,
            l,
            res,
            "compare",
            `Children ${v(l)} and ${v(r)}: larger is ${res ? v(r) : v(l)}`,
            { i, child: res ? r : l, end: size },
          );
          if (res) c = r;
        }
        const res = v(c) > v(i);
        compare(
          c,
          i,
          res,
          "swap",
          `${v(c)} > parent ${v(i)}? ${res ? "yes, sift down" : "no, heap restored"}`,
          { i, child: c, end: size },
        );
        if (!res) break;
        swap(i, c, "swap", { i: c, child: null, end: size });
        i = c;
      }
    };
    for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
      mark("heapify", `Heapify subtree at index ${i}`, { i, end: n });
      siftDown(i, n);
      end();
    }
    tb.checkpoint("Max-heap built");
    for (let e = n - 1; e >= 1; e--) {
      mark("outer", `Heap holds indices 0..${e}`, { end: e + 1, i: 0 });
      swap(0, e, "extract", { end: e, i: 0 });
      sorted(e, e, "extract", `${v(e)} is the largest remaining`, { end: e });
      siftDown(0, e);
      end();
    }
    if (n)
      sorted(0, 0, "extract", "Smallest value stays at index 0", { end: 0, i: null, child: null });
  }

  tb.checkpoint("Sorted");
  return tb.finish(misplaced());
}
