import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const out = (p) => `${root}public/${p}`;

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

class Canvas {
  constructor(w, h, ss = 4) {
    this.w = w;
    this.h = h;
    this.ss = ss;
    this.W = w * ss;
    this.H = h * ss;
    this.px = new Float32Array(this.W * this.H * 4);
  }
  rect(x, y, w, h, [r, g, b, a = 1]) {
    const s = this.ss;
    const x0 = Math.max(0, Math.round(x * s));
    const y0 = Math.max(0, Math.round(y * s));
    const x1 = Math.min(this.W, Math.round((x + w) * s));
    const y1 = Math.min(this.H, Math.round((y + h) * s));
    for (let yy = y0; yy < y1; yy++)
      for (let xx = x0; xx < x1; xx++) this.blend((yy * this.W + xx) * 4, r, g, b, a);
  }
  circle(cx, cy, rad, [r, g, b, a = 1]) {
    const s = this.ss;
    for (let yy = Math.floor((cy - rad) * s); yy <= Math.ceil((cy + rad) * s); yy++)
      for (let xx = Math.floor((cx - rad) * s); xx <= Math.ceil((cx + rad) * s); xx++) {
        if (xx < 0 || yy < 0 || xx >= this.W || yy >= this.H) continue;
        if ((xx / s - cx) ** 2 + (yy / s - cy) ** 2 <= rad * rad)
          this.blend((yy * this.W + xx) * 4, r, g, b, a);
      }
  }
  line(x0, y0, x1, y1, width, color) {
    if (x0 === x1)
      this.rect(
        x0 - width / 2,
        Math.min(y0, y1) - width / 2,
        width,
        Math.abs(y1 - y0) + width,
        color,
      );
    else if (y0 === y1)
      this.rect(
        Math.min(x0, x1) - width / 2,
        y0 - width / 2,
        Math.abs(x1 - x0) + width,
        width,
        color,
      );
    else {
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
      for (let i = 0; i <= n; i++)
        this.circle(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, width / 2, color);
    }
  }
  blend(i, r, g, b, a) {
    const p = this.px;
    const ia = 1 - a;
    p[i] = r * a + p[i] * ia;
    p[i + 1] = g * a + p[i + 1] * ia;
    p[i + 2] = b * a + p[i + 2] * ia;
    p[i + 3] = a + p[i + 3] * ia;
  }
  toPng() {
    const { w, h, ss, W } = this;
    const outBuf = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const acc = [0, 0, 0, 0];
        for (let dy = 0; dy < ss; dy++)
          for (let dx = 0; dx < ss; dx++) {
            const i = ((y * ss + dy) * W + x * ss + dx) * 4;
            for (let k = 0; k < 4; k++) acc[k] += this.px[i + k];
          }
        const n = ss * ss;
        const a = acc[3] / n;
        const o = (y * w + x) * 4;
        outBuf[o] = a ? Math.round(acc[0] / n / a) : 0;
        outBuf[o + 1] = a ? Math.round(acc[1] / n / a) : 0;
        outBuf[o + 2] = a ? Math.round(acc[2] / n / a) : 0;
        outBuf[o + 3] = Math.round(a * 255);
      }
    return png(w, h, outBuf);
  }
}

const GRAPHITE = [20, 23, 25];
const INK = [232, 234, 228];
const SIGNAL = [255, 106, 61];
const CLOSED = [38, 70, 82];
const OPEN = [215, 154, 46];
const PATH = [61, 214, 140];
const WALL = [96, 105, 112];
const FIELD = [16, 19, 20];
const LINE = [30, 35, 38];
const A = [232, 130, 88];

const EXPLORED = [44, 86, 102];
const UNSEEN = [62, 73, 78];

function mark(c, ox, oy, size) {
  const u = size / 16;
  const r = size * (3.5 / 16);
  const R = (x, y, w, h, col) => c.rect(ox + x * u, oy + y * u, w * u, h * u, col);
  R(r / u, 0, 16 - (2 * r) / u, 16, GRAPHITE);
  R(0, r / u, 16, 16 - (2 * r) / u, GRAPHITE);
  for (const [x, y] of [
    [r, r],
    [size - r, r],
    [r, size - r],
    [size - r, size - r],
  ])
    c.circle(ox + x, oy + y, r, GRAPHITE);
  R(2, 5, 3, 9, EXPLORED);
  R(5, 8, 3, 6, EXPLORED);
  R(8, 11, 3, 3, EXPLORED);
  for (const k of [2, 5, 8, 11]) R(k, k, 3, 3, SIGNAL);
  R(2, 11, 3, 3, INK);
  R(11, 2, 3, 3, INK);
  R(12, 3, 1, 1, GRAPHITE);
  if (size < 48) return;
  const hair = Math.max(1, u / 4) / u;
  for (const k of [5, 8, 11]) {
    R(k - hair, 2, hair, 12, GRAPHITE);
    R(2, k - hair, 12, hair, GRAPHITE);
  }
  for (const [x, y] of [
    [6, 3],
    [9, 3],
    [9, 6],
    [12, 6],
    [12, 9],
  ])
    R(x + 0.25, y + 0.25, 0.5, 0.5, UNSEEN);
}

function icon(size) {
  const c = new Canvas(size, size, size <= 32 ? 8 : 4);
  mark(c, 0, 0, size);
  return c.toPng();
}

async function gridData() {
  const res = await build({
    stdin: {
      contents: `import { SCENARIOS } from "./src/core/scenarios";
import { runVariant } from "./src/core/experiment";
const exp = SCENARIOS.find((s) => s.id === "astar-vs-dijkstra").build(false);
const a = runVariant(exp, "a"); const b = runVariant(exp, "b");
const mid = (r, f) => r.player.at(Math.floor(r.trace.events.length * f)).state;
const sa = a.player.at(a.trace.events.length).state; const sb = b.player.at(b.trace.events.length).state;
export default { w: exp.input.w, h: exp.input.h, cells: Array.from(exp.input.cells), start: exp.input.start, target: exp.input.target,
  a: Array.from(sa.status), b: Array.from(sb.status), pathA: sa.path, pathB: sb.path };`,
      resolveDir: root,
      loader: "ts",
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    alias: { "@": `${root}src` },
  });
  const code = res.outputFiles[0].text;
  const mod = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  return mod.default;
}

function og(g) {
  const W = 1200;
  const H = 630;
  const c = new Canvas(W, H, 2);
  c.rect(0, 0, W, H, [13, 15, 16]);
  const s = Math.floor(Math.min((W - 120) / g.w, (H - 150) / g.h));
  const ox = Math.round((W - s * g.w) / 2);
  const oy = 110;
  c.rect(ox, oy, s * g.w, s * g.h, LINE);
  for (let i = 0; i < g.w * g.h; i++) {
    const x = ox + (i % g.w) * s;
    const y = oy + Math.floor(i / g.w) * s;
    const ca = g.a[i] === 2;
    const cb = g.b[i] === 2;
    let col = FIELD;
    if (g.cells[i] === 0) col = WALL;
    else if (ca && cb) col = CLOSED;
    else if (ca) col = [...A, 0.55];
    else if (g.a[i] === 1) col = OPEN;
    c.rect(x + 1, y + 1, s - 1, s - 1, FIELD);
    c.rect(x + 1, y + 1, s - 1, s - 1, col);
  }
  const center = (cell) => [ox + (cell % g.w) * s + s / 2, oy + Math.floor(cell / g.w) * s + s / 2];
  for (let i = 1; i < g.pathA.length; i++)
    c.line(...center(g.pathA[i - 1]), ...center(g.pathA[i]), s * 0.28, PATH);
  const [sx, sy] = center(g.start);
  c.circle(sx, sy, s * 0.36, INK);
  const [tx, ty] = center(g.target);
  c.circle(tx, ty, s * 0.4, INK);
  c.circle(tx, ty, s * 0.28, FIELD);
  c.circle(tx, ty, s * 0.12, INK);
  mark(c, 60, 26, 64);
  return c.toPng();
}

mkdirSync(out("icons"), { recursive: true });
for (const size of [16, 32, 48, 128, 180, 512])
  writeFileSync(out(`icons/icon-${size}.png`), icon(size));
writeFileSync(out("og.png"), og(await gridData()));
console.log("icons and og.png written");
