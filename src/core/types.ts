export type Family = "grid" | "sort" | "search" | "graph" | "learn";

export interface BaseEvent {
  op: string;
  group: number;
  note: string;
}

export interface Checkpoint {
  at: number;
  label: string;
}

export interface CodeLine {
  text: string;
  op?: string;
  depth?: number;
}

export interface Complexity {
  best: string;
  average: string;
  worst: string;
  space: string;
  note?: string;
}

export interface Machine<I, E extends BaseEvent, S> {
  init(input: I): S;
  apply(state: S, event: E, index: number): void;
  clone(state: S): S;
}

export interface Trace<E extends BaseEvent> {
  events: E[];
  groupEnds: number[];
  checkpoints: Checkpoint[];
  series: number[];
  seriesLabel: string;
}

export interface Range {
  min: number;
  max: number;
  step: number;
}

export interface Metric {
  label: string;
  value: number | string;
  better?: "lower" | "higher";
  unit?: string;
}
