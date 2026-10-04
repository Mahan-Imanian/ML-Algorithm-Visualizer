import { useEffect } from "react";
import { randomSeed } from "@/core/rng";
import { makeGrid } from "@/core/grid/terrain";
import type { GridExp } from "@/core/experiment";
import { parseHash } from "@/lib/router";
import { useLab, type Tool } from "@/store/lab";
import { useSettings } from "@/store/settings";
import { useUI, type PresentPanel } from "@/store/ui";
import { enterPresentation, exitPresentation } from "./presentation";
import { regenerate, suggestB } from "./lab/variants";

export type ShortcutAction =
  | "palette"
  | "save"
  | "toggle"
  | "step+"
  | "step-"
  | "op+"
  | "op-"
  | "start"
  | "end"
  | "cp+"
  | "cp-"
  | "replay"
  | "random"
  | "maze"
  | "compare"
  | "gran"
  | "faster"
  | "slower"
  | "help"
  | "present"
  | "exit-present"
  | "hud"
  | "bookmark"
  | `panel:${PresentPanel}`
  | `tool:${Tool}`;

interface KeyLike {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  target: EventTarget | null;
}

const TEXT = 'input, textarea, select, [contenteditable="true"]';
const COMPOSITE =
  '[role="slider"], [role="tablist"], [role="radiogroup"], [role="group"], [role="menu"], [role="menubar"], [role="listbox"], [role="combobox"], [role="application"], [role="dialog"]';
const ACTIVATABLE =
  'button, a[href], summary, [role="button"], [role="tab"], [role="radio"], [role="menuitem"], [role="option"]';

export function shortcutFor(
  e: KeyLike,
  opts: { inLab: boolean; singleKey: boolean; present?: boolean },
): ShortcutAction | null {
  const el = e.target instanceof Element ? e.target : null;
  const mod = e.metaKey || e.ctrlKey;
  if (mod && !e.altKey && e.key.toLowerCase() === "k") return "palette";
  if (mod && !e.altKey && e.key.toLowerCase() === "s" && opts.inLab) return "save";
  if (mod || e.altKey) return null;
  if (el?.closest(TEXT)) return null;
  if (el?.closest('[role="dialog"]')) return null;
  if (e.key === "/") return "palette";
  if (e.key === "?") return "help";
  if (!opts.inLab) return null;
  if (opts.present && e.key === "Escape") return "exit-present";
  if (opts.present && !el?.closest('[role="application"]')) {
    const panel: Record<string, PresentPanel> = {
      c: "code",
      s: "state",
      e: "explain",
      m: "metrics",
    };
    const p = panel[e.key.toLowerCase()];
    if (p) return `panel:${p}`;
  }
  const inComposite = !!el?.closest(COMPOSITE);
  const onActivatable = !!el?.closest(ACTIVATABLE);
  switch (e.key) {
    case " ":
      return inComposite || onActivatable ? null : "toggle";
    case "ArrowRight":
      return inComposite ? null : e.shiftKey ? "op+" : "step+";
    case "ArrowLeft":
      return inComposite ? null : e.shiftKey ? "op-" : "step-";
    case "Home":
      return inComposite ? null : "start";
    case "End":
      return inComposite ? null : "end";
  }
  if (!opts.singleKey) return null;
  const k = e.key.toLowerCase();
  if (e.key === "]") return "cp+";
  if (e.key === "[") return "cp-";
  if (e.key === "=" || e.key === "+") return "faster";
  if (e.key === "-" || e.key === "_") return "slower";
  if (k === "r") return "replay";
  if (k === "n") return "random";
  if (k === "m") return "maze";
  if (k === "c") return "compare";
  if (k === "g") return "gran";
  if (k === "p") return "present";
  if (k === "h") return "hud";
  if (k === "b") return "bookmark";
  const tools: Record<string, Tool> = {
    "1": "wall",
    "2": "weight",
    "3": "erase",
    "4": "start",
    "5": "target",
  };
  if (tools[e.key]) return `tool:${tools[e.key]}`;
  return null;
}

export function runShortcut(action: ShortcutAction) {
  const lab = useLab.getState();
  const ui = useUI.getState();
  switch (action) {
    case "palette":
      return ui.dialog === "palette" ? ui.close() : ui.open("palette");
    case "save":
      return ui.open("save");
    case "help":
      return ui.open("shortcuts");
    case "toggle": {
      const total = Math.max(lab.runA.trace.events.length, lab.runB?.trace.events.length ?? 0);
      const pos = lab.runB ? Math.max(lab.cursorA, lab.cursorB) : lab.cursorA;
      return !lab.playing && pos >= total ? lab.restart() : lab.toggle();
    }
    case "step+":
      return lab.step(1);
    case "step-":
      return lab.step(-1);
    case "op+":
      return lab.step(1, "op");
    case "op-":
      return lab.step(-1, "op");
    case "start":
      return lab.toStart();
    case "end":
      return lab.toEnd();
    case "cp+":
      return lab.checkpoint(1);
    case "cp-":
      return lab.checkpoint(-1);
    case "replay":
      return lab.restart();
    case "random":
      return lab.update((e) => regenerate(e, randomSeed()));
    case "maze":
      if (lab.exp.family !== "grid") return;
      return lab.update(
        (e) =>
          ({
            ...e,
            input: makeGrid(
              (e as GridExp).input.size,
              "maze",
              randomSeed(),
              (e as GridExp).input.diagonal,
            ),
          }) as GridExp,
      );
    case "compare":
      return lab.setVariantB(lab.exp.b ? null : suggestB(lab.exp));
    case "gran":
      return lab.setGranularity(lab.granularity === "step" ? "op" : "step");
    case "faster":
      return lab.setSpeed(lab.speed + 1);
    case "slower":
      return lab.setSpeed(lab.speed - 1);
    case "present":
      return ui.present ? exitPresentation() : enterPresentation();
    case "exit-present":
      return exitPresentation();
    case "hud":
      return ui.setHud(!ui.hud);
    case "bookmark":
      return lab.toggleBookmark();
    default:
      if (action.startsWith("panel:")) return ui.togglePanel(action.slice(6) as PresentPanel);
      if (action.startsWith("tool:") && lab.exp.family === "grid")
        lab.setTool(action.slice(5) as Tool);
  }
}

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      const action = shortcutFor(e, {
        inLab: parseHash(window.location.hash).name === "lab",
        singleKey: useSettings.getState().singleKey,
        present: useUI.getState().present,
      });
      if (!action) return;
      if (action !== "palette" && useUI.getState().dialog) return;
      e.preventDefault();
      runShortcut(action);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
