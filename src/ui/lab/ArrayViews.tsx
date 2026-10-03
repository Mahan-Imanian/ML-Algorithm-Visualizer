import type { Run } from "@/core/experiment";
import { cn } from "@/lib/utils";
import { useElementSize } from "../hooks";

type SortRun = Extract<Run, { family: "sort" }>;
type SearchRun = Extract<Run, { family: "search" }>;

const POINTER_ORDER = ["lo", "i", "j", "min", "pivot", "child", "k", "mid", "hi", "end"];

export function SortView({
  run,
  cursor,
  label,
  duration,
}: {
  run: SortRun;
  cursor: number;
  label: string;
  duration: number;
}) {
  const [ref, size] = useElementSize<HTMLDivElement>();
  const s = run.player.at(cursor).state;
  const n = s.values.length;
  const max = Math.max(...s.values, 1);
  const hasBuffer = run.algo === "merge";
  const pointerH = 34;
  const W = size.w;
  const H = Math.max(0, size.h - pointerH);
  const mainH = hasBuffer ? H * 0.64 : H;
  const bufTop = mainH + 10;
  const bufH = hasBuffer ? H - bufTop : 0;
  const slot = n ? W / n : 0;
  const bw = Math.max(2, Math.min(slot * 0.74, slot - 1));
  const top = s.stack[s.stack.length - 1];
  const showValues = slot >= 20;
  const posOf = new Map<number, { at: number; buffer: boolean }>();
  s.order.forEach((id, i) => id >= 0 && posOf.set(id, { at: i, buffer: false }));
  s.buffer?.forEach((id, i) => id >= 0 && posOf.set(id, { at: s.bufferLo + i, buffer: true }));
  const cmp = s.compare;
  const pointers = Object.entries(s.ptr).filter(
    ([, v]) => v !== null && v !== undefined && (v as number) >= 0 && (v as number) <= n,
  ) as [string, number][];
  const heapEnd = run.algo === "heap" && typeof s.ptr.end === "number" ? s.ptr.end : null;

  const describe = `${label}: ${s.order
    .filter((x) => x >= 0)
    .map((id) => s.values[id])
    .join(", ")}`;

  return (
    <div
      ref={ref}
      className="relative h-full w-full"
      style={{ ["--bar-dur" as string]: `${duration}ms` }}
    >
      <svg
        width={W}
        height={size.h}
        className="block overflow-visible"
        role="img"
        aria-label={describe}
      >
        {top && top.hi >= top.lo && (
          <rect
            x={top.lo * slot}
            y={0}
            width={(top.hi - top.lo + 1) * slot}
            height={mainH}
            fill="rgb(var(--sunken))"
          />
        )}
        {heapEnd !== null && heapEnd > 0 && (
          <g>
            <rect x={0} y={0} width={heapEnd * slot} height={mainH} fill="rgb(var(--sunken))" />
            <text x={4} y={12} className="fill-ink-3 font-mono text-[10px]">
              heap
            </text>
          </g>
        )}
        {hasBuffer && (
          <g>
            <line x1={0} x2={W} y1={bufTop - 4} y2={bufTop - 4} stroke="rgb(var(--rule))" />
            <text x={0} y={bufTop + 10} className="fill-ink-3 font-mono text-[10px]">
              buffer
            </text>
          </g>
        )}
        {s.values.map((v, id) => {
          const pos = posOf.get(id);
          if (!pos) return null;
          const i = pos.at;
          const inBuf = pos.buffer;
          const area = inBuf ? bufH : mainH;
          const bh = Math.max(2, (v / max) * (area - (showValues ? 14 : 4)));
          const x = i * slot + (slot - bw) / 2;
          const y = (inBuf ? bufTop + bufH : mainH) - bh;
          let fill = "rgb(var(--ink) / 0.5)";
          const isCmp = cmp && (cmp.buf ? inBuf : !inBuf) && (cmp.i === i || cmp.j === i);
          const isSwap = !inBuf && s.swap && (s.swap[0] === i || s.swap[1] === i);
          const isWrite = !inBuf && s.write === i;
          if (!inBuf && s.sorted[i]) fill = "rgb(var(--st-path))";
          if (!inBuf && s.ptr.pivot === i) fill = "rgb(var(--ink))";
          if (isCmp) fill = "rgb(var(--st-open))";
          if (isSwap || isWrite) fill = "rgb(var(--signal))";
          const dim = !inBuf && top && (i < top.lo || i > top.hi) && !s.sorted[i];
          return (
            <g
              key={id}
              style={{
                transform: `translate(${x}px, ${y}px)`,
                transition: "transform var(--bar-dur) cubic-bezier(0.2,0,0,1)",
              }}
            >
              <rect
                width={bw}
                height={bh}
                fill={fill}
                opacity={dim ? 0.35 : 1}
                style={{ transition: "fill var(--bar-dur), opacity var(--bar-dur)" }}
              />
              {showValues && (
                <text
                  x={bw / 2}
                  y={-3}
                  textAnchor="middle"
                  className={cn(
                    "font-mono text-[10px]",
                    isCmp || isSwap ? "fill-ink" : "fill-ink-3",
                  )}
                >
                  {v}
                </text>
              )}
            </g>
          );
        })}
        <g transform={`translate(0, ${size.h - pointerH + 6})`}>
          <line x1={0} x2={W} y1={0} y2={0} stroke="rgb(var(--rule-strong))" />
          {pointers
            .sort((a, b) => POINTER_ORDER.indexOf(a[0]) - POINTER_ORDER.indexOf(b[0]))
            .map(([name, at], k, arr) => {
              const sameBefore = arr.slice(0, k).filter(([, a2]) => a2 === at).length;
              const x = Math.min(at, n - 1) * slot + slot / 2;
              const isRange = name === "lo" || name === "hi" || name === "end";
              return (
                <g
                  key={name}
                  style={{
                    transform: `translate(${x}px, 0)`,
                    transition: "transform var(--bar-dur) cubic-bezier(0.2,0,0,1)",
                  }}
                >
                  <path
                    d="M0 0 L-4 6 L4 6 Z"
                    fill={
                      name === "pivot"
                        ? "rgb(var(--ink))"
                        : isRange
                          ? "rgb(var(--ink-3))"
                          : "rgb(var(--signal))"
                    }
                  />
                  <text
                    y={17 + sameBefore * 11}
                    textAnchor="middle"
                    className="fill-ink-2 font-mono text-[10px]"
                  >
                    {name}
                  </text>
                </g>
              );
            })}
        </g>
      </svg>
    </div>
  );
}

export function SearchView({
  run,
  cursor,
  label,
  duration,
}: {
  run: SearchRun;
  cursor: number;
  label: string;
  duration: number;
}) {
  const [ref, size] = useElementSize<HTMLDivElement>();
  const s = run.player.at(cursor).state;
  const n = s.values.length;
  const max = Math.max(...s.values, s.target, 1);
  const pointerH = 30;
  const W = size.w;
  const H = Math.max(0, size.h - pointerH);
  const slot = n ? W / n : 0;
  const bw = Math.max(1.5, Math.min(slot * 0.74, slot - 1));
  const showValues = slot >= 22;
  const ty = H - (s.target / max) * (H - 16);
  return (
    <div
      ref={ref}
      className="relative h-full w-full"
      style={{ ["--bar-dur" as string]: `${duration}ms` }}
    >
      <svg
        width={W}
        height={size.h}
        className="block overflow-visible"
        role="img"
        aria-label={`${label}: searching for ${s.target}; ${s.done ? (s.found >= 0 ? `found at index ${s.found}` : "not present") : `range ${s.lo} to ${s.hi}`}`}
      >
        {!s.done && s.hi >= s.lo && (
          <rect
            x={s.lo * slot}
            y={0}
            width={(s.hi - s.lo + 1) * slot}
            height={H}
            fill="rgb(var(--sunken))"
            style={{ transition: "all var(--bar-dur) cubic-bezier(0.2,0,0,1)" }}
          />
        )}
        {s.values.map((v, i) => {
          const bh = Math.max(2, (v / max) * (H - 16));
          const inRange = s.done ? s.found === i : i >= s.lo && i <= s.hi;
          let fill = inRange ? "rgb(var(--ink) / 0.55)" : "rgb(var(--ink) / 0.16)";
          if (s.probed[i]) fill = inRange ? "rgb(var(--ink) / 0.75)" : "rgb(var(--ink) / 0.28)";
          if (s.probe === i) fill = "rgb(var(--st-open))";
          if (s.found === i) fill = "rgb(var(--st-path))";
          return (
            <g key={i}>
              <rect
                x={i * slot + (slot - bw) / 2}
                y={H - bh}
                width={bw}
                height={bh}
                fill={fill}
                style={{ transition: "fill var(--bar-dur)" }}
              />
              {showValues && (
                <text
                  x={i * slot + slot / 2}
                  y={H - bh - 3}
                  textAnchor="middle"
                  className="fill-ink-3 font-mono text-[10px]"
                >
                  {v}
                </text>
              )}
            </g>
          );
        })}
        <line x1={0} x2={W} y1={ty} y2={ty} stroke="rgb(var(--signal))" strokeDasharray="4 3" />
        <text
          x={W - 2}
          y={ty - 4}
          textAnchor="end"
          className="fill-signal-ink font-mono text-[11px]"
        >
          target {s.target}
        </text>
        <g transform={`translate(0, ${size.h - pointerH + 6})`}>
          <line x1={0} x2={W} y1={0} y2={0} stroke="rgb(var(--rule-strong))" />
          {(!s.done || s.found >= 0) &&
            (
              [
                ["lo", s.done ? -1 : s.lo],
                [run.algo === "binary" ? "mid" : "i", s.probe],
                ["hi", s.done ? -1 : s.hi],
              ] as [string, number][]
            )
              .filter(([, v]) => v >= 0 && v < n)
              .map(([name, at], k, arr) => (
                <g
                  key={name}
                  style={{
                    transform: `translate(${at * slot + slot / 2}px, 0)`,
                    transition: "transform var(--bar-dur) cubic-bezier(0.2,0,0,1)",
                  }}
                >
                  <path
                    d="M0 0 L-4 6 L4 6 Z"
                    fill={
                      name === "lo" || name === "hi" ? "rgb(var(--ink-3))" : "rgb(var(--signal))"
                    }
                  />
                  <text
                    y={17 + arr.slice(0, k).filter(([, a]) => a === at).length * 11}
                    textAnchor="middle"
                    className="fill-ink-2 font-mono text-[10px]"
                  >
                    {name}
                  </text>
                </g>
              ))}
        </g>
      </svg>
    </div>
  );
}
