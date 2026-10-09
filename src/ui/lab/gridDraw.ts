import type { Run } from "@/core/experiment";
import type { GridInput } from "@/core/grid/model";
import { CLOSED, OPEN } from "@/core/grid/machine";
import type { Palette } from "../hooks";

export type GridRun = Extract<Run, { family: "grid" }>;

export interface Geometry {
  s: number;
  ox: number;
  oy: number;
  ruler: number;
}

const RULER = 16;

export function geometry(W: number, H: number, w: number, h: number): Geometry {
  const probe = Math.floor(Math.min(W / w, H / h));
  const ruler = probe >= 9 && W > 360 ? RULER : 0;
  const s = Math.max(3, Math.floor(Math.min((W - ruler) / w, (H - ruler) / h)));
  return {
    s,
    ruler,
    ox: ruler + Math.floor((W - ruler - s * w) / 2),
    oy: ruler + Math.floor((H - ruler - s * h) / 2),
  };
}

export interface Snap {
  status: Uint8Array;
  current: number;
  pushedNow: number[];
  path: number[];
  outcome: string;
  g: Float64Array;
  parent: Int32Array;
  frontier: { cell: number; pri: number; h: number }[];
  diffStatus: Uint8Array | null;
  diffPath: number[] | null;
  diffCurrent: number;
}

export interface Anim {
  from: Uint8Array;
  at: Float64Array;
  pathKey: string;
  pathT: number;
  dur: number;
}

export interface View {
  geo: Geometry;
  input: GridInput;
  palette: Palette;
  terrain: HTMLCanvasElement | null;
  editing: boolean;
  values: boolean;
  focus: number | null;
  reduced: boolean;
  algo: string;
  w: number;
  h: number;
}

export function takeSnap(
  run: GridRun,
  cursor: number,
  diff: GridRun | null,
  diffCursor: number,
): Snap {
  const st = run.player.at(cursor).state;
  const base = {
    status: st.status.slice(),
    current: st.current,
    pushedNow: st.pushedNow.slice(),
    path: st.path,
    outcome: st.outcome,
    g: st.g.slice(),
    parent: st.parent.slice(),
    frontier: st.frontier.slice(),
  };
  if (!diff) return { ...base, diffStatus: null, diffPath: null, diffCurrent: -1 };
  const ds = diff.player.at(diffCursor).state;
  return {
    ...base,
    diffStatus: ds.status.slice(),
    diffPath: ds.path,
    diffCurrent: ds.outcome === "running" ? ds.current : -1,
  };
}

export function paintTerrain(
  ctx: CanvasRenderingContext2D,
  geo: Geometry,
  input: GridInput,
  p: Palette,
) {
  const { s, ox, oy, ruler } = geo;
  const { w, h, cells } = input;
  const gap = s >= 7 ? 1 : 0;
  if (ruler) {
    ctx.fillStyle = p.ink3;
    ctx.strokeStyle = p.ruleStrong;
    ctx.lineWidth = 1;
    ctx.font = '500 9px "IBM Plex Mono", monospace';
    const every = s >= 14 ? 5 : 10;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.beginPath();
    for (let c = 0; c <= w; c++) {
      const x = Math.round(ox + c * s) + 0.5;
      const major = c % every === 0;
      ctx.moveTo(x, oy - (major ? 6 : 3));
      ctx.lineTo(x, oy);
      if (major && c < w) ctx.fillText(String(c), ox + c * s + s / 2, oy - 6);
    }
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let r = 0; r <= h; r++) {
      const y = Math.round(oy + r * s) + 0.5;
      const major = r % every === 0;
      ctx.moveTo(ox - (major ? 6 : 3), y);
      ctx.lineTo(ox, y);
      if (major && r < h) ctx.fillText(String(r), ox - 7, oy + r * s + s / 2);
    }
    ctx.stroke();
  }
  ctx.fillStyle = p.gridLine;
  ctx.fillRect(ox, oy, s * w, s * h);
  for (let i = 0; i < w * h; i++) {
    const x = ox + (i % w) * s;
    const y = oy + Math.floor(i / w) * s;
    const v = cells[i];
    ctx.fillStyle = v === 0 ? p.wall : v > 1 ? p.weight : p.field;
    ctx.fillRect(x + gap, y + gap, s - gap, s - gap);
    if (v <= 1) continue;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + gap, y + gap, s - gap, s - gap);
    ctx.clip();
    ctx.strokeStyle = p.rgb("ink", 0.16 + v * 0.02);
    ctx.lineWidth = 1;
    const step = Math.max(3, 11 - v);
    ctx.beginPath();
    for (let k = -s; k < s; k += step) {
      ctx.moveTo(x + k, y + s);
      ctx.lineTo(x + k + s, y);
    }
    ctx.stroke();
    ctx.restore();
    if (s >= 16) {
      ctx.fillStyle = p.ink2;
      ctx.font = `500 ${Math.min(12, Math.floor(s * 0.45))}px "IBM Plex Mono", monospace`;
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText(String(v), x + s - 2, y + s - 1);
    }
  }
}

interface Frame {
  ctx: CanvasRenderingContext2D;
  v: View;
  snap: Snap;
  a: Anim;
  p: Palette;
  s: number;
  ox: number;
  oy: number;
  w: number;
  h: number;
  gap: number;
  inner: number;
  now: number;
  center: (c: number) => [number, number];
}

const ease = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);

export function paint(ctx: CanvasRenderingContext2D, v: View, snap: Snap, a: Anim): boolean {
  const { s, ox, oy } = v.geo;
  const { w, h } = v.input;
  const gap = s >= 7 ? 1 : 0;
  const f: Frame = {
    ctx,
    v,
    snap,
    a,
    p: v.palette,
    s,
    ox,
    oy,
    w,
    h,
    gap,
    inner: s - gap,
    now: performance.now(),
    center: (c) => [ox + (c % w) * s + s / 2, oy + Math.floor(c / w) * s + s / 2],
  };
  ctx.clearRect(0, 0, v.w, v.h);
  if (v.terrain) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(v.terrain, 0, 0);
    ctx.restore();
  } else paintTerrain(ctx, v.geo, v.input, v.palette);

  const focus = v.focus !== null && v.focus >= 0 && v.focus < w * h ? v.focus : null;
  let animating = false;
  if (!v.editing) {
    animating = paintCells(f);
    if (v.values && s >= 22) paintValues(f);
    if (snap.current >= 0 && snap.pushedNow.length) paintEnqueued(f);
    if (focus !== null && snap.parent[focus] >= 0) paintParentTrail(f, focus);
    if (paintPaths(f)) animating = true;
    paintCurrent(f);
  }
  paintEndpoints(f);
  if (focus !== null) paintFocus(f, focus);
  return animating;
}

function paintCells({ ctx, v, snap, a, p, s, ox, oy, w, h, gap, inner, now }: Frame): boolean {
  const { cells } = v.input;
  const colorOf = (st: number) => (st === CLOSED ? p.closed : st === OPEN ? p.open : null);
  let animating = false;
  for (let i = 0; i < w * h; i++) {
    const cv = cells[i];
    if (cv === 0) continue;
    const st = snap.status[i];
    let fill: string | null;
    if (snap.diffStatus) {
      const ca = st === CLOSED;
      const cb = snap.diffStatus[i] === CLOSED;
      fill = ca && cb ? p.closed : ca ? p.rgb("st-a", 0.45) : cb ? p.rgb("st-b", 0.4) : null;
    } else fill = colorOf(st);
    const t0 = a.at[i];
    const age = t0 && !v.reduced ? (now - t0) / a.dur : 1;
    if (!fill && age >= 1) continue;
    const x = ox + (i % w) * s + gap;
    const y = oy + Math.floor(i / w) * s + gap;
    const alpha = cv > 1 ? 0.8 : 1;
    if (age >= 1 || snap.diffStatus) {
      if (fill) {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, inner, inner);
      }
      continue;
    }
    animating = true;
    const k = ease(Math.max(0, age));
    const from = colorOf(a.from[i]);
    if (st === OPEN && !from) {
      const sz = inner * (0.35 + 0.65 * k);
      const off = (inner - sz) / 2;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.open;
      ctx.fillRect(x + off, y + off, sz, sz);
    } else {
      if (from) {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = from;
        ctx.fillRect(x, y, inner, inner);
      }
      if (fill) {
        ctx.globalAlpha = alpha * k;
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, inner, inner);
      }
      if (st === CLOSED && inner >= 6) {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = p.signal;
        ctx.lineWidth = Math.max(1, Math.min(2, s * 0.12));
        ctx.strokeRect(x + 0.5, y + 0.5, inner - 1, inner - 1);
      }
    }
  }
  ctx.globalAlpha = 1;
  return animating;
}

function paintValues({ ctx, v, snap, p, s, ox, oy, w, h }: Frame) {
  const fs = Math.max(9, Math.min(12, Math.floor(s * 0.32)));
  ctx.font = `500 ${fs}px "IBM Plex Mono", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const fMap = new Map<number, number>();
  if (v.algo === "astar" || v.algo === "greedy")
    for (const e of snap.frontier)
      if (!fMap.has(e.cell) || e.pri < fMap.get(e.cell)!) fMap.set(e.cell, e.pri);
  for (let i = 0; i < w * h; i++) {
    if (!snap.status[i] || !Number.isFinite(snap.g[i])) continue;
    const x = ox + (i % w) * s + s / 2;
    const y = oy + Math.floor(i / w) * s + s / 2;
    ctx.fillStyle = snap.status[i] === OPEN ? p.rgb("ink", 0.9) : p.ink2;
    const gv = Math.round(snap.g[i] * 10) / 10;
    const f = fMap.get(i);
    if (f !== undefined && s >= 30) {
      ctx.fillText(String(gv), x, y - fs * 0.5);
      ctx.fillStyle = p.ink3;
      ctx.fillText(`f${Math.round(f * 10) / 10}`, x, y + fs * 0.6);
    } else ctx.fillText(String(gv), x, y);
  }
}

function paintEnqueued({ ctx, v, snap, a, p, s, now, center }: Frame) {
  ctx.strokeStyle = p.rgb("signal", 0.85);
  ctx.lineWidth = Math.max(1, s * 0.09);
  ctx.lineCap = "round";
  const [cx, cy] = center(snap.current);
  for (const n of snap.pushedNow) {
    const [nx, ny] = center(n);
    const t0 = a.at[n];
    const k = t0 && !v.reduced ? ease(Math.min(1, (now - t0) / a.dur)) : 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + (nx - cx) * 0.8 * k, cy + (ny - cy) * 0.8 * k);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
}

function paintParentTrail({ ctx, snap, p, w, h, center }: Frame, focus: number) {
  ctx.save();
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = p.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  let c = focus;
  ctx.moveTo(...center(c));
  let guard = 0;
  while (snap.parent[c] >= 0 && guard++ < w * h) {
    c = snap.parent[c];
    ctx.lineTo(...center(c));
  }
  ctx.stroke();
  ctx.restore();
}

function paintPaths({ ctx, snap, a, p, s, now, center }: Frame): boolean {
  let animating = false;
  const drawPath = (path: number[], color: string, progress: number, dashed = false) => {
    if (path.length < 2) return;
    const pts = [...path].reverse();
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, s * 0.26);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (dashed) ctx.setLineDash([s * 0.5, s * 0.4]);
    ctx.beginPath();
    const segs = (pts.length - 1) * progress;
    ctx.moveTo(...center(pts[0]));
    let head: [number, number] = center(pts[0]);
    for (let i = 1; i < pts.length; i++) {
      if (i - 1 >= segs) break;
      const [x1, y1] = center(pts[i]);
      if (i > segs) {
        const [x0, y0] = center(pts[i - 1]);
        const f = segs - (i - 1);
        head = [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f];
        ctx.lineTo(...head);
      } else {
        head = [x1, y1];
        ctx.lineTo(x1, y1);
      }
    }
    ctx.stroke();
    if (progress < 1) {
      ctx.fillStyle = p.signal;
      ctx.beginPath();
      ctx.arc(head[0], head[1], Math.max(2.5, s * 0.22), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  if (snap.path.length) {
    let prog = 1;
    if (a.pathT) {
      prog = Math.min(1, (now - a.pathT) / Math.min(1100, 260 + snap.path.length * 16));
      prog = ease(prog);
      if (prog < 1) animating = true;
    }
    drawPath(snap.path, snap.diffStatus ? p.a : p.path, prog);
  }
  if (snap.diffPath && snap.diffPath.length) drawPath(snap.diffPath, p.b, 1, true);
  return animating;
}

function paintCurrent({ ctx, snap, p, s, inner, center }: Frame) {
  if (snap.current >= 0 && !snap.path.includes(snap.current)) {
    const [cx, cy] = center(snap.current);
    ctx.fillStyle = p.signal;
    ctx.fillRect(cx - inner / 2, cy - inner / 2, inner, inner);
    if (s >= 8) {
      ctx.strokeStyle = p.signal;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx - s / 2 - 1.5, cy - s / 2 - 1.5, s + 3, s + 3);
    }
  }
  if (snap.diffCurrent >= 0) {
    const [bx, by] = center(snap.diffCurrent);
    ctx.strokeStyle = p.b;
    ctx.lineWidth = Math.max(1.5, s * 0.14);
    ctx.strokeRect(bx - inner / 2 + 1, by - inner / 2 + 1, inner - 2, inner - 2);
  }
}

function paintEndpoints({ ctx, v, snap, p, s, center }: Frame) {
  const [sx, sy] = center(v.input.start);
  ctx.fillStyle = p.ink;
  ctx.beginPath();
  ctx.arc(sx, sy, Math.max(3, s * 0.34), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.field;
  ctx.beginPath();
  ctx.arc(sx, sy, Math.max(1, s * 0.12), 0, Math.PI * 2);
  ctx.fill();

  const [tx, ty] = center(v.input.target);
  const tr = Math.max(3.5, s * 0.36);
  ctx.strokeStyle =
    snap.outcome === "found" && !v.editing ? (snap.diffStatus ? p.a : p.path) : p.ink;
  ctx.lineWidth = Math.max(1.5, s * 0.1);
  ctx.beginPath();
  ctx.arc(tx, ty, tr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(tx - tr * 1.35, ty);
  ctx.lineTo(tx - tr * 0.55, ty);
  ctx.moveTo(tx + tr * 0.55, ty);
  ctx.lineTo(tx + tr * 1.35, ty);
  ctx.moveTo(tx, ty - tr * 1.35);
  ctx.lineTo(tx, ty - tr * 0.55);
  ctx.moveTo(tx, ty + tr * 0.55);
  ctx.lineTo(tx, ty + tr * 1.35);
  ctx.stroke();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.beginPath();
  ctx.arc(tx, ty, Math.max(1.2, s * 0.1), 0, Math.PI * 2);
  ctx.fill();
}

function paintFocus({ ctx, p, s, ox, oy, w }: Frame, focus: number) {
  const x = ox + (focus % w) * s;
  const y = oy + Math.floor(focus / w) * s;
  ctx.strokeStyle = p.focus;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, s - 1, s - 1);
}
