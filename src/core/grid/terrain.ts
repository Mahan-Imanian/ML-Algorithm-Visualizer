import { mulberry32, shuffleInPlace } from "../rng";
import {
  GRID_SIZES,
  MUD_COST,
  neighbors,
  type GridInput,
  type GridSize,
  type Terrain,
} from "./model";

const SCATTER_WALL_FRACTION = 0.3;
const SCATTER_ATTEMPTS = 40;
const MUD_BANDS: [number, number][] = [
  [0.45, 1],
  [0.58, 3],
  [0.7, 6],
];

export const TERRAINS: { id: Exclude<Terrain, "custom">; label: string; hint: string }[] = [
  { id: "open", label: "Open field", hint: "No obstacles. Shows each search's raw shape." },
  { id: "maze", label: "Maze", hint: "Corridors with a few loops. DFS and BFS diverge sharply." },
  { id: "rooms", label: "Rooms", hint: "Recursive division: chambers joined by single doors." },
  {
    id: "scatter",
    label: "Scatter",
    hint: `Random walls on ${SCATTER_WALL_FRACTION * 100}% of cells, redrawn until the target is reachable.`,
  },
  {
    id: "weighted",
    label: "Mud field",
    hint: "Mud and swamp cost more. BFS ignores it; Dijkstra does not.",
  },
  {
    id: "trap",
    label: "Trap",
    hint: "A cup facing the start. Greedy search walks straight in.",
  },
];

export function makeGrid(
  size: GridSize,
  terrain: Exclude<Terrain, "custom">,
  seed: number,
  diagonal = false,
): GridInput {
  const { w, h } = GRID_SIZES[size];
  const cells = new Uint8Array(w * h).fill(1);
  const rng = mulberry32(seed);
  const mid = Math.floor(h / 2) - (Math.floor(h / 2) % 2);
  let start = mid * w + Math.max(1, Math.floor(w / 6));
  let target = mid * w + (w - 1 - Math.max(1, Math.floor(w / 6)));

  if (terrain === "maze") {
    carveMaze(cells, w, h, rng);
    start = 1 * w + 1;
    target = (h - 2) * w + (w - 2);
  } else if (terrain === "rooms") {
    divide(cells, w, rng, 0, 0, h - 1, w - 1);
    start = mid * w;
    target = mid * w + (w - 1);
  } else if (terrain === "scatter") {
    for (let attempt = 0; attempt < SCATTER_ATTEMPTS; attempt++) {
      const r2 = mulberry32(seed + attempt * 7919);
      cells.fill(1);
      for (let i = 0; i < cells.length; i++) if (r2() < SCATTER_WALL_FRACTION) cells[i] = 0;
      cells[start] = 1;
      cells[target] = 1;
      if (reachable({ w, h, cells, start, target, diagonal, terrain, seed, size })) break;
    }
  } else if (terrain === "weighted") {
    paintNoise(cells, w, h, rng);
  } else if (terrain === "trap") {
    const tr = Math.floor(h / 2);
    const k = Math.max(2, Math.floor(h / 4));
    const cx = Math.floor(((start % w) + (target % w)) / 2) + Math.floor(w / 10);
    const depth = Math.max(3, Math.floor(w / 6));
    for (let r = tr - k; r <= tr + k; r++) cells[r * w + cx] = 0;
    for (let c = cx - depth; c <= cx; c++) {
      cells[(tr - k) * w + c] = 0;
      cells[(tr + k) * w + c] = 0;
    }
    start = tr * w + Math.max(1, Math.floor(w / 6));
    target = tr * w + (w - 1 - Math.max(1, Math.floor(w / 8)));
  }

  cells[start] = 1;
  cells[target] = 1;
  return { w, h, cells, start, target, diagonal, terrain, seed, size };
}

function carveMaze(cells: Uint8Array, w: number, h: number, rng: () => number) {
  cells.fill(0);
  const stack: [number, number][] = [[1, 1]];
  cells[1 * w + 1] = 1;
  const dirs: [number, number][] = [
    [-2, 0],
    [0, 2],
    [2, 0],
    [0, -2],
  ];
  while (stack.length) {
    const [r, c] = stack[stack.length - 1];
    const options = shuffleInPlace([...dirs], rng).filter(([dr, dc]) => {
      const rr = r + dr;
      const cc = c + dc;
      return rr > 0 && rr < h - 1 && cc > 0 && cc < w - 1 && cells[rr * w + cc] === 0;
    });
    if (!options.length) {
      stack.pop();
      continue;
    }
    const [dr, dc] = options[0];
    cells[(r + dr / 2) * w + (c + dc / 2)] = 1;
    cells[(r + dr) * w + (c + dc)] = 1;
    stack.push([r + dr, c + dc]);
  }
  for (let r = 1; r < h - 1; r++) {
    for (let c = 1; c < w - 1; c++) {
      const i = r * w + c;
      if (cells[i] !== 0) continue;
      const horizontal = cells[i - 1] && cells[i + 1] && !cells[i - w] && !cells[i + w];
      const vertical = cells[i - w] && cells[i + w] && !cells[i - 1] && !cells[i + 1];
      if ((horizontal || vertical) && rng() < 0.07) cells[i] = 1;
    }
  }
}

function divide(
  cells: Uint8Array,
  w: number,
  rng: () => number,
  r0: number,
  c0: number,
  r1: number,
  c1: number,
) {
  const height = r1 - r0 + 1;
  const width = c1 - c0 + 1;
  if (width < 3 || height < 3) return;
  const horizontal = width < height ? true : width > height ? false : rng() < 0.5;
  const pick = (lo: number, hi: number, parity: number) => {
    const opts: number[] = [];
    for (let v = lo; v <= hi; v++) if (v % 2 === parity) opts.push(v);
    return opts.length ? opts[Math.floor(rng() * opts.length)] : -1;
  };
  if (horizontal) {
    const wr = pick(r0 + 1, r1 - 1, 1);
    if (wr < 0) return;
    const door = pick(c0, c1, 0);
    for (let c = c0; c <= c1; c++) if (c !== door) cells[wr * w + c] = 0;
    divide(cells, w, rng, r0, c0, wr - 1, c1);
    divide(cells, w, rng, wr + 1, c0, r1, c1);
  } else {
    const wc = pick(c0 + 1, c1 - 1, 1);
    if (wc < 0) return;
    const door = pick(r0, r1, 0);
    for (let r = r0; r <= r1; r++) if (r !== door) cells[r * w + wc] = 0;
    divide(cells, w, rng, r0, c0, r1, wc - 1);
    divide(cells, w, rng, r0, wc + 1, r1, c1);
  }
}

function paintNoise(cells: Uint8Array, w: number, h: number, rng: () => number) {
  const field = (scale: number) => {
    const gw = Math.ceil(w / scale) + 2;
    const gh = Math.ceil(h / scale) + 2;
    const grid = Array.from({ length: gw * gh }, () => rng());
    return (r: number, c: number) => {
      const x = c / scale;
      const y = r / scale;
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const fx = x - x0;
      const fy = y - y0;
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const v = (xx: number, yy: number) => grid[yy * gw + xx];
      const top = v(x0, y0) * (1 - sx) + v(x0 + 1, y0) * sx;
      const bottom = v(x0, y0 + 1) * (1 - sx) + v(x0 + 1, y0 + 1) * sx;
      return top * (1 - sy) + bottom * sy;
    };
  };
  const coarse = field(Math.max(5, Math.round(w / 6)));
  const fine = field(3);
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const n = coarse(r, c) * 0.75 + fine(r, c) * 0.25;
      cells[r * w + c] = MUD_BANDS.find(([below]) => n < below)?.[1] ?? MUD_COST.max;
    }
  }
}

export function reachable(g: GridInput): boolean {
  const seen = new Uint8Array(g.cells.length);
  const queue = [g.start];
  seen[g.start] = 1;
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    if (cur === g.target) return true;
    for (const s of neighbors(g, cur)) {
      if (!seen[s.to]) {
        seen[s.to] = 1;
        queue.push(s.to);
      }
    }
  }
  return false;
}
