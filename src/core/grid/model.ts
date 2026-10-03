export type Heuristic = "manhattan" | "euclidean" | "octile" | "zero";
export type Terrain = "open" | "maze" | "rooms" | "scatter" | "weighted" | "trap" | "custom";
export type GridSize = "S" | "M" | "L" | "T";

export interface GridInput {
  w: number;
  h: number;
  cells: Uint8Array;
  start: number;
  target: number;
  diagonal: boolean;
  terrain: Terrain;
  seed: number;
  size: GridSize;
}

export const GRID_SIZES: Record<GridSize, { w: number; h: number; label: string }> = {
  S: { w: 21, h: 13, label: "Small · 21×13" },
  M: { w: 41, h: 25, label: "Medium · 41×25" },
  L: { w: 61, h: 37, label: "Large · 61×37" },
  T: { w: 17, h: 25, label: "Tall · 17×25" },
};

export const SQRT2 = Math.SQRT2;

export function rowCol(cell: number, w: number): [number, number] {
  return [Math.floor(cell / w), cell % w];
}

export function fmtCell(cell: number, w: number): string {
  const [r, c] = rowCol(cell, w);
  return `(${r}, ${c})`;
}

export interface Step {
  to: number;
  diag: boolean;
}

export function neighbors(g: GridInput, cell: number): Step[] {
  const { w, h, cells } = g;
  const r = Math.floor(cell / w);
  const c = cell % w;
  const open = (rr: number, cc: number) =>
    rr >= 0 && rr < h && cc >= 0 && cc < w && cells[rr * w + cc] > 0;
  const out: Step[] = [];
  const orth: [number, number][] = [
    [-1, 0],
    [0, 1],
    [1, 0],
    [0, -1],
  ];
  for (const [dr, dc] of orth)
    if (open(r + dr, c + dc)) out.push({ to: (r + dr) * w + c + dc, diag: false });
  if (g.diagonal) {
    const diag: [number, number][] = [
      [-1, 1],
      [1, 1],
      [1, -1],
      [-1, -1],
    ];
    for (const [dr, dc] of diag) {
      if (open(r + dr, c + dc) && open(r + dr, c) && open(r, c + dc)) {
        out.push({ to: (r + dr) * w + c + dc, diag: true });
      }
    }
  }
  return out;
}

export function moveCost(g: GridInput, step: Step): number {
  return g.cells[step.to] * (step.diag ? SQRT2 : 1);
}

export function heuristic(kind: Heuristic, a: number, b: number, w: number): number {
  const ar = Math.floor(a / w);
  const ac = a % w;
  const br = Math.floor(b / w);
  const bc = b % w;
  const dx = Math.abs(ac - bc);
  const dy = Math.abs(ar - br);
  switch (kind) {
    case "manhattan":
      return dx + dy;
    case "euclidean":
      return Math.hypot(dx, dy);
    case "octile":
      return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy);
    default:
      return 0;
  }
}

export function pathCost(g: GridInput, path: number[]): number {
  let cost = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const diag = Math.abs(a - b) !== 1 && Math.abs(a - b) !== g.w;
    cost += g.cells[b] * (diag ? SQRT2 : 1);
  }
  return cost;
}

export function hasWeights(g: GridInput): boolean {
  for (let i = 0; i < g.cells.length; i++) if (g.cells[i] > 1) return true;
  return false;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
