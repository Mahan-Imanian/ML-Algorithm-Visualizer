import { create } from "zustand";
import {
  ALGORITHMS,
  algorithmsByFamily,
  createGrid,
  runPathfinder,
  runSort,
  runKMeans,
  runGradientDescent,
  makeClusters,
  makeLinear,
  mulberry32,
} from "@/core";
import type { Family, GridModel, TraceEvent, Point } from "@/core";
import type { PathAlgo } from "@/core/pathfinding";
import type { SortAlgo } from "@/core/sorting";

export type Tool = "wall" | "weight" | "erase";
export type InspectorTab = "state" | "trace" | "code";

interface Trace {
  family: Family;
  algoId: string;
  events: TraceEvent[];
  initial: number[];
}

interface AlgoscopeState {
  family: Family;
  algoId: string;
  grid: GridModel;
  sortInput: number[];
  learnPoints: Point[];
  tool: Tool;
  trace: Trace | null;
  cursor: number;
  playing: boolean;
  speed: number;
  inspectorTab: InspectorTab;

  setFamily: (f: Family) => void;
  setAlgo: (id: string) => void;
  setTool: (t: Tool) => void;
  setInspectorTab: (t: InspectorTab) => void;
  paintCell: (cell: number) => void;
  clearGrid: () => void;
  regenerateData: () => void;
  run: () => void;
  reset: () => void;
  stepForward: () => void;
  stepBack: () => void;
  setCursor: (n: number) => void;
  togglePlay: () => void;
  setSpeed: (n: number) => void;
  exportRun: () => string;
}

const randomArray = (seed: number, n = 24) => {
  const rng = mulberry32(seed);
  return Array.from({ length: n }, () => 8 + Math.floor(rng() * 92));
};

function firstAlgo(family: Family): string {
  return algorithmsByFamily(family)[0].id;
}

export const useAlgoscope = create<AlgoscopeState>((set, get) => ({
  family: "pathfinding",
  algoId: "bfs",
  grid: createGrid(),
  sortInput: randomArray(1),
  learnPoints: makeClusters(),
  tool: "wall",
  trace: null,
  cursor: 0,
  playing: false,
  speed: 4,
  inspectorTab: "state",

  setFamily: (family) =>
    set({
      family,
      algoId: firstAlgo(family),
      trace: null,
      cursor: 0,
      playing: false,
      learnPoints: family === "learning" ? makeClusters() : get().learnPoints,
    }),

  setAlgo: (algoId) => {
    const algo = ALGORITHMS.find((a) => a.id === algoId);
    if (!algo) return;
    const patch: Partial<AlgoscopeState> = { algoId, trace: null, cursor: 0, playing: false };
    if (algo.family === "learning") {
      patch.learnPoints = algoId === "gradient" ? makeLinear() : makeClusters();
    }
    set(patch);
  },

  setTool: (tool) => set({ tool }),
  setInspectorTab: (inspectorTab) => set({ inspectorTab }),

  paintCell: (cell) => {
    const { grid, tool, family } = get();
    if (family !== "pathfinding" || cell === grid.start || cell === grid.target) return;
    const walls = new Set(grid.walls);
    const weights = new Map(grid.weights);
    if (tool === "wall") {
      weights.delete(cell);
      walls.add(cell);
    } else if (tool === "weight") {
      walls.delete(cell);
      weights.set(cell, 5);
    } else {
      walls.delete(cell);
      weights.delete(cell);
    }
    set({ grid: { ...grid, walls, weights }, trace: null, cursor: 0, playing: false });
  },

  clearGrid: () =>
    set((s) => ({
      grid: { ...s.grid, walls: new Set(), weights: new Map() },
      trace: null,
      cursor: 0,
      playing: false,
    })),

  regenerateData: () => {
    const { family } = get();
    const seed = Math.floor(Math.random() * 1e6);
    if (family === "sorting") set({ sortInput: randomArray(seed), trace: null, cursor: 0, playing: false });
    else if (family === "learning")
      set({
        learnPoints: get().algoId === "gradient" ? makeLinear(seed) : makeClusters(seed),
        trace: null,
        cursor: 0,
        playing: false,
      });
  },

  run: () => {
    const { family, algoId, grid, sortInput, learnPoints } = get();
    let events: TraceEvent[];
    if (family === "pathfinding") events = runPathfinder(grid, algoId as PathAlgo);
    else if (family === "sorting") events = runSort(sortInput, algoId as SortAlgo);
    else events = algoId === "gradient" ? runGradientDescent(learnPoints) : runKMeans(learnPoints);
    set({
      trace: { family, algoId, events, initial: [...sortInput] },
      cursor: 0,
      playing: events.length > 1,
    });
  },

  reset: () => set({ cursor: 0, playing: false }),

  stepForward: () => {
    const { trace, cursor } = get();
    if (!trace) return;
    set({ cursor: Math.min(cursor + 1, trace.events.length - 1), playing: false });
  },

  stepBack: () => set((s) => ({ cursor: Math.max(s.cursor - 1, 0), playing: false })),

  setCursor: (n) => {
    const { trace } = get();
    if (!trace) return;
    set({ cursor: Math.max(0, Math.min(n, trace.events.length - 1)) });
  },

  togglePlay: () => {
    const { trace, playing, cursor } = get();
    if (!trace) return get().run();
    if (!playing && cursor >= trace.events.length - 1) return set({ cursor: 0, playing: true });
    set({ playing: !playing });
  },

  setSpeed: (speed) => set({ speed }),

  exportRun: () => {
    const { trace, algoId, family } = get();
    return JSON.stringify({ app: "algoscope", version: 2, family, algoId, trace }, null, 2);
  },
}));
