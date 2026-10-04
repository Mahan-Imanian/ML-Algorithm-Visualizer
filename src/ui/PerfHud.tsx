import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useUI } from "@/store/ui";
import { Close } from "./icons";
import { perf, type PerfSnapshot } from "./perf";

const BUDGETS = [
  { hz: 60, ms: 1000 / 60 },
  { hz: 120, ms: 1000 / 120 },
  { hz: 144, ms: 1000 / 144 },
];

export function PerfHud() {
  const on = useUI((s) => s.hud);
  const setHud = useUI((s) => s.setHud);
  const [snap, setSnap] = useState<PerfSnapshot | null>(null);

  useEffect(() => {
    if (!on) return;
    perf.start();
    const id = window.setInterval(() => setSnap(perf.snapshot()), 250);
    return () => {
      window.clearInterval(id);
      perf.end();
    };
  }, [on]);

  if (!on) return null;
  const s = snap;
  const work = s ? Math.max(0, ...s.draws.map((d) => d.max)) : 0;
  return (
    <aside
      className="fixed right-3 top-14 z-[65] w-[264px] border border-ink bg-surface text-xs shadow-pop"
      aria-label="Performance monitor"
      data-perf-hud
    >
      <div className="flex h-8 items-center justify-between border-b border-rule pl-3 pr-1">
        <span className="label">Frame monitor</span>
        <div className="flex items-center gap-1">
          <button
            className="readout rounded px-1.5 py-0.5 text-2xs text-ink-2 hover:bg-sunken"
            onClick={() => perf.reset()}
          >
            reset
          </button>
          <button
            aria-label="Close performance monitor"
            className="rounded p-1 text-ink-2 hover:bg-sunken"
            onClick={() => setHud(false)}
          >
            <Close size={14} />
          </button>
        </div>
      </div>
      <dl className="readout grid grid-cols-2 gap-x-3 gap-y-1 px-3 py-2" data-perf>
        <dt className="text-ink-3">display</dt>
        <dd className="text-right" data-k="hz">
          {s ? `${s.refreshHz} Hz` : "…"}
        </dd>
        <dt className="text-ink-3">frames/s</dt>
        <dd className="text-right" data-k="fps">
          {s?.fps ?? "…"}
        </dd>
        <dt className="text-ink-3">median</dt>
        <dd className="text-right" data-k="median">
          {s ? `${s.median.toFixed(2)} ms` : "…"}
        </dd>
        <dt className="text-ink-3">p95 / p99</dt>
        <dd className="text-right" data-k="p95">
          {s ? `${s.p95.toFixed(1)} / ${s.p99.toFixed(1)}` : "…"}
        </dd>
        <dt className="text-ink-3">worst</dt>
        <dd className="text-right" data-k="worst">
          {s ? `${s.worst.toFixed(1)} ms` : "…"}
        </dd>
        <dt className="text-ink-3">dropped</dt>
        <dd className="text-right" data-k="dropped">
          {s ? `${s.droppedPct.toFixed(1)} %` : "…"}
        </dd>
        <dt className="text-ink-3">heap</dt>
        <dd className="text-right">{s?.heapMB ? `${s.heapMB.toFixed(1)} MB` : "n/a"}</dd>
      </dl>
      <div className="border-t border-rule px-3 py-2">
        <p className="label mb-1">Draw cost · avg / max</p>
        {s && s.draws.length ? (
          s.draws.map((d) => (
            <div key={d.name} className="readout flex justify-between" data-draw={d.name}>
              <span className="text-ink-3">{d.name}</span>
              <span>
                {d.avg.toFixed(2)} / {d.max.toFixed(2)} ms
              </span>
            </div>
          ))
        ) : (
          <p className="text-ink-3">No canvas draws yet.</p>
        )}
      </div>
      <div className="border-t border-rule px-3 py-2">
        <p className="label mb-1">React renders / s</p>
        {s && s.commitsPerSec.length ? (
          s.commitsPerSec.map((c) => (
            <div key={c.name} className="readout flex justify-between" data-commit={c.name}>
              <span className="text-ink-3">{c.name}</span>
              <span>{c.perSec.toFixed(1)}</span>
            </div>
          ))
        ) : (
          <p className="text-ink-3">None since reset.</p>
        )}
      </div>
      <div className="flex gap-1 border-t border-rule px-3 py-2">
        {BUDGETS.map((b) => (
          <span
            key={b.hz}
            className={cn(
              "readout flex-1 border px-1 py-0.5 text-center text-2xs",
              s && work <= b.ms ? "border-st-path text-st-path" : "border-rule text-ink-3",
            )}
            title={`Largest single draw ${work.toFixed(2)} ms against a ${b.ms.toFixed(1)} ms frame budget`}
          >
            {b.hz} Hz
          </span>
        ))}
      </div>
    </aside>
  );
}
