import type { BaseEvent, Checkpoint, Trace } from "./types";

type Without<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export class TraceBuilder<E extends BaseEvent> {
  readonly events: E[] = [];
  private readonly groupEnds: number[] = [];
  private readonly checkpoints: Checkpoint[] = [];
  private readonly series: number[] = [];

  constructor(private readonly seriesLabel: string) {}

  emit(event: Without<E, "group">): void {
    this.events.push({ ...event, group: this.groupEnds.length } as E);
  }

  endGroup(sample: number): void {
    const last = this.groupEnds.length ? this.groupEnds[this.groupEnds.length - 1] : 0;
    if (this.events.length > last) {
      this.groupEnds.push(this.events.length);
      this.series.push(sample);
    }
  }

  checkpoint(label: string): void {
    this.checkpoints.push({ at: this.events.length, label });
  }

  finish(sample: number): Trace<E> {
    this.endGroup(sample);
    return {
      events: this.events,
      groupEnds: this.groupEnds,
      checkpoints: dedupeCheckpoints(this.checkpoints),
      series: this.series,
      seriesLabel: this.seriesLabel,
    };
  }
}

function dedupeCheckpoints(list: Checkpoint[]): Checkpoint[] {
  const out: Checkpoint[] = [];
  for (const c of list) {
    const prev = out[out.length - 1];
    if (prev && prev.at === c.at) prev.label = c.label;
    else out.push({ ...c });
  }
  return out;
}

export function nextGroupCursor(groupEnds: number[], cursor: number, total: number): number {
  let lo = 0;
  let hi = groupEnds.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (groupEnds[mid] <= cursor) lo = mid + 1;
    else hi = mid;
  }
  return lo < groupEnds.length ? groupEnds[lo] : total;
}

export function prevGroupCursor(groupEnds: number[], cursor: number): number {
  let lo = 0;
  let hi = groupEnds.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (groupEnds[mid] < cursor) lo = mid + 1;
    else hi = mid;
  }
  return lo > 0 ? groupEnds[lo - 1] : 0;
}

export function groupIndexAt(groupEnds: number[], cursor: number): number {
  let lo = 0;
  let hi = groupEnds.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (groupEnds[mid] <= cursor) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
