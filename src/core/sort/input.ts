import { mulberry32, shuffleInPlace } from "../rng";

export type SortPreset = "random" | "nearly" | "reversed" | "sorted" | "few" | "custom";

export interface SortInput {
  values: number[];
  preset: SortPreset;
  seed: number;
}

export const SORT_PRESETS: { id: Exclude<SortPreset, "custom">; label: string; hint: string }[] = [
  { id: "random", label: "Random", hint: "Typical case." },
  {
    id: "nearly",
    label: "Nearly sorted",
    hint: "A few values out of place. Best case for adaptive sorts.",
  },
  { id: "reversed", label: "Reversed", hint: "Worst case for insertion and bubble sort." },
  {
    id: "sorted",
    label: "Already sorted",
    hint: "Worst case for quicksort with a last-element pivot.",
  },
  {
    id: "few",
    label: "Few unique",
    hint: "Many duplicates. Exposes stability and partition quirks.",
  },
];

export const SORT_MIN = 4;
export const SORT_MAX = 64;
export const SORT_VALUE_MIN = 1;
export const SORT_VALUE_MAX = 999;

export function makeSortInput(
  preset: Exclude<SortPreset, "custom">,
  n: number,
  seed: number,
): SortInput {
  const rng = mulberry32(seed);
  const size = Math.max(SORT_MIN, Math.min(SORT_MAX, Math.round(n)));
  let values: number[];
  if (preset === "few") {
    const levels = [18, 42, 66, 90];
    values = Array.from({ length: size }, () => levels[Math.floor(rng() * levels.length)]);
  } else {
    values = Array.from({ length: size }, (_, i) =>
      Math.round(6 + (i * 92) / Math.max(1, size - 1)),
    );
    if (preset === "random") shuffleInPlace(values, rng);
    else if (preset === "reversed") values.reverse();
    else if (preset === "nearly") {
      const swaps = Math.max(1, Math.round(size / 10));
      for (let s = 0; s < swaps; s++) {
        const i = Math.floor(rng() * (size - 3));
        const j = i + 1 + Math.floor(rng() * 3);
        [values[i], values[j]] = [values[j], values[i]];
      }
    }
  }
  return { values, preset, seed };
}

export function parseCustomValues(text: string): { values: number[] } | { error: string } {
  const parts = text
    .split(/[\s,;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < SORT_MIN) return { error: `Enter at least ${SORT_MIN} numbers.` };
  if (parts.length > SORT_MAX) return { error: `At most ${SORT_MAX} numbers.` };
  const values: number[] = [];
  for (const p of parts) {
    const v = Number(p);
    if (!/^-?\d+(\.\d+)?$/.test(p) || !Number.isInteger(v))
      return { error: `"${p}" is not a whole number.` };
    if (v < SORT_VALUE_MIN || v > SORT_VALUE_MAX)
      return { error: `Use whole numbers from ${SORT_VALUE_MIN} to ${SORT_VALUE_MAX}.` };
    values.push(v);
  }
  return { values };
}
