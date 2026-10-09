import { useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { variantLabel } from "@/core/experiment";
import { getAlgo } from "@/core/info";
import { cn } from "@/lib/utils";
import { useLab } from "@/store/lab";
import { usePresentedCursor } from "../clock";
import { useCommitCounter } from "../perf";
import { Segmented } from "../primitives";
import { CodePanel } from "./Code";
import { AboutPanel, ComparePanel, LogPanel, TagAB } from "./Panels";
import { Setup } from "./Setup";
import { StatePanel } from "./StatePanel";

const tabClass =
  "relative h-10 shrink-0 px-3 text-sm text-ink-2 transition-colors hover:text-ink data-[state=active]:text-ink after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-ink";

function useWhich() {
  const hasB = useLab((s) => !!s.runB);
  const [which, setWhich] = useState<"a" | "b">("a");
  return [hasB ? which : "a", setWhich, hasB] as const;
}

function WhichToggle({ which, set }: { which: "a" | "b"; set: (w: "a" | "b") => void }) {
  const exp = useLab((s) => s.exp);
  return (
    <div className="border-b border-rule px-4 py-2">
      <Segmented<"a" | "b">
        label="Inspect run"
        size="sm"
        value={which}
        onChange={set}
        className="w-full"
        options={[
          {
            value: "a",
            label: (
              <span className="flex items-center gap-1.5">
                <TagAB which="a" className="h-4 w-4" />
                {variantLabel(exp.a)}
              </span>
            ),
          },
          {
            value: "b",
            label: (
              <span className="flex items-center gap-1.5">
                <TagAB which="b" className="h-4 w-4" />
                {exp.b ? variantLabel(exp.b) : ""}
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}

function InspectView() {
  useCommitCounter("inspector");
  const [which, setWhich, hasB] = useWhich();
  const run = useLab((s) => (which === "b" && s.runB ? s.runB : s.runA));
  const cursor = usePresentedCursor(which);
  const [codeOpen, setCodeOpen] = useState(true);
  return (
    <div>
      {hasB && <WhichToggle which={which} set={setWhich} />}
      <section className="border-b border-rule" data-tour="code">
        <button
          className="flex w-full items-center justify-between px-4 pb-1 pt-3 text-left"
          aria-expanded={codeOpen}
          onClick={() => setCodeOpen((o) => !o)}
        >
          <h2 className="label">Pseudocode · {getAlgo(run.algo).short}</h2>
          <span className="text-2xs text-ink-3">{codeOpen ? "hide" : "show"}</span>
        </button>
        {codeOpen && (
          <div className="pb-2 pr-1">
            <CodePanel run={run} cursor={cursor} tone={which} />
          </div>
        )}
      </section>
      <div data-tour="state">
        <StatePanel run={run} cursor={cursor} />
      </div>
    </div>
  );
}

function LogView() {
  const [which, setWhich, hasB] = useWhich();
  const run = useLab((s) => (which === "b" && s.runB ? s.runB : s.runA));
  const cursor = usePresentedCursor(which);
  return (
    <div>
      {hasB && <WhichToggle which={which} set={setWhich} />}
      <LogPanel run={run} cursor={cursor} which={which} />
    </div>
  );
}

function CompareView() {
  const exp = useLab((s) => s.exp);
  const runA = useLab((s) => s.runA);
  const runB = useLab((s) => s.runB);
  if (!runB || !exp.b)
    return (
      <p className="px-4 py-4 text-sm text-ink-3">
        Pick a Run B under Compare to see the two side by side.
      </p>
    );
  return (
    <ComparePanel
      a={runA}
      b={runB}
      la={`A (${variantLabel(exp.a)})`}
      lb={`B (${variantLabel(exp.b)})`}
    />
  );
}

export function Inspector({ inline, withSetup }: { inline?: boolean; withSetup?: boolean }) {
  const hasB = useLab((s) => !!s.runB);
  const algo = useLab((s) => s.exp.a.algo);
  const [tab, setTab] = useState("inspect");
  const current = !hasB && tab === "compare" ? "inspect" : tab;
  return (
    <Tabs.Root
      value={current}
      onValueChange={setTab}
      className={cn("flex min-h-0 flex-col", !inline && "h-full")}
    >
      <Tabs.List
        className={cn(
          "flex shrink-0 overflow-x-auto border-b border-rule bg-surface px-1",
          inline && "sticky top-12 z-10",
        )}
        aria-label="Lab panels"
      >
        {withSetup && (
          <Tabs.Trigger value="setup" className={tabClass}>
            Setup
          </Tabs.Trigger>
        )}
        <Tabs.Trigger value="inspect" className={tabClass}>
          Inspect
        </Tabs.Trigger>
        {hasB && (
          <Tabs.Trigger value="compare" className={tabClass}>
            Compare
          </Tabs.Trigger>
        )}
        <Tabs.Trigger value="log" className={tabClass}>
          Log
        </Tabs.Trigger>
        <Tabs.Trigger value="about" className={tabClass}>
          About
        </Tabs.Trigger>
      </Tabs.List>
      <div className={cn("relative min-h-0", !inline && "flex-1 overflow-y-auto")} data-scroll>
        {withSetup && (
          <Tabs.Content value="setup" className="outline-none">
            <Setup />
          </Tabs.Content>
        )}
        <Tabs.Content value="inspect" className="outline-none">
          <InspectView />
        </Tabs.Content>
        {hasB && (
          <Tabs.Content value="compare" className="outline-none">
            <CompareView />
          </Tabs.Content>
        )}
        <Tabs.Content value="log" className="outline-none">
          <LogView />
        </Tabs.Content>
        <Tabs.Content value="about" className="outline-none">
          <AboutPanel algo={algo} />
        </Tabs.Content>
      </div>
    </Tabs.Root>
  );
}
