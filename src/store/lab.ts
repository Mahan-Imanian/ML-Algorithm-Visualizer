import { create } from "zustand";
import {
  defaultExperiment,
  runVariant,
  withAlgo,
  type AnyVariant,
  type Experiment,
  type Run,
} from "@/core/experiment";
import { MUD_COST } from "@/core/grid/model";
import type { AlgoId } from "@/core/info";
import { nextGroupCursor, prevGroupCursor } from "@/core/trace";

export type Tool = "wall" | "weight" | "erase" | "start" | "target";
export type GraphTool = "move" | "edge" | "node" | "delete";
export type Granularity = "step" | "op";

export const SPEEDS = [0.25, 0.5, 1, 2, 4, 8] as const;

interface LabStore {
  exp: Experiment;
  runA: Run;
  runB: Run | null;
  cursorA: number;
  cursorB: number;
  playing: boolean;
  speed: number;
  granularity: Granularity;
  tool: Tool;
  weight: number;
  editing: boolean;
  focusCell: number | null;
  revision: number;
  bookmarks: number[];
  graphTool: GraphTool;
  edgeFrom: number | null;

  load(exp: Experiment, cursor?: number): void;
  update(fn: (exp: Experiment) => Experiment, opts?: { keepCursor?: boolean }): void;
  setAlgo(id: AlgoId, compact?: boolean): void;
  setVariantB(v: AnyVariant | null): void;
  setParams(which: "a" | "b", params: AnyVariant["params"]): void;
  beginEdit(): void;
  editInput(fn: (exp: Experiment) => Experiment): void;
  endEdit(): void;

  play(): void;
  pause(): void;
  toggle(): void;
  step(dir: 1 | -1, unit?: Granularity): void;
  seek(position: number): void;
  toStart(): void;
  toEnd(): void;
  checkpoint(dir: 1 | -1): void;
  restart(): void;
  advance(units: number): boolean;

  setSpeed(i: number): void;
  setGranularity(g: Granularity): void;
  setTool(t: Tool): void;
  setWeight(w: number): void;
  setFocusCell(c: number | null): void;
  toggleBookmark(): void;
  setGraphTool(t: GraphTool): void;
  setEdgeFrom(n: number | null): void;
}

function build(exp: Experiment) {
  const runA = runVariant(exp, "a")!;
  const runB = runVariant(exp, "b");
  return { runA, runB };
}

export function lengthOf(run: Run | null): number {
  return run ? run.trace.events.length : 0;
}

export function totalLength(s: Pick<LabStore, "runA" | "runB">): number {
  return Math.max(lengthOf(s.runA), lengthOf(s.runB));
}

export function position(s: Pick<LabStore, "cursorA" | "cursorB" | "runB">): number {
  return s.runB ? Math.max(s.cursorA, s.cursorB) : s.cursorA;
}

const initial = defaultExperiment("bfs");

export const useLab = create<LabStore>((set, get) => ({
  exp: initial,
  ...build(initial),
  cursorA: 0,
  cursorB: 0,
  playing: false,
  speed: 2,
  granularity: "step",
  tool: "wall",
  weight: 5,
  editing: false,
  focusCell: null,
  revision: 0,
  bookmarks: [],
  graphTool: "move",
  edgeFrom: null,

  load(exp, cursor = 0) {
    const runs = build(exp);
    set({
      exp,
      ...runs,
      cursorA: Math.min(cursor, lengthOf(runs.runA)),
      cursorB: Math.min(cursor, lengthOf(runs.runB)),
      playing: false,
      editing: false,
      bookmarks: [],
      edgeFrom: null,
      revision: get().revision + 1,
    });
  },

  update(fn, opts) {
    const exp = fn(get().exp);
    const runs = build(exp);
    const keep = opts?.keepCursor;
    set({
      exp,
      ...runs,
      cursorA: keep ? Math.min(get().cursorA, lengthOf(runs.runA)) : 0,
      cursorB: keep ? Math.min(get().cursorB, lengthOf(runs.runB)) : 0,
      playing: false,
      bookmarks: keep ? get().bookmarks : [],
      revision: get().revision + 1,
    });
  },

  setAlgo(id, compact) {
    get().update((e) => withAlgo(e, id, compact));
  },

  setVariantB(v) {
    get().update((e) => ({ ...e, b: v }) as Experiment);
  },

  setParams(which, params) {
    get().update((e) => {
      const cur = which === "a" ? e.a : e.b;
      if (!cur) return e;
      return { ...e, [which]: { ...cur, params } } as Experiment;
    });
  },

  beginEdit() {
    set({ editing: true, playing: false });
  },

  editInput(fn) {
    set({ exp: fn(get().exp), editing: true, playing: false });
  },

  endEdit() {
    if (!get().editing) return;
    get().update((e) => e);
    set({ editing: false });
  },

  play() {
    const s = get();
    if (position(s) >= totalLength(s)) set({ cursorA: 0, cursorB: 0 });
    set({ playing: true });
  },
  pause() {
    set({ playing: false });
  },
  toggle() {
    if (get().playing) get().pause();
    else get().play();
  },

  step(dir, unit) {
    const s = get();
    const g = unit ?? s.granularity;
    const move = (run: Run | null, c: number) => {
      if (!run) return 0;
      const len = lengthOf(run);
      if (g === "op") return Math.max(0, Math.min(len, c + dir));
      return dir > 0
        ? nextGroupCursor(run.trace.groupEnds, c, len)
        : prevGroupCursor(run.trace.groupEnds, c);
    };
    set({ cursorA: move(s.runA, s.cursorA), cursorB: move(s.runB, s.cursorB), playing: false });
  },

  seek(p) {
    const s = get();
    const v = Math.max(0, Math.round(p));
    set({ cursorA: Math.min(v, lengthOf(s.runA)), cursorB: Math.min(v, lengthOf(s.runB)) });
  },

  toStart() {
    set({ cursorA: 0, cursorB: 0, playing: false });
  },

  toEnd() {
    const s = get();
    set({ cursorA: lengthOf(s.runA), cursorB: lengthOf(s.runB), playing: false });
  },

  checkpoint(dir) {
    const s = get();
    const at = position(s);
    const marks = [
      ...s.runA.trace.checkpoints.map((c) => c.at),
      ...(s.runB?.trace.checkpoints.map((c) => c.at) ?? []),
      ...s.bookmarks,
      totalLength(s),
    ].sort((x, y) => x - y);
    const target =
      dir > 0
        ? (marks.find((m) => m > at) ?? totalLength(s))
        : ([...marks].reverse().find((m) => m < at) ?? 0);
    get().seek(target);
    set({ playing: false });
  },

  restart() {
    set({ cursorA: 0, cursorB: 0, playing: true });
  },

  advance(units) {
    const s = get();
    let a = s.cursorA;
    let b = s.cursorB;
    for (let i = 0; i < units; i++) {
      const lenA = lengthOf(s.runA);
      const lenB = lengthOf(s.runB);
      if (s.granularity === "op") {
        a = Math.min(lenA, a + 1);
        b = Math.min(lenB, b + 1);
      } else {
        a = nextGroupCursor(s.runA.trace.groupEnds, a, lenA);
        b = s.runB ? nextGroupCursor(s.runB.trace.groupEnds, b, lenB) : 0;
      }
    }
    const done = a >= lengthOf(s.runA) && b >= lengthOf(s.runB);
    set({ cursorA: a, cursorB: b, playing: !done });
    return !done;
  },

  setSpeed(i) {
    set({ speed: Math.max(0, Math.min(SPEEDS.length - 1, i)) });
  },
  setGranularity(granularity) {
    set({ granularity });
  },
  setTool(tool) {
    set({ tool });
  },
  setWeight(weight) {
    set({ weight: Math.max(MUD_COST.min, Math.min(MUD_COST.max, Math.round(weight))) });
  },
  setFocusCell(focusCell) {
    set({ focusCell });
  },
  toggleBookmark() {
    const s = get();
    const at = position(s);
    const has = s.bookmarks.includes(at);
    set({
      bookmarks: has
        ? s.bookmarks.filter((b) => b !== at)
        : [...s.bookmarks, at].sort((x, y) => x - y),
    });
  },
  setGraphTool(graphTool) {
    set({ graphTool, edgeFrom: null });
  },
  setEdgeFrom(edgeFrom) {
    set({ edgeFrom });
  },
}));

export function baseRate(s: Pick<LabStore, "runA" | "runB" | "granularity">): number {
  const runs = [s.runA, s.runB].filter(Boolean) as Run[];
  if (s.granularity === "step") {
    const groups = Math.max(...runs.map((r) => r.trace.groupEnds.length));
    return Math.max(1.5, Math.min(60, groups / 12));
  }
  const ops = Math.max(...runs.map((r) => r.trace.events.length));
  return Math.max(3, Math.min(400, ops / 20));
}
