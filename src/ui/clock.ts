import { useEffect, useState } from "react";
import { useLab } from "@/store/lab";

const PANEL_HZ = 20;

export function useLiveCursor(which: "a" | "b"): number {
  return useLab((s) => (which === "a" ? s.cursorA : s.cursorB));
}

interface Presented {
  a: number;
  b: number;
}

interface Snapshot extends Presented {
  runA: unknown;
  runB: unknown;
}

function read(): Snapshot {
  const s = useLab.getState();
  return { a: s.cursorA, b: s.cursorB, runA: s.runA, runB: s.runB };
}

export function usePresented(): Presented {
  const runA = useLab((s) => s.runA);
  const runB = useLab((s) => s.runB);
  const [value, setValue] = useState<Snapshot>(read);
  useEffect(() => {
    let last = 0;
    let timer = 0;
    const push = () => {
      window.clearTimeout(timer);
      timer = 0;
      last = performance.now();
      const next = read();
      setValue((p) =>
        p.a === next.a && p.b === next.b && p.runA === next.runA && p.runB === next.runB ? p : next,
      );
    };
    push();
    const unsub = useLab.subscribe((s, prev) => {
      const runChanged = s.runA !== prev.runA || s.runB !== prev.runB;
      if (s.cursorA === prev.cursorA && s.cursorB === prev.cursorB && !runChanged) return;
      if (!s.playing || runChanged) return push();
      const gap = 1000 / PANEL_HZ;
      const since = performance.now() - last;
      if (since >= gap) push();
      else if (!timer) timer = window.setTimeout(push, gap - since);
    });
    return () => {
      unsub();
      window.clearTimeout(timer);
    };
  }, []);
  return value.runA === runA && value.runB === runB ? value : read();
}

export function usePresentedCursor(which: "a" | "b"): number {
  const p = usePresented();
  return which === "a" ? p.a : p.b;
}

const frameListeners = new Set<(t: number) => void>();
let rafId = 0;

function loop(t: number) {
  frameListeners.forEach((l) => l(t));
  rafId = frameListeners.size ? requestAnimationFrame(loop) : 0;
}

export function onFrame(cb: (t: number) => void): () => void {
  frameListeners.add(cb);
  if (!rafId) rafId = requestAnimationFrame(loop);
  return () => {
    frameListeners.delete(cb);
    if (!frameListeners.size && rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  };
}
