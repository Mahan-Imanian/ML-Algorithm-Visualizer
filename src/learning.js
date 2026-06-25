/* ─── Learning algorithms ────────────────────────────────────────
 * Pure trace generators for the "Learning" family. Each returns an
 * array of timeline events shaped like the path/sort traces so the
 * existing scrubber, inspector, and pseudocode panels work unchanged.
 *
 * No DOM, no globals: everything is a function of its inputs, which is
 * what makes these testable in Node (see test/run.js). Datasets live in
 * a normalized [0,1] × [0,1] space so the canvas mapping stays trivial.
 * ──────────────────────────────────────────────────────────────── */

function dist2(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

/* Box–Muller, driven by an injectable rng so datasets are reproducible. */
function gaussian(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* ─── Dataset generators ─────────────────────────────────────────── */
function makeBlobs(k = 3, n = 90, rng = Math.random) {
  const centers = Array.from({ length: k }, () => ({
    x: 0.18 + rng() * 0.64,
    y: 0.18 + rng() * 0.64
  }));
  return Array.from({ length: n }, (_, i) => {
    const c = centers[i % k];
    return {
      x: clamp01(c.x + gaussian(rng) * 0.06),
      y: clamp01(c.y + gaussian(rng) * 0.06)
    };
  });
}

function makeNoisyLine(n = 60, rng = Math.random) {
  const w = 0.35 + rng() * 0.5;   // true slope
  const b = 0.12 + rng() * 0.2;   // true intercept
  return Array.from({ length: n }, () => {
    const x = rng();
    return { x, y: clamp01(w * x + b + gaussian(rng) * 0.05) };
  });
}

/* ─── k-means clustering ─────────────────────────────────────────── */
function inertiaOf(points, centroids, assign) {
  return points.reduce((s, p, i) => s + dist2(p, centroids[assign[i]]), 0);
}

function pickInitial(points, k, rng = Math.random) {
  /* Spread initial centroids by sampling distinct points (k-means++ lite). */
  const idx = points.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, k).map(i => ({ x: points[i].x, y: points[i].y }));
}

function assignClusters(points, centroids) {
  return points.map(p => {
    let best = 0, bd = Infinity;
    centroids.forEach((c, ci) => { const d = dist2(p, c); if (d < bd) { bd = d; best = ci; } });
    return best;
  });
}

function recompute(points, assign, centroids) {
  return centroids.map((c, ci) => {
    let sx = 0, sy = 0, count = 0;
    points.forEach((p, i) => { if (assign[i] === ci) { sx += p.x; sy += p.y; count++; } });
    return count ? { x: sx / count, y: sy / count } : { x: c.x, y: c.y };
  });
}

function kmeansTrace(points, k = 3, opts = {}) {
  const rng = opts.rng || Math.random;
  const maxIter = opts.maxIter ?? 12;
  let centroids = (opts.initialCentroids || pickInitial(points, k, rng)).map(c => ({ ...c }));
  let assign = assignClusters(points, centroids);
  const events = [];

  const snap = (type, line, note, status = 'Clustering') => ({
    kind: 'learn', algo: 'kmeans', type, line, note, status,
    points: points.map((p, i) => ({ x: p.x, y: p.y, c: assign[i] })),
    centroids: centroids.map(c => ({ x: c.x, y: c.y })),
    inertia: inertiaOf(points, centroids, assign),
    iteration: 0, k
  });

  let snapped = snap('init', 0, `Initialize ${k} centroids and assign every point.`);
  snapped.iteration = 0;
  events.push(snapped);

  let iter = 0;
  while (iter < maxIter) {
    const moved = recompute(points, assign, centroids);
    const shift = moved.reduce((s, c, i) => s + dist2(c, centroids[i]), 0);
    centroids = moved;
    let e = snap('update', 2, `Iteration ${iter + 1}: move centroids to cluster means.`);
    e.iteration = iter + 1;
    events.push(e);

    const next = assignClusters(points, centroids);
    const changed = next.some((c, i) => c !== assign[i]);
    assign = next;
    e = snap('assign', 1, `Iteration ${iter + 1}: reassign points to nearest centroid.`);
    e.iteration = iter + 1;
    events.push(e);

    iter++;
    if (!changed && shift < 1e-6) break;
  }

  const last = snap('done', 4, `Converged after ${iter} iteration${iter !== 1 ? 's' : ''} · inertia ${inertiaOf(points, centroids, assign).toFixed(3)}.`, 'Converged');
  last.iteration = iter;
  events.push(last);
  return events.map((ev, i) => ({ ...ev, step: i }));
}

/* ─── Gradient descent (linear regression) ───────────────────────── */
function regressionTrace(points, opts = {}) {
  const lr = opts.lr ?? 0.5;
  const iters = opts.iters ?? 120;
  const sample = opts.sample ?? 3;
  const n = points.length || 1;
  let w = 0, b = 0;
  const events = [];

  const mseOf = () => points.reduce((s, p) => { const e = w * p.x + b - p.y; return s + e * e; }, 0) / n;

  const frame = (type, line, note, status = 'Descending', iteration = 0) => ({
    kind: 'learn', algo: 'regression', type, line, note, status,
    points, w, b, mse: mseOf(), iteration
  });

  events.push(frame('init', 0, 'Initialize w = 0, b = 0.', 'Descending', 0));

  for (let it = 0; it < iters; it++) {
    let gw = 0, gb = 0;
    for (const p of points) { const e = w * p.x + b - p.y; gw += 2 * e * p.x; gb += 2 * e; }
    gw /= n; gb /= n;
    w -= lr * gw; b -= lr * gb;
    if (it % sample === 0 || it === iters - 1) {
      events.push(frame('step', 3,
        `Step ${it + 1}: w=${w.toFixed(3)}, b=${b.toFixed(3)}, MSE=${mseOf().toFixed(4)}.`,
        'Descending', it + 1));
    }
  }

  events.push(frame('done', 4,
    `Converged · w=${w.toFixed(3)}, b=${b.toFixed(3)}, MSE=${mseOf().toFixed(4)}.`,
    'Converged', iters));
  return events.map((ev, i) => ({ ...ev, step: i }));
}

/* Browser: top-level functions are visible to app.js (shared script scope).
   Node: export for the test runner. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { makeBlobs, makeNoisyLine, kmeansTrace, regressionTrace, inertiaOf };
}
