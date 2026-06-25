/* Framework-free checks for the Learning algorithms. Run: node test/run.js */
const assert = require('node:assert');
const { makeBlobs, makeNoisyLine, kmeansTrace, regressionTrace, inertiaOf } = require('../src/learning.js');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ok  ${name}`); };

/* ── k-means ───────────────────────────────────────────────────── */
test('k-means separates two obvious clusters', () => {
  const a = Array.from({ length: 20 }, () => ({ x: 0.2 + Math.random() * 0.05, y: 0.2 + Math.random() * 0.05 }));
  const b = Array.from({ length: 20 }, () => ({ x: 0.8 + Math.random() * 0.05, y: 0.8 + Math.random() * 0.05 }));
  const pts = [...a, ...b];
  const ev = kmeansTrace(pts, 2, { initialCentroids: [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 }] });
  const last = ev[ev.length - 1];
  assert.strictEqual(last.status, 'Converged');
  assert.strictEqual(last.centroids.length, 2);
  // every point in cluster a shares a label, distinct from cluster b
  const labels = new Set(last.points.slice(0, 20).map(p => p.c));
  assert.strictEqual(labels.size, 1, 'cluster A should be homogeneous');
  assert.notStrictEqual(last.points[0].c, last.points[20].c, 'A and B must differ');
  assert.ok(last.inertia < 0.2, `inertia should be small, got ${last.inertia}`);
});

test('k-means inertia never increases across the trace', () => {
  const pts = makeBlobs(3, 60, mulberry32(42));
  const ev = kmeansTrace(pts, 3, { rng: mulberry32(7) });
  let prev = Infinity;
  for (const e of ev) {
    assert.ok(e.inertia <= prev + 1e-9, `inertia rose: ${prev} -> ${e.inertia}`);
    prev = e.inertia;
  }
  assert.ok(ev[0].step === 0 && ev[ev.length - 1].step === ev.length - 1, 'steps indexed');
});

/* ── gradient descent ──────────────────────────────────────────── */
test('gradient descent recovers a known line', () => {
  const W = 0.6, B = 0.2;
  const pts = Array.from({ length: 40 }, (_, i) => { const x = i / 39; return { x, y: W * x + B }; });
  const ev = regressionTrace(pts, { lr: 0.5, iters: 400, sample: 10 });
  const last = ev[ev.length - 1];
  assert.ok(Math.abs(last.w - W) < 0.03, `w=${last.w} expected ~${W}`);
  assert.ok(Math.abs(last.b - B) < 0.03, `b=${last.b} expected ~${B}`);
  assert.ok(last.mse < 1e-3, `mse=${last.mse} should be tiny`);
});

test('gradient descent loss is monotonically non-increasing', () => {
  const pts = makeNoisyLine(50, mulberry32(99));
  const ev = regressionTrace(pts, { lr: 0.4 });
  let prev = Infinity;
  for (const e of ev) {
    assert.ok(e.mse <= prev + 1e-9, `mse rose: ${prev} -> ${e.mse}`);
    prev = e.mse;
  }
});

/* seedable rng so dataset-driven tests are deterministic */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

console.log(`\n${passed} checks passed.`);
