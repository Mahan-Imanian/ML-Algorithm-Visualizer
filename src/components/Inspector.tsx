import { useMemo } from "react";
import { useAlgoscope } from "@/store/useAlgoscope";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getAlgorithm, deriveGrid, deriveSort } from "@/core";
import type { GridEvent, SortEvent, LearnFrame } from "@/core";
import { cn } from "@/lib/utils";

interface Derived {
  note: string;
  line: number;
  metrics: { label: string; value: string }[];
}

export function Inspector() {
  const { trace, cursor, algoId, inspectorTab, setInspectorTab, setCursor } = useAlgoscope();
  const algo = getAlgorithm(algoId);

  const derived = useMemo<Derived>(() => {
    if (!trace) return { note: "Run an algorithm to populate the inspector.", line: -1, metrics: [] };
    if (trace.family === "pathfinding") {
      const f = deriveGrid(trace.events as GridEvent[], cursor);
      return {
        note: f.note,
        line: f.line,
        metrics: [
          { label: "visited", value: String(f.visited.size) },
          { label: "frontier", value: String(f.frontier.size) },
          { label: "path", value: String(Math.max(0, f.path.length - 1)) },
        ],
      };
    }
    if (trace.family === "sorting") {
      const f = deriveSort(trace.initial, trace.events as SortEvent[], cursor);
      const slice = trace.events.slice(0, cursor + 1) as SortEvent[];
      return {
        note: f.note,
        line: f.line,
        metrics: [
          { label: "comparisons", value: String(slice.filter((e) => e.t === "compare").length) },
          { label: "swaps", value: String(slice.filter((e) => e.t === "swap").length) },
        ],
      };
    }
    const f = trace.events[cursor] as LearnFrame;
    return {
      note: f.note,
      line: f.line,
      metrics:
        f.kind === "kmeans"
          ? [
              { label: "iteration", value: String(f.iteration + 1) },
              { label: "inertia", value: f.inertia.toFixed(3) },
            ]
          : [
              { label: "step", value: String(f.iteration + 1) },
              { label: "loss", value: f.loss.toFixed(4) },
            ],
    };
  }, [trace, cursor]);

  const activeLine = Math.min(derived.line, algo.pseudocode.length - 1);

  return (
    <Tabs
      value={inspectorTab}
      onValueChange={(v) => setInspectorTab(v as typeof inspectorTab)}
      className="grid h-full grid-rows-[40px_minmax(0,1fr)] overflow-hidden"
    >
      <TabsList className="gap-0 border-b border-border px-1">
        <TabsTrigger value="state">State</TabsTrigger>
        <TabsTrigger value="trace">Trace</TabsTrigger>
        <TabsTrigger value="code">Pseudocode</TabsTrigger>
      </TabsList>

      <TabsContent value="state" className="flex min-h-0 flex-col gap-3 overflow-auto p-3">
        <div>
          <div className="text-[13px] font-semibold text-foreground">{algo.name}</div>
          <div className="font-mono text-[10px] text-[var(--primary-text)]">{algo.meta}</div>
        </div>
        <p className="min-h-9 rounded-md border border-border bg-surface-2 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
          {derived.note}
        </p>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border">
          {derived.metrics.map((m) => (
            <div key={m.label} className="flex flex-col gap-1 bg-surface-2 px-3 py-2.5">
              <dt className="font-mono text-[10px] text-muted-foreground">{m.label}</dt>
              <dd className="m-0 font-mono text-[19px] tabular-nums leading-none text-foreground">
                {m.value}
              </dd>
            </div>
          ))}
        </dl>
      </TabsContent>

      <TabsContent value="trace" className="min-h-0 overflow-auto p-2">
        {trace ? (
          <div className="flex flex-col gap-0.5">
            {trace.events.map((e, i) => {
              const note = "note" in e ? e.note : "";
              return (
                <button
                  key={i}
                  onClick={() => setCursor(i)}
                  className={cn(
                    "flex items-baseline gap-2 rounded px-2 py-1.5 text-left font-mono text-[11px] transition-colors",
                    i === cursor
                      ? "bg-[var(--primary-soft)] text-foreground"
                      : "text-muted-foreground hover:bg-surface-2",
                  )}
                >
                  <span className="min-w-7 text-faint">{i}</span>
                  <span className="flex-1 leading-snug">{note}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="px-1 py-1 font-mono text-[11px] text-faint">No trace yet.</p>
        )}
      </TabsContent>

      <TabsContent value="code" className="min-h-0 overflow-auto p-3">
        <div className="overflow-hidden rounded-md border border-border bg-background font-mono">
          {algo.pseudocode.map((line, i) => (
            <div
              key={i}
              className={cn(
                "flex items-baseline transition-colors",
                i === activeLine ? "bg-[var(--accent)]/15 text-foreground" : "text-muted-foreground",
              )}
            >
              <span className="w-8 flex-shrink-0 border-r border-border px-2 py-1.5 text-right text-[10px] text-faint">
                {i + 1}
              </span>
              <span className="whitespace-pre px-3 py-1.5 text-[11px]">{line}</span>
            </div>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}
