import { useCallback } from "react";
import { toast } from "./toastStore";
import { variantLabel } from "@/core/experiment";
import { ALGOS, FAMILIES, familyName } from "@/core/info";
import { SCENARIOS, type Scenario } from "@/core/scenarios";
import { appBaseUrl } from "@/lib/utils";
import { navigate } from "@/lib/router";
import { useIsCompact } from "@/lib/layout";
import { useLibrary, type SavedExperiment } from "@/store/library";
import { startTour } from "./commands";
import { ChevronRight, Github, Link, Trash } from "./icons";
import { Button, IconButton } from "./primitives";
import { Thumb } from "./Thumb";
import { TagAB } from "./lab/Panels";

function ScenarioTile({ s, compact }: { s: Scenario; compact: boolean }) {
  const build = useCallback(() => s.build(compact), [s, compact]);
  const exp = build();
  return (
    <li>
      <a
        href={`#/lab?s=${s.id}`}
        className="group flex h-full flex-col border border-rule bg-surface transition-colors duration-fast hover:border-ink"
      >
        <Thumb
          build={build}
          label={`Preview of ${s.title}`}
          className="aspect-[16/9] w-full border-b border-rule"
        />
        <div className="flex flex-1 flex-col gap-1.5 p-3">
          <h3 className="text-sm font-semibold leading-5 group-hover:underline group-hover:underline-offset-4">
            {s.title}
          </h3>
          <p className="text-sm text-ink-2">{s.question}</p>
          <p className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-2 text-xs text-ink-3">
            {exp.b ? (
              <>
                <TagAB which="a" className="h-4 w-4" />
                {variantLabel(exp.a)}
                <TagAB which="b" className="h-4 w-4" />
                {variantLabel(exp.b)}
              </>
            ) : (
              variantLabel(exp.a)
            )}
          </p>
        </div>
      </a>
    </li>
  );
}

export function Explore() {
  const compact = useIsCompact();
  const last = useLibrary((s) => s.last);
  const items = useLibrary((s) => s.items);
  const hero = useCallback(() => SCENARIOS[1].build(false), []);
  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-16 sm:px-6">
      <section className="grid gap-8 border-b border-rule py-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-center md:py-14">
        <div>
          <p className="label mb-3">Algorithm lab</p>
          <h1 className="text-2xl font-semibold sm:text-3xl">
            Run an algorithm one step at a time, with its queue, heap or call stack beside it.
          </h1>
          <p className="mt-4 max-w-[52ch] text-md text-ink-2">
            Stride records each operation of a run, so you can scrub forward and backward while
            the pseudocode highlights the line that ran. Two algorithms can run on the same input
            for comparison, and a link reopens the exact setup.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="signal" size="lg" onClick={startTour}>
              Take the 6-step tour
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate("/lab")}>
              Open the lab
            </Button>
          </div>
          {last && (
            <a
              href={`#/lab?e=${last.code}`}
              className="mt-4 inline-flex min-h-8 items-center gap-1.5 py-1 text-sm text-ink-2 hover:text-ink"
            >
              Continue: <span className="text-ink underline underline-offset-4">{last.label}</span>
              <ChevronRight />
            </a>
          )}
        </div>
        <a href="#/lab?s=astar-vs-dijkstra" className="group block border border-rule bg-surface">
          <Thumb
            build={hero}
            label="A* versus Dijkstra on the same grid. Cells only Dijkstra expanded are shaded orange; both find the same path."
            className="aspect-[41/25] w-full"
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-rule px-3 py-2 text-xs text-ink-2">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 bg-st-closed" /> both expanded
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 bg-st-a/45" /> only Dijkstra
            </span>
            <span className="ml-auto text-ink group-hover:underline group-hover:underline-offset-4">
              Open A* vs Dijkstra →
            </span>
          </div>
        </a>
      </section>

      <section className="py-10" aria-labelledby="exp-title">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h2 id="exp-title" className="text-xl font-semibold">
            Experiments
          </h2>
          <p className="hidden text-sm text-ink-3 sm:block">
            Each one is a question with a prepared input. Open it, press Run.
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {SCENARIOS.map((s) => (
            <ScenarioTile key={s.id} s={s} compact={compact} />
          ))}
        </ul>
      </section>

      <section className="border-t border-rule py-10" aria-labelledby="algo-title">
        <h2 id="algo-title" className="mb-5 text-xl font-semibold">
          Algorithms
        </h2>
        <div className="space-y-8">
          {FAMILIES.map((f) => (
            <div key={f.id}>
              <div className="mb-2 flex items-baseline gap-3">
                <h3 className="label">{f.name}</h3>
                <p className="text-sm text-ink-3">{f.blurb}</p>
              </div>
              <div className="overflow-x-auto border-t border-rule">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-ink-3">
                      <th className="py-2 pr-3 font-normal">Algorithm</th>
                      <th className="py-2 pr-3 font-normal">Best</th>
                      <th className="py-2 pr-3 font-normal">Average</th>
                      <th className="py-2 pr-3 font-normal">Worst</th>
                      <th className="py-2 pr-3 font-normal">Space</th>
                      <th className="py-2 font-normal">In short</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ALGOS.filter((a) => a.family === f.id).map((a) => (
                      <tr key={a.id} className="border-t border-rule">
                        <td className="py-2 pr-3">
                          <a
                            href={`#/lab?algo=${a.id}`}
                            className="inline-block py-1 font-medium underline decoration-rule-strong underline-offset-4 hover:decoration-ink"
                          >
                            {a.name}
                          </a>
                        </td>
                        <td className="readout py-2 pr-3 text-ink-2">{a.complexity.best}</td>
                        <td className="readout py-2 pr-3">{a.complexity.average}</td>
                        <td className="readout py-2 pr-3 text-ink-2">{a.complexity.worst}</td>
                        <td className="readout py-2 pr-3 text-ink-2">{a.complexity.space}</td>
                        <td className="py-2 text-ink-2">{a.summary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>

      {items.length > 0 && (
        <section className="border-t border-rule py-10" aria-labelledby="saved-title">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 id="saved-title" className="text-xl font-semibold">
              Recently saved
            </h2>
            <a
              href="#/saved"
              className="text-sm text-ink-2 underline underline-offset-4 hover:text-ink"
            >
              All {items.length}
            </a>
          </div>
          <SavedList items={items.slice(0, 3)} />
        </section>
      )}

      <footer className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-rule pt-6 text-sm text-ink-3">
        <span>Stride · MIT licensed</span>
        <a
          href="https://github.com/Mahan-Imanian/stride"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 hover:text-ink"
        >
          <Github /> Source
        </a>
        <span>Runs entirely in your browser. Nothing you build is uploaded.</span>
      </footer>
    </div>
  );
}

function SavedList({ items }: { items: SavedExperiment[] }) {
  const remove = useLibrary((s) => s.remove);
  const restore = useLibrary((s) => s.restore);
  const rename = useLibrary((s) => s.rename);
  return (
    <ul className="divide-y divide-rule border-y border-rule">
      {items.map((x) => (
        <li key={x.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
          <div className="min-w-0 flex-1">
            <input
              defaultValue={x.name}
              aria-label="Experiment name"
              onBlur={(e) =>
                e.target.value.trim() &&
                e.target.value !== x.name &&
                rename(x.id, e.target.value.trim())
              }
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className="w-full truncate rounded-sm bg-transparent px-1 py-0.5 text-sm font-medium hover:bg-sunken focus:bg-surface"
            />
            <p className="px-1 text-xs text-ink-3">
              {familyName(x.family)} · {x.label} · saved{" "}
              {new Date(x.savedAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="primary" onClick={() => navigate(`/lab?e=${x.code}`)}>
              Open
            </Button>
            <IconButton
              label="Copy link"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(`${appBaseUrl()}#/lab?e=${x.code}`);
                  toast.success("Link copied");
                } catch {
                  toast.error("Copy failed");
                }
              }}
            >
              <Link />
            </IconButton>
            <IconButton
              label="Delete"
              onClick={() => {
                const gone = remove(x.id);
                if (gone)
                  toast(`Deleted “${gone.name}”`, {
                    action: { label: "Undo", onClick: () => restore(gone) },
                  });
              }}
            >
              <Trash />
            </IconButton>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Saved() {
  const items = useLibrary((s) => s.items);
  return (
    <div className="mx-auto max-w-[880px] px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold">Saved experiments</h1>
      <p className="mt-2 text-md text-ink-2">
        Stored in this browser only. Use a share link to move one to another device.
      </p>
      <div className="mt-8">
        {items.length ? (
          <SavedList items={items} />
        ) : (
          <div className="border border-dashed border-rule-strong px-6 py-10 text-center">
            <p className="text-md font-medium">Nothing saved yet</p>
            <p className="mx-auto mt-1 max-w-[46ch] text-sm text-ink-2">
              In the lab, press Save or {navigator.platform.includes("Mac") ? "⌘S" : "Ctrl S"} to
              keep an experiment here with its input, settings and comparison.
            </p>
            <Button className="mt-4" variant="primary" onClick={() => navigate("/lab")}>
              Open the lab
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
