import os from "node:os";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import puppeteer from "puppeteer-core";

const root = fileURLToPath(new URL("..", import.meta.url));
const BASE = process.env.BASE ?? "http://localhost:4173/ML-Algorithm-Visualizer/";
const CHROME = process.env.CHROME_PATH;
const THROTTLE = Number(process.env.THROTTLE ?? 1);
const MAX_PLAY_MS = 8000;
const LONG_FRAME_MS = 25;
const only = process.argv[2];

if (!CHROME) {
  console.error("Set CHROME_PATH to a Chrome or Chromium executable.");
  process.exit(1);
}

async function largeGridCodes() {
  const res = await build({
    stdin: {
      contents: `import { DEFAULT_VIEW } from "./src/core/experiment";
import { makeGrid } from "./src/core/grid/terrain";
import { encode } from "./src/core/share";
const p = { heuristic: "octile", weight: 1 };
const view = { ...DEFAULT_VIEW };
export default {
  "61x37 mud bfs vs dijkstra": encode({ family: "grid", input: makeGrid("L", "weighted", 7, true),
    a: { algo: "bfs", params: p }, b: { algo: "dijkstra", params: p }, view }),
  "61x37 open dijkstra vs astar": encode({ family: "grid", input: makeGrid("L", "open", 7, true),
    a: { algo: "dijkstra", params: p }, b: { algo: "astar", params: p }, view }),
};`,
      resolveDir: root,
      loader: "ts",
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    alias: { "@": `${root}src` },
  });
  const code = Buffer.from(res.outputFiles[0].text).toString("base64");
  return (await import(`data:text/javascript;base64,${code}`)).default;
}

const ALGOS = [
  "bfs",
  "dfs",
  "dijkstra",
  "astar",
  "greedy",
  "insertion",
  "selection",
  "bubble",
  "quick",
  "merge",
  "heap",
  "linear",
  "binary",
  "jump",
  "prim",
  "kruskal",
  "kmeans",
  "gradient",
];
const codes = await largeGridCodes();
const cases = [
  ...ALGOS.map((a) => [a, `#/lab?algo=${a}`]),
  ...["astar-vs-dijkstra", "quick-worst", "kmeans-init"].map((s) => [s, `#/lab?s=${s}`]),
  ...Object.entries(codes).map(([name, code]) => [name, `#/lab?e=${code}`]),
].filter(([name]) => !only || name.includes(only));

const quantile = (xs, p) => xs[Math.min(xs.length - 1, Math.floor(xs.length * p))];

async function measure(browser, hash, speedUps) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.evaluateOnNewDocument(() => {
    const settings = { theme: "light", motion: "full", singleKey: true, tourDone: true };
    localStorage.setItem("algoscope.settings.v1", JSON.stringify(settings));
  });
  const errors = [];
  const foreign = new Set();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("request", (req) => {
    const origin = new URL(req.url()).origin;
    if (origin !== new URL(BASE).origin && !req.url().startsWith("data:")) foreign.add(origin);
  });
  await page.goto(BASE + hash, { waitUntil: "networkidle0" });
  await page.waitForSelector("main canvas");
  for (let i = 0; i < speedUps; i++) await page.keyboard.press("Equal");
  await page.evaluate(() => {
    const w = window;
    w.__frames = [];
    w.__long = 0;
    w.__boxes = new Map();
    new PerformanceObserver((l) => (w.__long += l.getEntries().length)).observe({
      type: "longtask",
    });
    let last = 0;
    const loop = (t) => {
      if (last) w.__frames.push(t - last);
      last = t;
      document.querySelectorAll("main canvas").forEach((c, i) => {
        const r = c.getBoundingClientRect();
        const set = w.__boxes.get(i) ?? new Set();
        set.add(`${r.x},${r.y},${r.width},${r.height}`);
        w.__boxes.set(i, set);
      });
      w.__raf = requestAnimationFrame(loop);
    };
    w.__raf = requestAnimationFrame(loop);
  });
  await page.keyboard.press("KeyH");
  if (THROTTLE > 1) await page.emulateCPUThrottling(THROTTLE);
  await page.keyboard.press("Space");
  const started = Date.now();
  await new Promise((r) => setTimeout(r, 300));
  while (Date.now() - started < MAX_PLAY_MS) {
    const playing = await page.evaluate(() =>
      [...document.querySelectorAll("button")].some((b) => b.textContent?.trim() === "Pause"),
    );
    if (!playing) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  const data = await page.evaluate(() => {
    const w = window;
    cancelAnimationFrame(w.__raf);
    const nums = (sel) =>
      [...document.querySelectorAll(sel)].map((d) => d.textContent.match(/[\d.]+/g).map(Number));
    return {
      frames: w.__frames.slice(2),
      long: w.__long,
      boxes: Math.max(1, ...[...w.__boxes.values()].map((s) => s.size)),
      drawMax: Math.max(0, ...nums("[data-draw]").map((n) => n[1])),
      commitsMax: Math.max(0, ...nums("[data-commit]").map((n) => n[0])),
    };
  });
  const { JSHeapUsedSize } = await page.metrics();
  await page.close();
  const xs = data.frames.sort((a, b) => a - b);
  return {
    frames: xs.length,
    median: quantile(xs, 0.5),
    p95: quantile(xs, 0.95),
    worst: xs[xs.length - 1],
    long: xs.filter((x) => x > LONG_FRAME_MS).length,
    longTasks: data.long,
    boxes: data.boxes,
    drawMax: data.drawMax,
    commitsMax: data.commitsMax,
    heapMB: JSHeapUsedSize / 1e6,
    foreign: [...foreign],
    errors,
  };
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--disable-background-timer-throttling", "--disable-renderer-backgrounding"],
});
console.log(`Chrome ${await browser.version()} · Node ${process.version} · ${os.cpus()[0].model}`);
console.log(`viewport 1440x900 · CPU throttle ${THROTTLE}x · ${BASE}\n`);
const rows = [];
for (const [speed, speedUps] of [
  ["1x", 0],
  ["4x", 2],
]) {
  for (const [name, hash] of cases) {
    const r = { name, speed, ...(await measure(browser, hash, speedUps)) };
    rows.push(r);
    console.log(
      [
        name.padEnd(30),
        speed.padEnd(3),
        `n ${String(r.frames).padStart(4)}`,
        `median ${r.median.toFixed(1)}`,
        `p95 ${r.p95.toFixed(1)}`,
        `worst ${r.worst.toFixed(1)}`,
        `>${LONG_FRAME_MS}ms ${r.long}`,
        `longtasks ${r.longTasks}`,
        `canvas boxes ${r.boxes}`,
        `draw max ${r.drawMax.toFixed(2)}`,
        `renders/s ${r.commitsMax.toFixed(1)}`,
        `heap ${r.heapMB.toFixed(0)} MB`,
        r.foreign.length ? `other origins: ${r.foreign.join(" ")}` : "",
        r.errors.length ? `errors ${r.errors.length}: ${r.errors[0]}` : "",
      ].join("  "),
    );
  }
}
await browser.close();
const max = (k) => Math.max(...rows.map((r) => r[k]));
console.log(
  `\nworst p95 ${max("p95").toFixed(1)} ms · worst frame ${max("worst").toFixed(1)} ms · ` +
    `frames over ${LONG_FRAME_MS} ms ${rows.reduce((s, r) => s + r.long, 0)} · ` +
    `long tasks ${max("longTasks")} · max canvas boxes per run ${max("boxes")} · ` +
    `max draw ${max("drawMax").toFixed(2)} ms · max renders/s ${max("commitsMax").toFixed(1)} · ` +
    `max heap ${max("heapMB").toFixed(0)} MB · page errors ${rows.reduce((s, r) => s + r.errors.length, 0)} · ` +
    `requests to other origins ${new Set(rows.flatMap((r) => r.foreign)).size}`,
);
