import type { ReactNode } from "react";
import type { Run } from "@/core/experiment";
import { frontierKind } from "@/core/grid/algorithms";
import { orderedFrontier } from "@/core/grid/machine";
import { fmtCell } from "@/core/grid/model";
import { EDGE_TREE, findRoot } from "@/core/graph/graph";
import { bestFit } from "@/core/learn/gradient";
import { cn } from "@/lib/utils";
import { useLab } from "@/store/lab";
import { CLUSTER_COLORS } from "./colors";

function Readout({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: "signal" | "path";
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="label truncate">{label}</dt>
      <dd
        className={cn(
          "readout truncate text-md",
          tone === "signal" ? "text-signal-ink" : tone === "path" ? "text-st-path" : "text-ink",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function Readouts({ items }: { items: [string, ReactNode, ("signal" | "path")?][] }) {
  return (
    <dl className="grid grid-cols-3 gap-x-3 gap-y-3">
      {items.map(([l, v, t]) => (
        <Readout key={l} label={l} value={v} tone={t} />
      ))}
    </dl>
  );
}

function Block({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="border-t border-rule px-4 py-3 first:border-t-0">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="label">{title}</h3>
        {meta && <span className="readout text-2xs text-ink-3">{meta}</span>}
      </div>
      {children}
    </div>
  );
}

export function StatePanel({ run, cursor }: { run: Run; cursor: number }) {
  switch (run.family) {
    case "grid":
      return <GridState run={run} cursor={cursor} />;
    case "sort":
      return <SortState run={run} cursor={cursor} />;
    case "search":
      return <SearchState run={run} cursor={cursor} />;
    case "graph":
      return <GraphState run={run} cursor={cursor} />;
    case "kmeans":
      return <KMeansState run={run} cursor={cursor} />;
    case "gradient":
      return <GradientState run={run} cursor={cursor} />;
  }
}

const ROWS = 12;
const ROW_H = 22;

function GridState({ run, cursor }: { run: Extract<Run, { family: "grid" }>; cursor: number }) {
  const s = run.player.at(cursor).state;
  const kind = frontierKind(run.algo);
  const list = orderedFrontier(s.frontier, kind);
  const w = run.input.w;
  const setFocus = useLab((st) => st.setFocusCell);
  const title =
    kind === "queue"
      ? "Queue · first in, first out"
      : kind === "stack"
        ? "Stack · last in, first out"
        : run.algo === "dijkstra"
          ? "Min-heap · by distance"
          : run.algo === "greedy"
            ? "Open set · by h"
            : "Open set · by f = g + h";
  const showH = run.algo === "astar" || run.algo === "greedy";
  const pushed = new Set(s.pushedNow);
  const shown = list.slice(0, ROWS);
  return (
    <div>
      <Block title="Now">
        <Readouts
          items={[
            ["Current", s.current >= 0 ? fmtCell(s.current, w) : "—", "signal"],
            [
              run.algo === "bfs" || run.algo === "dfs" ? "Moves" : "g",
              s.current >= 0 ? Math.round(s.g[s.current] * 100) / 100 : "—",
            ],
            [
              "Parent",
              s.current >= 0 && s.parent[s.current] >= 0 ? fmtCell(s.parent[s.current], w) : "—",
            ],
          ]}
        />
      </Block>
      <Block title={title} meta={`${list.length} waiting`}>
        <div className="readout grid grid-cols-[24px_minmax(0,1fr)_56px_48px_56px] text-2xs text-ink-3">
          <span>#</span>
          <span>cell</span>
          <span className="text-right">
            {run.algo === "bfs" || run.algo === "dfs" ? "moves" : "g"}
          </span>
          <span className="text-right">{showH ? "h" : ""}</span>
          <span className="pr-1 text-right">
            {kind === "pq" ? (run.algo === "astar" ? "f" : "key") : ""}
          </span>
        </div>
        <div
          className="relative mt-1 overflow-hidden"
          style={{ height: ROWS * ROW_H }}
          role={shown.length ? "list" : undefined}
          aria-label={shown.length ? `${title}, ${list.length} entries` : undefined}
        >
          {list.length === 0 && (
            <p className="absolute inset-x-0 top-0 text-sm text-ink-3">
              {cursor === 0 ? "Empty until the search starts." : "Empty."}
            </p>
          )}
          {shown.map((e, i) => {
            const stale = kind === "pq" && (s.status[e.cell] === 2 || e.g > s.g[e.cell]);
            const fresh = pushed.has(e.cell) && !stale;
            return (
              <div
                key={e.seq}
                role="listitem"
                className={cn(
                  "readout absolute inset-x-0 top-0 grid h-[22px] cursor-default grid-cols-[24px_minmax(0,1fr)_56px_48px_56px] items-center text-sm transition-transform duration-med ease-out",
                  i === 0 && "bg-sunken",
                  stale && "text-ink-3 line-through",
                  fresh && "animate-entry-in text-signal-ink",
                )}
                style={{ transform: `translateY(${i * ROW_H}px)` }}
                onMouseEnter={() => setFocus(e.cell)}
                onMouseLeave={() => setFocus(null)}
              >
                <span className="pl-1 text-ink-3">{i === 0 ? "→" : i + 1}</span>
                <span>{fmtCell(e.cell, w)}</span>
                <span className="text-right">{e.g}</span>
                <span className="text-right">{showH ? e.h : ""}</span>
                <span className="pr-1 text-right">{kind === "pq" ? e.pri : ""}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-1 h-4 text-xs text-ink-3">
          {list.length > shown.length ? `+ ${list.length - shown.length} more` : ""}
        </p>
        {kind === "pq" && run.algo !== "greedy" && (
          <p className="mt-2 text-xs text-ink-3">
            Struck-through rows are stale duplicates left behind by a cheaper route.
          </p>
        )}
      </Block>
      <Block title="Totals">
        <Readouts
          items={[
            ["Expanded", s.expanded],
            ["Pushed", s.pushes],
            [kind === "queue" ? "Peak queue" : "Peak frontier", s.maxFrontier],
            ["Skipped", s.skips],
            ["Relaxed", s.relaxations],
            [
              "Outcome",
              s.outcome === "found" ? "path" : s.outcome === "nopath" ? "no path" : "…",
              s.outcome === "found" ? "path" : undefined,
            ],
          ]}
        />
      </Block>
    </div>
  );
}

function SortState({ run, cursor }: { run: Extract<Run, { family: "sort" }>; cursor: number }) {
  const s = run.player.at(cursor).state;
  const v = (pos: number) =>
    pos >= 0 && pos < s.order.length && s.order[pos] >= 0 ? s.values[s.order[pos]] : null;
  const bv = (pos: number) => (s.buffer ? s.values[s.buffer[pos - s.bufferLo]] : null);
  const cmp = s.compare;
  const n = s.values.length;
  const ptrs = Object.entries(s.ptr).filter(([, x]) => typeof x === "number") as [string, number][];
  return (
    <div>
      <Block title="Now">
        {cmp ? (
          <p className="readout text-lg">
            <span className="text-st-open">{cmp.buf ? bv(cmp.i) : v(cmp.i)}</span>
            <span className="px-2 text-ink-3">vs</span>
            <span className="text-st-open">{cmp.buf ? bv(cmp.j) : v(cmp.j)}</span>
            <span className="ml-3 text-sm text-ink-2">{cmp.res ? "→ act" : "→ keep"}</span>
          </p>
        ) : s.swap ? (
          <p className="readout text-lg text-signal-ink">
            swap {v(s.swap[0])} ↔ {v(s.swap[1])}
          </p>
        ) : (
          <p className="text-sm text-ink-3">
            {cursor === 0 ? "Nothing compared yet." : "No comparison on this step."}
          </p>
        )}
      </Block>
      {ptrs.length > 0 && (
        <Block title="Pointers">
          <dl className="grid grid-cols-4 gap-2">
            {ptrs.map(([k, x]) => (
              <div key={k} className="flex flex-col">
                <dt className="label">{k}</dt>
                <dd className="readout text-sm">
                  {x}
                  {v(x) !== null && x < n && <span className="text-ink-3"> · {v(x)}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </Block>
      )}
      {(run.algo === "quick" || run.algo === "merge") && (
        <Block title="Call stack" meta={`depth ${s.stack.length}`}>
          {s.stack.length === 0 ? (
            <p className="text-sm text-ink-3">Empty.</p>
          ) : (
            <ol className="readout space-y-0.5 text-sm">
              {s.stack.slice(-8).map((f, i, arr) => (
                <li
                  key={`${f.lo}-${f.hi}-${i}`}
                  className={cn(
                    "animate-entry-in",
                    i === arr.length - 1 ? "text-ink" : "text-ink-3",
                  )}
                  style={{ paddingLeft: Math.min(i, 6) * 10 }}
                >
                  {run.algo === "quick" ? "quicksort" : "mergesort"}({f.lo}, {f.hi})
                </li>
              ))}
            </ol>
          )}
        </Block>
      )}
      {run.algo === "merge" && s.buffer && (
        <Block title="Merge buffer" meta={`${s.bufferLo}..${s.bufferLo + s.buffer.length - 1}`}>
          <p className="readout break-words text-sm">
            {s.buffer.map((id) => (id >= 0 ? s.values[id] : "·")).join("  ")}
          </p>
        </Block>
      )}
      <Block title="Totals">
        <Readouts
          items={[
            ["Compares", s.compares],
            ["Swaps", s.swaps],
            ["Writes", s.writes],
            ["n", n],
            ["n²/2", Math.round((n * n) / 2)],
            ["n log n", Math.round(n * Math.log2(n))],
          ]}
        />
      </Block>
    </div>
  );
}

function SearchState({ run, cursor }: { run: Extract<Run, { family: "search" }>; cursor: number }) {
  const s = run.player.at(cursor).state;
  const n = s.values.length;
  const cand = s.done ? 0 : Math.max(0, s.hi - s.lo + 1);
  return (
    <div>
      <Block title="Now">
        {s.probe >= 0 ? (
          <p className="readout text-lg">
            a[{s.probe}] = <span className="text-st-open">{s.values[s.probe]}</span>
            <span className="px-2 text-ink-3">{s.cmp}</span>
            <span className="text-signal-ink">{s.target}</span>
          </p>
        ) : (
          <p className="text-sm text-ink-3">Looking for {s.target}.</p>
        )}
      </Block>
      <Block title="Range">
        <Readouts
          items={[
            ["lo", s.done ? "—" : s.lo],
            ["hi", s.done ? "—" : s.hi],
            ["Candidates", `${cand}/${n}`],
          ]}
        />
        <div className="mt-3 h-1.5 w-full bg-sunken" aria-hidden="true">
          <div
            className="h-full bg-ink transition-[width] duration-med ease-out"
            style={{ width: `${(cand / n) * 100}%` }}
          />
        </div>
      </Block>
      <Block title="Probe budget">
        <Readouts
          items={[
            ["Used", s.probes, s.found >= 0 ? "path" : undefined],
            ["⌈log₂(n+1)⌉", Math.ceil(Math.log2(n + 1))],
            ["√n", Math.round(Math.sqrt(n))],
          ]}
        />
      </Block>
    </div>
  );
}

function GraphState({ run, cursor }: { run: Extract<Run, { family: "graph" }>; cursor: number }) {
  const s = run.player.at(cursor).state;
  const { edges, nodes } = run.input;
  const comps = new Set(nodes.map((_, i) => findRoot(s.uf, i))).size;
  const lbl = (e: number) => `${edges[e][0]}–${edges[e][1]}`;
  return (
    <div>
      <Block title="Now">
        <Readouts
          items={[
            ["Edge", s.current >= 0 ? lbl(s.current) : "—", "signal"],
            ["Weight", s.current >= 0 ? edges[s.current][2] : "—"],
            ["Tree total", s.total, "path"],
          ]}
        />
      </Block>
      {run.algo === "prim" ? (
        <Block title="Candidate heap · by weight" meta={`${s.candidates.length} waiting`}>
          {s.candidates.length === 0 ? (
            <p className="text-sm text-ink-3">Empty.</p>
          ) : (
            <table className="readout w-full text-sm">
              <tbody>
                {[...s.candidates]
                  .sort((a, b) => edges[a][2] - edges[b][2] || a - b)
                  .slice(0, 10)
                  .map((e, i) => {
                    const stale = s.inTree[edges[e][0]] && s.inTree[edges[e][1]];
                    return (
                      <tr
                        key={i}
                        className={cn(i === 0 && "bg-sunken", stale && "text-ink-3 line-through")}
                      >
                        <td className="w-6 py-0.5 pl-1 text-ink-3">{i === 0 ? "→" : i + 1}</td>
                        <td className="py-0.5">{lbl(e)}</td>
                        <td className="py-0.5 pr-1 text-right">{edges[e][2]}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </Block>
      ) : (
        <Block title="Sorted edges" meta={`${comps} fragment${comps === 1 ? "" : "s"}`}>
          <ol className="readout max-h-64 overflow-auto text-sm">
            {s.order.map((e, i) => {
              const status =
                s.edgeState[e] === EDGE_TREE ? "in tree" : s.edgeState[e] === 3 ? "cycle" : "";
              return (
                <li
                  key={e}
                  className={cn(
                    "flex justify-between px-1 py-0.5",
                    s.current === e && "bg-sunken text-ink",
                    status === "cycle" && "text-ink-3 line-through",
                    status === "in tree" && "text-st-path",
                  )}
                >
                  <span>
                    <span className="inline-block w-6 text-ink-3">{i + 1}</span>
                    {lbl(e)}
                  </span>
                  <span>{edges[e][2]}</span>
                </li>
              );
            })}
          </ol>
        </Block>
      )}
      <Block title="Totals">
        <Readouts
          items={[
            ["Tree edges", `${s.treeEdges}/${nodes.length - 1}`],
            ["Rejected", s.rejected],
            ["Fragments", comps],
          ]}
        />
      </Block>
    </div>
  );
}

function Spark({ values, highlight }: { values: number[]; highlight?: number }) {
  if (values.length < 2) return null;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pts = values
    .map(
      (v, i) =>
        `${(i / (values.length - 1)) * 100},${28 - ((v - lo) / Math.max(1e-9, hi - lo)) * 26}`,
    )
    .join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-8 w-full" aria-hidden="true">
      <polyline
        points={pts}
        fill="none"
        stroke="rgb(var(--ink-2))"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      {highlight !== undefined && (
        <circle
          cx={(highlight / (values.length - 1)) * 100}
          cy={28 - ((values[highlight] - lo) / Math.max(1e-9, hi - lo)) * 26}
          r="2"
          fill="rgb(var(--signal))"
        />
      )}
    </svg>
  );
}

function KMeansState({ run, cursor }: { run: Extract<Run, { family: "kmeans" }>; cursor: number }) {
  const s = run.player.at(cursor).state;
  const counts = s.centroids.map((_, i) =>
    s.assign ? s.assign.reduce((a, x) => a + (x === i ? 1 : 0), 0) : 0,
  );
  return (
    <div>
      <Block title="Now">
        <Readouts
          items={[
            ["Phase", s.phase, "signal"],
            ["Iteration", s.iteration],
            ["Switched", s.assign ? s.changed : "—"],
          ]}
        />
      </Block>
      <Block title="Clusters">
        <table className="readout w-full text-sm">
          <thead>
            <tr className="text-left text-2xs text-ink-3">
              <th className="pb-1 font-normal">#</th>
              <th className="pb-1 text-right font-normal">points</th>
              <th className="pb-1 text-right font-normal">centroid</th>
            </tr>
          </thead>
          <tbody>
            {s.centroids.map((c, i) => (
              <tr key={i}>
                <td className="py-0.5">
                  <span
                    className="mr-2 inline-block h-2.5 w-2.5 align-middle"
                    style={{ background: CLUSTER_COLORS[i % CLUSTER_COLORS.length] }}
                  />
                  {i + 1}
                </td>
                <td
                  className={cn(
                    "py-0.5 text-right",
                    s.assign && counts[i] === 0 && "text-signal-ink",
                  )}
                >
                  {s.assign ? counts[i] : "—"}
                </td>
                <td className="py-0.5 text-right text-ink-2">
                  ({c.x.toFixed(2)}, {c.y.toFixed(2)})
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Block>
      <Block title="Inertia" meta={s.inertia !== null ? s.inertia.toFixed(4) : "—"}>
        {s.history.length > 1 ? (
          <Spark values={s.history} highlight={s.history.length - 1} />
        ) : (
          <p className="text-sm text-ink-3">Appears after the first assignment.</p>
        )}
        <p className="mt-1 text-xs text-ink-3">
          Sum of squared distances from each point to its centroid. Never increases.
        </p>
      </Block>
    </div>
  );
}

function GradientState({
  run,
  cursor,
}: {
  run: Extract<Run, { family: "gradient" }>;
  cursor: number;
}) {
  const s = run.player.at(cursor).state;
  const opt = bestFit(run.input.points);
  const f = (v: number) => (Math.abs(v) >= 1000 ? v.toExponential(2) : v.toFixed(4));
  return (
    <div>
      <Block title="Parameters">
        <Readouts
          items={[
            ["m", f(s.m)],
            ["b", f(s.b)],
            [
              "Loss",
              s.phase === "diverged" ? "∞" : f(s.loss),
              s.phase === "diverged" ? "signal" : undefined,
            ],
          ]}
        />
      </Block>
      <Block title="Gradient">
        <Readouts
          items={[
            ["∂L/∂m", f(s.gm)],
            ["∂L/∂b", f(s.gb)],
            ["|∇|", f(Math.hypot(s.gm, s.gb))],
          ]}
        />
        {run.params.beta > 0 && (
          <div className="mt-3">
            <Readouts
              items={[
                ["v_m", f(s.vm)],
                ["v_b", f(s.vb)],
                ["β", run.params.beta],
              ]}
            />
          </div>
        )}
      </Block>
      <Block title="Target">
        <Readouts
          items={[
            ["best m", opt.m.toFixed(4), "path"],
            ["best b", opt.b.toFixed(4), "path"],
            ["lr", run.params.lr],
          ]}
        />
      </Block>
    </div>
  );
}
