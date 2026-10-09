import { useMemo } from "react";
import { metricsAt, variantLabel, type Run } from "@/core/experiment";
import { getAlgo } from "@/core/info";
import { cn } from "@/lib/utils";
import { useLab } from "@/store/lab";
import { useLiveCursor, usePresented, usePresentedCursor } from "../clock";
import { useElementSize } from "../hooks";
import { useCommitCounter } from "../perf";
import { SearchView, SortView } from "./ArrayViews";
import { explain } from "./explain";
import { GraphView } from "./GraphView";
import { GridCanvas } from "./GridCanvas";
import { GradientView, KMeansView } from "./LearnViews";
import { TagAB } from "./Panels";

function LiveGraph({
  run,
  which,
  label,
}: {
  run: Extract<Run, { family: "graph" }>;
  which: "a" | "b";
  label: string;
}) {
  const exp = useLab((s) => s.exp);
  const cursor = useLiveCursor(which);
  return exp.family === "graph" ? (
    <GraphView run={run} cursor={cursor} input={exp.input} editable label={label} />
  ) : null;
}

function LiveKMeans({
  run,
  which,
  label,
}: {
  run: Extract<Run, { family: "kmeans" }>;
  which: "a" | "b";
  label: string;
}) {
  const cursor = useLiveCursor(which);
  return <KMeansView run={run} cursor={cursor} label={label} editable />;
}

function LiveGradient({
  run,
  which,
  label,
}: {
  run: Extract<Run, { family: "gradient" }>;
  which: "a" | "b";
  label: string;
}) {
  const cursor = useLiveCursor(which);
  return <GradientView run={run} cursor={cursor} label={label} />;
}

function Visual({ run, which, diff }: { run: Run; which: "a" | "b"; diff: Run | null }) {
  useCommitCounter("visual shell");
  const exp = useLab((s) => s.exp);
  const label = `Run ${which.toUpperCase()}, ${variantLabel(which === "a" ? exp.a : exp.b!)}`;
  switch (run.family) {
    case "grid":
      return exp.family === "grid" ? (
        <GridCanvas
          run={run}
          which={which}
          diff={diff && diff.family === "grid" ? diff : null}
          input={exp.input}
          editable
          values={exp.view.values}
          label={label}
        />
      ) : null;
    case "sort":
      return <SortView run={run} which={which} label={label} />;
    case "search":
      return <SearchView run={run} which={which} label={label} />;
    case "graph":
      return <LiveGraph run={run} which={which} label={label} />;
    case "kmeans":
      return <LiveKMeans run={run} which={which} label={label} />;
    case "gradient":
      return <LiveGradient run={run} which={which} label={label} />;
  }
}

function PaneHeader({
  run,
  which,
  compare,
  overlay,
}: {
  run: Run;
  which: "a" | "b";
  compare: boolean;
  overlay?: boolean;
}) {
  const exp = useLab((s) => s.exp);
  const runB = useLab((s) => s.runB);
  const cursor = usePresentedCursor(which);
  const cursorB = usePresentedCursor("b");
  const metrics = metricsAt(run, cursor);
  const v = which === "a" ? exp.a : exp.b!;
  if (overlay && runB) {
    const mb = metricsAt(runB, cursorB);
    const pick = (ms: typeof metrics) => ms.filter((m) => m.label !== "Frontier");
    return (
      <div className="flex h-9 shrink-0 items-center gap-4 overflow-hidden whitespace-nowrap border-b border-rule bg-surface px-3 max-sm:gap-3">
        {(
          [
            ["a", exp.a, pick(metrics)],
            ["b", exp.b!, pick(mb)],
          ] as const
        ).map(([tag, variant, ms]) => (
          <div key={tag} className="flex min-w-0 items-center gap-3">
            <TagAB which={tag} className="shrink-0" />
            <span className="truncate text-sm font-medium max-md:hidden">
              {variantLabel(variant)}
            </span>
            <span className="shrink-0 text-sm font-medium md:hidden">
              {getAlgo(variant.algo).short}
            </span>
            <dl className="flex shrink-0 items-baseline gap-x-3">
              {ms.map((m) => (
                <div
                  key={m.label}
                  className="flex items-baseline gap-1.5 max-md:[&:not(:first-child)]:hidden max-2xl:[&:nth-child(3)]:hidden"
                >
                  <dt className="text-2xs text-ink-3">{m.label}</dt>
                  <dd className="readout min-w-[3ch] text-right text-sm tabular-nums text-ink">
                    {m.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="flex h-9 shrink-0 items-center gap-4 overflow-hidden whitespace-nowrap border-b border-rule bg-surface px-3">
      <div className="flex min-w-0 shrink items-center gap-2">
        {compare && <TagAB which={which} />}
        <span className="truncate text-sm font-medium">{variantLabel(v)}</span>
        {overlay && (
          <span className="flex items-center gap-1.5 text-xs text-ink-2">
            vs <TagAB which="b" /> {variantLabel(exp.b!)}
          </span>
        )}
      </div>
      <dl className="ml-auto flex shrink-0 items-baseline gap-x-4">
        {metrics.map((m, i) => (
          <div
            key={m.label}
            className={cn("flex items-baseline gap-1.5", i > 1 && "max-sm:hidden")}
          >
            <dt className="text-2xs text-ink-3">{m.label}</dt>
            <dd className="readout min-w-[4ch] text-right text-sm tabular-nums text-ink">
              {m.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function OverlayLegend() {
  return (
    <div className="flex h-7 shrink-0 items-center gap-x-4 overflow-hidden whitespace-nowrap border-t border-rule bg-surface px-3 text-xs text-ink-2">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 bg-st-a/50" /> only A
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 bg-st-b/45" /> only B
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 bg-st-closed" /> both
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 bg-st-a" /> A path
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 border-t-2 border-dashed border-st-b" /> B path
      </span>
    </div>
  );
}

export function Legend() {
  const exp = useLab((s) => s.exp);
  const items: [string, string][] =
    exp.family === "grid"
      ? [
          ["bg-st-open", "frontier"],
          ["bg-st-closed", "expanded"],
          ["bg-signal", "current"],
          ["bg-st-path", "path"],
          ["bg-st-wall", "wall"],
          ["bg-st-weight hatch", "mud"],
        ]
      : exp.family === "sort"
        ? [
            ["bg-st-open", "compared"],
            ["bg-signal", "moved"],
            ["bg-ink", "pivot"],
            ["bg-st-path", "sorted"],
            ["bg-sunken", "active range"],
          ]
        : exp.family === "search"
          ? [
              ["bg-sunken", "candidate range"],
              ["bg-st-open", "probe"],
              ["bg-st-path", "found"],
              ["bg-signal", "target value"],
            ]
          : exp.family === "graph"
            ? [
                ["bg-st-open", "candidate edge"],
                ["bg-signal", "edge under test"],
                ["bg-st-path", "tree edge"],
                ["bg-ink", "node in tree"],
              ]
            : exp.model === "kmeans"
              ? [
                  ["bg-ink-3", "unassigned"],
                  ["bg-sunken", "region of nearest centroid"],
                ]
              : [
                  ["bg-ink", "current fit"],
                  ["bg-signal", "residual / descent path"],
                  ["bg-st-path", "least-squares optimum"],
                ];
  return (
    <ul
      className="flex h-7 items-center gap-x-3 overflow-hidden whitespace-nowrap text-xs text-ink-2"
      aria-label="Legend"
    >
      {items.map(([c, l]) => (
        <li key={l} className="flex shrink-0 items-center gap-1.5">
          <span className={cn("h-2.5 w-2.5 border border-rule-strong", c)} aria-hidden="true" />
          {l}
        </li>
      ))}
    </ul>
  );
}

export function Stage({ narrow = false, bare = false }: { narrow?: boolean; bare?: boolean }) {
  const runA = useLab((s) => s.runA);
  const runB = useLab((s) => s.runB);
  const overlay = useLab(
    (s) => (s.exp.view.overlay || narrow) && s.exp.family === "grid" && !!s.runB,
  );
  const [box, size] = useElementSize<HTMLDivElement>();
  const gw = useLab((s) => (s.exp.family === "grid" ? s.exp.input.w : 0));
  const gh = useLab((s) => (s.exp.family === "grid" ? s.exp.input.h : 0));
  const side = gw
    ? Math.min(size.w / 2 / gw, (size.h - 36) / gh) >= Math.min(size.w / gw, (size.h / 2 - 36) / gh)
    : size.w >= 720;
  const compare = !!runB;

  return (
    <div
      ref={box}
      data-tour="stage"
      className={cn(
        "flex h-full min-h-0 w-full [contain:strict]",
        compare && !overlay && (side ? "flex-row" : "flex-col"),
      )}
    >
      <Pane
        run={runA}
        which="a"
        compare={compare}
        overlay={overlay}
        diff={overlay ? runB : null}
        bare={bare && !compare}
      />
      {runB && !overlay && (
        <>
          <div className={side ? "w-px shrink-0 bg-rule" : "h-px shrink-0 bg-rule"} />
          <Pane run={runB} which="b" compare diff={null} />
        </>
      )}
    </div>
  );
}

function Pane({
  run,
  which,
  compare,
  overlay,
  diff,
  bare,
}: {
  run: Run;
  which: "a" | "b";
  compare: boolean;
  overlay?: boolean;
  diff: Run | null;
  bare?: boolean;
}) {
  return (
    <section
      className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col"
      aria-label={`Run ${which.toUpperCase()}`}
    >
      {!bare && <PaneHeader run={run} which={which} compare={compare} overlay={overlay} />}
      <div
        className={cn(
          "relative min-h-0 flex-1 basis-0 [contain:strict]",
          run.family === "sort" || run.family === "search" ? "px-4 pb-2 pt-6" : "p-2",
        )}
      >
        <Visual run={run} which={which} diff={diff} />
      </div>
      {overlay && <OverlayLegend />}
    </section>
  );
}

const CAPTION_H = "h-[104px]";

export function NowCaption({ large = false }: { large?: boolean }) {
  useCommitCounter("caption");
  const runA = useLab((s) => s.runA);
  const runB = useLab((s) => s.runB);
  const { a: cursorA, b: cursorB } = usePresented();
  const playing = useLab((s) => s.playing);
  const editing = useLab((s) => s.editing);
  const a = useMemo(() => explain(runA, cursorA), [runA, cursorA]);
  const b = useMemo(() => (runB ? explain(runB, cursorB) : null), [runB, cursorB]);
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden border-t border-rule bg-surface [contain:strict]",
        large ? "h-[132px]" : CAPTION_H,
        b && "grid grid-cols-2 divide-x divide-rule",
      )}
      data-tour="now"
    >
      {editing ? (
        <p className="px-4 py-3 text-sm text-ink-2" role="status">
          Editing the input. The run is recorded again when you release.
        </p>
      ) : (
        <>
          <Line e={a} tag={runB ? "a" : undefined} algo={getAlgo(runA.algo).short} large={large} />
          {b && runB && <Line e={b} tag="b" algo={getAlgo(runB.algo).short} large={large} />}
        </>
      )}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {playing || editing ? "" : `${a.now}. ${a.why}`}
      </div>
    </div>
  );
}

function Line({
  e,
  tag,
  algo,
  large,
}: {
  e: ReturnType<typeof explain>;
  tag?: "a" | "b";
  algo: string;
  large: boolean;
}) {
  return (
    <div className="flex min-w-0 gap-3 px-4 py-2.5">
      {tag && <TagAB which={tag} className="mt-0.5 shrink-0" />}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "readout truncate font-medium text-ink",
            large ? "h-7 text-lg leading-7" : "h-5 text-sm leading-5",
          )}
          title={e.now}
        >
          <span className="mr-2 text-signal-ink">{tag ? "" : `${algo} ·`}</span>
          {e.now}
        </p>
        <p
          className={cn(
            "mt-1 line-clamp-2 text-ink-2",
            large ? "h-12 text-md leading-6" : "h-10 text-sm leading-5",
          )}
        >
          {e.why}
        </p>
        <p className="mt-1 h-4 truncate text-xs leading-4 text-ink-3">
          {e.next && (
            <>
              <span className="label mr-1.5">Next</span>
              {e.next}
            </>
          )}
        </p>
      </div>
    </div>
  );
}
