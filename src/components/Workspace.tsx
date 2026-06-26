import { useState, type ReactNode } from "react";
import { ChevronDown, Eraser, Square, Weight, Trash2, Shuffle } from "lucide-react";
import { useAlgoscope } from "@/store/useAlgoscope";
import { algorithmsByFamily, getAlgorithm, deriveGrid } from "@/core";
import type { Family, GridEvent } from "@/core";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GridStage } from "./stages/GridStage";
import { SortStage } from "./stages/SortStage";
import { LearnStage } from "./stages/LearnStage";

const FAMILIES: { id: Family; label: string }[] = [
  { id: "pathfinding", label: "Pathfinding" },
  { id: "sorting", label: "Sorting" },
  { id: "learning", label: "Learning" },
];

const LEGEND = [
  { label: "start", color: "var(--success)" },
  { label: "target", color: "var(--danger)" },
  { label: "frontier", color: "var(--cell-frontier)" },
  { label: "visited", color: "var(--cell-visited)" },
  { label: "path", color: "var(--cell-path)" },
  { label: "wall", color: "var(--cell-wall)" },
];

export function Workspace() {
  const { family, algoId, setFamily, setAlgo, tool, setTool, clearGrid, regenerateData, trace, cursor } =
    useAlgoscope();
  const [pickerOpen, setPickerOpen] = useState(false);
  const algo = getAlgorithm(algoId);

  const status =
    trace?.family === "pathfinding"
      ? deriveGrid(trace.events as GridEvent[], cursor).note
      : family === "pathfinding"
        ? "Draw terrain, then run the trace."
        : "Press Run to record a trace.";

  return (
    <section className="grid min-h-0 grid-rows-[50px_minmax(0,1fr)] overflow-hidden rounded-xl border border-border bg-surface-1">
      <div className="flex items-center gap-3 border-b border-border px-3">
        <div className="flex gap-1">
          {FAMILIES.map((f) => (
            <button
              key={f.id}
              onClick={() => setFamily(f.id)}
              className={cn(
                "h-7 rounded-md border px-3 text-[12px] font-medium transition-colors",
                family === f.id
                  ? "border-border bg-surface-3 text-foreground"
                  : "border-transparent text-muted-foreground hover:bg-surface-2 hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative w-[min(300px,40%)]">
          <button
            onClick={() => setPickerOpen((o) => !o)}
            onBlur={() => setTimeout(() => setPickerOpen(false), 120)}
            aria-haspopup="listbox"
            aria-expanded={pickerOpen}
            className="flex h-[34px] w-full items-center justify-between gap-2 rounded-md border border-border bg-surface-2 px-2.5 text-left hover:border-foreground/30"
          >
            <span className="flex min-w-0 flex-col">
              <strong className="truncate text-[12px] font-semibold leading-tight text-foreground">
                {algo.name}
              </strong>
              <small className="font-mono text-[10px] text-muted-foreground">{algo.meta}</small>
            </span>
            <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
          </button>
          {pickerOpen && (
            <div
              role="listbox"
              className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-80 overflow-auto rounded-lg border border-border bg-surface-3 p-1.5 shadow-[0_20px_50px_oklch(0_0_0/0.5)]"
            >
              {algorithmsByFamily(family).map((a) => (
                <button
                  key={a.id}
                  role="option"
                  aria-selected={a.id === algoId}
                  onClick={() => {
                    setAlgo(a.id);
                    setPickerOpen(false);
                  }}
                  className={cn(
                    "block w-full rounded-md px-2.5 py-2 text-left transition-colors hover:bg-[var(--primary-soft)]",
                    a.id === algoId && "bg-[var(--primary-soft)]",
                  )}
                >
                  <strong className="block text-[12px] font-semibold text-foreground">{a.name}</strong>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{a.blurb}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {family === "pathfinding" ? (
            <>
              <ToolButton active={tool === "wall"} onClick={() => setTool("wall")} icon={<Square size={13} />} label="Wall" />
              <ToolButton active={tool === "weight"} onClick={() => setTool("weight")} icon={<Weight size={13} />} label="Weight" />
              <ToolButton active={tool === "erase"} onClick={() => setTool("erase")} icon={<Eraser size={13} />} label="Erase" />
              <Button variant="ghost" size="icon" onClick={clearGrid} aria-label="Clear grid" title="Clear grid">
                <Trash2 size={14} />
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={regenerateData} className="gap-1.5">
              <Shuffle size={13} /> New data
            </Button>
          )}
        </div>
      </div>

      <div className="relative m-2.5 overflow-hidden rounded-lg border border-border bg-background">
        <div className="pointer-events-none absolute left-3.5 top-3 z-[4] font-mono text-[11px] text-muted-foreground">
          {status}
        </div>
        {family === "pathfinding" && (
          <div className="pointer-events-none absolute right-3.5 top-3 z-[4] flex flex-wrap justify-end gap-2">
            {LEGEND.map((l) => (
              <span key={l.label} className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                <span className="h-2 w-2 rounded-[2px]" style={{ background: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        )}
        <div className="absolute inset-x-3.5 bottom-3.5 top-[42px]">
          {family === "pathfinding" && <GridStage />}
          {family === "sorting" && <SortStage />}
          {family === "learning" && <LearnStage />}
        </div>
      </div>
    </section>
  );
}

function ToolButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Button variant={active ? "soft" : "outline"} onClick={onClick} className="gap-1.5" title={label}>
      {icon}
      <span className="hidden lg:inline">{label}</span>
    </Button>
  );
}
