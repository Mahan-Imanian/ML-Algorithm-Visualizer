import { useSyncExternalStore } from "react";

type LayoutMode = "wide" | "medium" | "narrow";

const WIDE_MIN_PX = 1280;
const MEDIUM_MIN_PX = 1024;
const COMPACT_BELOW_PX = 768;

export const STAGE_ROWS_PX = { caption: 104, legend: 28, transport: 88, phoneTransport: 148 };
export const PRESENT_ROWS_PX = { header: 64, caption: 132, transport: 104 };

export function layoutFor(width: number): LayoutMode {
  if (width >= WIDE_MIN_PX) return "wide";
  if (width >= MEDIUM_MIN_PX) return "medium";
  return "narrow";
}

export function isCompactWidth(width: number): boolean {
  return width < COMPACT_BELOW_PX;
}

function subscribe(cb: () => void) {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
}

export function useLayout(): LayoutMode {
  return useSyncExternalStore(
    subscribe,
    () => layoutFor(window.innerWidth),
    () => "wide",
  );
}

export function useIsCompact(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => isCompactWidth(window.innerWidth),
    () => false,
  );
}
