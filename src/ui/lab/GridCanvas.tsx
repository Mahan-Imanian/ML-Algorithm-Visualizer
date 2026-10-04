import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Run } from "@/core/experiment";
import { fmtCell, type GridInput } from "@/core/grid/model";
import { CLOSED, OPEN, type GridState } from "@/core/grid/machine";
import { baseRate, SPEEDS, useLab } from "@/store/lab";
import { cellsOnLine, eraseMode, moveEndpoint, paintCells } from "@/store/gridEdit";
import { usePresentedCursor } from "../clock";
import { setupCanvas, useElementSize, usePalette, useReducedMotion, type Palette } from "../hooks";
import { timed, useCommitCounter } from "../perf";

type GridRun = Extract<Run, { family: "grid" }>;

interface Props {
  run: GridRun;
  which: "a" | "b";
  diff: GridRun | null;
  input: GridInput;
  editable: boolean;
  values: boolean;
  label: string;
}

interface Geometry {
  s: number;
  ox: number;
  oy: number;
  ruler: number;
}

const RULER = 16;

function geometry(W: number, H: number, w: number, h: number): Geometry {
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

interface Snap {
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

interface Anim {
  from: Uint8Array;
  at: Float64Array;
  pathKey: string;
  pathT: number;
  dur: number;
}

function cursorOf(which: "a" | "b") {
  const s = useLab.getState();
  return which === "a" ? s.cursorA : s.cursorB;
}

function takeSnap(run: GridRun, cursor: number, diff: GridRun | null, diffCursor: number): Snap {
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

export function GridCanvas({ run, which, diff, input, editable, values, label }: Props) {
  useCommitCounter("grid canvas");
  const [box, size] = useElementSize<HTMLDivElement>();
  const canvas = useRef<HTMLCanvasElement>(null);
  const palette = usePalette();
  const reduced = useReducedMotion();
  const editing = useLab((s) => s.editing);
  const focusCell = useLab((s) => s.focusCell);
  const setFocusCell = useLab((s) => s.setFocusCell);
  const [kbdCell, setKbdCell] = useState<number | null>(null);
  const [announce, setAnnounce] = useState("");
  const drag = useRef<{ kind: "paint" | "start" | "target"; last: number; erase: boolean } | null>(
    null,
  );

  const geo = useMemo(
    () => geometry(size.w, size.h, input.w, input.h),
    [size.w, size.h, input.w, input.h],
  );

  const terrain = useMemo(() => {
    if (size.w < 2 || typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    const tctx = setupCanvas(c, size.w, size.h);
    if (!tctx) return null;
    paintTerrain(tctx, geo, input, palette);
    return c;
  }, [size.w, size.h, geo, input, palette]);

  const view = useRef({
    geo,
    input,
    palette,
    terrain,
    editing,
    values,
    focus: kbdCell ?? focusCell,
    reduced,
    algo: run.algo,
    w: size.w,
    h: size.h,
  });
  view.current = {
    geo,
    input,
    palette,
    terrain,
    editing,
    values,
    focus: kbdCell ?? focusCell,
    reduced,
    algo: run.algo,
    w: size.w,
    h: size.h,
  };

  const snap = useRef<Snap | null>(null);
  const anim = useRef<Anim>({
    from: new Uint8Array(0),
    at: new Float64Array(0),
    pathKey: "",
    pathT: 0,
    dur: 180,
  });
  const raf = useRef(0);

  const request = useRef<() => void>(() => undefined);
  request.current = () => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const el = canvas.current;
      const v = view.current;
      const sn = snap.current;
      if (!el || !sn || v.w < 2) return;
      const ctx = setupCanvas(el, v.w, v.h);
      if (!ctx) return;
      const more = timed("grid", () => paint(ctx, v, sn, anim.current));
      if (more) request.current();
    });
  };

  useLayoutEffect(() => {
    const n = input.w * input.h;
    const sync = (fresh: boolean) => {
      const s = useLab.getState();
      const next = takeSnap(run, cursorOf(which), diff, which === "a" ? s.cursorB : s.cursorA);
      const a = anim.current;
      const now = performance.now();
      if (a.from.length !== n || fresh) {
        a.from = new Uint8Array(n);
        a.at = new Float64Array(n);
      }
      const prev = snap.current;
      const rate = baseRate(s) * SPEEDS[s.speed];
      a.dur = s.playing ? Math.max(70, Math.min(240, 900 / Math.max(1, rate))) : 200;
      if (prev && prev.status.length === n && !view.current.reduced && !fresh) {
        for (let i = 0; i < n; i++) {
          if (prev.status[i] !== next.status[i]) {
            a.from[i] = prev.status[i];
            a.at[i] = now;
          }
        }
      }
      const key = next.path.join(",");
      if (key !== a.pathKey) {
        a.pathKey = key;
        a.pathT = key && !view.current.reduced && prev && !fresh ? now : 0;
      }
      snap.current = next;
      request.current();
    };
    sync(true);
    return useLab.subscribe((s, p) => {
      if (s.cursorA !== p.cursorA || s.cursorB !== p.cursorB) sync(false);
    });
  }, [run, diff, which, input.w, input.h]);

  useEffect(() => {
    request.current();
  }, [geo, terrain, editing, values, kbdCell, focusCell, palette, size.w, size.h]);

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    },
    [],
  );

  const cellAt = (clientX: number, clientY: number): number => {
    const el = canvas.current;
    if (!el) return -1;
    const r = el.getBoundingClientRect();
    const c = Math.floor((clientX - r.left - geo.ox) / geo.s);
    const row = Math.floor((clientY - r.top - geo.oy) / geo.s);
    if (c < 0 || row < 0 || c >= input.w || row >= input.h) return -1;
    return row * input.w + c;
  };

  const store = useLab.getState;

  const applyAt = (cells: number[]) => {
    const d = drag.current;
    if (!d) return;
    const s = store();
    if (d.kind === "paint") s.editInput((e) => paintCells(e, cells, s.tool, s.weight, d.erase));
    else s.editInput((e) => moveEndpoint(e, d.kind as "start" | "target", cells[cells.length - 1]));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!editable || e.button > 0) return;
    const cell = cellAt(e.clientX, e.clientY);
    if (cell < 0) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const s = store();
    const kind =
      cell === input.start
        ? "start"
        : cell === input.target
          ? "target"
          : s.tool === "start"
            ? "start"
            : s.tool === "target"
              ? "target"
              : "paint";
    drag.current = {
      kind,
      last: cell,
      erase: kind === "paint" && eraseMode(s.exp, cell, s.tool, s.weight),
    };
    s.beginEdit();
    applyAt([cell]);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const cell = cellAt(e.clientX, e.clientY);
    if (drag.current) {
      if (cell < 0 || cell === drag.current.last) return;
      const line = cellsOnLine(drag.current.last, cell, input.w);
      drag.current.last = cell;
      applyAt(line);
      return;
    }
    if (e.pointerType === "mouse" && cell !== focusCell) setFocusCell(cell < 0 ? null : cell);
  };

  const endDrag = () => {
    if (!drag.current) return;
    drag.current = null;
    store().endEdit();
  };

  const describe = (cell: number) => {
    const g = input;
    const st = run.player.at(cursorOf(which)).state;
    const [r, c] = [Math.floor(cell / g.w), cell % g.w];
    const parts = [`Row ${r}, column ${c}`];
    if (cell === g.start) parts.push("start");
    if (cell === g.target) parts.push("target");
    const v = g.cells[cell];
    parts.push(v === 0 ? "wall" : v > 1 ? `cost ${v}` : "open ground");
    if (st.status[cell] === CLOSED) parts.push(`expanded at step ${st.closedAt[cell]}`);
    else if (st.status[cell] === OPEN) parts.push("in the frontier");
    if (st.path.includes(cell)) parts.push("on the path");
    return parts.join(", ");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const g = input;
    const cur = kbdCell ?? g.start;
    let next = cur;
    const r = Math.floor(cur / g.w);
    const c = cur % g.w;
    const s = store();
    const commit = (fn: Parameters<typeof s.editInput>[0]) => {
      s.beginEdit();
      s.editInput(fn);
      s.endEdit();
    };
    switch (e.key) {
      case "ArrowUp":
        next = r > 0 ? cur - g.w : cur;
        break;
      case "ArrowDown":
        next = r < g.h - 1 ? cur + g.w : cur;
        break;
      case "ArrowLeft":
        next = c > 0 ? cur - 1 : cur;
        break;
      case "ArrowRight":
        next = c < g.w - 1 ? cur + 1 : cur;
        break;
      case "Home":
        next = r * g.w;
        break;
      case "End":
        next = r * g.w + g.w - 1;
        break;
      case " ":
      case "Enter":
        if (!editable) return;
        e.preventDefault();
        e.stopPropagation();
        if (s.tool === "start" || s.tool === "target")
          commit((x) => moveEndpoint(x, s.tool as "start" | "target", cur));
        else
          commit((x) =>
            paintCells(x, [cur], s.tool, s.weight, eraseMode(x, cur, s.tool, s.weight)),
          );
        setAnnounce(describe(cur));
        return;
      case "s":
      case "S":
        if (!editable || e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        e.stopPropagation();
        commit((x) => moveEndpoint(x, "start", cur));
        setAnnounce(`Start moved to row ${r}, column ${c}`);
        return;
      case "t":
      case "T":
        if (!editable || e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        e.stopPropagation();
        commit((x) => moveEndpoint(x, "target", cur));
        setAnnounce(`Target moved to row ${r}, column ${c}`);
        return;
      case "Escape":
        (e.target as HTMLElement).blur();
        return;
      default:
        return;
    }
    e.preventDefault();
    e.stopPropagation();
    setKbdCell(next);
    setFocusCell(next);
    setAnnounce(describe(next));
  };

  return (
    <div ref={box} className="relative h-full w-full touch-none select-none">
      <canvas
        ref={canvas}
        className="absolute inset-0 h-full w-full cursor-crosshair outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
        tabIndex={0}
        role="application"
        aria-roledescription="grid"
        aria-label={`${label}. ${input.w} by ${input.h} grid. ${editable ? "Arrow keys move the cursor. Space applies the current tool, S places the start, T places the target." : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={(e) => {
          if (!drag.current && e.pointerType === "mouse") setFocusCell(null);
        }}
        onFocus={() => {
          if (kbdCell === null) {
            setKbdCell(input.start);
            setAnnounce(describe(input.start));
          }
        }}
        onBlur={() => setKbdCell(null)}
        onKeyDown={onKeyDown}
      />
      <div className="sr-only" aria-live="polite">
        {announce}
      </div>
      {focusCell !== null && focusCell < input.w * input.h && !editing && (
        <CellCard cell={focusCell} input={input} run={run} which={which} geo={geo} width={size.w} />
      )}
    </div>
  );
}

function CellCard({
  cell,
  input,
  run,
  which,
  geo,
  width,
}: {
  cell: number;
  input: GridInput;
  run: GridRun;
  which: "a" | "b";
  geo: Geometry;
  width: number;
}) {
  const state: GridState = run.player.at(usePresentedCursor(which)).state;
  const algo = run.algo;
  const r = Math.floor(cell / input.w);
  const c = cell % input.w;
  const status = state.status[cell];
  const g = state.g[cell];
  const parent = state.parent[cell];
  const left = geo.ox + (c + 1) * geo.s + 8;
  const flip = left + 180 > width;
  const y = geo.oy + r * geo.s;
  const rows: [string, string][] = [["Cell", fmtCell(cell, input.w)]];
  const v = input.cells[cell];
  rows.push(["Terrain", v === 0 ? "wall" : v > 1 ? `cost ${v}` : "cost 1"]);
  rows.push(["State", status === CLOSED ? "expanded" : status === OPEN ? "frontier" : "unseen"]);
  if (status) {
    if (Number.isFinite(g))
      rows.push([
        algo === "bfs" || algo === "dfs" ? "Moves" : "g",
        String(Math.round(g * 100) / 100),
      ]);
    if (parent >= 0) rows.push(["Parent", fmtCell(parent, input.w)]);
    if (state.discoveredAt[cell] > 0) rows.push(["Found at", `op ${state.discoveredAt[cell]}`]);
    if (state.closedAt[cell] > 0) rows.push(["Expanded", `op ${state.closedAt[cell]}`]);
  }
  return (
    <div
      className="pointer-events-none absolute z-10 w-[172px] border border-rule-strong bg-surface px-2.5 py-2 text-xs shadow-pop"
      style={
        flip
          ? { left: Math.max(4, geo.ox + c * geo.s - 180), top: Math.max(4, y) }
          : { left, top: Math.max(4, y) }
      }
      aria-hidden="true"
    >
      {rows.map(([k, val]) => (
        <div key={k} className="flex h-[18px] items-center justify-between gap-4">
          <span className="text-ink-3">{k}</span>
          <span className="readout text-ink">{val}</span>
        </div>
      ))}
    </div>
  );
}

function paintTerrain(ctx: CanvasRenderingContext2D, geo: Geometry, input: GridInput, p: Palette) {
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

interface View {
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

const ease = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);

function paint(ctx: CanvasRenderingContext2D, v: View, snap: Snap, a: Anim): boolean {
  const { s, ox, oy } = v.geo;
  const { input, palette: p } = v;
  const { w, h, cells } = input;
  const now = performance.now();
  let animating = false;
  ctx.clearRect(0, 0, v.w, v.h);
  if (v.terrain) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(v.terrain, 0, 0);
    ctx.restore();
  } else paintTerrain(ctx, v.geo, input, p);
  const gap = s >= 7 ? 1 : 0;
  const inner = s - gap;
  const showRun = !v.editing;
  const pathSet = new Set(showRun ? snap.path : []);
  const colorOf = (st: number) => (st === CLOSED ? p.closed : st === OPEN ? p.open : null);

  if (showRun) {
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
  }

  if (showRun && v.values && s >= 22) {
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

  const center = (c: number): [number, number] => [
    ox + (c % w) * s + s / 2,
    oy + Math.floor(c / w) * s + s / 2,
  ];

  if (showRun && snap.current >= 0 && snap.pushedNow.length) {
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

  if (showRun && v.focus !== null && v.focus >= 0 && v.focus < w * h && snap.parent[v.focus] >= 0) {
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let c = v.focus;
    ctx.moveTo(...center(c));
    let guard = 0;
    while (snap.parent[c] >= 0 && guard++ < w * h) {
      c = snap.parent[c];
      ctx.lineTo(...center(c));
    }
    ctx.stroke();
    ctx.restore();
  }

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

  if (showRun && snap.path.length) {
    let prog = 1;
    if (a.pathT) {
      prog = Math.min(1, (now - a.pathT) / Math.min(1100, 260 + snap.path.length * 16));
      prog = ease(prog);
      if (prog < 1) animating = true;
    }
    drawPath(snap.path, snap.diffStatus ? p.a : p.path, prog);
  }
  if (showRun && snap.diffPath && snap.diffPath.length) drawPath(snap.diffPath, p.b, 1, true);

  if (showRun && snap.current >= 0 && !pathSet.has(snap.current)) {
    const [cx, cy] = center(snap.current);
    ctx.fillStyle = p.signal;
    ctx.fillRect(cx - inner / 2, cy - inner / 2, inner, inner);
    if (s >= 8) {
      ctx.strokeStyle = p.signal;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx - s / 2 - 1.5, cy - s / 2 - 1.5, s + 3, s + 3);
    }
  }

  if (showRun && snap.diffCurrent >= 0) {
    const [bx, by] = center(snap.diffCurrent);
    ctx.strokeStyle = p.b;
    ctx.lineWidth = Math.max(1.5, s * 0.14);
    ctx.strokeRect(bx - inner / 2 + 1, by - inner / 2 + 1, inner - 2, inner - 2);
  }

  const [sx, sy] = center(input.start);
  ctx.fillStyle = p.ink;
  ctx.beginPath();
  ctx.arc(sx, sy, Math.max(3, s * 0.34), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.field;
  ctx.beginPath();
  ctx.arc(sx, sy, Math.max(1, s * 0.12), 0, Math.PI * 2);
  ctx.fill();

  const [tx, ty] = center(input.target);
  const tr = Math.max(3.5, s * 0.36);
  ctx.strokeStyle = snap.outcome === "found" && showRun ? (snap.diffStatus ? p.a : p.path) : p.ink;
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

  if (v.focus !== null && v.focus >= 0 && v.focus < w * h) {
    const x = ox + (v.focus % w) * s;
    const y = oy + Math.floor(v.focus / w) * s;
    ctx.strokeStyle = p.focus;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, s - 1, s - 1);
  }
  return animating;
}
