import { useMemo, useRef } from "react";
import { useAlgoscope } from "@/store/useAlgoscope";
import { deriveGrid } from "@/core";
import type { GridEvent } from "@/core";
import { cn } from "@/lib/utils";

export function GridStage() {
  const grid = useAlgoscope((s) => s.grid);
  const trace = useAlgoscope((s) => s.trace);
  const cursor = useAlgoscope((s) => s.cursor);
  const paintCell = useAlgoscope((s) => s.paintCell);
  const painting = useRef(false);

  const frame = useMemo(() => {
    if (trace?.family === "pathfinding") {
      return deriveGrid(trace.events as GridEvent[], cursor);
    }
    return null;
  }, [trace, cursor]);

  const pathSet = useMemo(() => new Set(frame?.path ?? []), [frame]);
  const total = grid.width * grid.height;

  const roleOf = (cell: number): string => {
    if (cell === grid.start) return "start";
    if (cell === grid.target) return "target";
    if (pathSet.has(cell)) return "path";
    if (frame?.current === cell) return "current";
    if (frame?.frontier.has(cell)) return "frontier";
    if (frame?.visited.has(cell)) return "visited";
    if (grid.walls.has(cell)) return "wall";
    if (grid.weights.has(cell)) return "weight";
    return "empty";
  };

  return (
    <div
      className="grid h-full w-full gap-[3px]"
      style={{
        gridTemplateColumns: `repeat(${grid.width}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${grid.height}, minmax(0, 1fr))`,
      }}
      onMouseLeave={() => (painting.current = false)}
      onMouseUp={() => (painting.current = false)}
      role="grid"
      aria-label="Pathfinding grid"
    >
      {Array.from({ length: total }, (_, cell) => {
        const role = roleOf(cell);
        return (
          <button
            key={cell}
            data-role={role}
            aria-label={`Cell ${cell}: ${role}`}
            onMouseDown={() => {
              painting.current = true;
              paintCell(cell);
            }}
            onMouseEnter={() => painting.current && paintCell(cell)}
            className={cn("rounded-[4px] outline outline-1 transition-[background,box-shadow,transform]", cellClass(role))}
          />
        );
      })}
    </div>
  );
}

function cellClass(role: string): string {
  switch (role) {
    case "start":
      return "bg-[var(--success)] outline-transparent shadow-[0_0_10px_oklch(0.74_0.16_162/0.45)]";
    case "target":
      return "bg-[var(--danger)] outline-transparent shadow-[0_0_10px_oklch(0.67_0.19_16/0.4)]";
    case "path":
      return "bg-[var(--cell-path)] outline-transparent shadow-[0_0_10px_oklch(0.82_0.14_78/0.4)]";
    case "current":
      return "z-10 scale-[1.07] bg-[var(--cell-current)] outline-transparent shadow-[0_0_14px_oklch(0.6_0.19_279/0.55)]";
    case "frontier":
      return "bg-[var(--cell-frontier)] outline-[oklch(0.6_0.19_279/0.25)]";
    case "visited":
      return "bg-[var(--cell-visited)] outline-transparent";
    case "wall":
      return "bg-[var(--cell-wall)] outline-[oklch(0.28_0.008_262/0.5)]";
    case "weight":
      return "bg-[var(--cell-weight)] outline-[oklch(0.55_0.08_68/0.35)]";
    default:
      return "bg-[var(--cell-empty)] outline-[oklch(0.22_0.008_262/0.5)] hover:outline-[oklch(0.45_0.1_279/0.5)]";
  }
}
