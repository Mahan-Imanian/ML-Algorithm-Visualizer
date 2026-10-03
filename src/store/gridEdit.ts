import type { Experiment, GridExp } from "@/core/experiment";
import type { Tool } from "./lab";

export function cellsOnLine(a: number, b: number, w: number): number[] {
  let x0 = a % w;
  let y0 = Math.floor(a / w);
  const x1 = b % w;
  const y1 = Math.floor(b / w);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  const out: number[] = [];
  for (;;) {
    out.push(y0 * w + x0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
  return out;
}

export function paintCells(
  exp: Experiment,
  cells: number[],
  tool: Tool,
  weight: number,
  erase: boolean,
): Experiment {
  if (exp.family !== "grid") return exp;
  const g = exp.input;
  const next = g.cells.slice();
  let changed = false;
  for (const c of cells) {
    if (c === g.start || c === g.target || c < 0 || c >= next.length) continue;
    const value =
      erase || tool === "erase" ? 1 : tool === "wall" ? 0 : tool === "weight" ? weight : next[c];
    if (next[c] !== value) {
      next[c] = value;
      changed = true;
    }
  }
  if (!changed) return exp;
  return { ...exp, input: { ...g, cells: next, terrain: "custom" } } as GridExp;
}

export function moveEndpoint(exp: Experiment, which: "start" | "target", cell: number): Experiment {
  if (exp.family !== "grid") return exp;
  const g = exp.input;
  if (cell < 0 || cell >= g.cells.length) return exp;
  if (which === "start" && (cell === g.target || cell === g.start)) return exp;
  if (which === "target" && (cell === g.start || cell === g.target)) return exp;
  const cells = g.cells[cell] === 0 ? g.cells.slice() : g.cells;
  if (cells !== g.cells) cells[cell] = 1;
  return { ...exp, input: { ...g, cells, [which]: cell } } as GridExp;
}

export function eraseMode(exp: Experiment, cell: number, tool: Tool, weight: number): boolean {
  if (exp.family !== "grid") return false;
  const v = exp.input.cells[cell];
  if (tool === "wall") return v === 0;
  if (tool === "weight") return v === weight;
  return false;
}
