import { variantLabel, defaultParams, type AnyVariant } from "@/core/experiment";
import { ALGOS, familyName, type AlgoId } from "@/core/info";
import { randomSeed } from "@/core/rng";
import { SCENARIOS } from "@/core/scenarios";
import { makeGrid, TERRAINS } from "@/core/grid/terrain";
import type { GridExp } from "@/core/experiment";
import { toFile } from "@/core/share";
import { isCompactWidth } from "@/lib/layout";
import { downloadText } from "@/lib/utils";
import { navigate, parseHash } from "@/lib/router";
import { useLab, type GraphTool, type Tool } from "@/store/lab";
import { useSettings } from "@/store/settings";
import { useUI } from "@/store/ui";
import { regenerate } from "./lab/variants";
import { enterPresentation, exitPresentation } from "./presentation";

export interface Command {
  id: string;
  label: string;
  group: "Playback" | "This experiment" | "Algorithms" | "Experiments" | "Go to" | "View";
  keywords?: string;
  keys?: string;
  run(): void;
}

const lab = () => useLab.getState();
const inLab = () => parseHash(window.location.hash).name === "lab";
const goLab = () => {
  if (!inLab()) navigate("/lab");
};

export function exportExperiment() {
  const s = lab();
  downloadText(
    `algoscope-${s.exp.a.algo}${s.exp.b ? `-vs-${s.exp.b.algo}` : ""}.json`,
    toFile(s.exp, s.cursorA),
  );
}

export function buildCommands(): Command[] {
  const s = lab();
  const cmds: Command[] = [];
  const isLab = inLab();
  if (isLab) {
    cmds.push(
      {
        id: "play",
        label: s.playing ? "Pause" : "Play",
        group: "Playback",
        keys: "Space",
        keywords: "run start resume stop",
        run: () => lab().toggle(),
      },
      {
        id: "step-f",
        label: "Step forward",
        group: "Playback",
        keys: "→",
        keywords: "next",
        run: () => lab().step(1),
      },
      {
        id: "step-b",
        label: "Step back",
        group: "Playback",
        keys: "←",
        keywords: "previous reverse undo",
        run: () => lab().step(-1),
      },
      {
        id: "op-f",
        label: "Forward one operation",
        group: "Playback",
        keys: "⇧→",
        keywords: "fine",
        run: () => lab().step(1, "op"),
      },
      {
        id: "op-b",
        label: "Back one operation",
        group: "Playback",
        keys: "⇧←",
        keywords: "fine",
        run: () => lab().step(-1, "op"),
      },
      {
        id: "start",
        label: "Jump to start",
        group: "Playback",
        keys: "Home",
        keywords: "reset beginning rewind",
        run: () => lab().toStart(),
      },
      {
        id: "end",
        label: "Jump to end",
        group: "Playback",
        keys: "End",
        keywords: "finish result",
        run: () => lab().toEnd(),
      },
      {
        id: "cp-n",
        label: "Next checkpoint",
        group: "Playback",
        keys: "]",
        keywords: "milestone marker",
        run: () => lab().checkpoint(1),
      },
      {
        id: "cp-p",
        label: "Previous checkpoint",
        group: "Playback",
        keys: "[",
        keywords: "milestone marker",
        run: () => lab().checkpoint(-1),
      },
      {
        id: "replay",
        label: "Replay from the start",
        group: "Playback",
        keys: "R",
        keywords: "restart again",
        run: () => lab().restart(),
      },
      {
        id: "faster",
        label: "Faster",
        group: "Playback",
        keys: "=",
        keywords: "speed up",
        run: () => lab().setSpeed(lab().speed + 1),
      },
      {
        id: "slower",
        label: "Slower",
        group: "Playback",
        keys: "−",
        keywords: "speed down",
        run: () => lab().setSpeed(lab().speed - 1),
      },
      {
        id: "gran",
        label: s.granularity === "step" ? "Step by single operations" : "Step by logical steps",
        group: "Playback",
        keys: "G",
        keywords: "granularity group op",
        run: () => lab().setGranularity(lab().granularity === "step" ? "op" : "step"),
      },
      {
        id: "random",
        label: "New random input",
        group: "This experiment",
        keys: "N",
        keywords: "randomize shuffle seed regenerate",
        run: () => lab().update((e) => regenerate(e, randomSeed())),
      },
      {
        id: "save",
        label: "Save experiment",
        group: "This experiment",
        keys: "⌘S",
        keywords: "bookmark keep library",
        run: () => useUI.getState().open("save"),
      },
      {
        id: "share",
        label: "Share link",
        group: "This experiment",
        keywords: "copy url send",
        run: () => useUI.getState().open("share"),
      },
      {
        id: "export",
        label: "Export as JSON file",
        group: "This experiment",
        keywords: "download file",
        run: exportExperiment,
      },
    );
    if (s.exp.family === "grid") {
      const g = s.exp.input;
      for (const t of TERRAINS) {
        cmds.push({
          id: `terrain-${t.id}`,
          label: t.id === "maze" ? "Generate maze" : `Terrain: ${t.label}`,
          group: "This experiment",
          keys: t.id === "maze" ? "M" : undefined,
          keywords: `grid map ${t.id} ${t.hint}`,
          run: () =>
            lab().update(
              (e) => ({ ...e, input: makeGrid(g.size, t.id, randomSeed(), g.diagonal) }) as GridExp,
            ),
        });
      }
      const tools: [Tool, string, string][] = [
        ["wall", "Wall tool", "1"],
        ["weight", "Mud tool", "2"],
        ["erase", "Erase tool", "3"],
        ["start", "Place start", "4"],
        ["target", "Place target", "5"],
      ];
      for (const [t, label, key] of tools)
        cmds.push({
          id: `tool-${t}`,
          label,
          group: "This experiment",
          keys: key,
          keywords: "draw paint brush",
          run: () => lab().setTool(t),
        });
    }
    if (s.exp.b)
      cmds.push({
        id: "uncompare",
        label: "Stop comparing",
        group: "This experiment",
        keys: "C",
        keywords: "single remove b",
        run: () => lab().setVariantB(null),
      });
    for (const a of ALGOS.filter(
      (x) =>
        x.family === s.exp.family &&
        x.id !== s.exp.a.algo &&
        (s.exp.family !== "learn" || x.id === s.exp.a.algo),
    )) {
      cmds.push({
        id: `cmp-${a.id}`,
        label: `Compare with ${a.name}`,
        group: "This experiment",
        keywords: `versus vs side by side ${a.aliases.join(" ")}`,
        run: () =>
          lab().setVariantB({
            algo: a.id,
            params: defaultParams(a.id, s.exp.family === "grid" && s.exp.input.diagonal),
          } as AnyVariant),
      });
    }
    cmds.push(
      {
        id: "setup",
        label: "Open setup",
        group: "View",
        keywords: "configure input settings panel",
        run: () => useUI.getState().setSetupOpen(true),
      },
      {
        id: "present",
        label: useUI.getState().present ? "Exit presentation" : "Present full screen",
        group: "View",
        keys: "P",
        keywords: "presentation mode slides fullscreen demo projector talk lecture",
        run: () => (useUI.getState().present ? exitPresentation() : enterPresentation()),
      },
      {
        id: "hud",
        label: "Frame monitor",
        group: "View",
        keys: "H",
        keywords: "performance fps frame time profiler hud refresh 120hz 144hz",
        run: () => useUI.getState().setHud(!useUI.getState().hud),
      },
      {
        id: "bookmark",
        label: "Bookmark this step",
        group: "Playback",
        keys: "B",
        keywords: "mark remember checkpoint pin",
        run: () => lab().toggleBookmark(),
      },
    );
    if (s.exp.family === "graph") {
      const tools: [GraphTool, string][] = [
        ["move", "Graph tool: move nodes"],
        ["edge", "Graph tool: add or remove edges"],
        ["node", "Graph tool: add nodes"],
        ["delete", "Graph tool: delete"],
      ];
      for (const [t, label] of tools)
        cmds.push({
          id: `gtool-${t}`,
          label,
          group: "This experiment",
          keywords: "graph editor edit connect link vertex",
          run: () => lab().setGraphTool(t),
        });
    }
  }
  for (const a of ALGOS) {
    cmds.push({
      id: `algo-${a.id}`,
      label: a.name,
      group: "Algorithms",
      keywords: `${a.short} ${a.aliases.join(" ")} ${familyName(a.family)}`,
      run: () => {
        goLab();
        lab().setAlgo(a.id as AlgoId, isCompactWidth(window.innerWidth));
      },
    });
  }
  for (const sc of SCENARIOS) {
    cmds.push({
      id: `sc-${sc.id}`,
      label: sc.title,
      group: "Experiments",
      keywords: `${sc.question} ${sc.algos.join(" ")} preset scenario example`,
      run: () => navigate(`/lab?s=${sc.id}`),
    });
  }
  cmds.push(
    {
      id: "go-explore",
      label: "Explore",
      group: "Go to",
      keywords: "home start index",
      run: () => navigate("/"),
    },
    {
      id: "go-saved",
      label: "Saved experiments",
      group: "Go to",
      keywords: "library bookmarks",
      run: () => navigate("/saved"),
    },
    {
      id: "import",
      label: "Import experiment file",
      group: "Go to",
      keywords: "open load json upload",
      run: () => useUI.getState().open("import"),
    },
    {
      id: "shortcuts",
      label: "Keyboard shortcuts",
      group: "View",
      keys: "?",
      keywords: "help keys",
      run: () => useUI.getState().open("shortcuts"),
    },
    {
      id: "settings",
      label: "Settings",
      group: "View",
      keywords: "preferences motion theme",
      run: () => useUI.getState().open("settings"),
    },
    {
      id: "theme",
      label: "Toggle light and dark",
      group: "View",
      keywords: "theme dark mode light mode",
      run: () => useSettings.getState().toggleTheme(),
    },
    {
      id: "tour",
      label: "Take the 6-step tour",
      group: "View",
      keywords: "onboarding help guide tutorial",
      run: () => startTour(),
    },
  );
  return cmds;
}

export function startTour() {
  navigate("/lab?s=bfs-maze");
  setTimeout(() => useUI.getState().setTour(0), 60);
}

export function labelForCurrent(): string {
  const s = lab();
  return `${variantLabel(s.exp.a)}${s.exp.b ? ` vs ${variantLabel(s.exp.b)}` : ""}`;
}

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9*²\s]/g, " ");
}

function scoreCommand(c: Command, query: string): number {
  const q = norm(query).trim();
  if (!q) return 1;
  const label = norm(c.label);
  const hay = `${label} ${norm(c.keywords ?? "")} ${c.group.toLowerCase()}`;
  const raw = query.trim().toLowerCase();
  if (c.label.toLowerCase() === raw) return 100;
  if (
    c.group === "Algorithms" &&
    norm(c.keywords ?? "")
      .split(/\s+/)
      .includes(q)
  )
    return 90;
  if (c.label.toLowerCase().startsWith(raw)) return 80;
  let score = 0;
  for (const tok of q.split(/\s+/)) {
    if (!tok) continue;
    const words = hay.split(/\s+/);
    if (words.some((w) => w === tok)) score += 12;
    else if (words.some((w) => w.startsWith(tok))) score += 8;
    else if (hay.includes(tok)) score += 4;
    else if (subsequence(tok, label)) score += 1;
    else return 0;
  }
  if (raw.includes("*") && c.label.includes("*")) score += 10;
  return score;
}

function subsequence(needle: string, hay: string) {
  let i = 0;
  for (const ch of hay) if (ch === needle[i]) i++;
  return i === needle.length;
}

export function searchCommands(list: Command[], query: string): Command[] {
  return list
    .map((c, i) => ({ c, s: scoreCommand(c, query), i }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.c);
}
