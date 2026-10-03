import { useRef } from "react";
import type { GraphExp, Run } from "@/core/experiment";
import {
  EDGE_CANDIDATE,
  EDGE_REJECTED,
  EDGE_TREE,
  edgeWeight,
  findRoot,
  round3,
  type GraphInput,
} from "@/core/graph/graph";
import { useLab } from "@/store/lab";
import { useElementSize } from "../hooks";

type GraphRun = Extract<Run, { family: "graph" }>;

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
  const s = run.player.at(cursor).state;
  const pad = 22;
  const W = Math.max(0, size.w - pad * 2);
  const H = Math.max(0, size.h - pad * 2);
  const X = (x: number) => pad + x * W;
  const Y = (y: number) => pad + y * H;
  const drag = useRef<{ node: number; moved: boolean; x0: number; y0: number } | null>(null);
  const showWeights = input.nodes.length <= 24 && size.w > 300;
  const r = Math.max(9, Math.min(14, size.w / 50));

  const toUnit = (clientX: number, clientY: number) => {
    const rect = ref.current!.getBoundingClientRect();
    return {
      x: round3(Math.min(0.98, Math.max(0.02, (clientX - rect.left - pad) / Math.max(1, W)))),
      y: round3(Math.min(0.98, Math.max(0.02, (clientY - rect.top - pad) / Math.max(1, H)))),
    };
  };

  const onDown = (e: React.PointerEvent, node: number) => {
    if (!editable) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { node, moved: false, x0: e.clientX, y0: e.clientY };
  };
  const onMove = (e: React.PointerEvent) => {
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
    else
      useLab
        .getState()
        .update(
          (ex) => ({ ...ex, input: { ...(ex as GraphExp).input, root: d.node } }) as GraphExp,
        );
  };

  const showState = !editing;
  return (
    <div
      ref={ref}
      className="relative h-full w-full touch-none select-none"
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <svg
        width={size.w}
        height={size.h}
        className="block"
        role="img"
        aria-label={`${label}: ${input.nodes.length} nodes, ${input.edges.length} edges, tree weight so far ${s.total}`}
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
          const mx = (X(input.nodes[a].x) + X(input.nodes[b].x)) / 2;
          const my = (Y(input.nodes[a].y) + Y(input.nodes[b].y)) / 2;
          return (
            <g key={i}>
              <line
                x1={X(input.nodes[a].x)}
                y1={Y(input.nodes[a].y)}
                x2={X(input.nodes[b].x)}
                y2={Y(input.nodes[b].y)}
                stroke={stroke}
                strokeWidth={width}
                strokeDasharray={st === EDGE_REJECTED ? "4 4" : undefined}
                strokeLinecap="round"
                style={{ transition: "stroke var(--dur-med), stroke-width var(--dur-med)" }}
              />
              {showWeights && (
                <g transform={`translate(${mx}, ${my})`}>
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
        {input.nodes.map((p, i) => {
          const inTree =
            showState && (run.algo === "prim" ? s.inTree[i] : s.ufSize[findRoot(s.uf, i)] > 1);
          const isRoot = run.algo === "prim" && i === input.root;
          return (
            <g
              key={i}
              transform={`translate(${X(p.x)}, ${Y(p.y)})`}
              onPointerDown={(e) => onDown(e, i)}
              className={editable ? "cursor-grab active:cursor-grabbing" : undefined}
            >
              <circle r={r + 6} fill="transparent" />
              <circle
                r={r}
                fill={inTree ? "rgb(var(--ink))" : "rgb(var(--field))"}
                stroke="rgb(var(--ink))"
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
    </div>
  );
}
