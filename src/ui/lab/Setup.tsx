import { useEffect, useState } from "react";
import {
  defaultParams,
  variantLabel,
  type AnyVariant,
  type Experiment,
  type GradientExp,
  type GraphExp,
  type GridExp,
  type KMeansExp,
  type SearchExp,
  type SortExp,
} from "@/core/experiment";
import type { GridParams } from "@/core/grid/algorithms";
import { GRID_SIZES, type GridSize, type Heuristic } from "@/core/grid/model";
import { makeGrid, TERRAINS } from "@/core/grid/terrain";
import { components } from "@/core/graph/edit";
import { GRAPH_MAX, GRAPH_MIN, makeGraph } from "@/core/graph/graph";
import { algosOf, getAlgo, type AlgoId } from "@/core/info";
import { makeRegression, REGRESSION_DATASETS, type GradientParams } from "@/core/learn/gradient";
import { CLUSTER_DATASETS, K_INITS, makeClusters, type KMeansParams } from "@/core/learn/kmeans";
import { randomSeed } from "@/core/rng";
import {
  makeSearchInput,
  SEARCH_MAX,
  SEARCH_MIN,
  TARGET_MODES,
  type TargetMode,
} from "@/core/search/search";
import type { SortParams } from "@/core/sort/algorithms";
import {
  makeSortInput,
  parseCustomValues,
  SORT_MAX,
  SORT_MIN,
  SORT_PRESETS,
} from "@/core/sort/input";
import { cn } from "@/lib/utils";
import { useLab, type GraphTool, type Tool } from "@/store/lab";
import { Dice, Erase, StartPin, TargetPin, Trash, Wall, Weight } from "../icons";
import {
  Button,
  Field,
  IconButton,
  Section,
  Segmented,
  Select,
  Slider,
  Toggle,
} from "../primitives";
import { TagAB } from "./Panels";
import { hasSettings, regenerate, tweak } from "./variants";

export function Setup() {
  const exp = useLab((s) => s.exp);
  return (
    <div>
      <ProblemSection exp={exp} />
      {exp.family === "grid" && <ToolsSection />}
      <ParamsSection which="a" />
      <CompareSection />
      <ViewSection exp={exp} />
    </div>
  );
}

function ProblemSection({ exp }: { exp: Experiment }) {
  const update = useLab((s) => s.update);
  const reseed = (
    <IconButton
      label="New random input"
      keys="N"
      variant="outline"
      onClick={() => update((e) => regenerate(e, randomSeed()))}
    >
      <Dice />
    </IconButton>
  );
  switch (exp.family) {
    case "grid": {
      const g = exp.input;
      return (
        <Section title="Terrain" aside={reseed}>
          <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Terrain generator">
            {TERRAINS.map((t) => (
              <button
                key={t.id}
                title={t.hint}
                aria-pressed={g.terrain === t.id}
                onClick={() =>
                  update(
                    (e) =>
                      ({
                        ...e,
                        input: makeGrid(
                          g.size,
                          t.id,
                          g.terrain === t.id ? randomSeed() : g.seed,
                          g.diagonal,
                        ),
                      }) as GridExp,
                  )
                }
                className={cn(
                  "h-8 rounded border px-2 text-left text-sm transition-colors duration-fast",
                  g.terrain === t.id
                    ? "border-ink bg-ink text-surface"
                    : "border-rule-strong bg-surface text-ink hover:bg-sunken",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="mt-2 min-h-8 text-xs text-ink-3">
            {g.terrain === "custom"
              ? "Edited by hand. Pick a generator to start over."
              : TERRAINS.find((t) => t.id === g.terrain)?.hint}
          </p>
          <div className="mt-3 space-y-3">
            <Field label="Grid size">
              <Segmented<GridSize>
                label="Grid size"
                value={g.size}
                onChange={(size) =>
                  update(
                    (e) =>
                      ({
                        ...e,
                        input: makeGrid(
                          size,
                          g.terrain === "custom" ? "open" : g.terrain,
                          g.seed,
                          g.diagonal,
                        ),
                      }) as GridExp,
                  )
                }
                options={(Object.keys(GRID_SIZES) as GridSize[]).map((k) => ({
                  value: k,
                  label: k === "T" ? "Tall" : k,
                  title: GRID_SIZES[k].label,
                }))}
                className="w-full"
              />
            </Field>
            <Toggle
              label="Diagonal moves"
              hint="Eight neighbors; diagonals cost √2 and never cut corners."
              checked={g.diagonal}
              onChange={(diagonal) =>
                update((e) => {
                  const ge = e as GridExp;
                  const fix = (v: AnyVariant | null) =>
                    v && (v.algo === "astar" || v.algo === "greedy")
                      ? {
                          ...v,
                          params: {
                            ...(v.params as GridParams),
                            heuristic: (diagonal ? "octile" : "manhattan") as Heuristic,
                          },
                        }
                      : v;
                  return {
                    ...ge,
                    input: { ...ge.input, diagonal },
                    a: fix(ge.a),
                    b: fix(ge.b),
                  } as GridExp;
                })
              }
            />
          </div>
        </Section>
      );
    }
    case "sort":
      return <SortProblem exp={exp} reseed={reseed} />;
    case "search": {
      const s = exp.input;
      return (
        <Section title="Array" aside={reseed}>
          <div className="space-y-4">
            <Slider
              label="Length"
              value={s.values.length}
              min={SEARCH_MIN}
              max={SEARCH_MAX}
              onChange={(n) =>
                update((e) => ({ ...e, input: makeSearchInput(n, s.mode, s.seed) }) as SearchExp)
              }
            />
            <Field
              label="Target"
              htmlFor="target-mode"
              hint={TARGET_MODES.find((m) => m.id === s.mode)?.hint}
            >
              <Select
                id="target-mode"
                value={s.mode}
                onChange={(ev) =>
                  update(
                    (e) =>
                      ({
                        ...e,
                        input: makeSearchInput(
                          s.values.length,
                          ev.target.value as TargetMode,
                          s.seed,
                        ),
                      }) as SearchExp,
                  )
                }
              >
                {TARGET_MODES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Section>
      );
    }
    case "graph": {
      const g = exp.input;
      return (
        <Section title="Graph" aside={reseed}>
          <div className="space-y-4">
            <Slider
              label="Nodes"
              value={g.nodes.length}
              min={GRAPH_MIN}
              max={GRAPH_MAX}
              onChange={(n) =>
                update((e) => ({ ...e, input: makeGraph(n, g.seed, g.density) }) as GraphExp)
              }
            />
            <Field label="Edges per node">
              <Segmented
                label="Edges per node"
                value={String(g.density)}
                onChange={(d) =>
                  update(
                    (e) =>
                      ({ ...e, input: makeGraph(g.nodes.length, g.seed, Number(d)) }) as GraphExp,
                  )
                }
                options={["2", "3", "4", "5"].map((d) => ({ value: d, label: d }))}
                className="w-full"
              />
            </Field>
            <Field label="Prim's root node" htmlFor="root">
              <Select
                id="root"
                value={g.root}
                onChange={(ev) =>
                  update(
                    (e) => ({ ...e, input: { ...g, root: Number(ev.target.value) } }) as GraphExp,
                  )
                }
              >
                {g.nodes.map((_, i) => (
                  <option key={i} value={i}>
                    Node {i}
                  </option>
                ))}
              </Select>
            </Field>
            <GraphTools />
          </div>
        </Section>
      );
    }
    case "learn":
      if (exp.model === "kmeans") {
        const c = exp.input;
        return (
          <Section title="Dataset" aside={reseed}>
            <div className="space-y-4">
              <Field
                label="Shape"
                htmlFor="kds"
                hint={CLUSTER_DATASETS.find((d) => d.id === c.dataset)?.hint}
              >
                <Select
                  id="kds"
                  value={c.dataset}
                  onChange={(ev) =>
                    update(
                      (e) =>
                        ({
                          ...e,
                          input: makeClusters(ev.target.value as typeof c.dataset, c.n, c.seed),
                        }) as KMeansExp,
                    )
                  }
                >
                  {CLUSTER_DATASETS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Slider
                label="Points"
                value={c.n}
                min={60}
                max={400}
                step={10}
                onChange={(n) =>
                  update((e) => ({ ...e, input: makeClusters(c.dataset, n, c.seed) }) as KMeansExp)
                }
              />
            </div>
          </Section>
        );
      } else {
        const r = exp.input;
        return (
          <Section title="Dataset" aside={reseed}>
            <div className="space-y-4">
              <Field
                label="Shape"
                htmlFor="gds"
                hint={REGRESSION_DATASETS.find((d) => d.id === r.dataset)?.hint}
              >
                <Select
                  id="gds"
                  value={r.dataset}
                  onChange={(ev) =>
                    update(
                      (e) =>
                        ({
                          ...e,
                          input: makeRegression(ev.target.value as typeof r.dataset, r.n, r.seed),
                        }) as GradientExp,
                    )
                  }
                >
                  {REGRESSION_DATASETS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Slider
                label="Points"
                value={r.n}
                min={10}
                max={200}
                step={5}
                onChange={(n) =>
                  update(
                    (e) => ({ ...e, input: makeRegression(r.dataset, n, r.seed) }) as GradientExp,
                  )
                }
              />
            </div>
          </Section>
        );
      }
  }
}

function GraphTools() {
  const tool = useLab((s) => s.graphTool);
  const setTool = useLab((s) => s.setGraphTool);
  const exp = useLab((s) => s.exp);
  const parts = exp.family === "graph" ? components(exp.input) : 1;
  return (
    <Field
      label="Edit the graph"
      hint="Edge weights are the distance between their nodes, so moving a node reweights its edges."
    >
      <Segmented<GraphTool>
        label="Graph tool"
        value={tool}
        onChange={setTool}
        className="w-full"
        options={[
          { value: "move", label: "Move", title: "Drag nodes; click a node to set the root" },
          { value: "edge", label: "Edge", title: "Click two nodes to add or remove an edge" },
          { value: "node", label: "Node", title: "Click empty space to add a node" },
          { value: "delete", label: "Delete", title: "Click a node or edge to delete it" },
        ]}
      />
      {parts > 1 && (
        <p className="text-xs text-signal-ink">
          The graph has {parts} disconnected parts, so the algorithms build a spanning forest.
        </p>
      )}
    </Field>
  );
}

function SortProblem({ exp, reseed }: { exp: SortExp; reseed: React.ReactNode }) {
  const update = useLab((s) => s.update);
  const s = exp.input;
  const [text, setText] = useState(s.values.join(", "));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setText(s.values.join(", ")), [s.values]);
  const apply = () => {
    const r = parseCustomValues(text);
    if ("error" in r) {
      setError(r.error);
      return;
    }
    setError(null);
    update(
      (e) => ({ ...e, input: { values: r.values, preset: "custom", seed: s.seed } }) as SortExp,
    );
  };
  const n = s.values.length;
  return (
    <Section title="Input" aside={reseed}>
      <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Input order">
        {SORT_PRESETS.map((p) => (
          <button
            key={p.id}
            title={p.hint}
            aria-pressed={s.preset === p.id}
            onClick={() =>
              update(
                (e) =>
                  ({
                    ...e,
                    input: makeSortInput(p.id, n, s.preset === p.id ? randomSeed() : s.seed),
                  }) as SortExp,
              )
            }
            className={cn(
              "h-8 rounded border px-2 text-left text-sm transition-colors duration-fast",
              s.preset === p.id
                ? "border-ink bg-ink text-surface"
                : "border-rule-strong bg-surface hover:bg-sunken",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="mt-2 min-h-8 text-xs text-ink-3">
        {s.preset === "custom"
          ? "Your own values."
          : SORT_PRESETS.find((p) => p.id === s.preset)?.hint}
      </p>
      <div className="mt-3 space-y-4">
        <Slider
          label="Length"
          value={n}
          min={SORT_MIN}
          max={SORT_MAX}
          onChange={(v) =>
            update(
              (e) =>
                ({
                  ...e,
                  input: makeSortInput(s.preset === "custom" ? "random" : s.preset, v, s.seed),
                }) as SortExp,
            )
          }
        />
        <Field
          label="Custom values"
          htmlFor="custom-values"
          hint={
            error ??
            `${SORT_MIN}–${SORT_MAX} whole numbers from 1 to 999, separated by commas or spaces.`
          }
        >
          <div className="flex gap-1.5">
            <input
              id="custom-values"
              value={text}
              onChange={(ev) => setText(ev.target.value)}
              onKeyDown={(ev) => ev.key === "Enter" && apply()}
              aria-invalid={!!error}
              aria-describedby={error ? "custom-error" : undefined}
              className={cn(
                "readout h-8 min-w-0 flex-1 rounded border bg-surface px-2 text-sm",
                error ? "border-signal" : "border-rule-strong",
              )}
              spellCheck={false}
            />
            <Button onClick={apply}>Apply</Button>
          </div>
        </Field>
        {error && (
          <p id="custom-error" role="alert" className="-mt-3 text-xs text-signal-ink">
            {error}
          </p>
        )}
      </div>
    </Section>
  );
}

const TOOLS: { id: Tool; label: string; icon: React.ReactNode; key: string }[] = [
  { id: "wall", label: "Wall", icon: <Wall />, key: "1" },
  { id: "weight", label: "Mud", icon: <Weight />, key: "2" },
  { id: "erase", label: "Erase", icon: <Erase />, key: "3" },
  { id: "start", label: "Start", icon: <StartPin />, key: "4" },
  { id: "target", label: "Target", icon: <TargetPin />, key: "5" },
];

function ToolsSection() {
  const tool = useLab((s) => s.tool);
  const setTool = useLab((s) => s.setTool);
  const weight = useLab((s) => s.weight);
  const setWeight = useLab((s) => s.setWeight);
  const update = useLab((s) => s.update);
  return (
    <Section
      title="Draw"
      aside={
        <IconButton
          label="Clear walls and mud"
          variant="outline"
          onClick={() =>
            update((e) =>
              e.family === "grid"
                ? ({
                    ...e,
                    input: {
                      ...e.input,
                      cells: new Uint8Array(e.input.cells.length).fill(1),
                      terrain: "open",
                    },
                  } as GridExp)
                : e,
            )
          }
        >
          <Trash />
        </IconButton>
      }
    >
      <div className="grid grid-cols-5 gap-1" role="radiogroup" aria-label="Drawing tool">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            role="radio"
            aria-checked={tool === t.id}
            title={`${t.label} (${t.key})`}
            onClick={() => setTool(t.id)}
            className={cn(
              "flex h-12 flex-col items-center justify-center gap-1 rounded border text-2xs transition-colors duration-fast",
              tool === t.id
                ? "border-ink bg-ink text-surface"
                : "border-rule-strong bg-surface text-ink-2 hover:bg-sunken hover:text-ink",
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
      {tool === "weight" && (
        <Slider
          className="mt-4"
          label="Mud cost per cell"
          value={weight}
          min={2}
          max={9}
          onChange={setWeight}
        />
      )}
      <p className="mt-3 text-xs text-ink-3">
        Drag on the grid to draw. Drag the start or target to move them. Painting over the same kind
        of cell erases it.
      </p>
    </Section>
  );
}

export function ParamsEditor({ which }: { which: "a" | "b" }) {
  const exp = useLab((s) => s.exp);
  const setParams = useLab((s) => s.setParams);
  const v = which === "a" ? exp.a : exp.b;
  if (!v) return null;
  const set = (p: AnyVariant["params"]) => setParams(which, p);
  if (v.algo === "astar" || v.algo === "greedy") {
    const p = v.params as GridParams;
    return (
      <div className="space-y-4">
        <Field label="Heuristic h(n)" htmlFor={`h-${which}`}>
          <Select
            id={`h-${which}`}
            value={p.heuristic}
            onChange={(e) => set({ ...p, heuristic: e.target.value as Heuristic })}
          >
            <option value="manhattan">Manhattan · |dx| + |dy|</option>
            <option value="euclidean">Euclidean · straight line</option>
            <option value="octile">Octile · diagonal-aware</option>
            <option value="zero">Zero · becomes Dijkstra</option>
          </Select>
        </Field>
        {v.algo === "astar" && (
          <Slider
            label="Heuristic weight w"
            value={p.weight}
            min={1}
            max={5}
            step={0.5}
            onChange={(weight) => set({ ...p, weight })}
            format={(x) => `×${x}`}
          />
        )}
      </div>
    );
  }
  if (v.algo === "quick") {
    const p = v.params as SortParams;
    return (
      <Field label="Pivot rule" htmlFor={`pivot-${which}`}>
        <Select
          id={`pivot-${which}`}
          value={p.pivot}
          onChange={(e) => set({ pivot: e.target.value as SortParams["pivot"] })}
        >
          <option value="last">Last element</option>
          <option value="median3">Median of three</option>
          <option value="random">Random (seeded)</option>
        </Select>
      </Field>
    );
  }
  if (v.algo === "kmeans") {
    const p = v.params as KMeansParams;
    return (
      <div className="space-y-4">
        <Slider
          label="Clusters k"
          value={p.k}
          min={1}
          max={8}
          onChange={(k) => set({ ...p, k, manual: p.manual.slice(0, k) })}
        />
        <Field
          label="Initialisation"
          htmlFor={`init-${which}`}
          hint={K_INITS.find((i) => i.id === p.init)?.hint}
        >
          <Select
            id={`init-${which}`}
            value={p.init}
            onChange={(e) => set({ ...p, init: e.target.value as KMeansParams["init"] })}
          >
            {K_INITS.map((i) => (
              <option key={i.id} value={i.id}>
                {i.label}
              </option>
            ))}
          </Select>
        </Field>
        {p.init === "manual" && (
          <div className="flex items-center justify-between gap-2 text-xs text-ink-2">
            <span>
              {p.manual.length} of {p.k} placed
              {p.manual.length < p.k ? "; the rest use k-means++" : ""}.
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => set({ ...p, manual: [] })}
              disabled={!p.manual.length}
            >
              Clear
            </Button>
          </div>
        )}
      </div>
    );
  }
  if (v.algo === "gradient") {
    const p = v.params as GradientParams;
    return (
      <div className="space-y-4">
        <Slider
          label="Learning rate"
          value={p.lr}
          min={0.01}
          max={1.5}
          step={0.01}
          onChange={(lr) => set({ ...p, lr: Math.round(lr * 100) / 100 })}
        />
        <Slider
          label="Momentum β"
          value={p.beta}
          min={0}
          max={0.95}
          step={0.05}
          onChange={(beta) => set({ ...p, beta: Math.round(beta * 100) / 100 })}
        />
        <Slider
          label="Steps"
          value={p.steps}
          min={10}
          max={300}
          step={10}
          onChange={(steps) => set({ ...p, steps })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Slider
            label="Start m"
            value={p.m0}
            min={-1.5}
            max={2.3}
            step={0.1}
            onChange={(m0) => set({ ...p, m0: Math.round(m0 * 10) / 10 })}
          />
          <Slider
            label="Start b"
            value={p.b0}
            min={-1}
            max={1.4}
            step={0.1}
            onChange={(b0) => set({ ...p, b0: Math.round(b0 * 10) / 10 })}
          />
        </div>
      </div>
    );
  }
  return (
    <p className="text-sm text-ink-3">
      {getAlgo(v.algo).short} has no settings. Its behavior depends only on the input.
    </p>
  );
}

function ParamsSection({ which }: { which: "a" | "b" }) {
  const exp = useLab((s) => s.exp);
  const v = which === "a" ? exp.a : exp.b;
  if (!v || !hasSettings(v.algo)) return null;
  return (
    <Section
      title={exp.b ? "Run A settings" : "Algorithm settings"}
      aside={exp.b ? <TagAB which="a" /> : undefined}
    >
      <ParamsEditor which={which} />
    </Section>
  );
}

function CompareSection() {
  const exp = useLab((s) => s.exp);
  const setB = useLab((s) => s.setVariantB);
  const options = algosOf(exp.family).filter((a) => exp.family !== "learn" || a.id === exp.a.algo);
  const value = exp.b ? (exp.b.algo === exp.a.algo ? `same:${exp.b.algo}` : exp.b.algo) : "";
  const pick = (val: string) => {
    if (!val) return setB(null);
    if (val.startsWith("same:")) {
      const id = val.slice(5) as AlgoId;
      return setB({ algo: id, params: tweak(id, exp.a.params) } as AnyVariant);
    }
    const id = val as AlgoId;
    setB({
      algo: id,
      params: defaultParams(id, exp.family === "grid" && exp.input.diagonal),
    } as AnyVariant);
  };
  return (
    <Section title="Compare" aside={exp.b ? <TagAB which="b" /> : undefined}>
      <Field label="Run B" htmlFor="compare-with">
        <Select id="compare-with" value={value} onChange={(e) => pick(e.target.value)}>
          <option value="">No comparison</option>
          {options
            .filter((a) => a.id !== exp.a.algo)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          {hasSettings(exp.a.algo) && (
            <option value={`same:${exp.a.algo}`}>
              {getAlgo(exp.a.algo).short} with other settings
            </option>
          )}
        </Select>
      </Field>
      {exp.b && (
        <div className="mt-4 space-y-4">
          <p className="text-xs text-ink-3">
            Both runs share the same input. B is{" "}
            <span className="text-ink">{variantLabel(exp.b)}</span>.
          </p>
          <ParamsEditor which="b" />
        </div>
      )}
    </Section>
  );
}

function ViewSection({ exp }: { exp: Experiment }) {
  const update = useLab((s) => s.update);
  if (exp.family !== "grid") return null;
  return (
    <Section title="View" className="border-b-0">
      <div className="space-y-3">
        <Toggle
          label="Show distances on cells"
          hint="g (and f for A*) on cells large enough to read."
          checked={exp.view.values}
          onChange={(values) =>
            update((e) => ({ ...e, view: { ...e.view, values } }) as Experiment, {
              keepCursor: true,
            })
          }
        />
        {exp.b && (
          <Toggle
            label="Overlay A and B on one grid"
            hint="Shows which cells only A expanded, only B, or both. Turn off for side-by-side panes with each run's own frontier."
            checked={exp.view.overlay}
            onChange={(overlay) =>
              update((e) => ({ ...e, view: { ...e.view, overlay } }) as Experiment, {
                keepCursor: true,
              })
            }
          />
        )}
      </div>
    </Section>
  );
}
