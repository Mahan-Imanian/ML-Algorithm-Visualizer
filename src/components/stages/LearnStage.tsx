import { useEffect, useRef } from "react";
import { useAlgoscope } from "@/store/useAlgoscope";
import type { LearnFrame, Point } from "@/core";

const CLUSTER_COLORS = ["#a855f7", "#22c55e", "#f59e0b", "#38bdf8", "#fb7185"];

export function LearnStage() {
  const ref = useRef<HTMLCanvasElement>(null);
  const trace = useAlgoscope((s) => s.trace);
  const cursor = useAlgoscope((s) => s.cursor);
  const learnPoints = useAlgoscope((s) => s.learnPoints);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const W = rect.width;
    const H = rect.height;
    const pad = 24;
    const sx = (x: number) => pad + x * (W - 2 * pad);
    const sy = (y: number) => H - pad - y * (H - 2 * pad);

    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = "oklch(0.33 0.011 262 / 0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(pad, pad, W - 2 * pad, H - 2 * pad);

    const frame = trace?.family === "learning" ? (trace.events[cursor] as LearnFrame) : null;

    const drawPoint = (p: Point, color: string, r = 3.5) => {
      ctx.beginPath();
      ctx.arc(sx(p.x), sy(p.y), r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    };

    if (!frame) {
      for (const p of learnPoints) drawPoint(p, "oklch(0.62 0.012 262)");
      return;
    }

    if (frame.kind === "kmeans") {
      frame.points.forEach((p, i) => drawPoint(p, CLUSTER_COLORS[frame.assignments[i] % CLUSTER_COLORS.length]));
      frame.centroids.forEach((c, i) => {
        ctx.beginPath();
        ctx.arc(sx(c.x), sy(c.y), 8, 0, Math.PI * 2);
        ctx.fillStyle = CLUSTER_COLORS[i % CLUSTER_COLORS.length];
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "oklch(0.99 0 0)";
        ctx.stroke();
      });
    } else {
      for (const p of frame.points) drawPoint(p, "oklch(0.62 0.012 262)");
      ctx.beginPath();
      ctx.moveTo(sx(0), sy(frame.b));
      ctx.lineTo(sx(1), sy(frame.m * 1 + frame.b));
      ctx.strokeStyle = "#a855f7";
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }, [trace, cursor, learnPoints]);

  return <canvas ref={ref} className="block h-full w-full" aria-label="Learning plot" role="img" />;
}
