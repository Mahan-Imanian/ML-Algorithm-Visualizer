import { describe, expect, it } from "vitest";
import { defaultExperiment, runVariant } from "@/core/experiment";
import { layoutFor } from "@/lib/layout";
import { explain } from "../lab/explain";
import { parseHash } from "@/lib/router";
import { searchCommands, type Command } from "../commands";
import { shortcutFor } from "../shortcuts";

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
