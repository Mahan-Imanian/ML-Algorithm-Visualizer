import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { prefersReducedMotion, useSettings } from "@/store/settings";

export interface Palette {
  bg: string;
  field: string;
  surface: string;
  sunken: string;
  rule: string;
  ruleStrong: string;
  ink: string;
  ink2: string;
  ink3: string;
  signal: string;
  focus: string;
  open: string;
  closed: string;
  path: string;
  wall: string;
  weight: string;
  a: string;
  b: string;
  gridLine: string;
  rgb: (name: string, alpha?: number) => string;
}

function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const cache = new Map<string, string>();
  const channels = (name: string) => {
    let v = cache.get(name);
    if (v === undefined) {
      v = (cs.getPropertyValue(`--${name}`) || "0 0 0").trim();
      cache.set(name, v);
    }
    return v;
  };
  for (const n of ["ink", "signal", "st-a", "st-b", "field"]) channels(n);
  const rgb = (name: string, alpha = 1) => `rgb(${channels(name)} / ${alpha})`;
  return {
    bg: rgb("bg"),
    field: rgb("field"),
    surface: rgb("surface"),
    sunken: rgb("sunken"),
    rule: rgb("rule"),
    ruleStrong: rgb("rule-strong"),
    ink: rgb("ink"),
    ink2: rgb("ink-2"),
    ink3: rgb("ink-3"),
    signal: rgb("signal"),
    focus: rgb("focus"),
    open: rgb("st-open"),
    closed: rgb("st-closed"),
    path: rgb("st-path"),
    wall: rgb("st-wall"),
    weight: rgb("st-weight"),
    a: rgb("st-a"),
    b: rgb("st-b"),
    gridLine: rgb("grid-line"),
    rgb,
  };
}

let paletteVersion = 0;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  new MutationObserver(() => {
    paletteVersion++;
    listeners.forEach((l) => l());
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

export function usePalette(): Palette {
  const v = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => paletteVersion,
    () => 0,
  );
  const ref = useRef<{ v: number; p: Palette } | null>(null);
  if (!ref.current || ref.current.v !== v) ref.current = { v, p: readPalette() };
  return ref.current.p;
}

export function useReducedMotion(): boolean {
  const pref = useSettings((s) => s.motion);
  const [, force] = useState(0);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const on = () => force((n) => n + 1);
    mq?.addEventListener?.("change", on);
    return () => mq?.removeEventListener?.("change", on);
  }, []);
  return prefersReducedMotion(pref);
}

export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize((s) =>
        Math.abs(s.w - r.width) < 0.5 && Math.abs(s.h - r.height) < 0.5
          ? s
          : { w: r.width, h: r.height },
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

export function setupCanvas(
  canvas: HTMLCanvasElement,
  w: number,
  h: number,
): CanvasRenderingContext2D | null {
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  const pw = Math.max(1, Math.round(w * dpr));
  const ph = Math.max(1, Math.round(h * dpr));
  if (canvas.width !== pw) canvas.width = pw;
  if (canvas.height !== ph) canvas.height = ph;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}
