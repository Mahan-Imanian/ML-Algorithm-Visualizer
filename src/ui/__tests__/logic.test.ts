import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultExperiment, runVariant } from "@/core/experiment";
import { layoutFor } from "@/lib/layout";
import { explain } from "../lab/explain";
import { parseHash } from "@/lib/router";
import { searchCommands, type Command } from "../commands";
import { shortcutFor } from "../shortcuts";
import { baseRate } from "@/store/lab";

const key = (
  k: string,
  target: Element | null = document.body,
  mods: Partial<KeyboardEvent> = {},
) => ({
  key: k,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  target,
  ...mods,
});

const el = (html: string) => {
  const d = document.createElement("div");
  d.innerHTML = html;
  document.body.appendChild(d);
  return d.firstElementChild!;
};

describe("keyboard shortcuts", () => {
  const lab = { inLab: true, singleKey: true };
  it("maps the documented keys", () => {
    expect(shortcutFor(key(" "), lab)).toBe("toggle");
    expect(shortcutFor(key("ArrowRight"), lab)).toBe("step+");
    expect(shortcutFor(key("ArrowLeft", document.body, { shiftKey: true }), lab)).toBe("op-");
    expect(shortcutFor(key("k", document.body, { ctrlKey: true }), lab)).toBe("palette");
    expect(shortcutFor(key("s", document.body, { metaKey: true }), lab)).toBe("save");
    expect(shortcutFor(key("]"), lab)).toBe("cp+");
    expect(shortcutFor(key("m"), lab)).toBe("maze");
    expect(shortcutFor(key("3"), lab)).toBe("tool:erase");
  });

  it("never steals keys from sliders, text fields, buttons, tabs or the grid", () => {
    const slider = el('<span role="slider" tabindex="0"></span>');
    expect(shortcutFor(key("ArrowRight", slider), lab)).toBeNull();
    expect(shortcutFor(key(" ", slider), lab)).toBeNull();
    const input = el("<input />");
    expect(shortcutFor(key("n", input), lab)).toBeNull();
    expect(shortcutFor(key(" ", input), lab)).toBeNull();
    const button = el("<button>Go</button>");
    expect(shortcutFor(key(" ", button), lab)).toBeNull();
    expect(shortcutFor(key("ArrowRight", button), lab)).toBe("step+");
    const tabs = el('<div role="tablist"><button role="tab">A</button></div>');
    expect(shortcutFor(key("ArrowRight", tabs.firstElementChild), lab)).toBeNull();
    const grid = el('<canvas role="application"></canvas>');
    expect(shortcutFor(key("ArrowLeft", grid), lab)).toBeNull();
  });

  it("respects the single-key setting and page context", () => {
    expect(shortcutFor(key("n"), { inLab: true, singleKey: false })).toBeNull();
    expect(shortcutFor(key(" "), { inLab: true, singleKey: false })).toBe("toggle");
    expect(shortcutFor(key(" "), { inLab: false, singleKey: true })).toBeNull();
    expect(
      shortcutFor(key("k", document.body, { ctrlKey: true }), { inLab: false, singleKey: false }),
    ).toBe("palette");
  });
});

describe("command search", () => {
  const cmds: Command[] = [
    {
      id: "a",
      label: "Breadth-first search",
      group: "Algorithms",
      keywords: "BFS bfs breadth first queue",
      run: () => {},
    },
    {
      id: "b",
      label: "A* search",
      group: "Algorithms",
      keywords: "A* astar a star heuristic",
      run: () => {},
    },
    {
      id: "c",
      label: "Generate maze",
      group: "This experiment",
      keywords: "grid map maze",
      run: () => {},
    },
    {
      id: "d",
      label: "Quicksort's worst case",
      group: "Experiments",
      keywords: "Sorted input and a last-element pivot quick",
      run: () => {},
    },
    {
      id: "e",
      label: "Share link",
      group: "This experiment",
      keywords: "copy url send",
      run: () => {},
    },
  ];
  it("finds algorithms by abbreviation and commands by intent", () => {
    expect(searchCommands(cmds, "bfs")[0].id).toBe("a");
    expect(searchCommands(cmds, "a*")[0].id).toBe("b");
    expect(searchCommands(cmds, "astar")[0].id).toBe("b");
    expect(searchCommands(cmds, "maze")[0].id).toBe("c");
    expect(searchCommands(cmds, "quicksort worst case")[0].id).toBe("d");
    expect(searchCommands(cmds, "copy")[0].id).toBe("e");
    expect(searchCommands(cmds, "zzzz")).toHaveLength(0);
    expect(searchCommands(cmds, "")).toHaveLength(cmds.length);
  });
});

describe("captions", () => {
  it("closes every sort and gradient run with a summary, not a leftover sub-step", () => {
    for (const algo of ["bubble", "heap", "quick", "gradient"] as const) {
      const run = runVariant(defaultExperiment(algo), "a")!;
      const end = explain(run, run.trace.events.length);
      expect(end.now, algo).toMatch(/^(Sorted all \d+ values|Stopped after \d+ steps)/);
      expect(end.next).toBeNull();
    }
  });
});

describe("playback rate", () => {
  const rateFor = (algo: Parameters<typeof defaultExperiment>[0], granularity: "step" | "op") => {
    const runA = runVariant(defaultExperiment(algo), "a")!;
    return { runA, rate: baseRate({ runA, runB: null, granularity }) };
  };

  it("plays a mid-sized run in 12 s by step and 20 s by operation at 1x", () => {
    const step = rateFor("bfs", "step");
    expect(step.runA.trace.groupEnds.length / step.rate).toBeCloseTo(12, 6);
    const op = rateFor("bfs", "op");
    expect(op.runA.trace.events.length / op.rate).toBeCloseTo(20, 6);
  });

  it("keeps short runs at a readable minimum rate", () => {
    expect(rateFor("binary", "step").rate).toBe(1.5);
    expect(rateFor("binary", "op").rate).toBe(3);
  });
});

describe("saved experiments in local storage", () => {
  afterEach(() => localStorage.clear());

  it("skips entries it cannot show instead of crashing the saved list", async () => {
    const good = {
      id: "x1",
      name: "Mine",
      savedAt: 1,
      code: "abc",
      family: "sort",
      label: "Merge",
    };
    localStorage.setItem(
      "algoscope.library.v1",
      JSON.stringify([
        good,
        { ...good, id: "x2", family: "trees" },
        { ...good, id: "x3", name: 5 },
        { ...good, id: "x4", savedAt: "yesterday" },
        null,
        "x5",
      ]),
    );
    localStorage.setItem("algoscope.last.v1", JSON.stringify(5));
    vi.resetModules();
    const { useLibrary } = await import("@/store/library");
    expect(useLibrary.getState().items).toEqual([good]);
    expect(useLibrary.getState().last).toBeNull();
  });

  it("keeps reading settings stored under the pre-rename key", async () => {
    localStorage.setItem(
      "algoscope.settings.v1",
      JSON.stringify({ theme: "dark", motion: "reduce", singleKey: false, tourDone: true }),
    );
    vi.resetModules();
    const { useSettings } = await import("@/store/settings");
    expect(useSettings.getState()).toMatchObject({
      theme: "dark",
      motion: "reduce",
      singleKey: false,
      tourDone: true,
    });
  });

  it("starts empty when the stored library is not a list", async () => {
    localStorage.setItem("algoscope.library.v1", JSON.stringify({ items: [] }));
    vi.resetModules();
    const { useLibrary } = await import("@/store/library");
    expect(useLibrary.getState().items).toEqual([]);
  });
});

describe("layout and routing", () => {
  it("chooses a layout per width", () => {
    expect(layoutFor(320)).toBe("narrow");
    expect(layoutFor(768)).toBe("narrow");
    expect(layoutFor(1024)).toBe("medium");
    expect(layoutFor(1279)).toBe("medium");
    expect(layoutFor(1280)).toBe("wide");
    expect(layoutFor(1920)).toBe("wide");
  });

  it("parses routes", () => {
    expect(parseHash("").name).toBe("explore");
    expect(parseHash("#/saved").name).toBe("saved");
    const r = parseHash("#/lab?s=mst");
    expect(r.name).toBe("lab");
    if (r.name === "lab") expect(r.query.get("s")).toBe("mst");
  });
});
