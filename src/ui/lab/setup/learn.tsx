import type { GradientExp, KMeansExp } from "@/core/experiment";
import { makeRegression, REGRESSION_DATASETS, REGRESSION_POINTS } from "@/core/learn/gradient";
import { CLUSTER_DATASETS, CLUSTER_POINTS, makeClusters } from "@/core/learn/kmeans";
import { useLab } from "@/store/lab";
import { Field, Section, Select, Slider } from "../../primitives";

export function KMeansProblem({ exp, reseed }: { exp: KMeansExp; reseed: React.ReactNode }) {
  const update = useLab((s) => s.update);
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
          {...CLUSTER_POINTS}
          onChange={(n) =>
            update((e) => ({ ...e, input: makeClusters(c.dataset, n, c.seed) }) as KMeansExp)
          }
        />
      </div>
    </Section>
  );
}

export function GradientProblem({ exp, reseed }: { exp: GradientExp; reseed: React.ReactNode }) {
  const update = useLab((s) => s.update);
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
          {...REGRESSION_POINTS}
          onChange={(n) =>
            update((e) => ({ ...e, input: makeRegression(r.dataset, n, r.seed) }) as GradientExp)
          }
        />
      </div>
    </Section>
  );
}
