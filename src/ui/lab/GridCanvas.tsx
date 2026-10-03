import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Run } from "@/core/experiment";
import { fmtCell, type GridInput } from "@/core/grid/model";
import { CLOSED, OPEN, type GridState } from "@/core/grid/machine";
import { useLab } from "@/store/lab";
import { cellsOnLine, eraseMode, moveEndpoint, paintCells } from "@/store/gridEdit";
import { setupCanvas, useElementSize, usePalette, useReducedMotion, type Palette } from "../hooks";

type GridRun = Extract<Run, { family: "grid" }>;

interface Props {
  run: GridRun;
  cursor: number;
  input: GridInput;
  editable: boolean;
  values: boolean;
  diff?: { run: GridRun; cursor: number } | null;
  label: string;
}

interface Geometry {
  s: number;
  ox: number;
  oy: number;
}

function geometry(W: number, H: number, w: number, h: number): Geometry {
  const s = Math.max(3, Math.floor(Math.min(W / w, H / h)));
  return { s, ox: Math.floor((W - s * w) / 2), oy: Math.floor((H - s * h) / 2) };
}

export function GridCanvas({ run, cursor, input, editable, values, diff, label }: Props) {
  const [box, size] = useElementSize<HTMLDivElement>();
  const canvas = useRef<HTMLCanvasElement>(null);
  const palette = usePalette();
  const reduced = useReducedMotion();
  const editing = useLab((s) => s.editing);
  const focusCell = useLab((s) => s.focusCell);
  const setFocusCell = useLab((s) => s.setFocusCell);
  const [kbdCell, setKbdCell] = useState<number | null>(null);
  const [announce, setAnnounce] = useState("");
  const flash = useRef<Float64Array>(new Float64Array(0));
  const prevStatus = useRef<Uint8Array | null>(null);
  const pathStart = useRef<{ key: string; t: number }>({ key: "", t: 0 });
  const raf = useRef(0);
  const drag = useRef<{ kind: "paint" | "start" | "target"; last: number; erase: boolean } | null>(
    null,
  );

  const geo = useMemo(
    () => geometry(size.w, size.h, input.w, input.h),
    [size.w, size.h, input.w, input.h],
  );

  const frame = run.player.at(cursor);
  const state = frame.state;

  const snapshot = useMemo(() => {
    const s = run.player.at(cursor).state;
    const ds = diff ? diff.run.player.at(diff.cursor).state : null;
    return {
      status: s.status.slice(),
      current: s.current,
      pushedNow: s.pushedNow.slice(),
      path: s.path,
      outcome: s.outcome,
      g: values ? s.g.slice() : null,
      parent: s.parent.slice(),
      frontier: values ? s.frontier.slice() : null,
      diffStatus: ds ? ds.status.slice() : null,
      diffPath: ds ? ds.path : null,
    };
  }, [cursor, run, values, diff]);

  useEffect(() => {
    const n = input.w * input.h;
    if (flash.current.length !== n) flash.current = new Float64Array(n);
    const prev = prevStatus.current;
    const now = performance.now();
    if (prev && prev.length === n && !reduced) {
      for (let i = 0; i < n; i++)
        if (prev[i] !== snapshot.status[i] && snapshot.status[i] !== 0) flash.current[i] = now;
    }
    prevStatus.current = snapshot.status;
    const key = snapshot.path.join(",");
    if (key && key !== pathStart.current.key) pathStart.current = { key, t: reduced ? 0 : now };
    if (!key) pathStart.current = { key: "", t: 0 };
  }, [snapshot, input.w, input.h, reduced]);

  const terrain = useMemo(() => {
    if (size.w < 2 || typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    const tctx = setupCanvas(c, size.w, size.h);
    if (!tctx) return null;
    paintTerrain(tctx, geo, input, palette);
    return c;
  }, [size.w, size.h, geo, input, palette]);

  const draw = useCallback(() => {
    const el = canvas.current;
    if (!el || size.w < 2) return false;
    const ctx = setupCanvas(el, size.w, size.h);
    if (!ctx) return false;
    return paint(ctx, size.w, size.h, geo, input, snapshot, palette, {
      editing,
      values,
      focus: kbdCell ?? focusCell,
      flash: flash.current,
      pathT: pathStart.current.t,
      reduced,
      algo: run.algo,
      terrain,
    });
  }, [
    size,
    geo,
    input,
    snapshot,
    palette,
    editing,
    values,
    kbdCell,
    focusCell,
    reduced,
    run.algo,
    terrain,
  ]);

  useEffect(() => {
    cancelAnimationFrame(raf.current);
    const loop = () => {
      const more = draw();
      if (more) raf.current = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf.current);
  }, [draw]);

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
    const [r, c] = [Math.floor(cell / g.w), cell % g.w];
    const parts = [`Row ${r}, column ${c}`];
    if (cell === g.start) parts.push("start");
    if (cell === g.target) parts.push("target");
    const v = g.cells[cell];
    parts.push(v === 0 ? "wall" : v > 1 ? `cost ${v}` : "open ground");
    if (state.status[cell] === CLOSED) parts.push(`expanded at step ${state.closedAt[cell]}`);
    else if (state.status[cell] === OPEN) parts.push("in the frontier");
    if (state.path.includes(cell)) parts.push("on the path");
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
        className="absolute inset-0 h-full w-full cursor-crosshair outline-none focus-visible:ring-2 focus-visible:ring-focus"
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
        <CellCard cell={focusCell} input={input} state={state} geo={geo} algo={run.algo} />
      )}
    </div>
  );
}

function CellCard({
  cell,
  input,
  state,
  geo,
  algo,
}: {
  cell: number;
  input: GridInput;
  state: GridState;
  geo: Geometry;
  algo: string;
}) {
  const r = Math.floor(cell / input.w);
  const c = cell % input.w;
  const status = state.status[cell];
  const g = state.g[cell];
  const parent = state.parent[cell];
  const x = geo.ox + (c + 1) * geo.s + 8;
  const y = geo.oy + r * geo.s;
  const flip = c > input.w * 0.6;
  const rows: [string, string][] = [["Cell", fmtCell(cell, input.w)]];
  const v = input.cells[cell];
  rows.push(["Terrain", v === 0 ? "wall" : v > 1 ? `cost ${v}` : "cost 1"]);
  if (status) {
    rows.push(["State", status === CLOSED ? "expanded" : "frontier"]);
    if (Number.isFinite(g))
      rows.push([
        algo === "bfs" || algo === "dfs" ? "Moves" : "g",
        String(Math.round(g * 100) / 100),
      ]);
    if (parent >= 0) rows.push(["Parent", fmtCell(parent, input.w)]);
    if (state.discoveredAt[cell] > 0) rows.push(["Found at", `step ${state.discoveredAt[cell]}`]);
    if (state.closedAt[cell] > 0) rows.push(["Expanded", `step ${state.closedAt[cell]}`]);
  }
  return (
    <div
      className="pointer-events-none absolute z-10 min-w-[150px] animate-fade-in rounded border border-rule-strong bg-surface/95 px-2.5 py-2 text-xs shadow-pop"
      style={
        flip
          ? { right: Math.max(4, geo.ox + (input.w - c) * geo.s + 8), top: Math.max(4, y) }
          : { left: x, top: Math.max(4, y) }
      }
      aria-hidden="true"
    >
      {rows.map(([k, val]) => (
        <div key={k} className="flex justify-between gap-4">
          <span className="text-ink-3">{k}</span>
          <span className="readout text-ink">{val}</span>
        </div>
      ))}
    </div>
  );
}

interface Snap {
  status: Uint8Array;
  current: number;
  pushedNow: number[];
  path: number[];
  outcome: string;
  g: Float64Array | null;
  parent: Int32Array;
  frontier: { cell: number; pri: number; h: number }[] | null;
  diffStatus: Uint8Array | null;
  diffPath: number[] | null;
}

function paintTerrain(ctx: CanvasRenderingContext2D, geo: Geometry, input: GridInput, p: Palette) {
  const { s, ox, oy } = geo;
  const { w, h, cells } = input;
  const gap = s >= 7 ? 1 : 0;
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

function paint(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  geo: Geometry,
  input: GridInput,
  snap: Snap,
  p: Palette,
  o: {
    editing: boolean;
    values: boolean;
    focus: number | null;
    flash: Float64Array;
    pathT: number;
    reduced: boolean;
    algo: string;
    terrain: HTMLCanvasElement | null;
  },
): boolean {
  const { s, ox, oy } = geo;
  const { w, h, cells } = input;
  const now = performance.now();
  let animating = false;
  ctx.clearRect(0, 0, W, H);
  if (o.terrain) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(o.terrain, 0, 0);
    ctx.restore();
  } else paintTerrain(ctx, geo, input, p);
  const gap = s >= 7 ? 1 : 0;
  const showRun = !o.editing;
  const pathSet = new Set(showRun ? snap.path : []);

  for (let i = 0; i < w * h; i++) {
    const v = cells[i];
    if (v === 0 || !showRun) continue;
    let fill: string | null = null;
    if (snap.diffStatus) {
      const a = snap.status[i] === CLOSED;
      const b = snap.diffStatus[i] === CLOSED;
      fill = a && b ? p.closed : a ? p.rgb("st-a", 0.45) : b ? p.rgb("st-b", 0.4) : null;
    } else if (snap.status[i] === CLOSED) fill = p.closed;
    else if (snap.status[i] === OPEN) fill = p.open;
    const t = o.reduced ? 0 : o.flash[i];
    if (!fill && !t) continue;
    const x = ox + (i % w) * s;
    const y = oy + Math.floor(i / w) * s;
    if (fill) {
      ctx.globalAlpha = v > 1 ? 0.8 : 1;
      ctx.fillStyle = fill;
      ctx.fillRect(x + gap, y + gap, s - gap, s - gap);
      ctx.globalAlpha = 1;
    }
    if (t) {
      const age = (now - t) / 320;
      if (age < 1) {
        ctx.fillStyle = p.rgb("signal", 0.55 * (1 - age) * (1 - age));
        ctx.fillRect(x + gap, y + gap, s - gap, s - gap);
        animating = true;
      }
    }
  }

  if (showRun && o.values && s >= 22 && snap.g) {
    const fs = Math.max(9, Math.min(12, Math.floor(s * 0.32)));
    ctx.font = `500 ${fs}px "IBM Plex Mono", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const fMap = new Map<number, number>();
    if (snap.frontier && (o.algo === "astar" || o.algo === "greedy"))
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
    ctx.strokeStyle = p.rgb("signal", 0.8);
    ctx.lineWidth = Math.max(1, s * 0.08);
    const [cx, cy] = center(snap.current);
    for (const n of snap.pushedNow) {
      const [nx, ny] = center(n);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + (nx - cx) * 0.78, cy + (ny - cy) * 0.78);
      ctx.stroke();
    }
  }

  if (showRun && o.focus !== null && o.focus >= 0 && o.focus < w * h && snap.parent[o.focus] >= 0) {
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let c = o.focus;
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
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, s * 0.26);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (dashed) ctx.setLineDash([s * 0.5, s * 0.4]);
    ctx.beginPath();
    const segs = (path.length - 1) * progress;
    ctx.moveTo(...center(path[0]));
    for (let i = 1; i < path.length; i++) {
      if (i - 1 >= segs) break;
      const [x1, y1] = center(path[i]);
      if (i > segs) {
        const [x0, y0] = center(path[i - 1]);
        const f = segs - (i - 1);
        ctx.lineTo(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f);
      } else ctx.lineTo(x1, y1);
    }
    ctx.stroke();
    ctx.restore();
  };

  if (showRun && snap.path.length) {
    let prog = 1;
    if (o.pathT) {
      prog = Math.min(1, (now - o.pathT) / Math.min(900, 220 + snap.path.length * 14));
      prog = 1 - (1 - prog) ** 3;
      if (prog < 1) animating = true;
    }
    drawPath(snap.path, snap.diffStatus ? p.a : p.path, prog);
  }
  if (showRun && snap.diffPath && snap.diffPath.length) drawPath(snap.diffPath, p.b, 1, true);

  if (showRun && snap.current >= 0 && !pathSet.has(snap.current)) {
    const x = ox + (snap.current % w) * s;
    const y = oy + Math.floor(snap.current / w) * s;
    ctx.fillStyle = p.signal;
    ctx.fillRect(x + gap, y + gap, s - gap, s - gap);
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

  if (o.focus !== null && o.focus >= 0 && o.focus < w * h) {
    const x = ox + (o.focus % w) * s;
    const y = oy + Math.floor(o.focus / w) * s;
    ctx.strokeStyle = p.focus;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, s - 1, s - 1);
  }
  return animating;
}
