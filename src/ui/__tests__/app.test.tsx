import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "../App";
import { useLab } from "@/store/lab";
import { useSettings } from "@/store/settings";
import { useUI } from "@/store/ui";
import { encode } from "@/core/share";
import { SCENARIOS } from "@/core/scenarios";

async function go(hash: string) {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
  if (hash.startsWith("/lab"))
    await screen.findByRole("slider", { name: "Timeline position" }, { timeout: 4000 });
}

beforeEach(() => {
  localStorage.clear();
  useUI.setState({ dialog: null, tour: null, setupOpen: false });
  window.location.hash = "";
});
afterEach(cleanup);

describe("first visit", () => {
  it("explains the product and offers a guided start", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /queue, the heap, the pivot/i,
    );
    expect(screen.getByRole("button", { name: /60-second tour/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Experiments" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /BFS floods a maze/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Dijkstra's algorithm" })).toHaveAttribute(
      "href",
      "#/lab?algo=dijkstra",
    );
  });

  it("starts the tour on a prepared maze", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /60-second tour/i }));
    await act(async () => {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      await new Promise((r) => setTimeout(r, 100));
    });
    expect(useLab.getState().exp.a.algo).toBe("bfs");
    expect(useUI.getState().tour).toBe(0);
    expect(screen.getByRole("dialog", { name: "Run it" })).toBeInTheDocument();
  });
});

describe("lab", () => {
  it("never shows an empty state: an experiment is ready before Run", async () => {
    render(<App />);
    await go("/lab?algo=dijkstra");
    expect(screen.getByRole("button", { name: "Run" })).toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: /Dijkstra's algorithm pseudocode/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Ready").length).toBeGreaterThan(0);
  });

  it("steps forward and backward and highlights the matching pseudocode line", async () => {
    render(<App />);
    await go("/lab?algo=dijkstra");
    const code = () =>
      screen.getByRole("list", { name: /pseudocode/i }).querySelector('[aria-current="step"]');
    fireEvent.click(screen.getByRole("button", { name: "Step forward" }));
    expect(useLab.getState().cursorA).toBe(1);
    expect(code()).toHaveTextContent("dist[start] ← 0");
    fireEvent.click(screen.getByRole("button", { name: "Step forward" }));
    expect(code()).toHaveTextContent("pq.push(n, alt)");
    fireEvent.keyDown(window, { key: "ArrowLeft", shiftKey: true });
    expect(code()).toHaveTextContent("pq.push(n, alt)");
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(useLab.getState().cursorA).toBe(1);
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(useLab.getState().cursorA).toBe(0);
    fireEvent.keyDown(window, { key: "End" });
    expect(useLab.getState().cursorA).toBe(useLab.getState().runA.trace.events.length);
    expect(
      screen.getByRole("list", { name: /pseudocode/i }).querySelector('[aria-current="step"]'),
    ).toHaveTextContent("return path(cur)");
  });

  it("gives every slider an accessible name", async () => {
    Object.defineProperty(window, "innerWidth", { value: 1440, configurable: true });
    render(<App />);
    await go("/lab?s=lr-too-high");
    const sliders = screen.getAllByRole("slider");
    expect(sliders.length).toBeGreaterThan(3);
    for (const s of sliders) expect(s).toHaveAccessibleName();
    Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true });
  });

  it("renders only the active inspector panel", async () => {
    render(<App />);
    await go("/lab?algo=bfs");
    const panels = screen.getAllByRole("tabpanel");
    expect(panels).toHaveLength(1);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "About" }));
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    expect(screen.getByRole("tabpanel")).toHaveTextContent(/Complexity/);
  });

  it("compares two algorithms with a verdict, not just two canvases", async () => {
    render(<App />);
    await go("/lab?s=astar-vs-dijkstra");
    expect(useLab.getState().runB).not.toBeNull();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Compare" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent(/expands \d+% fewer cells/);
    expect(screen.getByRole("tabpanel")).toHaveTextContent(/Both find a path of cost/);
  });

  it("loads a shared link exactly, at the shared step", async () => {
    const exp = SCENARIOS.find((s) => s.id === "weights")!.build(false);
    render(<App />);
    await go(`/lab?e=${encode(exp, 30)}`);
    const s = useLab.getState();
    expect(s.exp.a.algo).toBe("bfs");
    expect(s.exp.b?.algo).toBe("dijkstra");
    expect(s.cursorA).toBe(30);
  });

  it("explains a broken link instead of failing silently", async () => {
    render(<App />);
    await go("/lab?e=garbage");
    expect(screen.getByRole("alert")).toHaveTextContent(/incomplete or was changed/);
  });
});

describe("command palette", () => {
  it("opens with Ctrl+K, finds algorithms by abbreviation and navigates with the keyboard", async () => {
    render(<App />);
    await go("/lab?algo=bfs");
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const input = screen.getByRole("combobox", { name: /search commands/i });
    fireEvent.change(input, { target: { value: "dijk" } });
    const list = screen.getByRole("listbox");
    const options = within(list).getAllByRole("option");
    expect(options[0]).toHaveTextContent("Dijkstra's algorithm");
    expect(input).toHaveAttribute("aria-activedescendant", options[0].id);
    fireEvent.change(input, { target: { value: "maze" } });
    const first = within(screen.getByRole("listbox")).getAllByRole("option")[0];
    expect(first).toHaveTextContent("Generate maze");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).not.toBe(first.id);
  });

  it("types BFS in capitals and switches to breadth-first search with Enter", async () => {
    render(<App />);
    await go("/lab?algo=dijkstra");
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const input = screen.getByRole("combobox", { name: /search commands/i });
    fireEvent.change(input, { target: { value: "BFS" } });
    expect(within(screen.getByRole("listbox")).getAllByRole("option")[0]).toHaveTextContent(
      "Breadth-first search",
    );
    fireEvent.keyDown(input, { key: "Enter" });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(useLab.getState().exp.a.algo).toBe("bfs");
  });
});

describe("presentation", () => {
  it("enters with P, toggles panels with C/S/E/M and leaves with Escape", async () => {
    render(<App />);
    await go("/lab?algo=bfs");
    fireEvent.keyDown(window, { key: "p" });
    const stage = screen.getByRole("region", { name: "Presentation" });
    expect(stage).toBeInTheDocument();
    const code = within(stage).getByRole("button", { name: /^Code/ });
    expect(code).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(window, { key: "c" });
    expect(code).toHaveAttribute("aria-pressed", "false");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Presentation" })).toBeNull();
  });

  it("bookmarks a step and jumps back to it as a milestone", async () => {
    render(<App />);
    await go("/lab?algo=bfs");
    const s = () => useLab.getState();
    act(() => {
      s().step(1);
      s().step(1);
      s().step(1);
    });
    const at = s().cursorA;
    fireEvent.keyDown(window, { key: "b" });
    expect(s().bookmarks).toContain(at);
    fireEvent.keyDown(window, { key: "End" });
    act(() => {
      while (s().cursorA > at) s().checkpoint(-1);
    });
    expect(s().cursorA).toBe(at);
  });
});

describe("theme", () => {
  it("switches theme from the menu again and again without a reload", async () => {
    useSettings.setState({ theme: "light" });
    render(<App />);
    for (const expected of ["dark", "light", "dark"]) {
      fireEvent.keyDown(screen.getByRole("button", { name: "More" }), { key: "Enter" });
      fireEvent.click(await screen.findByRole("menuitem", { name: /(Paper|Scope) theme/ }));
      expect(document.documentElement.dataset.theme).toBe(expected);
    }
  });
});
