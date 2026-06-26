export type Family = "pathfinding" | "sorting" | "learning";

export interface AlgorithmInfo {
  id: string;
  family: Family;
  name: string;
  meta: string;
  blurb: string;
  pseudocode: string[];
}

export interface GridModel {
  width: number;
  height: number;
  start: number;
  target: number;
  walls: Set<number>;
  weights: Map<number, number>;
}

export type GridEvent =
  | { t: "frontier"; cell: number; note: string; line: number }
  | { t: "current"; cell: number; note: string; line: number }
  | { t: "visit"; cell: number; note: string; line: number }
  | { t: "path"; cells: number[]; note: string; line: number };

export interface GridFrame {
  visited: Set<number>;
  frontier: Set<number>;
  current: number | null;
  path: number[];
  note: string;
  line: number;
}

export type SortEvent =
  | { t: "compare"; a: number; b: number; note: string; line: number }
  | { t: "swap"; a: number; b: number; note: string; line: number }
  | { t: "pivot"; index: number; note: string; line: number }
  | { t: "sorted"; index: number; note: string; line: number };

export interface SortFrame {
  array: number[];
  comparing: number[];
  swapping: number[];
  pivot: number | null;
  sorted: Set<number>;
  note: string;
  line: number;
}

export interface KMeansFrame {
  kind: "kmeans";
  points: { x: number; y: number }[];
  assignments: number[];
  centroids: { x: number; y: number }[];
  iteration: number;
  inertia: number;
  note: string;
  line: number;
}

export interface GradientFrame {
  kind: "gradient";
  points: { x: number; y: number }[];
  m: number;
  b: number;
  loss: number;
  iteration: number;
  note: string;
  line: number;
}

export type LearnFrame = KMeansFrame | GradientFrame;

export type TraceEvent = GridEvent | SortEvent | LearnFrame;

export interface Trace {
  family: Family;
  algorithm: string;
  events: TraceEvent[];
  meta: Record<string, unknown>;
}
