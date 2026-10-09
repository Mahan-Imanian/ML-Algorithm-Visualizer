import type { AnyVariant, Experiment, GridExp } from "@/core/experiment";
import type { GridParams } from "@/core/grid/algorithms";
import { GRID_SIZES, MUD_COST, type GridSize, type Heuristic } from "@/core/grid/model";
import { makeGrid, TERRAINS } from "@/core/grid/terrain";
import { randomSeed } from "@/core/rng";
import { cn } from "@/lib/utils";
import { useLab, type Tool } from "@/store/lab";
import { Erase, StartPin, TargetPin, Trash, Wall, Weight } from "../../icons";
import { Field, IconButton, Section, Segmented, Slider, Toggle } from "../../primitives";

export function GridProblem({ exp, reseed }: { exp: GridExp; reseed: React.ReactNode }) {
  const update = useLab((s) => s.update);
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

const TOOLS: { id: Tool; label: string; icon: React.ReactNode; key: string }[] = [
  { id: "wall", label: "Wall", icon: <Wall />, key: "1" },
  { id: "weight", label: "Mud", icon: <Weight />, key: "2" },
  { id: "erase", label: "Erase", icon: <Erase />, key: "3" },
  { id: "start", label: "Start", icon: <StartPin />, key: "4" },
  { id: "target", label: "Target", icon: <TargetPin />, key: "5" },
];

export function GridTools() {
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
          {...MUD_COST}
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

export function GridView({ exp }: { exp: GridExp }) {
  const update = useLab((s) => s.update);
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
