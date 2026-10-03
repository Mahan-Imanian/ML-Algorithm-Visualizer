import type { Run } from "@/core/experiment";
import { fmtCell, heuristic } from "@/core/grid/model";

export interface Explanation {
  now: string;
  why: string;
  next: string | null;
}

const INTRO: Record<string, string> = {
  bfs: "BFS will expand cells strictly in the order it discovers them. Press play or step forward.",
  dfs: "DFS will chase one branch as deep as it can before backing up.",
  dijkstra: "Dijkstra will settle cells in order of their distance from the start.",
  astar: "A* ranks cells by cost so far plus a guess of the cost to go.",
  greedy: "Greedy search ranks cells only by how close they look to the target.",
  insertion: "Insertion sort will grow a sorted prefix from the left.",
  selection: "Selection sort will pull the smallest remaining value to the front each pass.",
  bubble: "Bubble sort will sweep left to right, swapping neighbors that are out of order.",
  quick: "Quicksort will partition around a pivot, then recurse on each side.",
  merge: "Merge sort will split down to single values, then merge sorted runs back together.",
  heap: "Heapsort will build a max-heap, then repeatedly move its root to the end.",
  linear: "Linear search will check each slot in turn.",
  binary: "Binary search will compare with the middle and discard half the range each probe.",
  jump: "Jump search will leap ahead in blocks of √n, then scan one block.",
  prim: "Prim's algorithm will grow one tree outward from the root.",
  kruskal:
    "Kruskal's algorithm will take edges from lightest to heaviest, skipping any that close a cycle.",
  kmeans: "k-means will alternate between assigning points and moving centroids.",
  gradient: "Gradient descent will step the line's slope and intercept downhill on the loss.",
};

export function explain(run: Run, cursor: number): Explanation {
  const events = run.trace.events;
  const next = cursor < events.length ? events[cursor].note : null;
  if (cursor === 0) return { now: "Ready", why: INTRO[run.algo] ?? "", next };
  const e = events[cursor - 1];
  return { now: e.note, why: why(run, cursor), next };
}

function why(run: Run, cursor: number): string {
  switch (run.family) {
    case "grid": {
      const e = run.trace.events[cursor - 1];
      const g = run.input;
      const f = (c: number) => fmtCell(c, g.w);
      const algo = run.algo;
      if (e.k === "push") {
        if (e.op === "init")
          return algo === "bfs"
            ? "The queue starts with only the start cell, which is marked discovered so it is never queued twice."
            : "The frontier starts with only the start cell.";
        if (algo === "bfs")
          return `${f(e.cell)} is an undiscovered neighbor of ${f(e.from)}. It joins the back of the queue and waits behind everything found earlier. That first-in, first-out order is why BFS spreads in rings.`;
        if (algo === "dfs")
          return `${f(e.cell)} goes on top of the stack. Last in, first out: the newest neighbor is explored next, which is what drives DFS deep.`;
        if (algo === "greedy")
          return `${f(e.cell)} is ${e.h} away by the ${run.params.heuristic} estimate. Greedy ranks it by that alone; the ${e.g} already spent getting here is ignored.`;
        const what = algo === "dijkstra" ? "distance" : "g";
        const cost = e.g;
        if (Number.isFinite(e.prevG))
          return `A cheaper route to ${f(e.cell)} through ${f(e.from)}: ${what} ${e.prevG} → ${e.g}. The old heap entry stays behind as a stale duplicate; it will be skipped when it surfaces.`;
        if (algo === "astar")
          return `${f(e.cell)} costs ${cost} to reach. Estimated ${e.h} more to the target, so f = ${e.g} + ${run.params.weight !== 1 ? `${run.params.weight}×` : ""}${e.h} = ${e.pri}. Lower f is expanded sooner.`;
        return `${f(e.cell)} costs ${cost} to reach via ${f(e.from)}${g.cells[e.cell] > 1 ? `, including its terrain cost of ${g.cells[e.cell]}` : ""}. It enters the heap with that distance as its priority.`;
      }
      if (e.k === "pop") {
        if (algo === "bfs")
          return `${f(e.cell)} has waited longest in the queue, so it is expanded now. It is ${e.g} moves from the start. Every cell at distance ${e.g} is expanded before any at ${e.g + 1}.`;
        if (algo === "dfs")
          return `${f(e.cell)} was the most recent push. DFS commits to it and will only come back to older branches when this one dead-ends.`;
        if (algo === "dijkstra")
          return `${f(e.cell)} has the smallest distance in the heap (${e.g}). All edges cost at least 1, so no unsettled cell can offer a cheaper way here later. Its distance is final.`;
        if (algo === "astar") {
          const h = heuristic(run.params.heuristic, e.cell, g.target, g.w);
          return `${f(e.cell)} has the lowest f in the open set: g ${e.g} + h ${Math.round(h * 100) / 100}. Ties go to the smaller h, keeping the search aimed at the target.`;
        }
        return `${f(e.cell)} looks closest to the target. Greedy expands it without asking what it cost to get here.`;
      }
      if (e.k === "skip") {
        return algo === "dfs"
          ? `${f(e.cell)} was pushed by an earlier branch but has since been visited. Popping it changes nothing.`
          : `This heap entry for ${f(e.cell)} is stale: the cell was already ${algo === "dijkstra" ? "settled" : "closed"} through a cheaper route. Skipping stale entries is cheaper than updating the heap in place.`;
      }
      if (e.k === "found") {
        const optimal =
          algo === "dijkstra" ||
          (algo === "astar" &&
            run.params.weight === 1 &&
            !(g.diagonal && run.params.heuristic === "manhattan"));
        return `Following parent pointers back from the target gives the path. ${algo === "bfs" ? "It has the fewest moves possible, though not necessarily the lowest cost." : optimal ? "With these settings it is guaranteed to be the cheapest path." : "This algorithm does not guarantee the cheapest path."}`;
      }
      return "The frontier ran dry before reaching the target. No sequence of moves connects the two.";
    }
    case "sort": {
      const e = run.trace.events[cursor - 1];
      const s = run.player.at(cursor).state;
      const v = (pos: number) => s.values[s.order[pos]];
      switch (e.k) {
        case "compare":
          if (run.algo === "insertion")
            return `Insertion sort slides the new value left while its left neighbor is larger. ${e.res ? "It is, so they swap." : "It is not, so the value has found its place."}`;
          if (run.algo === "selection")
            return `Scanning the unsorted part for its minimum. The smallest seen so far is ${typeof s.ptr.min === "number" ? v(s.ptr.min) : "?"} at index ${s.ptr.min}.`;
          if (run.algo === "bubble")
            return `Adjacent values are compared. ${e.res ? "They are out of order, so they swap and the larger one keeps moving right." : "They are in order; move on."}`;
          if (run.algo === "quick")
            return `Partitioning: values smaller than the pivot are moved to the left of i. Everything left of i is now known to be smaller than the pivot.`;
          if (run.algo === "merge")
            return "Both halves are already sorted, so the smaller of their two front values must be the next smallest overall.";
          return "Sift-down keeps the parent at least as large as both children, which is the max-heap rule.";
        case "swap":
          if (run.algo === "heap" && e.op === "extract")
            return "The root of a max-heap is the largest remaining value. Swapping it to the end places it for good and shrinks the heap by one.";
          if (run.algo === "quick" && e.op === "pivot")
            return "The chosen pivot is moved to the end so the partition loop can use the same code whatever the pivot rule.";
          if (run.algo === "quick" && e.op === "place")
            return "Everything left of i is smaller than the pivot and everything right is not, so this swap puts the pivot in its final position.";
          return `Swapped ${v(e.i)} and ${v(e.j)}. That is ${s.swaps} swap${s.swaps === 1 ? "" : "s"} so far.`;
        case "copy":
          return "Merging needs scratch space: the range is copied into a buffer so the array slots can be overwritten in order.";
        case "write":
          return e.op === "drain"
            ? "One half ran out; whatever remains in the other is already sorted and is copied straight across."
            : "The taken value goes into the next array slot. Equal values are taken from the left half first, which keeps merge sort stable.";
        case "sorted":
          return e.op === "early"
            ? "A full pass with no swaps proves every neighbor is in order, so bubble sort stops early."
            : "These positions will not change again.";
        case "range":
          return e.push
            ? `Recursing into indices ${e.lo}..${e.hi}. Outside this range is dimmed.`
            : "This sub-problem is done; returning to the caller.";
        default:
          return run.algo === "quick"
            ? "The pivot rule decides how balanced the partitions are. A bad pivot on sorted data gives O(n²)."
            : run.algo === "heap"
              ? "Each subtree is sifted down from the bottom up, which builds the heap in O(n)."
              : "Starting the next pass.";
      }
    }
    case "search": {
      const e = run.trace.events[cursor - 1];
      const s = run.player.at(cursor).state;
      if (e.k === "probe") {
        if (e.cmp === "=") return "The probe matches the target.";
        if (run.algo === "binary")
          return `${s.values[e.i]} is ${e.cmp === "<" ? "smaller" : "larger"} than ${s.target}. The array is sorted, so the target can only be to the ${e.cmp === "<" ? "right" : "left"}.`;
        if (run.algo === "jump" && e.op === "jump")
          return `Block end ${s.values[e.i]} ${e.cmp === "<" ? "is still below the target, so jump again" : "is not below the target, so the target must be inside this block"}.`;
        return `${s.values[e.i]} is not the target.`;
      }
      if (e.k === "range")
        return `${Math.max(0, e.hi - e.lo + 1)} candidates remain out of ${s.values.length}.`;
      if (e.k === "found")
        return `It took ${s.probes} probe${s.probes === 1 ? "" : "s"}. A linear scan would need ${e.i + 1}.`;
      return "Every possible position has been ruled out.";
    }
    case "graph": {
      const e = run.trace.events[cursor - 1];
      if (e.k === "accept")
        return run.algo === "prim"
          ? "It is the lightest edge crossing from the tree to the rest of the graph. The cut property says such an edge always belongs to some minimum spanning tree."
          : "Its ends are in different fragments, so adding it cannot form a cycle. Union-find merges the two fragments.";
      if (e.k === "reject")
        return run.algo === "prim"
          ? "Both ends are already in the tree, so this edge would close a loop."
          : "find(u) = find(v): the ends are already connected, so this edge would close a cycle.";
      if (e.k === "push")
        return "Every edge from the newly added node to an outside node becomes a candidate.";
      if (e.k === "consider")
        return "Edges are processed in ascending weight order, so this is the lightest one not yet examined.";
      return "";
    }
    case "kmeans": {
      const e = run.trace.events[cursor - 1];
      if (e.k === "centroid")
        return run.params.init === "plusplus"
          ? "k-means++ picks each new centroid with probability proportional to its squared distance from the nearest existing one, which spreads them out."
          : run.params.init === "corner"
            ? "All centroids start crammed into one corner. Watch how many iterations it takes to recover, and whether it does."
            : run.params.init === "manual"
              ? "These are the starting positions you placed."
              : "Random data points become the starting centroids.";
      if (e.k === "assign")
        return `Each point joins the centroid it is closest to. ${e.changed} point${e.changed === 1 ? "" : "s"} changed cluster; inertia is now ${e.inertia.toFixed(3)}.`;
      if (e.k === "update")
        return `Each centroid moves to the average position of its points, which can only lower the total squared distance. ${e.empty.length ? "An empty cluster has no points to average, so its centroid stays where it is." : ""}`;
      return "No point changed cluster, so the next update would move nothing. This is a local optimum, not necessarily the best one.";
    }
    case "gradient": {
      const e = run.trace.events[cursor - 1];
      if (e.k === "start")
        return "The line starts with the chosen slope and intercept. The red residuals show each point's error.";
      if (e.k === "gradient")
        return `The gradient points uphill on the loss surface: increasing m changes loss at rate ${e.gm.toFixed(3)}, increasing b at rate ${e.gb.toFixed(3)}. The arrow shows the step direction, which is the opposite way.`;
      if (e.k === "update")
        return run.params.beta
          ? `Momentum adds β = ${run.params.beta} of the previous step, so consistent directions build up speed while zig-zags cancel out.`
          : `The parameters move by ${run.params.lr} × gradient. A larger rate means bigger steps and a risk of overshooting the valley floor.`;
      return "Each step overshot the minimum by more than the last. The learning rate is above the stable limit for this loss surface.";
    }
  }
}
