import { defaultParams, variantLabel, type AnyVariant, type Experiment } from "@/core/experiment";
import { HEURISTIC_WEIGHT, type GridParams } from "@/core/grid/algorithms";
import type { Heuristic } from "@/core/grid/model";
import { algosOf, getAlgo, type AlgoId } from "@/core/info";
import { GRADIENT_LIMITS, type GradientParams } from "@/core/learn/gradient";
import { K_INITS, K_RANGE, type KMeansParams } from "@/core/learn/kmeans";
import { randomSeed } from "@/core/rng";
import type { SortParams } from "@/core/sort/algorithms";
import { useLab } from "@/store/lab";
import { Dice } from "../icons";
import { Button, Field, IconButton, Section, Select, Slider } from "../primitives";
import { TagAB } from "./Panels";
import { GraphProblem } from "./setup/graph";
import { GridProblem, GridTools, GridView } from "./setup/grid";
import { GradientProblem, KMeansProblem } from "./setup/learn";
import { SearchProblem } from "./setup/search";
import { SortProblem } from "./setup/sort";
import { hasSettings, regenerate, tweak } from "./variants";

export function Setup() {
  const exp = useLab((s) => s.exp);
  return (
    <div>
      <ProblemSection exp={exp} />
      {exp.family === "grid" && <GridTools />}
      <ParamsSection which="a" />
      <CompareSection />
      {exp.family === "grid" && <GridView exp={exp} />}
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
    case "grid":
      return <GridProblem exp={exp} reseed={reseed} />;
    case "sort":
      return <SortProblem exp={exp} reseed={reseed} />;
    case "search":
      return <SearchProblem exp={exp} reseed={reseed} />;
    case "graph":
      return <GraphProblem exp={exp} reseed={reseed} />;
    case "learn":
      return exp.model === "kmeans" ? (
        <KMeansProblem exp={exp} reseed={reseed} />
      ) : (
        <GradientProblem exp={exp} reseed={reseed} />
      );
  }
}

function ParamsEditor({ which }: { which: "a" | "b" }) {
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
            {...HEURISTIC_WEIGHT}
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
          {...K_RANGE}
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
          {...GRADIENT_LIMITS.lr}
          onChange={(lr) => set({ ...p, lr: Math.round(lr * 100) / 100 })}
        />
        <Slider
          label="Momentum β"
          value={p.beta}
          {...GRADIENT_LIMITS.beta}
          onChange={(beta) => set({ ...p, beta: Math.round(beta * 100) / 100 })}
        />
        <Slider
          label="Steps"
          value={p.steps}
          {...GRADIENT_LIMITS.steps}
          onChange={(steps) => set({ ...p, steps })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Slider
            label="Start m"
            value={p.m0}
            {...GRADIENT_LIMITS.m0}
            onChange={(m0) => set({ ...p, m0: Math.round(m0 * 10) / 10 })}
          />
          <Slider
            label="Start b"
            value={p.b0}
            {...GRADIENT_LIMITS.b0}
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
