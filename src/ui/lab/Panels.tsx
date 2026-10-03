import { useMemo } from "react";
import { compareInsights, finalMetrics, type Run } from "@/core/experiment";
import { getAlgo, type AlgoId } from "@/core/info";
import { SCENARIOS } from "@/core/scenarios";
import { cn } from "@/lib/utils";
import { navigate } from "@/lib/router";
import { useLab } from "@/store/lab";
import { Check, Close } from "../icons";

export function AboutPanel({ algo }: { algo: AlgoId }) {
  const info = getAlgo(algo);
  const related = SCENARIOS.filter((s) => s.algos.includes(algo));
  const c = info.complexity;
  return (
    <div className="space-y-4 px-4 py-4">
      <div>
        <h3 className="text-md font-semibold">{info.name}</h3>
        <p className="mt-1 text-sm text-ink-2">{info.summary}</p>
      </div>
      <ul className="space-y-1.5 text-sm">
        {info.how.map((h) => (
          <li key={h} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 bg-ink-3" aria-hidden="true" />
            <span>{h}</span>
          </li>
        ))}
      </ul>
      <table className="w-full text-sm">
        <caption className="label pb-2 text-left">Complexity</caption>
        <tbody className="readout">
          {(
            [
              ["Best", c.best],
              ["Average", c.average],
              ["Worst", c.worst],
              ["Space", c.space],
            ] as const
          ).map(([k, v]) => (
            <tr key={k} className="border-t border-rule">
              <th scope="row" className="py-1 text-left font-sans font-normal text-ink-2">
                {k}
              </th>
              <td className="py-1 text-right">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {c.note && <p className="-mt-2 text-xs text-ink-3">{c.note}</p>}
      <ul className="space-y-1 text-sm">
        {info.props.map((p) => (
          <li key={p.label} className="flex items-center gap-2">
            {p.value ? <Check className="text-st-path" /> : <Close className="text-ink-3" />}
            <span className={p.value ? "" : "text-ink-2"}>{p.label}</span>
          </li>
        ))}
      </ul>
      <p className="border-l-2 border-signal pl-3 text-sm">{info.watch}</p>
      {related.length > 0 && (
        <div>
          <h4 className="label mb-2">Try</h4>
          <ul className="space-y-1">
            {related.map((s) => (
              <li key={s.id}>
                <button
                  className="text-left text-sm text-ink underline decoration-rule-strong underline-offset-4 hover:decoration-ink"
                  onClick={() => navigate(`/lab?s=${s.id}`)}
                >
                  {s.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ComparePanel({ a, b, la, lb }: { a: Run; b: Run; la: string; lb: string }) {
  const ma = useMemo(() => finalMetrics(a), [a]);
  const mb = useMemo(() => finalMetrics(b), [b]);
  const insights = useMemo(() => compareInsights(a, b, la, lb), [a, b, la, lb]);
  return (
    <div className="px-4 py-4">
      <ul className="mb-4 space-y-2">
        {insights.map((t) => (
          <li key={t} className="border-l-2 border-ink pl-3 text-sm">
            {t}
          </li>
        ))}
      </ul>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className="label pb-2 font-normal">At the end</th>
            <th className="pb-2 text-right">
              <TagAB which="a" />
            </th>
            <th className="pb-2 text-right">
              <TagAB which="b" />
            </th>
          </tr>
        </thead>
        <tbody className="readout">
          {ma.map((m, i) => {
            const x = m.value;
            const y = mb[i]?.value;
            const nx = typeof x === "number" ? x : Number.parseFloat(String(x));
            const ny = typeof y === "number" ? y : Number.parseFloat(String(y));
            const comparable = m.better && Number.isFinite(nx) && Number.isFinite(ny) && nx !== ny;
            const aWins = comparable && (m.better === "lower" ? nx < ny : nx > ny);
            const bWins = comparable && !aWins;
            return (
              <tr key={m.label} className="border-t border-rule">
                <th scope="row" className="py-1.5 text-left font-sans font-normal text-ink-2">
                  {m.label}
                </th>
                <td
                  className={cn(
                    "py-1.5 text-right",
                    aWins && "font-semibold text-ink",
                    bWins && "text-ink-3",
                  )}
                >
                  {x}
                </td>
                <td
                  className={cn(
                    "py-1.5 text-right",
                    bWins && "font-semibold text-ink",
                    aWins && "text-ink-3",
                  )}
                >
                  {y}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-ink-3">
        Bold marks the better value where lower or higher is clearly better.
      </p>
    </div>
  );
}

export function TagAB({ which, className }: { which: "a" | "b"; className?: string }) {
  return (
    <span
      className={cn(
        "readout inline-flex h-5 w-5 items-center justify-center rounded-sm text-2xs font-semibold text-white",
        which === "a" ? "bg-st-a" : "bg-st-b",
        className,
      )}
      aria-label={which === "a" ? "Run A" : "Run B"}
    >
      {which.toUpperCase()}
    </span>
  );
}

function keepInView(el: HTMLElement | null) {
  const box = el?.closest<HTMLElement>("[data-scroll]");
  if (!el || !box || box.scrollHeight <= box.clientHeight) return;
  const top = el.offsetTop - box.offsetTop;
  if (top < box.scrollTop + 24 || top > box.scrollTop + box.clientHeight - 48)
    box.scrollTop = top - box.clientHeight / 2;
}

export function LogPanel({ run, cursor, which }: { run: Run; cursor: number; which: "a" | "b" }) {
  const seek = useLab((s) => s.seek);
  const events = run.trace.events;
  const from = Math.max(0, cursor - 30);
  const to = Math.min(events.length, cursor + 30);
  const rows = [];
  for (let i = from; i < to; i++) rows.push(i);
  return (
    <div className="px-2 py-2">
      <p className="px-2 pb-2 text-xs text-ink-3">
        Showing operations {from + 1}–{to} of {events.length}. Select one to jump there
        {which === "b" ? " (both runs move together)" : ""}.
      </p>
      <ol className="font-mono text-xs">
        {rows.map((i) => {
          const done = i < cursor;
          const isCurrent = i === cursor - 1;
          return (
            <li key={i}>
              <button
                ref={isCurrent ? keepInView : undefined}
                onClick={() => seek(i + 1)}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex w-full gap-3 rounded-sm px-2 py-1 text-left hover:bg-sunken",
                  isCurrent ? "bg-signal/10 text-ink" : done ? "text-ink-2" : "text-ink-3",
                )}
              >
                <span className="w-10 shrink-0 text-right tabular-nums">{i + 1}</span>
                <span className="min-w-0 flex-1">{events[i].note}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
