import { useMemo } from "react";
import { metricsAt, variantLabel, type Run } from "@/core/experiment";
import { cn } from "@/lib/utils";
import { baseRate, SPEEDS, useLab } from "@/store/lab";
import { useElementSize } from "../hooks";
import { SortView, SearchView } from "./ArrayViews";
import { explain } from "./explain";
import { GraphView } from "./GraphView";
import { GridCanvas } from "./GridCanvas";
import { GradientView, KMeansView } from "./LearnViews";
import { TagAB } from "./Panels";

function useBarDuration() {
  const playing = useLab((s) => s.playing);
  const rate = useLab((s) => baseRate(s) * SPEEDS[s.speed]);
  if (!playing) return 200;
  return Math.max(0, Math.min(220, Math.round((1000 / Math.max(1, rate)) * 0.85)));
}

function Visual({
  run,
  cursor,
  which,
  diff,
}: {
  run: Run;
  cursor: number;
  which: "a" | "b";
  diff?: { run: Run; cursor: number } | null;
}) {
  const exp = useLab((s) => s.exp);
  const dur = useBarDuration();
  const label = `Run ${which.toUpperCase()}, ${variantLabel(which === "a" ? exp.a : exp.b!)}`;
  switch (run.family) {
    case "grid":
      return exp.family === "grid" ? (
        <GridCanvas
          run={run}
          cursor={cursor}
          input={exp.input}
          editable
          values={exp.view.values}
          diff={diff && diff.run.family === "grid" ? { run: diff.run, cursor: diff.cursor } : null}
          label={label}
        />
      ) : null;
    case "sort":
      return <SortView run={run} cursor={cursor} label={label} duration={dur} />;
    case "search":
      return <SearchView run={run} cursor={cursor} label={label} duration={dur} />;
    case "graph":
      return exp.family === "graph" ? (
        <GraphView run={run} cursor={cursor} input={exp.input} editable label={label} />
      ) : null;
    case "kmeans":
      return <KMeansView run={run} cursor={cursor} label={label} editable />;
    case "gradient":
      return <GradientView run={run} cursor={cursor} label={label} />;
  }
}

function PaneHeader({
  run,
  cursor,
  which,
  compare,
  overlay,
}: {
  run: Run;
  cursor: number;
  which: "a" | "b";
  compare: boolean;
  overlay?: boolean;
}) {
  const exp = useLab((s) => s.exp);
  const metrics = metricsAt(run, cursor);
  const v = which === "a" ? exp.a : exp.b!;
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-x-4 gap-y-1 border-b border-rule px-3 py-1.5">
      <div className="flex shrink-0 items-center gap-2">
        {compare && <TagAB which={which} />}
        <span className="text-sm font-medium">{variantLabel(v)}</span>
        {overlay && (
          <span className="flex items-center gap-1.5 text-xs text-ink-2">
            vs <TagAB which="b" /> {variantLabel(exp.b!)}
          </span>
        )}
      </div>
      <dl className="ml-auto flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
        {metrics.map((m) => (
          <div key={m.label} className="flex items-baseline gap-1.5">
            <dt className="whitespace-nowrap text-2xs text-ink-3">{m.label}</dt>
            <dd className="readout text-sm text-ink">{m.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function OverlayLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-rule px-3 py-1.5 text-xs text-ink-2">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 bg-st-a/50" /> only A expanded
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 bg-st-b/45" /> only B expanded
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 bg-st-closed" /> both
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 bg-st-a" /> A's path
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 border-t-2 border-dashed border-st-b" /> B's path
      </span>
    </div>
  );
}

export function Legend() {
  const exp = useLab((s) => s.exp);
  if (exp.family !== "grid") return null;
  const items: [string, string][] = [
    ["bg-st-open", "frontier"],
    ["bg-st-closed", "expanded"],
    ["bg-signal", "current"],
    ["bg-st-path", "path"],
    ["bg-st-wall", "wall"],
    ["bg-st-weight hatch", "mud"],
  ];
  return (
    <ul
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2"
      aria-label="Legend"
    >
      {items.map(([c, l]) => (
        <li key={l} className="flex items-center gap-1.5">
          <span className={cn("h-2.5 w-2.5 border border-rule-strong", c)} aria-hidden="true" />
          {l}
        </li>
      ))}
    </ul>
  );
}

export function Stage({ caption = true, narrow = false }: { caption?: boolean; narrow?: boolean }) {
  const runA = useLab((s) => s.runA);
  const runB = useLab((s) => s.runB);
  const cursorA = useLab((s) => s.cursorA);
  const cursorB = useLab((s) => s.cursorB);
  const overlay = useLab(
    (s) => (s.exp.view.overlay || narrow) && s.exp.family === "grid" && !!s.runB,
  );
  const [box, size] = useElementSize<HTMLDivElement>();
  const gw = useLab((s) => (s.exp.family === "grid" ? s.exp.input.w : 0));
  const gh = useLab((s) => (s.exp.family === "grid" ? s.exp.input.h : 0));
  const side = gw
    ? Math.min(size.w / 2 / gw, (size.h - 44) / gh) >= Math.min(size.w / gw, (size.h / 2 - 44) / gh)
    : size.w >= 720;
  const compare = !!runB;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={box}
        data-tour="stage"
        className={cn(
          "flex min-h-0 flex-1",
          compare && !overlay && (side ? "flex-row" : "flex-col"),
        )}
      >
        <Pane
          run={runA}
          cursor={cursorA}
          which="a"
          compare={compare}
          overlay={overlay}
          diff={overlay && runB ? { run: runB, cursor: cursorB } : null}
        />
        {runB && !overlay && (
          <>
            <div className={side ? "w-px bg-rule" : "h-px bg-rule"} />
            <Pane run={runB} cursor={cursorB} which="b" compare />
          </>
        )}
      </div>
      {caption && <NowCaption />}
    </div>
  );
}

function Pane({
  run,
  cursor,
  which,
  compare,
  overlay,
  diff,
}: {
  run: Run;
  cursor: number;
  which: "a" | "b";
  compare: boolean;
  overlay?: boolean;
  diff?: { run: Run; cursor: number } | null;
}) {
  return (
    <section
      className="flex min-h-0 min-w-0 flex-1 flex-col"
      aria-label={`Run ${which.toUpperCase()}`}
    >
      <PaneHeader run={run} cursor={cursor} which={which} compare={compare} overlay={overlay} />
      <div
        className={cn(
          "relative min-h-0 flex-1",
          run.family === "sort" || run.family === "search" ? "px-4 pb-2 pt-6" : "p-2",
        )}
      >
        <Visual run={run} cursor={cursor} which={which} diff={diff} />
      </div>
      {overlay && <OverlayLegend />}
    </section>
  );
}

export function NowCaption() {
  const runA = useLab((s) => s.runA);
  const runB = useLab((s) => s.runB);
  const cursorA = useLab((s) => s.cursorA);
  const cursorB = useLab((s) => s.cursorB);
  const playing = useLab((s) => s.playing);
  const editing = useLab((s) => s.editing);
  const a = useMemo(() => explain(runA, cursorA), [runA, cursorA]);
  const b = useMemo(() => (runB ? explain(runB, cursorB) : null), [runB, cursorB]);
  if (editing) {
    return (
      <div className="border-t border-rule bg-surface px-4 py-3 text-sm text-ink-2" role="status">
        Editing the input. Release to re-run.
      </div>
    );
  }
  return (
    <div className="border-t border-rule bg-surface" data-tour="now">
      <Line e={a} tag={runB ? "a" : undefined} />
      {b && <Line e={b} tag="b" />}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {playing ? "" : `${a.now}. ${a.why}`}
      </div>
    </div>
  );
}

function Line({ e, tag }: { e: ReturnType<typeof explain>; tag?: "a" | "b" }) {
  return (
    <div className="flex gap-3 border-b border-rule px-4 py-2.5 last:border-b-0">
      {tag && <TagAB which={tag} className="mt-0.5" />}
      <div className="min-w-0 flex-1">
        <p className="readout text-sm font-medium text-ink">{e.now}</p>
        <p className="mt-0.5 text-sm text-ink-2">{e.why}</p>
        {e.next && (
          <p className="mt-1 truncate text-xs text-ink-3">
            <span className="label mr-1.5">Next</span>
            {e.next}
          </p>
        )}
      </div>
    </div>
  );
}
