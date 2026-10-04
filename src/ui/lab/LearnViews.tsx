import { useEffect, useMemo, useRef } from "react";
import type { KMeansExp, Run } from "@/core/experiment";
import { B_RANGE, bestFit, lossAt, M_RANGE } from "@/core/learn/gradient";
import type { Point } from "@/core/learn/kmeans";
import { useLab } from "@/store/lab";
import { perf, timed } from "../perf";
import { CLUSTER_COLORS } from "./colors";
import { setupCanvas, useElementSize, usePalette, useReducedMotion, type Palette } from "../hooks";

type KRun = Extract<Run, { family: "kmeans" }>;
type GRun = Extract<Run, { family: "gradient" }>;

function plotBox(W: number, H: number, padL = 34, padB = 26, pad = 10) {
  const side = Math.max(0, Math.min(W - padL - pad, H - padB - pad));
  const x0 = padL + Math.max(0, (W - padL - pad - side) / 2);
  const y0 = pad + Math.max(0, (H - padB - pad - side) / 2);
  return { x0, y0, side };
}

function axes(
  ctx: CanvasRenderingContext2D,
  p: Palette,
  x0: number,
  y0: number,
  w: number,
  h: number,
  xr: [number, number],
  yr: [number, number],
  xl: string,
  yl: string,
) {
  ctx.strokeStyle = p.ruleStrong;
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, w, h);
  ctx.fillStyle = p.ink3;
  ctx.font = '10px "IBM Plex Mono", monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let i = 0; i <= 4; i++) {
    const v = xr[0] + ((xr[1] - xr[0]) * i) / 4;
    const x = x0 + (w * i) / 4;
    ctx.fillRect(x, y0 + h, 1, 4);
    ctx.fillText(String(Math.round(v * 100) / 100), x, y0 + h + 6);
  }
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= 4; i++) {
    const v = yr[0] + ((yr[1] - yr[0]) * i) / 4;
    const y = y0 + h - (h * i) / 4;
    ctx.fillRect(x0 - 4, y, 4, 1);
    ctx.fillText(String(Math.round(v * 100) / 100), x0 - 6, y);
  }
  ctx.fillStyle = p.ink2;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText(xl, x0 + w, y0 - 2);
  ctx.save();
  ctx.translate(x0 - 26, y0);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillText(yl, 0, 0);
  ctx.restore();
}

export function KMeansView({
  run,
  cursor,
  label,
  editable,
}: {
  run: KRun;
  cursor: number;
  label: string;
  editable: boolean;
}) {
  const [ref, size] = useElementSize<HTMLDivElement>();
  const canvas = useRef<HTMLCanvasElement>(null);
  const p = usePalette();
  const reduced = useReducedMotion();
  const manual = run.params.init === "manual";
  const placed = run.params.manual;
  const anim = useRef<{ from: Point[]; t: number }>({ from: [], t: 0 });
  const prevKey = useRef("");

  const snap = useMemo(() => {
    const s = run.player.at(cursor).state;
    return {
      centroids: s.centroids.map((c) => ({ ...c })),
      trails: s.trails.map((t) => t.slice()),
      assign: s.assign ? s.assign.slice() : null,
      phase: s.phase,
      empty: s.empty.slice(),
    };
  }, [cursor, run]);

  useEffect(() => {
    const key = snap.centroids.map((c) => `${c.x.toFixed(4)},${c.y.toFixed(4)}`).join("|");
    if (snap.phase === "update" && !reduced) {
      anim.current = {
        from: snap.trails.map((t) => t[t.length - 2] ?? t[t.length - 1]),
        t: performance.now(),
      };
    } else anim.current = { from: [], t: 0 };
    prevKey.current = key;
  }, [snap, reduced]);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const el = canvas.current;
      if (!el || size.w < 2) return;
      const ctx = setupCanvas(el, size.w, size.h);
      if (!ctx) return;
      ctx.clearRect(0, 0, size.w, size.h);
      const { x0, y0, side } = plotBox(size.w, size.h);
      const X = (x: number) => x0 + x * side;
      const Y = (y: number) => y0 + side - y * side;
      ctx.fillStyle = p.field;
      ctx.fillRect(x0, y0, side, side);
      let prog = 1;
      if (anim.current.t) {
        prog = Math.min(1, (performance.now() - anim.current.t) / 420);
        prog = 1 - (1 - prog) ** 3;
      }
      const cents = snap.centroids.map((c, i) => {
        const f = anim.current.from[i];
        return f && prog < 1 ? { x: f.x + (c.x - f.x) * prog, y: f.y + (c.y - f.y) * prog } : c;
      });
      if (cents.length && snap.assign) {
        const cells = 48;
        const cs = side / cells;
        for (let gy = 0; gy < cells; gy++) {
          for (let gx = 0; gx < cells; gx++) {
            const px = (gx + 0.5) / cells;
            const py = 1 - (gy + 0.5) / cells;
            let best = 0;
            let bd = Infinity;
            cents.forEach((c, i) => {
              const d = (c.x - px) ** 2 + (c.y - py) ** 2;
              if (d < bd) {
                bd = d;
                best = i;
              }
            });
            ctx.fillStyle = CLUSTER_COLORS[best % CLUSTER_COLORS.length] + "1a";
            ctx.fillRect(x0 + gx * cs, y0 + gy * cs, cs + 0.5, cs + 0.5);
          }
        }
      }
      const pts = run.input.points;
      for (let i = 0; i < pts.length; i++) {
        const a = snap.assign ? snap.assign[i] : -1;
        ctx.fillStyle = a >= 0 ? CLUSTER_COLORS[a % CLUSTER_COLORS.length] : p.ink3;
        ctx.beginPath();
        ctx.arc(X(pts[i].x), Y(pts[i].y), 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      snap.trails.forEach((t, i) => {
        if (t.length < 2) return;
        ctx.strokeStyle = CLUSTER_COLORS[i % CLUSTER_COLORS.length];
        ctx.lineWidth = 1.25;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(X(t[0].x), Y(t[0].y));
        const upto = prog < 1 ? t.length - 1 : t.length;
        for (let k = 1; k < upto; k++) ctx.lineTo(X(t[k].x), Y(t[k].y));
        if (prog < 1) ctx.lineTo(X(cents[i].x), Y(cents[i].y));
        ctx.stroke();
        ctx.setLineDash([]);
      });
      cents.forEach((c, i) => {
        const x = X(c.x);
        const y = Y(c.y);
        const col = CLUSTER_COLORS[i % CLUSTER_COLORS.length];
        ctx.fillStyle = p.field;
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - 4.5, y - 4.5);
        ctx.lineTo(x + 4.5, y + 4.5);
        ctx.moveTo(x + 4.5, y - 4.5);
        ctx.lineTo(x - 4.5, y + 4.5);
        ctx.stroke();
        if (snap.empty.includes(i)) {
          ctx.fillStyle = p.signal;
          ctx.font = '10px "IBM Plex Mono", monospace';
          ctx.textAlign = "left";
          ctx.fillText("empty", x + 12, y);
        }
      });
      if (manual && cursor === 0) {
        placed.forEach((c) => {
          ctx.strokeStyle = p.ink;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.arc(X(c.x), Y(c.y), 11, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        });
      }
      axes(ctx, p, x0, y0, side, side, [0, 1], [0, 1], "x", "y");
      if (prog < 1) raf = requestAnimationFrame(draw);
    };
    timed("k-means", draw);
    return () => cancelAnimationFrame(raf);
  }, [snap, size, p, run.input.points, manual, placed, cursor]);

  const onClick = (e: React.MouseEvent) => {
    if (!editable || !manual) return;
    const rect = canvas.current!.getBoundingClientRect();
    const { x0, y0, side } = plotBox(size.w, size.h);
    const x = (e.clientX - rect.left - x0) / side;
    const y = 1 - (e.clientY - rect.top - y0) / side;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    const st = useLab.getState();
    const exp = st.exp as KMeansExp;
    const which = exp.a.params === run.params ? "a" : "b";
    const v = which === "a" ? exp.a : exp.b!;
    const next = [...v.params.manual, { x, y }].slice(-v.params.k);
    st.setParams(which, { ...v.params, manual: next });
  };

  const sizes = useMemo(() => {
    if (!snap.assign) return "";
    const counts = new Array(snap.centroids.length).fill(0);
    snap.assign.forEach((a) => counts[a]++);
    return counts.map((c, i) => `cluster ${i + 1}: ${c} points`).join(", ");
  }, [snap]);

  return (
    <div ref={ref} className="relative h-full w-full">
      <canvas
        ref={canvas}
        onClick={onClick}
        className={
          manual && editable
            ? "absolute inset-0 h-full w-full cursor-crosshair"
            : "absolute inset-0 h-full w-full"
        }
        role="img"
        aria-label={`${label}: ${run.input.points.length} points, ${snap.centroids.length} centroids. ${sizes}`}
      />
      {manual && editable && cursor === 0 && (
        <p className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded bg-ink px-2.5 py-1 text-xs text-surface">
          Click the plot to place centroids ({placed.length}/{run.params.k})
        </p>
      )}
    </div>
  );
}

export function GradientView({ run, cursor, label }: { run: GRun; cursor: number; label: string }) {
  const [ref, size] = useElementSize<HTMLDivElement>();
  const canvas = useRef<HTMLCanvasElement>(null);
  const p = usePalette();
  const pts = run.input.points;
  const opt = useMemo(() => bestFit(pts), [pts]);

  const surface = useMemo(() => {
    const cols = 96;
    const rows = 72;
    const vals = new Float32Array(cols * rows);
    let lo = Infinity;
    let hi = -Infinity;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const m = M_RANGE[0] + ((M_RANGE[1] - M_RANGE[0]) * (c + 0.5)) / cols;
        const b = B_RANGE[1] - ((B_RANGE[1] - B_RANGE[0]) * (r + 0.5)) / rows;
        const v = Math.log(lossAt(pts, m, b) + 1e-4);
        vals[r * cols + c] = v;
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
    }
    return { cols, rows, vals, lo, hi };
  }, [pts]);

  const surfaceImg = useMemo(() => {
    if (typeof document === "undefined") return null;
    const off = document.createElement("canvas");
    off.width = surface.cols;
    off.height = surface.rows;
    const octx = off.getContext("2d");
    if (!octx) return null;
    const img = octx.createImageData(surface.cols, surface.rows);
    const channels = (name: string) =>
      p
        .rgb(name)
        .replace(/^rgb\(|\s*\/.*$/g, "")
        .trim()
        .split(/\s+/)
        .map(Number);
    const ink = channels("ink");
    const field = channels("field");
    for (let i = 0; i < surface.vals.length; i++) {
      const t = (surface.vals[i] - surface.lo) / Math.max(1e-9, surface.hi - surface.lo);
      const band = Math.floor(t * 12) / 12;
      const a = 0.04 + band * 0.42 + (Math.floor(t * 12) % 2 ? 0.03 : 0);
      img.data[i * 4] = field[0] + (ink[0] - field[0]) * a;
      img.data[i * 4 + 1] = field[1] + (ink[1] - field[1]) * a;
      img.data[i * 4 + 2] = field[2] + (ink[2] - field[2]) * a;
      img.data[i * 4 + 3] = 255;
    }
    octx.putImageData(img, 0, 0);
    return off;
  }, [surface, p]);

  const snap = useMemo(() => {
    const st = run.player.at(cursor).state;
    return {
      m: st.m,
      b: st.b,
      path: st.path.slice(),
      phase: st.phase,
      gm: st.gm,
      gb: st.gb,
      loss: st.loss,
    };
  }, [cursor, run]);

  useEffect(() => {
    const t0 = performance.now();
    const el = canvas.current;
    if (!el || size.w < 2) return;
    const ctx = setupCanvas(el, size.w, size.h);
    if (!ctx) return;
    ctx.clearRect(0, 0, size.w, size.h);
    const stacked = size.w < 620;
    const halfW = stacked ? size.w : size.w / 2;
    const halfH = stacked ? size.h * 0.52 : size.h - 54;

    {
      const { x0, y0, side } = plotBox(halfW, halfH);
      const X = (x: number) => x0 + x * side;
      const Y = (y: number) => y0 + side - y * side;
      ctx.fillStyle = p.field;
      ctx.fillRect(x0, y0, side, side);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, y0, side, side);
      ctx.clip();
      ctx.strokeStyle = p.rgb("signal", 0.45);
      ctx.lineWidth = 1;
      for (const q of pts) {
        ctx.beginPath();
        ctx.moveTo(X(q.x), Y(q.y));
        ctx.lineTo(X(q.x), Y(snap.m * q.x + snap.b));
        ctx.stroke();
      }
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = p.ink3;
      ctx.beginPath();
      ctx.moveTo(X(0), Y(opt.b));
      ctx.lineTo(X(1), Y(opt.m + opt.b));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = snap.phase === "diverged" ? p.signal : p.ink;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(X(0), Y(snap.b));
      ctx.lineTo(X(1), Y(snap.m + snap.b));
      ctx.stroke();
      ctx.restore();
      for (const q of pts) {
        ctx.fillStyle = p.ink2;
        ctx.beginPath();
        ctx.arc(X(q.x), Y(q.y), 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
      axes(ctx, p, x0, y0, side, side, [0, 1], [0, 1], "x", "y");
      ctx.fillStyle = p.ink2;
      ctx.font = '11px "IBM Plex Mono", monospace';
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("data · ŷ = m·x + b", x0 + 6, y0 + 6);
    }

    {
      const ox = stacked ? 0 : halfW;
      const oy = stacked ? halfH : 0;
      const areaH = stacked ? size.h - halfH - 54 : halfH;
      const { x0: bx, y0: by, side } = plotBox(halfW, areaH);
      const x0 = ox + bx;
      const y0 = oy + by;
      const w = side;
      const h = side;
      if (surfaceImg) {
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(surfaceImg, x0, y0, w, h);
      }
      const MX = (m: number) => x0 + ((m - M_RANGE[0]) / (M_RANGE[1] - M_RANGE[0])) * w;
      const BY = (b: number) => y0 + ((B_RANGE[1] - b) / (B_RANGE[1] - B_RANGE[0])) * h;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, y0, w, h);
      ctx.clip();
      ctx.strokeStyle = p.ink;
      ctx.lineWidth = 1.5;
      ctx.font = '12px "IBM Plex Mono", monospace';
      ctx.fillStyle = p.path;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("×", MX(opt.m), BY(opt.b));
      ctx.strokeStyle = p.signal;
      ctx.lineWidth = 1.75;
      ctx.beginPath();
      snap.path.forEach((q, i) =>
        i ? ctx.lineTo(MX(q.m), BY(q.b)) : ctx.moveTo(MX(q.m), BY(q.b)),
      );
      ctx.stroke();
      ctx.fillStyle = p.signal;
      for (const q of snap.path) {
        ctx.beginPath();
        ctx.arc(MX(q.m), BY(q.b), 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      const last = snap.path[snap.path.length - 1];
      if (last) {
        ctx.fillStyle = p.field;
        ctx.strokeStyle = p.signal;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(MX(last.m), BY(last.b), 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (snap.phase === "gradient") {
          const len = Math.hypot(snap.gm, snap.gb) || 1;
          const sc = Math.min(40, 18 + len * 4) / len;
          ctx.strokeStyle = p.ink;
          ctx.lineWidth = 1.5;
          const ax = MX(last.m);
          const ay = BY(last.b);
          const ex = ax - snap.gm * sc;
          const ey = ay + snap.gb * sc;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(ex, ey);
          ctx.stroke();
          const ang = Math.atan2(ey - ay, ex - ax);
          ctx.beginPath();
          ctx.moveTo(ex, ey);
          ctx.lineTo(ex - 7 * Math.cos(ang - 0.4), ey - 7 * Math.sin(ang - 0.4));
          ctx.lineTo(ex - 7 * Math.cos(ang + 0.4), ey - 7 * Math.sin(ang + 0.4));
          ctx.closePath();
          ctx.fillStyle = p.ink;
          ctx.fill();
        }
      }
      ctx.restore();
      axes(ctx, p, x0, y0, w, h, M_RANGE, B_RANGE, "m", "b");
      ctx.fillStyle = p.ink2;
      ctx.font = '11px "IBM Plex Mono", monospace';
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("loss surface · MSE(m, b)", x0 + 6, y0 + 6);
    }

    {
      const y0 = size.h - 44;
      const x0 = 34;
      const w = size.w - x0 - 10;
      const h = 34;
      const losses = run.trace.series;
      const lg = losses.map((v) => Math.log10(Math.max(1e-6, Math.min(1e8, v))));
      const lo = Math.min(...lg);
      const hi = Math.max(...lg);
      ctx.fillStyle = p.ink3;
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText("loss", x0 - 6, y0 + h / 2);
      ctx.strokeStyle = p.rule;
      ctx.beginPath();
      ctx.moveTo(x0, y0 + h + 0.5);
      ctx.lineTo(x0 + w, y0 + h + 0.5);
      ctx.stroke();
      ctx.strokeStyle = p.ink3;
      ctx.lineWidth = 1;
      ctx.beginPath();
      lg.forEach((v, i) => {
        const x = x0 + (w * i) / Math.max(1, lg.length - 1);
        const y = y0 + h - ((v - lo) / Math.max(1e-9, hi - lo)) * h;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.stroke();
      const doneSteps = snap.path.length;
      ctx.strokeStyle = p.signal;
      ctx.lineWidth = 2;
      ctx.beginPath();
      lg.slice(0, doneSteps).forEach((v, i) => {
        const x = x0 + (w * i) / Math.max(1, lg.length - 1);
        const y = y0 + h - ((v - lo) / Math.max(1e-9, hi - lo)) * h;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.stroke();
    }
    perf.draw("gradient", performance.now() - t0);
  }, [snap, size, p, pts, surfaceImg, opt, run.trace.series]);

  return (
    <div ref={ref} className="relative h-full w-full">
      <canvas
        ref={canvas}
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label={`${label}: m ${snap.m.toFixed(3)}, b ${snap.b.toFixed(3)}, loss ${snap.phase === "diverged" ? "diverged" : snap.loss.toFixed(4)}. Best fit m ${opt.m.toFixed(3)}, b ${opt.b.toFixed(3)}.`}
      />
    </div>
  );
}
