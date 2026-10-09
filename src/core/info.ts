import type { CodeLine, Complexity, Family } from "./types";

export type AlgoId =
  | "bfs"
  | "dfs"
  | "dijkstra"
  | "astar"
  | "greedy"
  | "insertion"
  | "selection"
  | "bubble"
  | "quick"
  | "merge"
  | "heap"
  | "linear"
  | "binary"
  | "jump"
  | "prim"
  | "kruskal"
  | "kmeans"
  | "gradient";

export interface AlgoInfo {
  id: AlgoId;
  family: Family;
  name: string;
  short: string;
  aliases: string[];
  summary: string;
  how: string[];
  watch: string;
  complexity: Complexity;
  props: { label: string; value: boolean }[];
  code: CodeLine[];
}

export const FAMILIES: { id: Family; name: string; blurb: string }[] = [
  { id: "grid", name: "Pathfinding", blurb: "Search a grid for the cheapest route." },
  { id: "sort", name: "Sorting", blurb: "Order an array by comparing and moving values." },
  { id: "search", name: "Searching", blurb: "Find a value in a sorted array." },
  { id: "graph", name: "Spanning trees", blurb: "Connect every node with the least total weight." },
  { id: "learn", name: "Learning", blurb: "Fit a model to data one update at a time." },
];

const L = (text: string, op?: string, depth = 0): CodeLine => ({ text, op, depth });

export const ALGOS: AlgoInfo[] = [
  {
    id: "bfs",
    family: "grid",
    name: "Breadth-first search",
    short: "BFS",
    aliases: ["bfs", "breadth first", "queue", "level order"],
    summary:
      "Expands cells in the order they were discovered, so it grows in rings around the start.",
    how: [
      "A FIFO queue holds discovered cells that have not been expanded.",
      "A cell is marked discovered the moment it is queued, so nothing is queued twice.",
      "The first time the target leaves the queue, the path has the fewest moves.",
    ],
    watch: "BFS counts moves, not cost. On weighted terrain its path can be expensive.",
    complexity: { best: "O(1)", average: "O(V + E)", worst: "O(V + E)", space: "O(V)" },
    props: [
      { label: "Optimal for move count", value: true },
      { label: "Uses weights", value: false },
      { label: "Complete", value: true },
    ],
    code: [
      L("queue ← [start]; discovered ← {start}", "init"),
      L("while queue is not empty:"),
      L("cur ← queue.dequeue()", "dequeue", 1),
      L("if cur = target: return path(cur)", "found", 1),
      L("for each neighbor n of cur:", undefined, 1),
      L("if n not in discovered:", undefined, 2),
      L("discovered.add(n); parent[n] ← cur", undefined, 3),
      L("queue.enqueue(n)", "enqueue", 3),
      L('return "no path"', "nopath"),
    ],
  },
  {
    id: "dfs",
    family: "grid",
    name: "Depth-first search",
    short: "DFS",
    aliases: ["dfs", "depth first", "stack", "backtracking"],
    summary: "Follows one corridor as far as it goes before backing up to the last branch.",
    how: [
      "A LIFO stack holds cells to try next; the newest push is explored first.",
      "A cell can sit on the stack several times; only its first pop counts.",
      "The path it returns is whatever branch reached the target first.",
    ],
    watch: "DFS finds a path, rarely the shortest one. Compare it with BFS in a maze.",
    complexity: { best: "O(1)", average: "O(V + E)", worst: "O(V + E)", space: "O(V)" },
    props: [
      { label: "Optimal", value: false },
      { label: "Uses weights", value: false },
      { label: "Complete on finite grids", value: true },
    ],
    code: [
      L("stack ← [start]", "init"),
      L("while stack is not empty:"),
      L("cur ← stack.pop()", undefined, 1),
      L("if cur is visited: continue", "skip", 1),
      L("mark cur visited; parent[cur] ← from", "visit", 1),
      L("if cur = target: return path(cur)", "found", 1),
      L("for each neighbor n of cur:", undefined, 1),
      L("if n not visited: stack.push(n)", "push", 2),
      L('return "no path"', "nopath"),
    ],
  },
  {
    id: "dijkstra",
    family: "grid",
    name: "Dijkstra's algorithm",
    short: "Dijkstra",
    aliases: ["dijkstra", "shortest path", "uniform cost", "ucs", "priority queue"],
    summary: "Always settles the cheapest unsettled cell, so every settled distance is final.",
    how: [
      "A binary min-heap orders the frontier by distance from the start.",
      "Finding a cheaper route to a cell pushes a new heap entry; the old one goes stale.",
      "Stale entries are skipped when they surface. This is lazy deletion.",
    ],
    watch: "On weighted terrain, compare its path cost with BFS on the same grid.",
    complexity: {
      best: "O(1)",
      average: "O(E log V)",
      worst: "O(E log V)",
      space: "O(V)",
      note: "Binary heap with lazy deletion",
    },
    props: [
      { label: "Optimal", value: true },
      { label: "Uses weights", value: true },
      { label: "Guided toward target", value: false },
    ],
    code: [
      L("dist[start] ← 0; pq.push(start, 0)", "init"),
      L("while pq is not empty:"),
      L("cur ← pq.extractMin()", undefined, 1),
      L("if cur is settled: continue  # stale entry", "skip", 1),
      L("settle cur", "settle", 1),
      L("if cur = target: return path(cur)", "found", 1),
      L("for each neighbor n of cur:", undefined, 1),
      L("alt ← dist[cur] + cost(n)", undefined, 2),
      L("if alt < dist[n]:", undefined, 2),
      L("dist[n] ← alt; parent[n] ← cur", undefined, 3),
      L("pq.push(n, alt)", "relax", 3),
      L('return "no path"', "nopath"),
    ],
  },
  {
    id: "astar",
    family: "grid",
    name: "A* search",
    short: "A*",
    aliases: ["astar", "a star", "a*", "heuristic", "informed search"],
    summary:
      "Dijkstra plus a guess of the remaining distance, which steers the search toward the target.",
    how: [
      "Each cell is ranked by f = g + h: cost so far plus estimated cost to go.",
      "Ties go to the cell with the smaller h, which keeps the search pointed at the goal.",
      "With an admissible heuristic (never overestimates) the path is optimal.",
    ],
    watch: "Raise the heuristic weight above 1: fewer cells expanded, but the path can get worse.",
    complexity: {
      best: "O(d)",
      average: "O(E log V)",
      worst: "O(E log V)",
      space: "O(V)",
      note: "Depends heavily on heuristic quality",
    },
    props: [
      { label: "Optimal (weight 1, admissible h)", value: true },
      { label: "Uses weights", value: true },
      { label: "Guided toward target", value: true },
    ],
    code: [
      L("g[start] ← 0; open.push(start, h(start))", "init"),
      L("while open is not empty:"),
      L("cur ← open.extractMin()  # lowest f = g + w·h", undefined, 1),
      L("if cur is closed: continue  # stale entry", "skip", 1),
      L("close cur", "close", 1),
      L("if cur = target: return path(cur)", "found", 1),
      L("for each neighbor n of cur:", undefined, 1),
      L("tentative ← g[cur] + cost(n)", undefined, 2),
      L("if tentative < g[n]:", undefined, 2),
      L("g[n] ← tentative; parent[n] ← cur", undefined, 3),
      L("open.push(n, g[n] + w·h(n))", "relax", 3),
      L('return "no path"', "nopath"),
    ],
  },
  {
    id: "greedy",
    family: "grid",
    name: "Greedy best-first search",
    short: "Greedy",
    aliases: ["greedy", "best first", "gbfs", "heuristic only"],
    summary: "Ranks cells by the heuristic alone and ignores the cost already paid.",
    how: [
      "The open set is ordered by h only, so it charges straight at the target.",
      "A cell is never revisited once seen, even if a cheaper route appears.",
      "Fast on open ground, easily fooled by obstacles that face the start.",
    ],
    watch: "Load the heuristic trap and compare it with A*.",
    complexity: { best: "O(d)", average: "O(E log V)", worst: "O(E log V)", space: "O(V)" },
    props: [
      { label: "Optimal", value: false },
      { label: "Uses weights", value: false },
      { label: "Guided toward target", value: true },
    ],
    code: [
      L("open.push(start, h(start)); seen ← {start}", "init"),
      L("while open is not empty:"),
      L("cur ← open.extractMin()  # lowest h only", undefined, 1),
      L("close cur", "close", 1),
      L("if cur = target: return path(cur)", "found", 1),
      L("for each neighbor n of cur:", undefined, 1),
      L("if n not in seen:", undefined, 2),
      L("seen.add(n); parent[n] ← cur", undefined, 3),
      L("open.push(n, h(n))", "push", 3),
      L('return "no path"', "nopath"),
    ],
  },
  {
    id: "insertion",
    family: "sort",
    name: "Insertion sort",
    short: "Insertion",
    aliases: ["insertion", "insert"],
    summary: "Grows a sorted prefix by sliding each new value left until it fits.",
    how: [
      "Everything left of i is already sorted.",
      "The new value swaps left past every larger neighbor.",
      "On nearly sorted input almost nothing moves, so it runs in close to linear time.",
    ],
    watch: "Try the nearly sorted preset against merge sort: insertion makes fewer comparisons.",
    complexity: { best: "O(n)", average: "O(n²)", worst: "O(n²)", space: "O(1)" },
    props: [
      { label: "Stable", value: true },
      { label: "In place", value: true },
      { label: "Adaptive", value: true },
    ],
    code: [
      L("for i in 1 .. n-1:", "outer"),
      L("j ← i", undefined, 1),
      L("while j > 0 and a[j-1] > a[j]:", "compare", 1),
      L("swap(a[j-1], a[j])", "swap", 2),
      L("j ← j - 1", undefined, 2),
      L("a[0 .. i] is sorted", "sorted", 1),
    ],
  },
  {
    id: "selection",
    family: "sort",
    name: "Selection sort",
    short: "Selection",
    aliases: ["selection", "select min"],
    summary: "Scans the unsorted part for its minimum and moves it to the front.",
    how: [
      "Pass i finds the smallest value in a[i..n-1].",
      "At most one swap per pass, but always n(n−1)/2 comparisons.",
      "Input order does not change the number of comparisons.",
    ],
    watch: "Count comparisons on sorted input: it does the same work as on random input.",
    complexity: { best: "O(n²)", average: "O(n²)", worst: "O(n²)", space: "O(1)" },
    props: [
      { label: "Stable", value: false },
      { label: "In place", value: true },
      { label: "Adaptive", value: false },
    ],
    code: [
      L("for i in 0 .. n-2:", "outer"),
      L("min ← i", undefined, 1),
      L("for j in i+1 .. n-1:", undefined, 1),
      L("if a[j] < a[min]: min ← j", "compare", 2),
      L("swap(a[i], a[min])", "swap", 1),
      L("a[i] is in its final place", "sorted", 1),
    ],
  },
  {
    id: "bubble",
    family: "sort",
    name: "Bubble sort",
    short: "Bubble",
    aliases: ["bubble", "sinking"],
    summary: "Sweeps the array swapping adjacent pairs, carrying the largest value to the end.",
    how: [
      "Each pass bubbles the largest remaining value into place.",
      "If a pass makes no swaps, the array is sorted and it stops early.",
      "Values far from their final position take many passes to arrive.",
    ],
    watch: "Sorted input finishes after a single pass thanks to the early exit.",
    complexity: { best: "O(n)", average: "O(n²)", worst: "O(n²)", space: "O(1)" },
    props: [
      { label: "Stable", value: true },
      { label: "In place", value: true },
      { label: "Adaptive", value: true },
    ],
    code: [
      L("for pass in 0 .. n-2:", "outer"),
      L("swapped ← false", undefined, 1),
      L("for j in 0 .. n-2-pass:", undefined, 1),
      L("if a[j] > a[j+1]:", "compare", 2),
      L("swap(a[j], a[j+1]); swapped ← true", "swap", 3),
      L("a[n-1-pass] is in place", "sorted", 1),
      L("if not swapped: stop", "early", 1),
    ],
  },
  {
    id: "quick",
    family: "sort",
    name: "Quicksort",
    short: "Quick",
    aliases: ["quick", "quicksort", "partition", "lomuto", "pivot"],
    summary: "Partitions around a pivot, then sorts each side independently.",
    how: [
      "Lomuto partition: values smaller than the pivot are swapped to the left.",
      "The pivot lands in its final position after each partition.",
      "A pivot that is always the extreme value makes partitions lopsided: O(n²).",
    ],
    watch: "Sorted input with a last-element pivot is the worst case. Switch to median-of-three.",
    complexity: {
      best: "O(n log n)",
      average: "O(n log n)",
      worst: "O(n²)",
      space: "O(log n)",
      note: "Recursion depth; O(n) in the worst case",
    },
    props: [
      { label: "Stable", value: false },
      { label: "In place", value: true },
      { label: "Adaptive", value: false },
    ],
    code: [
      L("quicksort(lo, hi):", "range"),
      L("if lo ≥ hi: return", undefined, 1),
      L("pivot ← choose(lo, hi); move it to hi", "pivot", 1),
      L("i ← lo", undefined, 1),
      L("for j in lo .. hi-1:", undefined, 1),
      L("if a[j] < pivot:", "compare", 2),
      L("swap(a[i], a[j]); i ← i + 1", "swap", 3),
      L("swap(a[i], a[hi])  # pivot to final place", "place", 1),
      L("quicksort(lo, i-1); quicksort(i+1, hi)", "recurse", 1),
    ],
  },
  {
    id: "merge",
    family: "sort",
    name: "Merge sort",
    short: "Merge",
    aliases: ["merge", "mergesort", "divide and conquer"],
    summary: "Splits the array in half, sorts each half, then merges them through a buffer.",
    how: [
      "Recursion splits until every piece has one element.",
      "Merging takes the smaller head of two sorted runs, one value at a time.",
      "Same O(n log n) on every input, at the price of an O(n) buffer.",
    ],
    watch: "Comparisons barely change between random, sorted and reversed input.",
    complexity: { best: "O(n log n)", average: "O(n log n)", worst: "O(n log n)", space: "O(n)" },
    props: [
      { label: "Stable", value: true },
      { label: "In place", value: false },
      { label: "Adaptive", value: false },
    ],
    code: [
      L("mergesort(lo, hi):", "range"),
      L("if hi - lo < 1: return", undefined, 1),
      L("mid ← (lo + hi) / 2; mergesort(lo, mid); mergesort(mid+1, hi)", undefined, 1),
      L("buffer ← copy of a[lo .. hi]", "copy", 1),
      L("while both halves have values:", undefined, 1),
      L("take the smaller head", "compare", 2),
      L("a[k] ← taken value; k ← k + 1", "write", 2),
      L("copy the remaining half", "drain", 1),
      L("a[lo .. hi] is sorted", "sorted", 1),
    ],
  },
  {
    id: "heap",
    family: "sort",
    name: "Heapsort",
    short: "Heap",
    aliases: ["heap", "heapsort", "binary heap", "sift down"],
    summary: "Builds a max-heap in the array, then repeatedly moves the root to the end.",
    how: [
      "Heapify turns the array into a max-heap from the bottom up.",
      "The root is the largest value; it swaps with the last heap slot.",
      "Sift-down restores the heap in O(log n).",
    ],
    watch: "Guaranteed O(n log n) with no buffer, but it jumps around the array.",
    complexity: { best: "O(n log n)", average: "O(n log n)", worst: "O(n log n)", space: "O(1)" },
    props: [
      { label: "Stable", value: false },
      { label: "In place", value: true },
      { label: "Adaptive", value: false },
    ],
    code: [
      L("for i from n/2 - 1 down to 0: siftDown(i, n)", "heapify"),
      L("for end from n-1 down to 1:", "outer"),
      L("swap(a[0], a[end])  # max to its place", "extract", 1),
      L("siftDown(0, end)", undefined, 1),
      L("siftDown(i, size):"),
      L("child ← larger of a[2i+1], a[2i+2]", "compare", 1),
      L("if a[child] > a[i]: swap(a[i], a[child]); i ← child", "swap", 1),
    ],
  },
  {
    id: "linear",
    family: "search",
    name: "Linear search",
    short: "Linear",
    aliases: ["linear", "sequential", "scan"],
    summary: "Checks every slot from left to right until it finds the target.",
    how: [
      "No assumptions about order.",
      "The number of probes equals the target's position.",
      "On sorted data it can stop as soon as it passes the target's value.",
    ],
    watch: "Put the target at the end and compare with binary search.",
    complexity: { best: "O(1)", average: "O(n)", worst: "O(n)", space: "O(1)" },
    props: [
      { label: "Needs sorted input", value: false },
      { label: "Random access", value: false },
    ],
    code: [
      L("for i in 0 .. n-1:", "probe"),
      L("if a[i] = target: return i", "found", 1),
      L("if a[i] > target: break  # sorted input", "past", 1),
      L('return "absent"', "absent"),
    ],
  },
  {
    id: "binary",
    family: "search",
    name: "Binary search",
    short: "Binary",
    aliases: ["binary", "bisection", "halving", "log n"],
    summary: "Compares with the middle element and discards half of the range every step.",
    how: [
      "The target, if present, is always inside [lo, hi].",
      "Each probe halves the range, so 64 elements need at most 7 probes.",
      "Only works on sorted data.",
    ],
    watch: "Double the array size: the probe count rises by one.",
    complexity: { best: "O(1)", average: "O(log n)", worst: "O(log n)", space: "O(1)" },
    props: [
      { label: "Needs sorted input", value: true },
      { label: "Random access", value: true },
    ],
    code: [
      L("lo ← 0; hi ← n - 1", "init"),
      L("while lo ≤ hi:"),
      L("mid ← (lo + hi) / 2", "probe", 1),
      L("if a[mid] = target: return mid", "found", 1),
      L("if a[mid] < target: lo ← mid + 1", "right", 1),
      L("else: hi ← mid - 1", "left", 1),
      L('return "absent"', "absent"),
    ],
  },
  {
    id: "jump",
    family: "search",
    name: "Jump search",
    short: "Jump",
    aliases: ["jump", "block search", "sqrt"],
    summary:
      "Jumps ahead √n slots at a time, then scans back inside the block that must hold the target.",
    how: [
      "Probe every √n-th element until one is not smaller than the target.",
      "The target can only be in the block just jumped over.",
      "A linear scan of that block finishes the job.",
    ],
    watch: "Sits between linear and binary search: O(√n) probes.",
    complexity: { best: "O(1)", average: "O(√n)", worst: "O(√n)", space: "O(1)" },
    props: [
      { label: "Needs sorted input", value: true },
      { label: "Random access", value: true },
    ],
    code: [
      L("step ← ⌊√n⌋; prev ← 0", "init"),
      L("while a[min(step, n) - 1] < target:", "jump"),
      L("prev ← step; step ← step + ⌊√n⌋", undefined, 1),
      L("for i in prev .. min(step, n) - 1:", "probe"),
      L("if a[i] = target: return i", "found", 1),
      L('return "absent"', "absent"),
    ],
  },
  {
    id: "prim",
    family: "graph",
    name: "Prim's algorithm",
    short: "Prim",
    aliases: ["prim", "mst", "minimum spanning tree", "jarnik"],
    summary: "Grows one tree from a root, always adding the cheapest edge that leaves it.",
    how: [
      "A min-heap holds every edge from the tree to the outside.",
      "The cheapest edge to a new node joins the tree.",
      "Edges whose far end is already in the tree are discarded when they surface.",
    ],
    watch: "Change the root: the order changes, the final tree weight does not.",
    complexity: { best: "O(E log V)", average: "O(E log V)", worst: "O(E log V)", space: "O(E)" },
    props: [
      { label: "Grows a single tree", value: true },
      { label: "Needs edge sorting", value: false },
    ],
    code: [
      L("tree ← {root}; push all edges of root", "init"),
      L("while heap is not empty and tree is not spanning:"),
      L("(u, v, w) ← heap.extractMin()", undefined, 1),
      L("if v is in tree: discard  # both ends inside", "reject", 1),
      L("add v and edge (u, v) to tree", "accept", 1),
      L("push every edge (v, x) with x outside the tree", "push", 1),
      L("return tree  # spans only the root's component", "done"),
    ],
  },
  {
    id: "kruskal",
    family: "graph",
    name: "Kruskal's algorithm",
    short: "Kruskal",
    aliases: ["kruskal", "mst", "union find", "disjoint set", "minimum spanning tree"],
    summary: "Takes edges from lightest to heaviest and keeps any that does not close a cycle.",
    how: [
      "All edges are sorted by weight up front.",
      "Union-find tracks which nodes are already connected.",
      "An edge between two different components merges them; otherwise it would form a cycle.",
    ],
    watch: "Watch separate fragments form and merge, unlike Prim's single growing tree.",
    complexity: { best: "O(E log E)", average: "O(E log E)", worst: "O(E log E)", space: "O(V)" },
    props: [
      { label: "Grows a single tree", value: false },
      { label: "Needs edge sorting", value: true },
    ],
    code: [
      L("sort edges by weight", "init"),
      L("for each edge (u, v) in order:", "consider"),
      L("if find(u) = find(v): skip  # would close a cycle", "reject", 1),
      L("union(u, v); add (u, v) to tree", "accept", 1),
      L("if tree has V-1 edges: stop", "done", 1),
    ],
  },
  {
    id: "kmeans",
    family: "learn",
    name: "k-means clustering",
    short: "k-means",
    aliases: ["kmeans", "k-means", "clustering", "lloyd", "centroids", "unsupervised"],
    summary:
      "Alternates between assigning points to the nearest centroid and moving each centroid to its points' mean.",
    how: [
      "Assignment step: each point joins its closest centroid.",
      "Update step: each centroid moves to the mean of its cluster.",
      "Inertia (sum of squared distances) never increases, so it always converges, though not always to the best answer.",
    ],
    watch:
      "Try the bad corner initialisation, then the moons dataset. k-means only sees round clusters.",
    complexity: {
      best: "O(n·k)",
      average: "O(n·k·i)",
      worst: "O(n·k·i)",
      space: "O(n + k)",
      note: "i = iterations until assignments stop changing",
    },
    props: [
      { label: "Deterministic for a given start", value: true },
      { label: "Finds the global optimum", value: false },
    ],
    code: [
      L("place k initial centroids", "init"),
      L("repeat:"),
      L("assign each point to its nearest centroid", "assign", 1),
      L("move each centroid to the mean of its points", "update", 1),
      L("until no point changes cluster", "converged"),
    ],
  },
  {
    id: "gradient",
    family: "learn",
    name: "Gradient descent",
    short: "Gradient",
    aliases: [
      "gradient",
      "gradient descent",
      "regression",
      "learning rate",
      "sgd",
      "momentum",
      "linear regression",
    ],
    summary:
      "Fits a line by repeatedly stepping the parameters downhill on the mean squared error surface.",
    how: [
      "The gradient says which way the loss increases; the update steps the other way.",
      "The learning rate scales the step. Too small crawls, too large overshoots and diverges.",
      "Momentum keeps a running velocity, which speeds up travel along long valleys.",
    ],
    watch: "Set the learning rate above 1: the path zig-zags across the valley, then diverges.",
    complexity: {
      best: "O(n) per step",
      average: "O(n·steps)",
      worst: "O(n·steps)",
      space: "O(1)",
    },
    props: [
      { label: "Convex problem here", value: true },
      { label: "Sensitive to learning rate", value: true },
    ],
    code: [
      L("m, b ← initial values; v ← 0", "init"),
      L("for each step:"),
      L("ŷ ← m·x + b", undefined, 1),
      L("∇ ← (∂MSE/∂m, ∂MSE/∂b)", "gradient", 1),
      L("v ← β·v + ∇", undefined, 1),
      L("(m, b) ← (m, b) − lr · v", "update", 1),
      L("stop if the loss diverges", "diverged", 1),
    ],
  },
];

export interface AlgoDepth {
  maintains: string;
  assumes: string;
  useWhen: string;
  tradeoff: string;
}

export const DEPTH: Record<AlgoId, AlgoDepth> = {
  bfs: {
    maintains: "A FIFO queue of discovered cells, a discovered set, and a parent pointer per cell.",
    assumes: "Every move costs the same. Weights on cells are ignored.",
    useWhen:
      "Shortest paths by edge count: unweighted grids, social-network hops, level-order traversal.",
    tradeoff:
      "Explores in every direction equally, so it visits far more cells than a guided search.",
  },
  dfs: {
    maintains: "A LIFO stack of (cell, parent) pairs and a visited set.",
    assumes: "Nothing about costs. Only reachability matters.",
    useWhen:
      "Reachability, cycle detection, topological order, maze generation, exhaustive search with backtracking.",
    tradeoff: "Uses little memory on narrow graphs but returns an arbitrary, usually long, path.",
  },
  dijkstra: {
    maintains:
      "A min-heap keyed by tentative distance, a distance table, a settled set, and parents.",
    assumes: "All edge costs are non-negative. A negative edge breaks the settle-once guarantee.",
    useWhen:
      "Single-source cheapest paths on weighted graphs: routing, network latency, game maps.",
    tradeoff:
      "Optimal but undirected: it settles every node closer than the target, in all directions.",
  },
  astar: {
    maintains: "An open min-heap keyed by f = g + w·h, a closed set, g per node, and parents.",
    assumes:
      "With w = 1, h must never overestimate the remaining cost (admissible) for the path to be optimal.",
    useWhen:
      "Point-to-point search where a good distance estimate exists: game pathfinding, robotics, puzzles.",
    tradeoff:
      "Expands far fewer nodes than Dijkstra, but only as good as h. Raising w trades optimality for speed.",
  },
  greedy: {
    maintains: "An open min-heap keyed by h alone and a seen set.",
    assumes: "That looking close to the goal means being close to it.",
    useWhen: "Quick, good-enough paths when optimality does not matter and obstacles are sparse.",
    tradeoff:
      "Fast on open ground, but concave obstacles trap it and its paths can be far from optimal.",
  },
  insertion: {
    maintains: "A sorted prefix a[0..i-1] and the value currently being inserted.",
    assumes: "Comparisons are cheap and the input may already be partly ordered.",
    useWhen:
      "Small arrays, nearly sorted data, and as the base case inside hybrid sorts like Timsort.",
    tradeoff: "O(n) on sorted input, O(n²) on reversed input. Stable and in place.",
  },
  selection: {
    maintains: "A sorted prefix and the index of the minimum seen in the current pass.",
    assumes: "Writes are expensive relative to comparisons.",
    useWhen: "When the number of swaps must be minimal: at most n − 1.",
    tradeoff: "Always n(n−1)/2 comparisons regardless of input order, and not stable.",
  },
  bubble: {
    maintains: "A sorted suffix and a swapped flag for early exit.",
    assumes: "Nothing beyond comparable values.",
    useWhen: "Teaching, and detecting that an array is already sorted in one pass.",
    tradeoff:
      "Simple and stable, but values travel one position per swap, so it is slow in practice.",
  },
  quick: {
    maintains: "A recursion stack of (lo, hi) ranges, the pivot, and the partition boundary i.",
    assumes: "The pivot splits ranges reasonably evenly. Bad pivots on sorted input give O(n²).",
    useWhen:
      "General-purpose in-memory sorting with good cache behaviour; the default in many libraries.",
    tradeoff:
      "Fast on average and in place, but not stable, with a quadratic worst case unless pivots are chosen well.",
  },
  merge: {
    maintains: "A recursion stack of ranges and an auxiliary buffer for the merge.",
    assumes: "O(n) extra memory is available.",
    useWhen:
      "When stability or a guaranteed O(n log n) matters: linked lists, external sorting, stable sorts of records.",
    tradeoff:
      "Predictable and stable, at the cost of a buffer and more data movement than quicksort.",
  },
  heap: {
    maintains: "A max-heap in a[0..end) and a sorted suffix a[end..n).",
    assumes: "Random access to the array.",
    useWhen:
      "When a guaranteed O(n log n) with O(1) extra space is required, for example in embedded systems.",
    tradeoff: "No worst-case blowup and no buffer, but poor cache locality and not stable.",
  },
  linear: {
    maintains: "A single index i.",
    assumes: "Nothing. Works on unsorted data; on sorted data it can stop early.",
    useWhen: "Small or unsorted arrays, or a single lookup where sorting first would cost more.",
    tradeoff: "O(n) probes but no preprocessing.",
  },
  binary: {
    maintains: "An interval [lo, hi] that must contain the target if it is present.",
    assumes: "The array is sorted and supports random access.",
    useWhen:
      "Repeated lookups in sorted data, bisection on monotonic functions, lower/upper bound queries.",
    tradeoff:
      "O(log n) probes, but requires sorted input and is easy to get wrong at the boundaries.",
  },
  jump: {
    maintains: "The current block boundary and the start of the previous block.",
    assumes: "Sorted data where stepping forward is cheaper than jumping back.",
    useWhen:
      "Sorted sequences with expensive backward seeks, such as tapes or skip-like structures.",
    tradeoff: "O(√n) probes: better than linear, worse than binary.",
  },
  prim: {
    maintains: "The set of tree nodes and a min-heap of candidate edges leaving the tree.",
    assumes: "A connected undirected graph. Otherwise it spans only the root's component.",
    useWhen: "Dense graphs and when a tree must grow from a chosen starting point.",
    tradeoff: "O(E log V) with a binary heap; one tree at a time.",
  },
  kruskal: {
    maintains: "Edges sorted by weight and a union-find structure of fragments.",
    assumes: "An undirected graph. Disconnected graphs yield a spanning forest.",
    useWhen:
      "Sparse graphs, and when edges arrive pre-sorted. Also the basis of single-linkage clustering.",
    tradeoff: "O(E log E) dominated by the sort; builds many fragments that merge.",
  },
  kmeans: {
    maintains: "k centroids and the assignment of every point to its nearest centroid.",
    assumes: "Clusters are roughly spherical and similar in size; k is known in advance.",
    useWhen:
      "Fast partitioning of numeric data, colour quantisation, initial guesses for richer models.",
    tradeoff: "Converges quickly to a local optimum that depends on the starting centroids.",
  },
  gradient: {
    maintains: "The parameters (m, b), the gradient, and with momentum a velocity vector.",
    assumes: "The loss is differentiable. Here it is convex, so there is one minimum.",
    useWhen: "Fitting any differentiable model, from linear regression to neural networks.",
    tradeoff:
      "Simple and general, but the learning rate must suit the curvature of the loss surface.",
  },
};

export function getAlgo(id: AlgoId): AlgoInfo {
  const a = ALGOS.find((x) => x.id === id);
  if (!a) throw new Error(`Unknown algorithm ${id}`);
  return a;
}

export function isAlgoId(v: unknown): v is AlgoId {
  return typeof v === "string" && ALGOS.some((a) => a.id === v);
}

export function algosOf(family: Family): AlgoInfo[] {
  return ALGOS.filter((a) => a.family === family);
}

export function familyName(f: Family): string {
  return FAMILIES.find((x) => x.id === f)!.name;
}

export function lineOf(info: AlgoInfo, op: string): number {
  return info.code.findIndex((l) => l.op === op);
}
