import { create } from "zustand";
import { readJson, writeJson } from "@/lib/storage";

export type ThemePref = "system" | "light" | "dark";
export type MotionPref = "system" | "reduce" | "full";

interface Settings {
  theme: ThemePref;
  motion: MotionPref;
  singleKey: boolean;
  tourDone: boolean;
}

interface SettingsStore extends Settings {
  set(patch: Partial<Settings>): void;
}

const KEY = "algoscope.settings.v1";
const defaults: Settings = { theme: "system", motion: "system", singleKey: true, tourDone: false };

export const useSettings = create<SettingsStore>((set, get) => ({
  ...defaults,
  ...readJson<Partial<Settings>>(KEY, {}),
  set(patch) {
    set(patch);
    const { theme, motion, singleKey, tourDone } = get();
    writeJson(KEY, { theme, motion, singleKey, tourDone });
  },
}));

export function prefersReducedMotion(pref: MotionPref): boolean {
  if (pref === "reduce") return true;
  if (pref === "full") return false;
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}
