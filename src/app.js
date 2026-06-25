/* ─── DOM refs ───────────────────────────────────────────────── */
const $app            = document.querySelector('.app');
const $gridStage      = document.getElementById('gridStage');
const $sortStage      = document.getElementById('sortStage');
const $learnStage     = document.getElementById('learnStage');
const $learnCanvas    = document.getElementById('learnCanvas');
const $libraryStage   = document.getElementById('libraryStage');
const $toolRail       = document.getElementById('toolRail');
const $wsActions      = document.getElementById('workspaceActions');
const $legend         = document.getElementById('legend');
const $canvasStatus   = document.getElementById('canvasStatus');
const $statePanel     = document.getElementById('statePanel');
const $tracePanel     = document.getElementById('tracePanel');
const $codePanel      = document.getElementById('codePanel');
const $comboButton    = document.getElementById('comboButton');
const $comboList      = document.getElementById('comboList');
const $comboName      = document.getElementById('comboName');
const $comboMeta      = document.getElementById('comboMeta');
const $runButton      = document.getElementById('runButton');
const $stepButton     = document.getElementById('stepButton');
const $backButton     = document.getElementById('backButton');
const $resetButton    = document.getElementById('resetTraceButton');
const $stepRange      = document.getElementById('stepRange');
const $speedRange     = document.getElementById('speedRange');
const $stepLabel      = document.getElementById('stepLabel');
const $timelineStatus = document.getElementById('timelineStatus');
const $markers        = document.getElementById('markers');
const $cmdTrigger     = document.getElementById('commandTrigger');
const $palette        = document.getElementById('palette');
const $paletteBack    = document.getElementById('paletteBackdrop');
const $cmdInput       = document.getElementById('commandInput');
const $paletteResults = document.getElementById('paletteResults');
const $exportBtn      = document.getElementById('exportButton');
const $importBtn      = document.getElementById('importButton');
const $importFile     = document.getElementById('importFile');
const $saveState      = document.getElementById('saveState');
const $toast          = document.getElementById('toast');

/* ─── Constants ──────────────────────────────────────────────── */
const ROWS       = 20;
const COLS       = 34;
const START_KEY  = '10-5';
const TARGET_KEY = '10-28';
const ARRAY_LEN  = 46;
const CLUSTERS_K = 3;
/* Cluster palette — distinct hues that survive the dark canvas. */
const CLUSTER_COLORS = [
  'oklch(0.70 0.17 279)', 'oklch(0.78 0.15 78)', 'oklch(0.74 0.16 162)',
  'oklch(0.67 0.19 16)',  'oklch(0.66 0.16 240)'
];

/* ─── State ──────────────────────────────────────────────────── */
let mode          = 'build';
let family        = 'pathfinding';
let pathAlg       = 'bfs';
let sortAlg       = 'insertion';
let learnAlg      = 'kmeans';
let tool          = 'wall';
let cells         = new Map();
let sortArray     = [];
let dataset       = [];
let trace         = [];
let stepIndex     = 0;
let playing       = false;
let timer         = null;
let dirty         = true;
let savedRuns     = loadSaved();
let activePanel   = 'state';
let toastTimer    = null;
let paletteCommands = [];
let paletteIndex    = 0;

/* DOM element caches — built once, updated cheaply */
let cellEls = new Map();  // key → button
let barEls  = [];         // index → div

/* ─── Algorithm definitions ──────────────────────────────────── */
const algorithms = {
  pathfinding: [
    { id: 'bfs',      name: 'Breadth-first search', meta: 'Unweighted · O(V + E)',        detail: 'Expands by distance from the start. Finds the shortest path on unweighted grids.' },
    { id: 'dfs',      name: 'Depth-first search',   meta: 'Unweighted · O(V + E)',        detail: 'Explores deeply before backtracking. Useful contrast against shortest-path methods.' },
    { id: 'dijkstra', name: 'Dijkstra',             meta: 'Weighted · O((V + E) log V)',  detail: 'Uses accumulated cost. Handles weighted terrain without a heuristic.' },
    { id: 'astar',    name: 'A* search',            meta: 'Weighted · heuristic',         detail: 'Combines cost and Manhattan distance. Usually reaches the target with fewer expansions.' }
  ],
  sorting: [
    { id: 'insertion', name: 'Insertion sort', meta: 'Stable · O(n²)',         detail: 'Builds a sorted prefix by shifting larger values right.' },
    { id: 'selection', name: 'Selection sort', meta: 'Unstable · O(n²)',       detail: 'Finds the minimum remaining value and places it at the front.' },
    { id: 'bubble',    name: 'Bubble sort',    meta: 'Stable · O(n²)',         detail: 'Repeatedly swaps adjacent values until large items settle at the end.' },
    { id: 'quick',     name: 'Quick sort',     meta: 'Divide/conquer · O(n log n)', detail: 'Partitions around pivots, then sorts each partition recursively.' }
  ],
  learning: [
    { id: 'kmeans',     name: 'k-means clustering', meta: 'Unsupervised · O(n·k·i)', detail: 'Groups points around K moving centroids by alternating assignment and averaging.' },
    { id: 'regression', name: 'Gradient descent',   meta: 'Supervised · linear fit', detail: 'Fits a line by following the mean-squared-error gradient downhill, step by step.' }
  ]
};

const pseudocode = {
  bfs:       ['enqueue start', 'while queue not empty', 'current = dequeue queue', 'for each neighbor', 'if unseen: mark and enqueue', 'reconstruct path'],
  dfs:       ['push start', 'while stack not empty', 'current = pop stack', 'for each neighbor', 'if unseen: mark and push', 'reconstruct path'],
  dijkstra:  ['distance[start] = 0', 'choose node with lowest distance', 'relax each neighbor', 'update parent when cheaper', 'repeat until target', 'reconstruct path'],
  astar:     ['g[start] = 0', 'f = g + heuristic', 'choose node with lowest f', 'relax neighbor cost', 'update parent and priority', 'reconstruct path'],
  insertion: ['for each item', 'store key', 'shift larger values right', 'insert key', 'advance sorted prefix'],
  selection: ['for each position', 'scan for minimum', 'remember min index', 'swap into position', 'advance boundary'],
  bubble:    ['repeat passes', 'compare adjacent pair', 'swap if out of order', 'largest settles at end', 'stop when sorted'],
  quick:     ['choose pivot', 'partition values', 'move smaller left', 'move larger right', 'recurse on partitions'],
  kmeans:     ['initialize K centroids', 'assign points to nearest centroid', 'move centroids to cluster means', 'repeat until stable', 'report clusters'],
  regression: ['initialize w, b = 0', 'predict ŷ = w·x + b', 'compute MSE loss', 'gradient step on w and b', 'repeat until converged']
};

/* Tool icons — monospace characters that read as symbols, not decoration */
const TOOL_ICONS = {
  wall: '▣', weight: '◈', erase: '✕', preset: '⊞', clear: '↺',
  array: '≡', shuffle: '⇄', nearly: '≋', reverse: '↕',
  inspect: '⊕', compare: '◫', save: '⊙', library: '▤'
};

/* ─── Presets ────────────────────────────────────────────────── */
const presets = [
  {
    title: 'Weighted corridor',
    family: 'pathfinding',
    tags: ['A*', 'Dijkstra'],
    difficulty: 'medium',
    description: 'Tests whether cost-aware search avoids expensive terrain instead of chasing distance.'
  },
  {
    title: 'Two barriers',
    family: 'pathfinding',
    tags: ['BFS', 'routing'],
    difficulty: 'easy',
    description: 'A clean shortest-path scenario with two wall bands and one narrow passage.'
  },
  {
    title: 'Nearly sorted array',
    family: 'sorting',
    tags: ['insertion', 'low inversions'],
    difficulty: 'easy',
    description: 'Shows why insertion sort improves when most values are already close to place.'
  },
  {
    title: 'Pivot stress test',
    family: 'sorting',
    tags: ['quick sort', 'partition'],
    difficulty: 'medium',
    description: 'A distribution shaped to make pivot movement and partition boundaries visible.'
  },
  {
    title: 'Three blobs',
    family: 'learning',
    tags: ['k-means', 'clusters'],
    difficulty: 'easy',
    description: 'Three Gaussian blobs — watch k-means settle one centroid into each group.'
  },
  {
    title: 'Noisy line',
    family: 'learning',
    tags: ['gradient descent', 'MSE'],
    difficulty: 'easy',
    description: 'Points scattered around a hidden line; gradient descent recovers its slope.'
  }
];

/* ─── Grid helpers ───────────────────────────────────────────── */
function key(row, col) { return `${row}-${col}`; }
function parseKey(k) { const [r, c] = k.split('-').map(Number); return { row: r, col: c }; }
function fmtKey(k) { const { row, col } = parseKey(k); return `[${String(row).padStart(2, ' ')}·${String(col).padStart(2, ' ')}]`; }
function cellWeight(k) { return cells.get(k)?.type === 'weight' ? 6 : 1; }
function currentAlgorithm() { return algorithms[family].find(a => a.id === activeAlgId()); }
function activeAlgId() {
  return family === 'pathfinding' ? pathAlg
       : family === 'sorting'     ? sortAlg
       : learnAlg;
}

/* ─── Grid init & DOM build ──────────────────────────────────── */
function initializeGrid() {
  cells.clear();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) cells.set(key(r, c), { type: 'empty' });
  }
  cells.set(START_KEY,  { type: 'start' });
  cells.set(TARGET_KEY, { type: 'target' });
}

function buildGrid() {
  $gridStage.innerHTML = '';
  cellEls.clear();
  $gridStage.classList.add('no-anim');
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const k = key(r, c);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cell';
      btn.setAttribute('aria-label', `Cell ${r},${c}`);
      btn.addEventListener('pointerdown', () => editCell(k));
      btn.addEventListener('pointerenter', ev => { if (ev.buttons === 1 && mode === 'build') editCell(k); });
      $gridStage.appendChild(btn);
      cellEls.set(k, btn);
    }
  }
  /* Two rAFs ensure classes are committed before enabling transitions */
  requestAnimationFrame(() => requestAnimationFrame(() => $gridStage.classList.remove('no-anim')));
}

/* Update cell classes without touching DOM structure */
function renderGrid(classMap = {}) {
  for (const [k, el] of cellEls) {
    const base  = cells.get(k)?.type ?? 'empty';
    const extra = classMap[k] ?? [];
    let cls = 'cell';
    if (base !== 'empty') cls += ' ' + base;
    if (extra.length) cls += ' ' + extra.join(' ');
    if (el.className !== cls) el.className = cls;
  }
}

/* ─── Sort array & DOM build ─────────────────────────────────── */
function makeArray(kind = 'random') {
  const len = ARRAY_LEN;
  if (kind === 'nearly') {
    const base = Array.from({ length: len }, (_, i) => Math.round(10 + i * 1.8));
    for (let i = 0; i < 8; i++) {
      const a = Math.floor(Math.random() * len);
      const b = Math.floor(Math.random() * len);
      [base[a], base[b]] = [base[b], base[a]];
    }
    sortArray = base;
  } else if (kind === 'reverse') {
    sortArray = Array.from({ length: len }, (_, i) => Math.round(96 - i * 1.8));
  } else {
    sortArray = Array.from({ length: len }, () => Math.floor(12 + Math.random() * 86));
  }
  markDirty('Array generated');
}

function buildBars() {
  $sortStage.innerHTML = '';
  barEls = [];
  for (let i = 0; i < ARRAY_LEN; i++) {
    const div = document.createElement('div');
    div.className = 'bar';
    $sortStage.appendChild(div);
    barEls.push(div);
  }
}

function renderBars(active = {}) {
  const max = Math.max(...sortArray, 100);
  sortArray.forEach((v, i) => {
    const bar = barEls[i];
    if (!bar) return;
    let cls = 'bar';
    if (active.compare?.includes(i)) cls += ' compare';
    if (active.swap?.includes(i))    cls += ' swap';
    if (active.pivot === i)          cls += ' pivot';
    if (active.sorted?.includes(i))  cls += ' sorted';
    if (bar.className !== cls) bar.className = cls;
    const h = `${Math.max(4, Math.round((v / max) * 88))}%`;
    if (bar.style.height !== h) bar.style.height = h;
  });
}

/* ─── Learning dataset & canvas ──────────────────────────────── */
function makeDataset(kind = learnAlg) {
  dataset = kind === 'regression' ? makeNoisyLine(60) : makeBlobs(CLUSTERS_K, 90);
  markDirty(kind === 'regression' ? 'Linear data generated' : 'Cluster data generated');
}

/* Map normalized [0,1] data coords to device-pixel canvas coords. */
function fitCanvas() {
  const rect = $learnCanvas.getBoundingClientRect();
  const dpr  = window.devicePixelRatio || 1;
  $learnCanvas.width  = Math.max(1, Math.round(rect.width  * dpr));
  $learnCanvas.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = $learnCanvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: rect.width, h: rect.height, pad: 26 };
}

function project(p, view) {
  const { w, h, pad } = view;
  return {
    x: pad + p.x * (w - 2 * pad),
    y: h - (pad + p.y * (h - 2 * pad))   /* invert: data y grows upward */
  };
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function drawAxes(view) {
  const { ctx, w, h, pad } = view;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = cssVar('--b0') || 'rgba(120,130,160,.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, pad); ctx.lineTo(pad, h - pad); ctx.lineTo(w - pad, h - pad);
  ctx.stroke();
}

function drawLearn(ev) {
  if (!$learnStage.clientWidth) return;
  const view = fitCanvas();
  drawAxes(view);
  const { ctx } = view;

  if (ev.algo === 'regression') {
    ctx.fillStyle = cssVar('--blu') || '#5a8';
    ev.points.forEach(p => { const s = project(p, view); dot(ctx, s.x, s.y, 3); });
    /* fitted line ŷ = w·x + b across the visible x-range */
    const a = project({ x: 0, y: ev.w * 0 + ev.b }, view);
    const b = project({ x: 1, y: ev.w * 1 + ev.b }, view);
    ctx.strokeStyle = cssVar('--amb') || '#fc6';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    return;
  }

  /* k-means: points coloured by cluster, centroids as ringed crosses */
  ev.points.forEach(p => {
    const s = project(p, view);
    ctx.fillStyle = CLUSTER_COLORS[p.c % CLUSTER_COLORS.length];
    ctx.globalAlpha = 0.85;
    dot(ctx, s.x, s.y, 3);
  });
  ctx.globalAlpha = 1;
  (ev.centroids || []).forEach((c, ci) => {
    const s = project(c, view);
    ctx.strokeStyle = CLUSTER_COLORS[ci % CLUSTER_COLORS.length];
    ctx.fillStyle   = cssVar('--bg') || '#0b0e14';
    ctx.lineWidth = 2.5;
    dot(ctx, s.x, s.y, 7, true);
    ctx.beginPath();
    ctx.moveTo(s.x - 4, s.y); ctx.lineTo(s.x + 4, s.y);
    ctx.moveTo(s.x, s.y - 4); ctx.lineTo(s.x, s.y + 4);
    ctx.stroke();
  });
}

function dot(ctx, x, y, r, stroke = false) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  stroke ? (ctx.fill(), ctx.stroke()) : ctx.fill();
}

/* Frame for the build view (no trace yet): raw data, no clusters/line. */
function currentLearnFrame() {
  if (learnAlg === 'regression') {
    return { kind: 'learn', algo: 'regression', points: dataset, w: 0, b: -1, mse: null, iteration: 0 };
  }
  return { kind: 'learn', algo: 'kmeans', points: dataset.map(p => ({ ...p, c: 0 })), centroids: [], inertia: null, iteration: 0, k: CLUSTERS_K };
}

/* ─── Cell editing ───────────────────────────────────────────── */
function editCell(k) {
  if (family !== 'pathfinding' || mode !== 'build') return;
  if (k === START_KEY || k === TARGET_KEY) return;
  const cur = cells.get(k).type;
  const next = tool === 'erase' ? 'empty'
             : tool === 'wall'   ? (cur === 'wall' ? 'empty' : 'wall')
             : tool === 'weight' ? (cur === 'weight' ? 'empty' : 'weight')
             : cur;
  cells.set(k, { type: next });
  /* Update only the edited cell, not the whole grid */
  const el = cellEls.get(k);
  el.className = next === 'empty' ? 'cell' : `cell ${next}`;
  markDirty('Grid edited');
}

function markDirty(reason) {
  dirty = true;
  $saveState.classList.remove('is-saved');
  $saveState.querySelector('.save-label').textContent = 'Unsaved draft';
  if (reason) $canvasStatus.textContent = reason;
}

/* ─── Pathfinding helpers ────────────────────────────────────── */
function neighbors(k) {
  const { row, col } = parseKey(k);
  return [[-1, 0], [1, 0], [0, -1], [0, 1]]
    .map(([dr, dc]) => [row + dr, col + dc])
    .filter(([r, c]) => r >= 0 && r < ROWS && c >= 0 && c < COLS)
    .map(([r, c]) => key(r, c))
    .filter(nk => cells.get(nk).type !== 'wall');
}

function manhattan(a, b) {
  const x = parseKey(a), y = parseKey(b);
  return Math.abs(x.row - y.row) + Math.abs(x.col - y.col);
}

function reconstruct(parent, end) {
  const path = [];
  let cur = end;
  while (cur) { path.unshift(cur); cur = parent.get(cur); }
  return path;
}

/* ─── Path trace generator ───────────────────────────────────── */
function makePathTrace() {
  const alg    = pathAlg;
  const events = [];
  const parent = new Map();
  const seen   = new Set([START_KEY]);
  const visited = new Set();
  let found = false;

  function snapshot(type, current, frontier, line, note, dist = new Map()) {
    const path = current === TARGET_KEY ? reconstruct(parent, TARGET_KEY) : [];
    events.push({
      kind: 'path', type, current,
      frontier: [...frontier].slice(0, 18),
      visited:  [...visited],
      path, line, note,
      status: type === 'path' ? 'Path found' : 'Searching',
      cost:    dist.get(TARGET_KEY) ?? (path.length ? path.length - 1 : null),
      weights: [...cells.values()].filter(c => c.type === 'weight').length
    });
  }

  if (alg === 'bfs') {
    const queue = [START_KEY];
    while (queue.length && events.length < 2500) {
      const cur = queue.shift();
      visited.add(cur);
      snapshot('expand', cur, queue, 2, `Expand ${fmtKey(cur)}; queue has ${queue.length} node${queue.length !== 1 ? 's' : ''}.`);
      if (cur === TARGET_KEY) { found = true; break; }
      for (const nb of neighbors(cur)) {
        if (!seen.has(nb)) {
          seen.add(nb); parent.set(nb, cur); queue.push(nb);
          snapshot('frontier', nb, queue, 4, `Enqueue ${fmtKey(nb)}.`);
        }
      }
    }
  }

  if (alg === 'dfs') {
    const stack = [START_KEY];
    while (stack.length && events.length < 2500) {
      const cur = stack.pop();
      visited.add(cur);
      snapshot('expand', cur, stack, 2, `Visit ${fmtKey(cur)}; stack depth is ${stack.length}.`);
      if (cur === TARGET_KEY) { found = true; break; }
      for (const nb of neighbors(cur).reverse()) {
        if (!seen.has(nb)) {
          seen.add(nb); parent.set(nb, cur); stack.push(nb);
          snapshot('frontier', nb, stack, 4, `Push ${fmtKey(nb)} onto stack.`);
        }
      }
    }
  }

  if (alg === 'dijkstra' || alg === 'astar') {
    const open   = new Set([START_KEY]);
    const dist   = new Map([[START_KEY, 0]]);
    const closed = new Set();
    while (open.size && events.length < 2500) {
      let cur = null, best = Infinity;
      for (const item of open) {
        const score = (dist.get(item) ?? Infinity) + (alg === 'astar' ? manhattan(item, TARGET_KEY) : 0);
        if (score < best) { best = score; cur = item; }
      }
      open.delete(cur); closed.add(cur); visited.add(cur);
      const label = alg === 'astar' ? 'A*' : 'Dijkstra';
      snapshot('expand', cur, [...open], 2, `${label} picks ${fmtKey(cur)} — score ${best}.`, dist);
      if (cur === TARGET_KEY) { found = true; break; }
      for (const nb of neighbors(cur)) {
        const next = (dist.get(cur) ?? 0) + cellWeight(nb);
        if (next < (dist.get(nb) ?? Infinity)) {
          dist.set(nb, next); parent.set(nb, cur); open.add(nb);
          snapshot('frontier', nb, [...open], 4, `Relax ${fmtKey(nb)}; best cost now ${next}.`, dist);
        }
      }
    }
  }

  const path = found ? reconstruct(parent, TARGET_KEY) : [];
  path.forEach((k, i) =>
    events.push({
      kind: 'path', type: 'path', current: k,
      frontier: [], visited: [...visited], path: path.slice(0, i + 1),
      line: 5, note: `Path step ${i + 1} of ${path.length}: ${fmtKey(k)}.`,
      status: 'Path found',
      cost: path.length - 1,
      weights: [...cells.values()].filter(c => c.type === 'weight').length
    })
  );

  if (!events.length) events.push(blankEvent('No trace generated.'));
  if (!found) {
    events.push({ ...events[events.length - 1], status: 'No path found', note: 'Search exhausted — no path to target exists.' });
  }

  return events.map((ev, i) => ({ ...ev, step: i }));
}

/* ─── Sort trace generator ───────────────────────────────────── */
function makeSortTrace() {
  const a = [...sortArray];
  const events = [];
  const counts = { comparisons: 0, swaps: 0 };

  const push = (type, note, active = {}) => {
    events.push({
      kind: 'sort', type, array: [...a],
      comparisons: counts.comparisons, swaps: counts.swaps,
      line: active.line ?? 0, note,
      status: type === 'done' ? 'Sorted' : 'Sorting',
      ...active
    });
  };

  if (sortAlg === 'insertion') {
    for (let i = 1; i < a.length; i++) {
      const kv = a[i];
      let j = i - 1;
      push('key', `Take value ${kv} from index ${i}.`, { compare: [i], line: 0 });
      while (j >= 0 && a[j] > kv) {
        counts.comparisons++;
        push('compare', `Compare ${a[j]} > ${kv}; shift right.`, { compare: [j, j + 1], line: 2 });
        a[j + 1] = a[j]; counts.swaps++;
        push('shift', `Shift ${a[j + 1]} right to index ${j + 1}.`, { swap: [j, j + 1], line: 2 });
        j--;
      }
      a[j + 1] = kv;
      push('insert', `Insert ${kv} at index ${j + 1}.`, { compare: [j + 1], sorted: range(0, i), line: 3 });
    }
  }

  if (sortAlg === 'selection') {
    for (let i = 0; i < a.length - 1; i++) {
      let min = i;
      for (let j = i + 1; j < a.length; j++) {
        counts.comparisons++;
        push('compare', `Scan index ${j} — current min index is ${min}.`, { compare: [min, j], line: 1, sorted: range(0, i - 1) });
        if (a[j] < a[min]) min = j;
      }
      [a[i], a[min]] = [a[min], a[i]]; counts.swaps++;
      push('swap', `Place minimum (${a[i]}) at index ${i}.`, { swap: [i, min], sorted: range(0, i), line: 3 });
    }
  }

  if (sortAlg === 'bubble') {
    for (let end = a.length - 1; end > 0; end--) {
      for (let i = 0; i < end; i++) {
        counts.comparisons++;
        push('compare', `Compare adjacent indices ${i} and ${i + 1}.`, { compare: [i, i + 1], sorted: range(end + 1, a.length - 1), line: 1 });
        if (a[i] > a[i + 1]) {
          [a[i], a[i + 1]] = [a[i + 1], a[i]]; counts.swaps++;
          push('swap', `Swap: ${a[i]} and ${a[i + 1]} out of order.`, { swap: [i, i + 1], sorted: range(end + 1, a.length - 1), line: 2 });
        }
      }
    }
  }

  if (sortAlg === 'quick') {
    quickTrace(a, 0, a.length - 1, push, counts);
  }

  push('done', `Sorted in ${events.length} steps — ${counts.comparisons} comparisons, ${counts.swaps} swaps.`, { sorted: range(0, a.length - 1), line: 4 });
  return events.map((ev, i) => ({ ...ev, step: i }));
}

/* Quick sort shares makeSortTrace's push + counts so its metrics are real. */
function quickTrace(a, lo, hi, push, counts) {
  if (lo >= hi) return;
  const pivot = a[hi];
  let i = lo;
  push('pivot', `Choose pivot ${pivot} at index ${hi}.`, { pivot: hi, compare: [hi], line: 0 });
  for (let j = lo; j < hi; j++) {
    counts.comparisons++;
    push('compare', `Compare index ${j} (${a[j]}) with pivot ${pivot}.`, { compare: [j, hi], pivot: hi, line: 1 });
    if (a[j] < pivot) {
      [a[i], a[j]] = [a[j], a[i]]; counts.swaps++;
      push('swap', `Move smaller value ${a[i]} left into the partition.`, { swap: [i, j], pivot: hi, line: 2 });
      i++;
    }
  }
  [a[i], a[hi]] = [a[hi], a[i]]; counts.swaps++;
  push('swap', `Place pivot ${a[i]} at index ${i}.`, { swap: [i, hi], pivot: i, line: 3 });
  quickTrace(a, lo, i - 1, push, counts);
  quickTrace(a, i + 1, hi, push, counts);
}

function range(a, b) {
  if (b < a) return [];
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

/* ─── Blank event (no trace yet) ─────────────────────────────── */
function blankEvent(note) {
  return {
    kind: family, type: 'idle', current: null,
    frontier: [], visited: [], path: [],
    line: 0, note, status: 'Idle',
    cost: null, weights: 0, comparisons: 0, swaps: 0,
    compare: [], swap: [], sorted: []
  };
}

/* ─── Trace control ──────────────────────────────────────────── */
function generateTrace() {
  stopPlayback();
  if (family === 'pathfinding')   trace = makePathTrace();
  else if (family === 'sorting')  trace = makeSortTrace();
  else trace = learnAlg === 'regression' ? regressionTrace(dataset) : kmeansTrace(dataset, CLUSTERS_K);
  stepIndex = 0;
  mode = 'run';
  syncModeButtons();
  updateStepControls();
  renderAll();
  toast(`${trace.length} trace events`);
}

function applyStep(index) {
  stepIndex = Math.max(0, Math.min(index, trace.length - 1));
  const ev = trace[stepIndex];
  if (!ev) { renderAll(); return; }

  if (ev.kind === 'path') {
    const map = {};
    ev.visited.forEach(k  => { map[k] = ['visited']; });
    ev.frontier.forEach(k => { map[k] = ['frontier']; });
    ev.path.forEach(k     => { map[k] = ['path']; });
    if (ev.current) map[ev.current] = ['current'];
    renderGrid(map);
  }
  if (ev.kind === 'sort') {
    sortArray = [...ev.array];
    renderBars(ev);
  }
  if (ev.kind === 'learn') {
    drawLearn(ev);
  }

  renderInspector();
  updateStepControls();
}

function updateStepControls() {
  $stepRange.max   = Math.max(0, trace.length - 1);
  $stepRange.value = stepIndex;
  $stepLabel.textContent    = `Step ${trace.length ? stepIndex + 1 : 0} / ${trace.length}`;
  $timelineStatus.textContent = trace[stepIndex]?.status || 'No trace';
  $runButton.textContent = playing ? 'Pause' : 'Run';

  $markers.innerHTML = '';
  const total = trace.length;
  trace.forEach((ev, i) => {
    if (i % Math.ceil(Math.max(1, total / 22)) === 0 || ev.type === 'path' || ev.type === 'done') {
      const m = document.createElement('span');
      m.className = `marker ${ev.type === 'path' || ev.type === 'done' ? 'goal' : ''}`;
      m.style.left  = `${total <= 1 ? 0 : (i / (total - 1)) * 100}%`;
      m.title = ev.note || `Step ${i + 1}`;
      $markers.appendChild(m);
    }
  });
}

function play() {
  if (!trace.length) generateTrace();
  if (playing) { stopPlayback(); return; }
  playing = true;
  $runButton.textContent = 'Pause';
  const speed = Number($speedRange.value);
  const delay = Math.max(36, 310 - speed * 32);
  timer = setInterval(() => {
    if (stepIndex >= trace.length - 1) { stopPlayback(); return; }
    applyStep(stepIndex + 1);
  }, delay);
}

function stopPlayback() {
  playing = false;
  clearInterval(timer);
  timer = null;
  $runButton.textContent = 'Run';
}

/* ─── Inspector ──────────────────────────────────────────────── */
function renderInspector() {
  const ev  = trace[stepIndex] || blankEvent(
    family === 'pathfinding' ? 'Build terrain, then run the trace.'
      : family === 'sorting' ? 'Generate an array, then run the trace.'
      : 'Generate data, then run the trace.'
  );
  const alg = currentAlgorithm();

  /* State panel */
  let metricsHTML;
  if (family === 'pathfinding') {
    metricsHTML = `
      <dl class="metrics">
        <div class="metric"><dt>Visited</dt><dd>${ev.visited?.length ?? 0}</dd></div>
        <div class="metric"><dt>Frontier</dt><dd>${ev.frontier?.length ?? 0}</dd></div>
        <div class="metric"><dt>Cost</dt><dd>${ev.cost ?? '—'}</dd></div>
        <div class="metric"><dt>Weights</dt><dd>${ev.weights ?? 0}</dd></div>
      </dl>`;
  } else if (family === 'sorting') {
    metricsHTML = `
      <dl class="metrics">
        <div class="metric"><dt>Items</dt><dd>${sortArray.length}</dd></div>
        <div class="metric"><dt>Compares</dt><dd>${ev.comparisons ?? 0}</dd></div>
        <div class="metric"><dt>Swaps</dt><dd>${ev.swaps ?? 0}</dd></div>
        <div class="metric"><dt>Step</dt><dd>${trace.length ? stepIndex + 1 : 0}</dd></div>
      </dl>`;
  } else if (learnAlg === 'kmeans') {
    metricsHTML = `
      <dl class="metrics">
        <div class="metric"><dt>Clusters</dt><dd>${ev.k ?? CLUSTERS_K}</dd></div>
        <div class="metric"><dt>Iteration</dt><dd>${ev.iteration ?? 0}</dd></div>
        <div class="metric"><dt>Inertia</dt><dd>${ev.inertia != null ? ev.inertia.toFixed(2) : '—'}</dd></div>
        <div class="metric"><dt>Points</dt><dd>${ev.points?.length ?? dataset.length}</dd></div>
      </dl>`;
  } else {
    metricsHTML = `
      <dl class="metrics">
        <div class="metric"><dt>Iteration</dt><dd>${ev.iteration ?? 0}</dd></div>
        <div class="metric"><dt>MSE</dt><dd>${ev.mse != null ? ev.mse.toFixed(4) : '—'}</dd></div>
        <div class="metric"><dt>slope w</dt><dd>${ev.w != null ? ev.w.toFixed(3) : '—'}</dd></div>
        <div class="metric"><dt>bias b</dt><dd>${ev.b != null ? ev.b.toFixed(3) : '—'}</dd></div>
      </dl>`;
  }

  $statePanel.innerHTML = `
    <div class="state-algo">
      <span class="algo-name">${alg.name}</span>
      <span class="algo-tag">${alg.meta}</span>
    </div>
    <div class="state-note">${ev.note || 'No event selected.'}</div>
    ${metricsHTML}
    <div class="queue-section">
      <div class="queue-label">${queueLabel()}</div>
      <div class="queue-list">${renderQueue(ev)}</div>
    </div>`;

  /* Trace panel */
  $tracePanel.innerHTML = `
    <div class="queue-label">event log</div>
    <div class="log-list">${renderLog()}</div>`;

  /* Pseudocode panel */
  $codePanel.innerHTML = renderCodeBlock(ev.line ?? 0);
}

function queueLabel() {
  if (family === 'pathfinding') return 'frontier queue';
  if (family === 'sorting')     return 'array window';
  return learnAlg === 'kmeans' ? 'centroids' : 'parameters';
}

function renderQueue(ev) {
  if (family === 'pathfinding') {
    if (!ev.frontier?.length) return '<div class="queue-empty">Queue is empty.</div>';
    return ev.frontier.map((k, i) =>
      `<div class="queue-item">${String(i + 1).padStart(2, ' ')}. ${fmtKey(k)}</div>`
    ).join('');
  }
  if (family === 'learning') {
    if (learnAlg === 'kmeans') {
      const cs = ev.centroids || [];
      if (!cs.length) return '<div class="queue-empty">Run to place centroids.</div>';
      return cs.map((c, i) =>
        `<div class="queue-item">c${i + 1} · (${c.x.toFixed(2)}, ${c.y.toFixed(2)})</div>`
      ).join('');
    }
    return `
      <div class="queue-item">w (slope) · ${ev.w != null ? ev.w.toFixed(3) : '—'}</div>
      <div class="queue-item">b (bias)  · ${ev.b != null ? ev.b.toFixed(3) : '—'}</div>
      <div class="queue-item">MSE       · ${ev.mse != null ? ev.mse.toFixed(4) : '—'}</div>`;
  }
  const anchor = ev.compare?.[0] ?? 0;
  const start  = Math.max(0, anchor - 3);
  return sortArray.slice(start, start + 9).map((v, i) =>
    `<div class="queue-item">[${String(start + i).padStart(2, ' ')}] ${v}</div>`
  ).join('');
}

function renderLog() {
  if (!trace.length) return '<div class="log-empty">Run the algorithm to see events.</div>';
  const lo = Math.max(0, stepIndex - 8);
  const hi = Math.min(trace.length, stepIndex + 9);
  return trace.slice(lo, hi).map(ev => `
    <div class="log-row ${ev.step === stepIndex ? 'is-now' : ''}">
      <span class="log-num">${String(ev.step + 1).padStart(3, '0')}</span>
      <span class="log-note">${ev.note}</span>
      <button class="log-goto" data-step="${ev.step}" aria-label="Jump to step ${ev.step + 1}">↑</button>
    </div>`
  ).join('');
}

function renderCodeBlock(activeLine) {
  const lines = pseudocode[activeAlgId()] || [];
  const rows  = lines.map((text, i) => `
    <div class="code-line ${i === activeLine ? 'is-active' : ''}">
      <span class="code-line-num">${i + 1}</span>
      <span class="code-line-text">${text}</span>
    </div>`
  ).join('');
  return `<div class="code-block">${rows}</div>`;
}

/* ─── Tool rail ──────────────────────────────────────────────── */
function renderTools() {
  const config = {
    pathfinding: {
      build:   [['wall','Wall · W'], ['weight','Weight · G'], ['erase','Erase · E'], 'sep', ['preset','Load preset'], ['clear','Clear grid']],
      run:     [['inspect','Inspect'], ['save','Save run'], ['clear','Clear trace']],
      analyze: [['compare','Compare'], ['inspect','Inspect'], ['save','Save run']],
      library: [['library','Saved'], ['preset','Presets'], ['save','Import/Export']]
    },
    sorting: {
      build:   [['array','Random'], ['nearly','Nearly sorted'], ['reverse','Reversed'], 'sep', ['clear','Reset']],
      run:     [['inspect','Inspect'], ['save','Save run']],
      analyze: [['compare','Compare'], ['inspect','Trace'], ['save','Save run']],
      library: [['library','Saved'], ['preset','Presets'], ['save','Import/Export']]
    },
    learning: {
      build:   [['array','New data'], ['shuffle','Reseed'], 'sep', ['clear','Reset']],
      run:     [['inspect','Inspect'], ['save','Save run']],
      analyze: [['compare','Compare'], ['inspect','Trace'], ['save','Save run']],
      library: [['library','Saved'], ['preset','Presets'], ['save','Import/Export']]
    }
  }[family][mode];

  $toolRail.innerHTML = '';
  config.forEach(item => {
    if (item === 'sep') {
      const sep = document.createElement('div');
      sep.className = 'tool-sep';
      $toolRail.appendChild(sep);
      return;
    }
    const [id, label] = item;
    const btn = document.createElement('button');
    btn.className = `tool-btn ${tool === id ? 'is-active' : ''}`;
    btn.setAttribute('aria-label', label);
    btn.innerHTML = `${TOOL_ICONS[id] || '·'}<span class="tool-tip">${label}</span>`;
    btn.addEventListener('click', () => handleTool(id));
    $toolRail.appendChild(btn);
  });
}

function handleTool(id) {
  if (['wall', 'weight', 'erase'].includes(id)) tool = id;
  if (id === 'clear') {
    if (family === 'pathfinding') clearGrid();
    else if (family === 'learning') makeDataset();
    else makeArray('random');
  }
  if (id === 'array')   family === 'learning' ? makeDataset() : makeArray('random');
  if (id === 'shuffle') makeDataset();
  if (id === 'nearly')  makeArray('nearly');
  if (id === 'reverse') makeArray('reverse');
  if (id === 'preset')  loadPreset(presets.find(p => p.family === family));
  if (id === 'save')    saveRun();
  renderAll();
}

/* ─── Workspace action buttons ────────────────────────────────── */
function renderActions() {
  $wsActions.innerHTML = '';
  const btn = (label, fn, cls = '') => {
    const b = document.createElement('button');
    b.textContent = label;
    if (cls) b.className = cls;
    b.addEventListener('click', fn);
    $wsActions.appendChild(b);
  };
  if (mode === 'build') {
    if (family === 'pathfinding') {
      btn('Run trace', generateTrace, 'primary-action');
      btn('Weighted corridor', () => loadPreset(presets[0]));
      btn('Clear', clearGrid);
    } else if (family === 'sorting') {
      btn('Run sort', generateTrace, 'primary-action');
      btn('Random', () => { makeArray('random'); renderAll(); });
      btn('Nearly sorted', () => { makeArray('nearly'); renderAll(); });
      btn('Reversed', () => { makeArray('reverse'); renderAll(); });
    } else {
      btn(learnAlg === 'regression' ? 'Run descent' : 'Run k-means', generateTrace, 'primary-action');
      btn('New data', () => { makeDataset(); renderAll(); });
    }
  }
  if (mode === 'run') {
    btn(playing ? 'Pause' : 'Run', play, 'primary-action');
    btn('Step', () => applyStep(stepIndex + 1));
    btn('Restart', () => applyStep(0));
  }
  if (mode === 'analyze') {
    btn('Save run', saveRun, 'primary-action');
    btn('Export JSON', exportState);
  }
  if (mode === 'library') {
    btn('Import JSON', () => $importFile.click(), 'primary-action');
    btn('Export JSON', exportState);
  }
}

/* ─── Legend ─────────────────────────────────────────────────── */
function renderLegend() {
  if (mode === 'library') { $legend.innerHTML = ''; return; }
  let items;
  if (family === 'pathfinding') {
    items = [
      ['var(--grn)',          'Start'],
      ['var(--ros)',          'Target'],
      ['var(--cell-visited)', 'Visited'],
      ['var(--cell-frontier)','Frontier'],
      ['var(--cell-current)', 'Current'],
      ['var(--cell-path)',    'Path']
    ];
  } else if (family === 'sorting') {
    items = [
      ['var(--blu)', 'Value'],
      ['var(--amb)', 'Compare'],
      ['var(--ros)', 'Swap'],
      ['var(--grn)', 'Sorted']
    ];
  } else if (learnAlg === 'kmeans') {
    items = [
      [CLUSTER_COLORS[0], 'Cluster 1'],
      [CLUSTER_COLORS[1], 'Cluster 2'],
      [CLUSTER_COLORS[2], 'Cluster 3'],
      ['var(--t1)',       'Centroid']
    ];
  } else {
    items = [
      ['var(--blu)', 'Data point'],
      ['var(--amb)', 'Fitted line']
    ];
  }
  $legend.innerHTML = items.map(([color, label]) =>
    `<span class="legend-item">
      <i class="legend-dot" style="background:${color}"></i>${label}
    </span>`
  ).join('');
}

/* ─── Algorithm picker ───────────────────────────────────────── */
function renderCombo() {
  const alg = currentAlgorithm();
  $comboName.textContent = alg.name;
  $comboMeta.textContent = alg.meta;
  $comboList.innerHTML = algorithms[family].map(a => `
    <button class="picker-option ${a.id === alg.id ? 'is-selected' : ''}" data-id="${a.id}">
      <span>
        <strong>${a.name}</strong>
        <p>${a.detail}</p>
      </span>
      <em>${a.meta}</em>
    </button>`
  ).join('');
  $comboList.querySelectorAll('.picker-option').forEach(btn =>
    btn.addEventListener('click', () => {
      if (family === 'pathfinding') pathAlg = btn.dataset.id;
      else sortAlg = btn.dataset.id;
      $comboList.classList.remove('is-open');
      $comboButton.setAttribute('aria-expanded', 'false');
      markDirty('Algorithm changed');
      renderAll();
    })
  );
}

/* ─── Library stage ──────────────────────────────────────────── */
function renderLibrary() {
  const saved = savedRuns.map(run => ({
    title: run.name,
    family: run.family,
    tags: [run.algorithm, `${run.traceLength} steps`],
    difficulty: 'saved',
    description: `Saved at ${run.savedAt}.`,
    isSaved: true
  }));
  const items = [...saved, ...presets];
  $libraryStage.innerHTML = `
    <div class="library-grid">
      ${items.map((item, i) => scenarioCard(item, i)).join('')}
    </div>`;
  $libraryStage.querySelectorAll('.card-load').forEach(btn =>
    btn.addEventListener('click', () => loadPreset(items[Number(btn.dataset.index)]))
  );
}

function scenarioCard(item, i) {
  const dots = Array.from({ length: 40 }, (_, d) => {
    const cls = d % 11 === 0 ? 'wall' : d % 17 === 0 ? 'path' : d % 7 === 0 ? 'frontier' : d === 12 ? 'current' : '';
    return `<i class="preview-dot ${cls}"></i>`;
  }).join('');
  const tags = (item.tags || []).map(t => `<span class="card-tag">${t}</span>`).join('');
  return `
    <article class="scenario-card">
      <div class="scenario-preview">${dots}</div>
      <div>
        <h3>${item.title}</h3>
        <p>${item.description}</p>
      </div>
      <div class="card-meta">
        <span class="card-tag">${item.family}</span>
        <span class="card-tag">${item.difficulty}</span>
        ${tags}
      </div>
      <button class="card-load" data-index="${i}">Load scenario</button>
    </article>`;
}

/* ─── Preset loading ─────────────────────────────────────────── */
function loadPreset(preset) {
  if (!preset) return;
  family = preset.family;
  mode   = 'build';
  if (family === 'pathfinding') {
    clearGrid(false);
    for (let c = 8; c < 26; c++) if (c !== 17) cells.set(key(6, c),  { type: 'wall' });
    for (let c = 5; c < 22; c++) if (c !== 11) cells.set(key(14, c), { type: 'wall' });
    if (preset.title.includes('Weighted')) {
      for (let c = 12; c < 26; c++) cells.set(key(11, c), { type: 'weight' });
    }
  } else if (family === 'sorting') {
    preset.title.includes('Nearly') ? makeArray('nearly') : makeArray('reverse');
  } else {
    learnAlg = preset.title.includes('line') ? 'regression' : 'kmeans';
    makeDataset();
  }
  trace = []; stepIndex = 0;
  markDirty(`${preset.title} loaded`);
  renderAll();
}

function clearGrid(doRender = true) {
  initializeGrid();
  trace = []; stepIndex = 0;
  markDirty('Grid reset');
  if (doRender) renderAll();
}

/* ─── Save / load / export ───────────────────────────────────── */
function saveRun() {
  const alg = activeAlgId();
  const run = {
    name: `${family} · ${alg}`,
    family, algorithm: alg,
    traceLength: trace.length,
    savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    state: serialize()
  };
  savedRuns.unshift(run);
  savedRuns = savedRuns.slice(0, 12);
  localStorage.setItem('algorithm-cockpit-runs', JSON.stringify(savedRuns));
  dirty = false;
  $saveState.classList.add('is-saved');
  $saveState.querySelector('.save-label').textContent = 'Saved';
  toast('Run saved locally');
  renderAll();
}

function loadSaved() {
  try { return JSON.parse(localStorage.getItem('algorithm-cockpit-runs') || '[]'); }
  catch { return []; }
}

function serialize() {
  return { family, mode, pathAlg, sortAlg, learnAlg, cells: [...cells.entries()], sortArray, dataset, trace, stepIndex };
}

function hydrate(data) {
  family    = data.family    || 'pathfinding';
  mode      = data.mode      || 'build';
  pathAlg   = data.pathAlg   || data.pathAlgorithm || 'bfs';
  sortAlg   = data.sortAlg   || data.sortAlgorithm  || 'insertion';
  learnAlg  = data.learnAlg  || 'kmeans';
  cells     = new Map(data.cells || []);
  sortArray = data.sortArray || sortArray;
  dataset   = data.dataset   || dataset;
  trace     = data.trace     || [];
  stepIndex = data.stepIndex || 0;
  renderAll();
}

function exportState() {
  const blob = new Blob([JSON.stringify(serialize(), null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `algorithm-cockpit-${Date.now()}.json`;
  link.click();
  toast('Exported as JSON');
}

/* ─── Command palette ────────────────────────────────────────── */
function openPalette() {
  $palette.classList.add('is-open');
  $paletteBack.classList.add('is-open');
  $cmdInput.value = '';
  renderCommands('');
  $cmdInput.focus();
}

function closePalette() {
  $palette.classList.remove('is-open');
  $paletteBack.classList.remove('is-open');
}

function switchFamily(next) { closePalette(); trace = []; stepIndex = 0; family = next; mode = 'build'; renderAll(); }

function renderCommands(query) {
  paletteCommands = [
    { name: 'Run selected algorithm',  desc: 'Generate and play a trace',          fn: () => { closePalette(); generateTrace(); play(); },                          key: 'Space' },
    { name: 'Step forward',            desc: 'Advance one trace event',             fn: () => { closePalette(); if (!trace.length) generateTrace(); applyStep(stepIndex + 1); }, key: '→' },
    { name: 'Load weighted corridor',  desc: 'Pathfinding preset for Dijkstra/A*', fn: () => { closePalette(); loadPreset(presets[0]); },                            key: '' },
    { name: 'Switch to pathfinding',   desc: 'Open the grid view',                  fn: () => switchFamily('pathfinding'),                                            key: '' },
    { name: 'Switch to sorting',       desc: 'Open the sorting view',               fn: () => switchFamily('sorting'),                                                key: '' },
    { name: 'Switch to learning',      desc: 'Open the ML view (k-means · GD)',     fn: () => switchFamily('learning'),                                               key: '' },
    { name: 'Save run',                desc: 'Store current state locally',         fn: () => { closePalette(); saveRun(); },                                          key: '' },
    { name: 'Export JSON',             desc: 'Download scenario and trace',         fn: () => { closePalette(); exportState(); },                                      key: '' }
  ].filter(c => `${c.name} ${c.desc}`.toLowerCase().includes(query.toLowerCase()));
  paletteIndex = 0;
  paintCommands();
}

function paintCommands() {
  $paletteResults.innerHTML = paletteCommands.map((c, i) => `
    <button class="cmd-row ${i === paletteIndex ? 'is-active' : ''}" data-index="${i}">
      <span>
        <strong>${c.name}</strong>
        <p>${c.desc}</p>
      </span>
      ${c.key ? `<kbd>${c.key}</kbd>` : ''}
    </button>`
  ).join('') || '<div class="log-empty" style="padding:12px">No matching commands.</div>';

  $paletteResults.querySelectorAll('.cmd-row').forEach(btn =>
    btn.addEventListener('click', () => paletteCommands[Number(btn.dataset.index)]?.fn())
  );
}

function movePalette(delta) {
  if (!paletteCommands.length) return;
  paletteIndex = (paletteIndex + delta + paletteCommands.length) % paletteCommands.length;
  paintCommands();
  $paletteResults.querySelector('.cmd-row.is-active')?.scrollIntoView({ block: 'nearest' });
}

/* ─── Toast ──────────────────────────────────────────────────── */
function toast(msg) {
  clearTimeout(toastTimer);
  $toast.textContent = msg;
  $toast.classList.add('is-open');
  toastTimer = setTimeout(() => $toast.classList.remove('is-open'), 2000);
}

/* ─── Canvas status copy ─────────────────────────────────────── */
function statusCopy() {
  if (mode === 'build') {
    if (family === 'pathfinding') return 'Paint walls and weights — Space to run.';
    if (family === 'sorting')     return 'Generate an array — Space to run.';
    return learnAlg === 'regression' ? 'Generate data — Space to fit a line.' : 'Generate data — Space to cluster.';
  }
  if (mode === 'run')     return 'Run, step, or scrub the trace.';
  if (mode === 'analyze') return 'Inspect events, pseudocode, and metrics.';
  return 'Load a preset or saved run.';
}

/* ─── Sync tab buttons ───────────────────────────────────────── */
function syncModeButtons() {
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('is-active', b.dataset.mode === mode));
}
function syncFamilyButtons() {
  document.querySelectorAll('.family-btn').forEach(b => b.classList.toggle('is-active', b.dataset.family === family));
}

/* ─── Master render ──────────────────────────────────────────── */
function renderAll() {
  $app.dataset.family = family;
  $app.dataset.mode   = mode;
  syncModeButtons();
  syncFamilyButtons();
  renderTools();
  renderActions();
  renderCombo();
  renderLegend();
  $canvasStatus.textContent = statusCopy();

  const showGrid  = family === 'pathfinding' && mode !== 'library';
  const showSort  = family === 'sorting'     && mode !== 'library';
  const showLearn = family === 'learning'    && mode !== 'library';
  const showLib   = mode === 'library';
  $gridStage.classList.toggle('is-hidden', !showGrid);
  $sortStage.classList.toggle('is-hidden', !showSort);
  $learnStage.classList.toggle('is-hidden', !showLearn);
  $libraryStage.classList.toggle('is-hidden', !showLib);

  if (showLib) {
    renderLibrary();
  } else if (showGrid) {
    if (trace.length) applyStep(stepIndex);
    else renderGrid();
  } else if (showSort) {
    if (trace.length) applyStep(stepIndex);
    else renderBars({});
  } else if (showLearn) {
    if (trace.length) applyStep(stepIndex);           /* refreshes canvas + inspector */
    else requestAnimationFrame(() => drawLearn(currentLearnFrame()));
  }

  if (!trace.length) renderInspector();
  updateStepControls();
}

/* ─── Event listeners ────────────────────────────────────────── */
$comboButton.addEventListener('click', () => {
  const open = !$comboList.classList.contains('is-open');
  $comboList.classList.toggle('is-open', open);
  $comboButton.setAttribute('aria-expanded', String(open));
});
document.addEventListener('click', ev => {
  if (!ev.target.closest('#algorithmCombo')) {
    $comboList.classList.remove('is-open');
    $comboButton.setAttribute('aria-expanded', 'false');
  }
});

document.querySelectorAll('.mode-btn').forEach(btn =>
  btn.addEventListener('click', () => { mode = btn.dataset.mode; renderAll(); })
);
document.querySelectorAll('.family-btn').forEach(btn =>
  btn.addEventListener('click', () => {
    /* Reset stale trace when switching family — path trace in sort view is meaningless */
    if (btn.dataset.family !== family) { trace = []; stepIndex = 0; }
    family = btn.dataset.family; mode = 'build'; renderAll();
  })
);
document.querySelectorAll('.inspector-tab').forEach(btn =>
  btn.addEventListener('click', () => {
    activePanel = btn.dataset.panel;
    document.querySelectorAll('.inspector-tab').forEach(t => {
      t.classList.toggle('is-active', t === btn);
      t.setAttribute('aria-selected', String(t === btn));
    });
    [$statePanel, $tracePanel, $codePanel].forEach(p => p.classList.add('is-hidden'));
    document.getElementById(`${activePanel}Panel`).classList.remove('is-hidden');
  })
);

$runButton.addEventListener('click', play);
$stepButton.addEventListener('click', () => { if (!trace.length) generateTrace(); applyStep(stepIndex + 1); });
$backButton.addEventListener('click', () => applyStep(stepIndex - 1));
$resetButton.addEventListener('click', () => applyStep(0));

/* Suppress cell transitions while scrubbing */
$stepRange.addEventListener('mousedown',  () => $gridStage.classList.add('no-anim'));
$stepRange.addEventListener('touchstart', () => $gridStage.classList.add('no-anim'));
$stepRange.addEventListener('mouseup',    () => $gridStage.classList.remove('no-anim'));
$stepRange.addEventListener('touchend',   () => $gridStage.classList.remove('no-anim'));
$stepRange.addEventListener('input',      () => applyStep(Number($stepRange.value)));

$cmdTrigger.addEventListener('click', openPalette);
$paletteBack.addEventListener('click', closePalette);
$cmdInput.addEventListener('input', () => renderCommands($cmdInput.value));
$cmdInput.addEventListener('keydown', ev => {
  if (ev.key === 'ArrowDown') { ev.preventDefault(); movePalette(1); }
  else if (ev.key === 'ArrowUp') { ev.preventDefault(); movePalette(-1); }
  else if (ev.key === 'Enter') { ev.preventDefault(); paletteCommands[paletteIndex]?.fn(); }
});
$exportBtn.addEventListener('click', exportState);
$importBtn.addEventListener('click', () => $importFile.click());
$importFile.addEventListener('change', async () => {
  const file = $importFile.files[0];
  if (!file) return;
  try {
    hydrate(JSON.parse(await file.text()));
    toast('Import loaded');
  } catch {
    toast('Import failed — invalid JSON');
  }
  $importFile.value = '';
});

/* Click-to-jump in trace log */
$tracePanel.addEventListener('click', ev => {
  const btn = ev.target.closest('.log-goto');
  if (btn) applyStep(Number(btn.dataset.step));
});

/* Keyboard shortcuts */
document.addEventListener('keydown', ev => {
  const inInput = ev.target.matches('input, textarea');
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); openPalette(); return; }
  if (ev.key === 'Escape') { closePalette(); return; }
  if (inInput) return;
  if (ev.code === 'Space') { ev.preventDefault(); play(); return; }
  if (ev.key === 'ArrowRight') { ev.preventDefault(); if (!trace.length) generateTrace(); applyStep(stepIndex + 1); return; }
  if (ev.key === 'ArrowLeft')  { ev.preventDefault(); applyStep(stepIndex - 1); return; }
  if (ev.key.toLowerCase() === 'w') { tool = 'wall';   renderTools(); return; }
  if (ev.key.toLowerCase() === 'g') { tool = 'weight'; renderTools(); return; }
  if (ev.key.toLowerCase() === 'e') { tool = 'erase';  renderTools(); return; }
});

/* Deep-link support — popup/side-panel link to index.html#run, #library, etc. */
function applyHash() {
  const h = location.hash.replace('#', '').toLowerCase();
  if (!h) return;
  if (['build', 'run', 'analyze', 'library'].includes(h)) mode = h;
  else if (['pathfinding', 'sorting', 'learning'].includes(h)) { family = h; mode = 'build'; }
  renderAll();
}
window.addEventListener('hashchange', applyHash);

/* Canvas has no intrinsic size — redraw the learning plot on resize. */
window.addEventListener('resize', () => {
  if (family === 'learning' && mode !== 'library') {
    drawLearn(trace.length ? trace[stepIndex] : currentLearnFrame());
  }
});

/* ─── Init ───────────────────────────────────────────────────── */
initializeGrid();
buildGrid();
makeArray('random');
buildBars();
makeDataset();
renderAll();
applyHash();
