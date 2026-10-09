import { useEffect } from "react";
import { metricsAt, variantLabel } from "@/core/experiment";
import { familyName, getAlgo } from "@/core/info";
import { PRESENT_ROWS_PX, STAGE_ROWS_PX, useIsCompact } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { useLab } from "@/store/lab";
import { useUI, type PresentPanel } from "@/store/ui";
import { usePresented } from "../clock";
import { Close, Mark } from "../icons";
import { useCommitCounter } from "../perf";
import { exitPresentation } from "../presentation";
import { CodePanel } from "./Code";
import { TagAB } from "./Panels";
import { NowCaption, Stage } from "./Stage";
import { StatePanel } from "./StatePanel";
import { Transport } from "./Transport";

const TOGGLES: { id: PresentPanel; label: string; key: string }[] = [
  { id: "code", label: "Code", key: "C" },
  { id: "state", label: "State", key: "S" },
  { id: "explain", label: "Explanation", key: "E" },
  { id: "metrics", label: "Metrics", key: "M" },
];

function Metrics() {
  const runA = useLab((s) => s.runA);
  const runB = useLab((s) => s.runB);
  const p = usePresented();
  const rows = [
    { tag: runB ? ("a" as const) : null, m: metricsAt(runA, p.a) },
    ...(runB ? [{ tag: "b" as const, m: metricsAt(runB, p.b) }] : []),
  ];
  return (
    <div className="flex flex-col justify-center gap-1">
      {rows.map((r, i) => (
        <dl key={i} className="flex items-baseline gap-5 whitespace-nowrap">
          {r.tag && <TagAB which={r.tag} className="self-center" />}
          {r.m.map((m) => (
            <div key={m.label} className="flex items-baseline gap-2">
              <dt className="text-xs text-ink-3">{m.label}</dt>
              <dd className="readout min-w-[4ch] text-right text-md text-ink">{m.value}</dd>
            </div>
          ))}
        </dl>
      ))}
    </div>
  );
}

export function Present() {
  useCommitCounter("present");
  const exp = useLab((s) => s.exp);
  const runA = useLab((s) => s.runA);
  const runB = useLab((s) => s.runB);
  const panels = useUI((s) => s.panels);
  const togglePanel = useUI((s) => s.togglePanel);
  const presented = usePresented();
  const info = getAlgo(exp.a.algo);
  const compact = useIsCompact();
  const side = !compact && (panels.code || panels.state);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-40 grid bg-field"
      style={{
        gridTemplateRows: [
          `${PRESENT_ROWS_PX.header}px`,
          "minmax(0,1fr)",
          `${panels.explain ? PRESENT_ROWS_PX.caption : 0}px`,
          `${compact ? STAGE_ROWS_PX.phoneTransport : PRESENT_ROWS_PX.transport}px`,
        ].join(" "),
      }}
      role="region"
      aria-label="Presentation"
    >
      <header className="flex min-w-0 items-center gap-5 overflow-hidden border-b border-rule bg-surface px-5">
        <Mark />
        <div className="min-w-0">
          <p className="label truncate">{familyName(exp.family)}</p>
          <h1 className="truncate text-xl font-semibold">
            {exp.b ? (
              <span className="flex items-center gap-2">
                <TagAB which="a" /> {variantLabel(exp.a)}
                <span className="text-ink-3">vs</span>
                <TagAB which="b" /> {variantLabel(exp.b)}
              </span>
            ) : (
              info.name
            )}
          </h1>
        </div>
        {panels.metrics && (
          <div className="ml-auto hidden lg:block">
            <Metrics />
          </div>
        )}
        <div className={cn("flex shrink-0 items-center gap-1", !panels.metrics && "ml-auto")}>
          {(compact ? TOGGLES.filter((t) => t.id === "explain") : TOGGLES).map((t) => (
            <button
              key={t.id}
              aria-pressed={panels[t.id]}
              onClick={() => togglePanel(t.id)}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded border px-2.5 text-xs transition-colors",
                panels[t.id]
                  ? "border-ink bg-ink text-surface"
                  : "border-rule-strong text-ink-2 hover:text-ink",
              )}
            >
              {t.label}
              <kbd className="readout text-2xs opacity-70">{t.key}</kbd>
            </button>
          ))}
          <button
            onClick={exitPresentation}
            className="ml-2 flex h-8 items-center gap-1.5 rounded border border-rule-strong px-2.5 text-xs text-ink-2 hover:text-ink"
            aria-label="Exit presentation"
          >
            <Close size={14} /> Esc
          </button>
        </div>
      </header>
      <div
        className="grid min-h-0"
        style={{ gridTemplateColumns: side ? "minmax(0,1fr) 400px" : "minmax(0,1fr)" }}
      >
        <div className="min-h-0 min-w-0 [contain:strict]">
          <Stage bare={panels.metrics} />
        </div>
        {side && (
          <aside
            className="grid min-h-0 border-l border-rule bg-surface"
            style={{
              gridTemplateRows:
                panels.code && panels.state ? "auto minmax(0,1fr)" : "minmax(0,1fr)",
            }}
          >
            {panels.code && (
              <section
                className={cn(
                  "min-h-0 overflow-y-auto py-2 pr-1",
                  panels.state && "max-h-[48vh] border-b border-rule",
                )}
              >
                <h2 className="label px-4 pb-1">Pseudocode · {info.short}</h2>
                <CodePanel run={runA} cursor={presented.a} />
              </section>
            )}
            {panels.state && (
              <section className="min-h-0 overflow-y-auto">
                <StatePanel run={runA} cursor={presented.a} />
              </section>
            )}
          </aside>
        )}
      </div>
      <div className="min-h-0 overflow-hidden">{panels.explain && <NowCaption large />}</div>
      <Transport present={!compact} compact={compact} />
      {runB && <span className="sr-only">Comparing two runs.</span>}
    </div>
  );
}
