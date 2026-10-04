import { useEffect, useLayoutEffect, useRef } from "react";
import type { Run } from "@/core/experiment";
import type { SortState } from "@/core/sort/machine";
import type { SearchState } from "@/core/search/search";
import { baseRate, SPEEDS, useLab } from "@/store/lab";
import { usePresentedCursor } from "../clock";
import { setupCanvas, useElementSize, usePalette, useReducedMotion, type Palette } from "../hooks";
import { timed } from "../perf";

type SortRun = Extract<Run, { family: "sort" }>;
type SearchRun = Extract<Run, { family: "search" }>;

const POINTER_ORDER = ["lo", "i", "j", "min", "pivot", "child", "k", "mid", "hi", "end"];
const PTR_H = 40;

function cursorOf(which: "a" | "b") {
  const s = useLab.getState();
  return which === "a" ? s.cursorA : s.cursorB;
}

function settle(dt: number) {
  const s = useLab.getState();
  const rate = s.playing ? baseRate(s) * SPEEDS[s.speed] : 4;
  const tau = Math.max(0.025, Math.min(0.12, 0.45 / Math.max(1, rate)));
  return 1 - Math.exp(-dt / 1000 / tau);
}

interface Target {
  slot: number;
  buffer: boolean;
  color: string;
  dim: boolean;
  emph: boolean;
}

function sortTargets(s: SortState, p: Palette, algo: string): Target[] {
  const out: Target[] = s.values.map(() => ({
    slot: 0,
    buffer: false,
    color: p.rgb("ink", 0.5),
    dim: false,
    emph: false,
  }));
  const top = s.stack[s.stack.length - 1];
  s.order.forEach((id, i) => {
    if (id < 0) return;
    const t = out[id];
    t.slot = i;
    if (s.sorted[i]) t.color = p.path;
    if (s.ptr.pivot === i) t.color = p.ink;
    if (top && (i < top.lo || i > top.hi) && !s.sorted[i]) t.dim = true;
    if (algo === "heap" && typeof s.ptr.end === "number" && i >= s.ptr.end && !s.sorted[i])
      t.dim = true;
  });
  s.buffer?.forEach((id, i) => {
    if (id < 0) return;
    out[id].slot = s.bufferLo + i;
    out[id].buffer = true;
  });
  const mark = (pos: number, buf: boolean, color: string) => {
    const id = buf ? s.buffer?.[pos - s.bufferLo] : s.order[pos];
    if (id === undefined || id < 0) return;
    out[id].color = color;
    out[id].dim = false;
    out[id].emph = true;
  };
  if (s.compare) {
    mark(s.compare.i, s.compare.buf, p.open);
    mark(s.compare.j, s.compare.buf, p.open);
  }
  if (s.swap) {
    mark(s.swap[0], false, p.signal);
    mark(s.swap[1], false, p.signal);
  }
  if (s.write !== null) mark(s.write, false, p.signal);
  return out;
}

export function SortView({ run, which, label }: { run: SortRun; which: "a" | "b"; label: string }) {
  const [box, size] = useElementSize<HTMLDivElement>();
  const canvas = useRef<HTMLCanvasElement>(null);
  const palette = usePalette();
  const reduced = useReducedMotion();
  const presented = usePresentedCursor(which);
  const pos = useRef<{ x: Float64Array; y: Float64Array; ready: boolean }>({
    x: new Float64Array(0),
    y: new Float64Array(0),
    ready: false,
  });
  const ptrPos = useRef(new Map<string, number>());
  const state = useRef<SortState | null>(null);
  const raf = useRef(0);
  const last = useRef(0);
  const env = useRef({ size, palette, reduced, run });
  env.current = { size, palette, reduced, run };

  const request = useRef<() => void>(() => undefined);
  request.current = () => {
    if (raf.current) return;
    raf.current = requestAnimationFrame((t) => {
      raf.current = 0;
      const dt = last.current ? Math.min(64, t - last.current) : 16;
      last.current = t;
      const el = canvas.current;
      const st = state.current;
      const { size: sz, palette: p, reduced: rm, run: r } = env.current;
      if (!el || !st || sz.w < 2) return;
      const ctx = setupCanvas(el, sz.w, sz.h);
      if (!ctx) return;
      const moving = timed("bars", () =>
        drawSort(ctx, sz.w, sz.h, st, p, r.algo, pos.current, ptrPos.current, rm ? 1 : settle(dt)),
      );
      if (moving) request.current();
      else last.current = 0;
    });
  };

  useLayoutEffect(() => {
    const sync = () => {
      state.current = run.player.at(cursorOf(which)).state;
      request.current();
    };
    pos.current.ready = false;
    ptrPos.current.clear();
    sync();
    return useLab.subscribe((s, p) => {
      if (s.cursorA !== p.cursorA || s.cursorB !== p.cursorB) sync();
    });
  }, [run, which]);

  useEffect(() => {
    request.current();
  }, [size.w, size.h, palette]);

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    },
    [],
  );

  const s = run.player.at(presented).state;
  const desc = `${label}: ${s.order
    .filter((x) => x >= 0)
    .map((id) => s.values[id])
    .join(", ")}`;

  return (
    <div ref={box} className="relative h-full w-full">
      <canvas
        ref={canvas}
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label={desc}
      />
    </div>
  );
}

function drawSort(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  s: SortState,
  p: Palette,
  algo: string,
  pos: { x: Float64Array; y: Float64Array; ready: boolean },
  ptrPos: Map<string, number>,
  k: number,
): boolean {
  const n = s.values.length;
  const max = Math.max(...s.values, 1);
  const hasBuffer = algo === "merge";
  const area = Math.max(0, H - PTR_H);
  const mainH = hasBuffer ? area * 0.64 : area;
  const bufTop = mainH + 12;
  const bufH = hasBuffer ? area - bufTop : 0;
  const slot = n ? W / n : 0;
  const bw = Math.max(2, Math.min(slot * 0.74, slot - 1));
  const showValues = slot >= 20;
  const targets = sortTargets(s, p, algo);
  if (pos.x.length !== n) {
    pos.x = new Float64Array(n);
    pos.y = new Float64Array(n);
    pos.ready = false;
  }
  ctx.clearRect(0, 0, W, H);
  const top = s.stack[s.stack.length - 1];
  if (top && top.hi >= top.lo) {
    ctx.fillStyle = p.sunken;
    ctx.fillRect(top.lo * slot, 0, (top.hi - top.lo + 1) * slot, mainH);
  }
  if (algo === "heap" && typeof s.ptr.end === "number" && s.ptr.end > 0) {
    ctx.fillStyle = p.sunken;
    ctx.fillRect(0, 0, s.ptr.end * slot, mainH);
    ctx.fillStyle = p.ink3;
    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("heap", 4, 4);
  }
  if (hasBuffer) {
    ctx.strokeStyle = p.rule;
    ctx.beginPath();
    ctx.moveTo(0, bufTop - 5.5);
    ctx.lineTo(W, bufTop - 5.5);
    ctx.stroke();
    ctx.fillStyle = p.ink3;
    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("buffer", 0, bufTop);
  }
  let moving = false;
  ctx.font = '10px "IBM Plex Mono", monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  for (let id = 0; id < n; id++) {
    const t = targets[id];
    const tx = t.slot * slot + (slot - bw) / 2;
    const ty = t.buffer ? 1 : 0;
    if (!pos.ready) {
      pos.x[id] = tx;
      pos.y[id] = ty;
    } else {
      pos.x[id] += (tx - pos.x[id]) * k;
      pos.y[id] += (ty - pos.y[id]) * k;
      if (Math.abs(tx - pos.x[id]) > 0.3 || Math.abs(ty - pos.y[id]) > 0.004) moving = true;
      else {
        pos.x[id] = tx;
        pos.y[id] = ty;
      }
    }
    const v = s.values[id];
    const yMix = pos.y[id];
    const areaH = mainH + (bufH - mainH) * yMix;
    const base = mainH + (bufTop + bufH - mainH) * yMix;
    const bh = Math.max(2, (v / max) * (areaH - (showValues ? 14 : 4)));
    const x = pos.x[id];
    ctx.globalAlpha = t.dim ? 0.32 : 1;
    ctx.fillStyle = t.color;
    ctx.fillRect(x, base - bh, bw, bh);
    if (showValues) {
      ctx.fillStyle = t.emph ? p.ink : p.ink3;
      ctx.fillText(String(v), x + bw / 2, base - bh - 3);
    }
  }
  ctx.globalAlpha = 1;
  pos.ready = true;

  const baseY = H - PTR_H + 6;
  ctx.strokeStyle = p.ruleStrong;
  ctx.beginPath();
  ctx.moveTo(0, baseY + 0.5);
  ctx.lineTo(W, baseY + 0.5);
  ctx.stroke();
  const ptrs = Object.entries(s.ptr)
    .filter(([, v]) => typeof v === "number" && v >= 0 && v <= n)
    .sort((a, b) => POINTER_ORDER.indexOf(a[0]) - POINTER_ORDER.indexOf(b[0])) as [
    string,
    number,
  ][];
  const labels = new Map<number, { x: number; names: string[] }>();
  for (const [name, at] of ptrs) {
    const target = Math.min(at, n - 1) * slot + slot / 2;
    const prev = ptrPos.get(name);
    const x = prev === undefined ? target : prev + (target - prev) * k;
    if (Math.abs(target - x) > 0.3) moving = true;
    ptrPos.set(name, Math.abs(target - x) > 0.3 ? x : target);
    const isRange = name === "lo" || name === "hi" || name === "end";
    ctx.fillStyle = name === "pivot" ? p.ink : isRange ? p.ink3 : p.signal;
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.lineTo(x - 4, baseY + 6);
    ctx.lineTo(x + 4, baseY + 6);
    ctx.closePath();
    ctx.fill();
    const l = labels.get(at);
    if (l) l.names.push(name);
    else labels.set(at, { x, names: [name] });
  }
  drawLabels(ctx, [...labels.values()], baseY, W, p.ink2);
  for (const name of [...ptrPos.keys()]) if (!ptrs.some(([n2]) => n2 === name)) ptrPos.delete(name);
  return moving;
}

export function SearchView({
  run,
  which,
  label,
}: {
  run: SearchRun;
  which: "a" | "b";
  label: string;
}) {
  const [box, size] = useElementSize<HTMLDivElement>();
  const canvas = useRef<HTMLCanvasElement>(null);
  const palette = usePalette();
  const reduced = useReducedMotion();
  const presented = usePresentedCursor(which);
  const state = useRef<SearchState | null>(null);
  const anim = useRef({ lo: -1, hi: -1, probe: -1 });
  const raf = useRef(0);
  const last = useRef(0);
  const env = useRef({ size, palette, reduced });
  env.current = { size, palette, reduced };

  const request = useRef<() => void>(() => undefined);
  request.current = () => {
    if (raf.current) return;
    raf.current = requestAnimationFrame((t) => {
      raf.current = 0;
      const dt = last.current ? Math.min(64, t - last.current) : 16;
      last.current = t;
      const el = canvas.current;
      const st = state.current;
      const { size: sz, palette: p, reduced: rm } = env.current;
      if (!el || !st || sz.w < 2) return;
      const ctx = setupCanvas(el, sz.w, sz.h);
      if (!ctx) return;
      const moving = timed("search", () =>
        drawSearch(ctx, sz.w, sz.h, st, p, anim.current, rm ? 1 : settle(dt)),
      );
      if (moving) request.current();
      else last.current = 0;
    });
  };

  useLayoutEffect(() => {
    const sync = () => {
      state.current = run.player.at(cursorOf(which)).state;
      request.current();
    };
    anim.current = { lo: -1, hi: -1, probe: -1 };
    sync();
    return useLab.subscribe((s, p) => {
      if (s.cursorA !== p.cursorA || s.cursorB !== p.cursorB) sync();
    });
  }, [run, which]);

  useEffect(() => {
    request.current();
  }, [size.w, size.h, palette]);

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    },
    [],
  );

  const s = run.player.at(presented).state;
  return (
    <div ref={box} className="relative h-full w-full">
      <canvas
        ref={canvas}
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label={`${label}: searching for ${s.target}; ${s.done ? (s.found >= 0 ? `found at index ${s.found}` : "not present") : `candidates ${s.lo} to ${s.hi}`}`}
      />
    </div>
  );
}

function drawSearch(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  s: SearchState,
  p: Palette,
  a: { lo: number; hi: number; probe: number },
  k: number,
): boolean {
  const n = s.values.length;
  const max = Math.max(...s.values, s.target, 1);
  const area = Math.max(0, H - PTR_H);
  const slot = n ? W / n : 0;
  const bw = Math.max(1.5, Math.min(slot * 0.74, slot - 1));
  const showValues = slot >= 22;
  const lo = s.done ? (s.found >= 0 ? s.found : 0) : s.lo;
  const hi = s.done ? (s.found >= 0 ? s.found : -1) : s.hi;
  const step = (cur: number, to: number) => (cur < 0 ? to : cur + (to - cur) * k);
  a.lo = step(a.lo, lo);
  a.hi = step(a.hi, hi);
  if (s.probe >= 0) a.probe = step(a.probe, s.probe);
  const moving =
    Math.abs(a.lo - lo) > 0.01 || Math.abs(a.hi - hi) > 0.01 || Math.abs(a.probe - s.probe) > 0.01;
  ctx.clearRect(0, 0, W, H);
  if (a.hi >= a.lo - 0.5) {
    ctx.fillStyle = p.sunken;
    ctx.fillRect(a.lo * slot, 0, Math.max(0, (a.hi - a.lo + 1) * slot), area);
  }
  ctx.font = '10px "IBM Plex Mono", monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  for (let i = 0; i < n; i++) {
    const v = s.values[i];
    const bh = Math.max(2, (v / max) * (area - 16));
    const inRange = s.done ? s.found === i : i >= s.lo && i <= s.hi;
    let fill = inRange ? p.rgb("ink", 0.55) : p.rgb("ink", 0.16);
    if (s.probed[i]) fill = inRange ? p.rgb("ink", 0.75) : p.rgb("ink", 0.28);
    if (s.probe === i) fill = p.open;
    if (s.found === i) fill = p.path;
    ctx.fillStyle = fill;
    ctx.fillRect(i * slot + (slot - bw) / 2, area - bh, bw, bh);
    if (showValues) {
      ctx.fillStyle = p.ink3;
      ctx.fillText(String(v), i * slot + slot / 2, area - bh - 3);
    }
  }
  const ty = Math.round(area - (s.target / max) * (area - 16)) + 0.5;
  ctx.strokeStyle = p.signal;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(0, ty);
  ctx.lineTo(W, ty);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = p.signal;
  ctx.textAlign = "right";
  ctx.font = '11px "IBM Plex Mono", monospace';
  ctx.fillText(`target ${s.target}`, W - 2, ty - 4);
  const baseY = H - PTR_H + 6;
  ctx.strokeStyle = p.ruleStrong;
  ctx.beginPath();
  ctx.moveTo(0, baseY + 0.5);
  ctx.lineTo(W, baseY + 0.5);
  ctx.stroke();
  const marks: [string, number, string][] = [];
  if (!s.done && s.hi >= s.lo) {
    marks.push(["lo", a.lo, p.ink3], ["hi", a.hi, p.ink3]);
  }
  if (s.probe >= 0 && (!s.done || s.found >= 0)) marks.push(["probe", a.probe, p.signal]);
  ctx.font = '10px "IBM Plex Mono", monospace';
  const labels: { x: number; names: string[] }[] = [];
  for (const [name, at, color] of marks) {
    const x = at * slot + slot / 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.lineTo(x - 4, baseY + 6);
    ctx.lineTo(x + 4, baseY + 6);
    ctx.closePath();
    ctx.fill();
    const same = labels.find((l) => Math.abs(l.x - x) < slot / 2);
    if (same) same.names.push(name);
    else labels.push({ x, names: [name] });
  }
  drawLabels(ctx, labels, baseY, W, p.ink2);
  return moving;
}

function drawLabels(
  ctx: CanvasRenderingContext2D,
  labels: { x: number; names: string[] }[],
  baseY: number,
  W: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const rowEnd = [-Infinity, -Infinity];
  for (const l of labels.sort((a, b) => a.x - b.x)) {
    const text = l.names.join("·");
    const half = ctx.measureText(text).width / 2;
    const x = Math.min(Math.max(l.x, half), W - half);
    const row = x - half >= rowEnd[0] + 4 ? 0 : 1;
    rowEnd[row] = x + half;
    ctx.fillText(text, x, baseY + 8 + row * 11);
  }
}
