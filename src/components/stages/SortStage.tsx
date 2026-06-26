import { useMemo } from "react";
import { useAlgoscope } from "@/store/useAlgoscope";
import { deriveSort } from "@/core";
import type { SortEvent } from "@/core";
import { cn } from "@/lib/utils";

export function SortStage() {
  const sortInput = useAlgoscope((s) => s.sortInput);
  const trace = useAlgoscope((s) => s.trace);
  const cursor = useAlgoscope((s) => s.cursor);

  const frame = useMemo(() => {
    if (trace?.family === "sorting") {
      return deriveSort(trace.initial, trace.events as SortEvent[], cursor);
    }
    return null;
  }, [trace, cursor]);

  const values = frame?.array ?? sortInput;
  const max = Math.max(...values, 1);

  const roleOf = (i: number): string => {
    if (!frame) return "idle";
    if (frame.swapping.includes(i)) return "swap";
    if (frame.comparing.includes(i)) return "compare";
    if (frame.pivot === i) return "pivot";
    if (frame.sorted.has(i)) return "sorted";
    return "idle";
  };

  return (
    <div className="flex h-full w-full items-end justify-center gap-[5px]">
      {values.map((v, i) => {
        const role = roleOf(i);
        return (
          <div
            key={i}
            className={cn(
              "min-w-[4px] max-w-[28px] flex-1 rounded-t-[4px] transition-[height,background,transform,box-shadow] duration-200",
              role === "swap" && "-translate-y-[7px] bg-[var(--danger)]",
              role === "compare" && "-translate-y-[4px] bg-[var(--accent)]",
              role === "pivot" && "bg-[var(--info)] shadow-[0_0_0_2px_var(--primary)]",
              role === "sorted" && "bg-[var(--success)]",
              role === "idle" && "bg-[var(--info)]",
            )}
            style={{ height: `${(v / max) * 100}%` }}
          />
        );
      })}
    </div>
  );
}
