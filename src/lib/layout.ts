import { useSyncExternalStore } from "react";

export type LayoutMode = "wide" | "medium" | "narrow";

export function layoutFor(width: number): LayoutMode {
  if (width >= 1280) return "wide";
  if (width >= 1024) return "medium";
  return "narrow";
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
    () => window.innerWidth < 768,
    () => false,
  );
}
