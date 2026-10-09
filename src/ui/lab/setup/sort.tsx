import { useEffect, useState } from "react";
import type { SortExp } from "@/core/experiment";
import { randomSeed } from "@/core/rng";
import {
  makeSortInput,
  parseCustomValues,
  SORT_MAX,
  SORT_MIN,
  SORT_PRESETS,
} from "@/core/sort/input";
import { cn } from "@/lib/utils";
import { useLab } from "@/store/lab";
import { Button, Field, Section, Slider } from "../../primitives";

export function SortProblem({ exp, reseed }: { exp: SortExp; reseed: React.ReactNode }) {
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
