import type { BaseEvent, Machine } from "./types";

export const KEYFRAME_INTERVAL = { default: 64, gradient: 32, kmeans: 8 };

interface Frame<S> {
  state: S;
  hits: Record<string, number>;
  cursor: number;
}

interface Snapshot<S> {
  state: S;
  hits: Record<string, number>;
}

export class Player<I, E extends BaseEvent, S> {
  private readonly keyframes: Snapshot<S>[] = [];
  private work: Snapshot<S>;
  private workCursor = 0;

  constructor(
    private readonly machine: Machine<I, E, S>,
    input: I,
    readonly events: E[],
    private readonly every = KEYFRAME_INTERVAL.default,
  ) {
    const live: Snapshot<S> = { state: machine.init(input), hits: {} };
    this.keyframes.push(this.copy(live));
    for (let i = 0; i < events.length; i++) {
      this.step(live, i);
      if ((i + 1) % every === 0) this.keyframes.push(this.copy(live));
    }
    this.work = this.copy(this.keyframes[0]);
  }

  get length(): number {
    return this.events.length;
  }

  at(cursor: number): Frame<S> {
    const c = Math.max(0, Math.min(cursor, this.events.length));
    if (c < this.workCursor || c - this.workCursor > this.every) {
      const k = Math.floor(c / this.every);
      this.work = this.copy(this.keyframes[k]);
      this.workCursor = k * this.every;
    }
    while (this.workCursor < c) {
      this.step(this.work, this.workCursor);
      this.workCursor++;
    }
    return { state: this.work.state, hits: this.work.hits, cursor: c };
  }

  private step(snap: Snapshot<S>, i: number): void {
    const e = this.events[i];
    this.machine.apply(snap.state, e, i);
    snap.hits[e.op] = (snap.hits[e.op] ?? 0) + 1;
  }

  private copy(s: Snapshot<S>): Snapshot<S> {
    return { state: this.machine.clone(s.state), hits: { ...s.hits } };
  }
}
