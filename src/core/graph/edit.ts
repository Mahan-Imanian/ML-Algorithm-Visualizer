import {
  clampNodeCoord,
  edgeWeight,
  findRoot,
  GRAPH_MAX,
  GRAPH_MIN,
  type GraphInput,
  type GraphNode,
} from "./graph";

const sortEdges = (edges: GraphInput["edges"]) =>
  [...edges].sort((x, y) => x[0] - y[0] || x[1] - y[1]);

export function hasEdge(g: GraphInput, a: number, b: number): boolean {
  const [x, y] = a < b ? [a, b] : [b, a];
  return g.edges.some((e) => e[0] === x && e[1] === y);
}

export function toggleEdge(g: GraphInput, a: number, b: number): GraphInput {
  if (a === b || a < 0 || b < 0 || a >= g.nodes.length || b >= g.nodes.length) return g;
  const [x, y] = a < b ? [a, b] : [b, a];
  const edges = hasEdge(g, x, y)
    ? g.edges.filter((e) => !(e[0] === x && e[1] === y))
    : sortEdges([...g.edges, [x, y, edgeWeight(g.nodes[x], g.nodes[y])]]);
  return { ...g, edges };
}

export function removeEdge(g: GraphInput, index: number): GraphInput {
  if (index < 0 || index >= g.edges.length) return g;
  return { ...g, edges: g.edges.filter((_, i) => i !== index) };
}

export function addNode(g: GraphInput, at: GraphNode, links = 2): GraphInput {
  if (g.nodes.length >= GRAPH_MAX) return g;
  const p = { x: clampNodeCoord(at.x), y: clampNodeCoord(at.y) };
  const nodes = [...g.nodes, p];
  const id = nodes.length - 1;
  const nearest = g.nodes
    .map((q, i) => ({ i, d: Math.hypot(q.x - p.x, q.y - p.y) }))
    .sort((u, v) => u.d - v.d)
    .slice(0, links);
  const edges = sortEdges([
    ...g.edges,
    ...nearest.map(({ i }) => [i, id, edgeWeight(nodes[i], p)] as [number, number, number]),
  ]);
  return { ...g, nodes, edges };
}

export function removeNode(g: GraphInput, index: number): GraphInput {
  if (g.nodes.length <= GRAPH_MIN || index < 0 || index >= g.nodes.length) return g;
  const nodes = g.nodes.filter((_, i) => i !== index);
  const shift = (v: number) => (v > index ? v - 1 : v);
  const edges = g.edges
    .filter((e) => e[0] !== index && e[1] !== index)
    .map((e) => [shift(e[0]), shift(e[1]), e[2]] as [number, number, number]);
  const root = g.root === index ? 0 : shift(g.root);
  return { ...g, nodes, edges: sortEdges(edges), root };
}

export function components(g: GraphInput): number {
  const parent = g.nodes.map((_, i) => i);
  const find = (x: number) => findRoot(parent, x);
  for (const [a, b] of g.edges) parent[find(a)] = find(b);
  return new Set(g.nodes.map((_, i) => find(i))).size;
}
