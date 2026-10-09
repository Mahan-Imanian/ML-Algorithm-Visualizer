import { useRef, useState } from "react";
import type { GraphExp, Run } from "@/core/experiment";
import { addNode, removeEdge, removeNode, toggleEdge } from "@/core/graph/edit";
import {
  clampNodeCoord,
  EDGE_CANDIDATE,
  EDGE_REJECTED,
  EDGE_TREE,
  edgeWeight,
  findRoot,
  type GraphInput,
} from "@/core/graph/graph";
import { cn } from "@/lib/utils";
import { useLab } from "@/store/lab";
import { useElementSize } from "../hooks";

type GraphRun = Extract<Run, { family: "graph" }>;

const HINT: Record<string, string> = {
  move: "Drag a node to move it. Click a node to make it Prim's root.",
  edge: "Click two nodes to add an edge between them, or remove the one that exists.",
  node: "Click empty space to add a node linked to its two nearest neighbours.",
  delete: "Click a node or an edge to delete it.",
};

export function GraphView({
  run,
  cursor,
  input,
  editable,
  label,
}: {
  run: GraphRun;
  cursor: number;
  input: GraphInput;
  editable: boolean;
  label: string;
}) {
  const [ref, size] = useElementSize<HTMLDivElement>();
  const editing = useLab((s) => s.editing);
  const tool = useLab((s) => s.graphTool);
  const edgeFrom = useLab((s) => s.edgeFrom);
  const s = run.player.at(cursor).state;
  const pad = 24;
  const W = Math.max(0, size.w - pad * 2);
  const H = Math.max(0, size.h - pad * 2);
  const X = (x: number) => pad + x * W;
  const Y = (y: number) => pad + y * H;
  const drag = useRef<{ node: number; moved: boolean; x0: number; y0: number } | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const showWeights = input.nodes.length <= 24 && size.w > 300;
  const r = Math.max(9, Math.min(14, size.w / 50));

  const toUnit = (clientX: number, clientY: number) => {
    const rect = ref.current!.getBoundingClientRect();
    return {
      x: clampNodeCoord((clientX - rect.left - pad) / Math.max(1, W)),
      y: clampNodeCoord((clientY - rect.top - pad) / Math.max(1, H)),
    };
  };

  const apply = (fn: (g: GraphInput) => GraphInput) =>
    useLab.getState().update((ex) => ({ ...ex, input: fn((ex as GraphExp).input) }) as GraphExp);

  const onNodeDown = (e: React.PointerEvent, node: number) => {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    const st = useLab.getState();
    if (tool === "edge") {
      if (edgeFrom === null) st.setEdgeFrom(node);
      else {
        if (edgeFrom !== node) apply((g) => toggleEdge(g, edgeFrom, node));
        st.setEdgeFrom(null);
      }
      return;
    }
    if (tool === "delete") {
      apply((g) => removeNode(g, node));
      return;
    }
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { node, moved: false, x0: e.clientX, y0: e.clientY };
  };

  const onMove = (e: React.PointerEvent) => {
    if (tool === "edge" && edgeFrom !== null) {
      const rect = ref.current!.getBoundingClientRect();
      setPointer({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 4) return;
    if (!d.moved) useLab.getState().beginEdit();
    d.moved = true;
    const p = toUnit(e.clientX, e.clientY);
    useLab.getState().editInput((ex) => {
      const g = (ex as GraphExp).input;
      const nodes = g.nodes.map((q, i) => (i === d.node ? p : q));
      const edges = g.edges.map(
        ([a, b]) => [a, b, edgeWeight(nodes[a], nodes[b])] as [number, number, number],
      );
      return { ...ex, input: { ...g, nodes, edges } } as GraphExp;
    });
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) useLab.getState().endEdit();
    else if (tool === "move") apply((g) => ({ ...g, root: d.node }));
  };

  const onBackground = (e: React.PointerEvent) => {
    if (!editable) return;
    if (tool === "node") apply((g) => addNode(g, toUnit(e.clientX, e.clientY)));
    if (tool === "edge") useLab.getState().setEdgeFrom(null);
  };

  const showState = !editing;
  const pendingFrom = tool === "edge" && edgeFrom !== null ? input.nodes[edgeFrom] : null;
  return (
    <div
      ref={ref}
      className={cn(
        "relative h-full w-full touch-none select-none",
        tool === "node" && "cursor-copy",
      )}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={() => setPointer(null)}
    >
      <svg
        width={size.w}
        height={size.h}
        className="block"
        role="img"
        aria-label={`${label}: ${input.nodes.length} nodes, ${input.edges.length} edges, tree weight so far ${s.total}`}
        onPointerDown={onBackground}
      >
        {input.edges.map(([a, b, w], i) => {
          const st = showState ? s.edgeState[i] : 0;
          const cur = showState && s.current === i;
          const stroke = cur
            ? "rgb(var(--signal))"
            : st === EDGE_TREE
              ? "rgb(var(--st-path))"
              : st === EDGE_CANDIDATE
                ? "rgb(var(--st-open))"
                : st === EDGE_REJECTED
                  ? "rgb(var(--ink) / 0.18)"
                  : "rgb(var(--ink) / 0.3)";
          const width = st === EDGE_TREE ? 4 : cur ? 3.5 : st === EDGE_CANDIDATE ? 2.5 : 1.25;
          const x1 = X(input.nodes[a].x);
          const y1 = Y(input.nodes[a].y);
          const x2 = X(input.nodes[b].x);
          const y2 = Y(input.nodes[b].y);
          return (
            <g key={`${a}-${b}`}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={stroke}
                strokeWidth={width}
                strokeDasharray={st === EDGE_REJECTED ? "4 4" : undefined}
                strokeLinecap="round"
                style={{ transition: "stroke var(--dur-med), stroke-width var(--dur-med)" }}
              />
              {editable && tool === "delete" && (
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="transparent"
                  strokeWidth={14}
                  className="cursor-pointer"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    apply((g) => removeEdge(g, i));
                  }}
                />
              )}
              {showWeights && (
                <g transform={`translate(${(x1 + x2) / 2}, ${(y1 + y2) / 2})`} pointerEvents="none">
                  <rect
                    x={-11}
                    y={-7}
                    width={22}
                    height={14}
                    rx={2}
                    fill="rgb(var(--field))"
                    opacity={0.92}
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    className={
                      cur
                        ? "fill-signal-ink font-mono text-[10px] font-medium"
                        : "fill-ink-2 font-mono text-[10px]"
                    }
                  >
                    {w}
                  </text>
                </g>
              )}
            </g>
          );
        })}
        {pendingFrom && pointer && (
          <line
            x1={X(pendingFrom.x)}
            y1={Y(pendingFrom.y)}
            x2={pointer.x}
            y2={pointer.y}
            stroke="rgb(var(--focus))"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            pointerEvents="none"
          />
        )}
        {input.nodes.map((p, i) => {
          const inTree =
            showState && (run.algo === "prim" ? s.inTree[i] : s.ufSize[findRoot(s.uf, i)] > 1);
          const isRoot = run.algo === "prim" && i === input.root;
          const picked = tool === "edge" && edgeFrom === i;
          return (
            <g
              key={i}
              transform={`translate(${X(p.x)}, ${Y(p.y)})`}
              onPointerDown={(e) => onNodeDown(e, i)}
              className={
                editable
                  ? tool === "move"
                    ? "cursor-grab active:cursor-grabbing"
                    : "cursor-pointer"
                  : undefined
              }
            >
              <circle r={r + 6} fill="transparent" />
              {picked && (
                <circle r={r + 5} fill="none" stroke="rgb(var(--focus))" strokeWidth={2} />
              )}
              <circle
                r={r}
                fill={inTree ? "rgb(var(--ink))" : "rgb(var(--field))"}
                stroke={tool === "delete" ? "rgb(var(--signal))" : "rgb(var(--ink))"}
                strokeWidth={isRoot ? 3 : 1.5}
                style={{ transition: "fill var(--dur-med)" }}
              />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                className={
                  inTree ? "fill-surface font-mono text-[10px]" : "fill-ink font-mono text-[10px]"
                }
              >
                {i}
              </text>
              {isRoot && (
                <text y={-r - 6} textAnchor="middle" className="fill-ink-2 font-mono text-[10px]">
                  root
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {editable && (
        <p className="pointer-events-none absolute bottom-1 left-2 truncate text-2xs text-ink-3">
          {tool === "edge" && edgeFrom !== null
            ? `Edge from node ${edgeFrom}: click the other end.`
            : HINT[tool]}
        </p>
      )}
    </div>
  );
}
