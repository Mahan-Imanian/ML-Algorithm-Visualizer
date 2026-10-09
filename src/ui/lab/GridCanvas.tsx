import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { fmtCell, type GridInput } from "@/core/grid/model";
import { CLOSED, OPEN, type GridState } from "@/core/grid/machine";
import { baseRate, SPEEDS, useLab } from "@/store/lab";
import { cellsOnLine, eraseMode, moveEndpoint, paintCells } from "@/store/gridEdit";
import { usePresentedCursor } from "../clock";
import { setupCanvas, useElementSize, usePalette, useReducedMotion } from "../hooks";
import { timed, useCommitCounter } from "../perf";
import {
  geometry,
  paint,
  paintTerrain,
  takeSnap,
  type Anim,
  type Geometry,
  type GridRun,
  type Snap,
} from "./gridDraw";

interface Props {
  run: GridRun;
  which: "a" | "b";
  diff: GridRun | null;
  input: GridInput;
  editable: boolean;
  values: boolean;
  label: string;
}

const CELL_MOTION = { stepFraction: 0.9, minMs: 70, maxMs: 240, pausedMs: 200 };

function cursorOf(which: "a" | "b") {
  const s = useLab.getState();
  return which === "a" ? s.cursorA : s.cursorB;
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
    dur: CELL_MOTION.pausedMs,
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
      const fit = (CELL_MOTION.stepFraction * 1000) / Math.max(1, rate);
      a.dur = s.playing
        ? Math.max(CELL_MOTION.minMs, Math.min(CELL_MOTION.maxMs, fit))
        : CELL_MOTION.pausedMs;
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
