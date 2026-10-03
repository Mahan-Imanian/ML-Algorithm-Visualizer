import { getAlgo, lineOf } from "@/core/info";
import type { Run } from "@/core/experiment";
import { cn } from "@/lib/utils";

export function CodePanel({ run, cursor, tone }: { run: Run; cursor: number; tone?: "a" | "b" }) {
  const info = getAlgo(run.algo);
  const frame = run.player.at(cursor);
  const events = run.trace.events;
  const current = cursor > 0 ? lineOf(info, events[cursor - 1].op) : -1;
  const upcoming = cursor < events.length ? lineOf(info, events[cursor].op) : -1;
  const hits = frame.hits;

  return (
    <div
      className="relative font-mono text-[12.5px] leading-5"
      role="list"
      aria-label={`${info.name} pseudocode`}
    >
      {info.code.map((line, i) => {
        const count = line.op ? (hits[line.op] ?? 0) : 0;
        const active = i === current;
        return (
          <div
            key={i}
            role="listitem"
            aria-current={active ? "step" : undefined}
            className={cn(
              "relative flex items-start border-l-[3px] py-0.5 transition-[background-color,border-color] duration-med ease-out",
              active
                ? tone === "b"
                  ? "border-st-b bg-st-b/10"
                  : "border-signal bg-signal/10"
                : "border-transparent",
            )}
          >
            <span className="w-7 shrink-0 select-none pr-2 text-right text-2xs leading-5 text-ink-3">
              {i + 1}
            </span>
            <span
              className={cn(
                "w-3 shrink-0 select-none text-center text-2xs leading-5",
                i === upcoming && !active ? "text-ink-3" : "text-transparent",
              )}
              aria-hidden="true"
            >
              ›
            </span>
            <span
              className={cn(
                "min-w-0 flex-1 whitespace-pre-wrap break-words pr-2",
                active ? "font-medium text-ink" : "text-ink-2",
              )}
              style={{ paddingLeft: (line.depth ?? 0) * 12 }}
            >
              {line.text}
            </span>
            {line.op && (
              <span
                className={cn(
                  "readout w-11 shrink-0 pr-3 text-right text-2xs leading-5",
                  count ? "text-ink-2" : "text-transparent",
                )}
                aria-label={`executed ${count} times`}
              >
                ×{count}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
