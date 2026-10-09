import type { SearchExp } from "@/core/experiment";
import {
  makeSearchInput,
  SEARCH_MAX,
  SEARCH_MIN,
  TARGET_MODES,
  type TargetMode,
} from "@/core/search/search";
import { useLab } from "@/store/lab";
import { Field, Section, Select, Slider } from "../../primitives";

export function SearchProblem({ exp, reseed }: { exp: SearchExp; reseed: React.ReactNode }) {
  const update = useLab((s) => s.update);
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
                    input: makeSearchInput(s.values.length, ev.target.value as TargetMode, s.seed),
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
