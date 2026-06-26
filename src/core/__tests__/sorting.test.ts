import { describe, it, expect } from "vitest";
import { runSort, deriveSort, mulberry32 } from "../index";
import type { SortAlgo } from "../sorting";

const rng = mulberry32(42);
const sample = Array.from({ length: 18 }, () => Math.floor(rng() * 100));
const algos: SortAlgo[] = ["insertion", "selection", "bubble", "quick"];

describe("sorting", () => {
  for (const algo of algos) {
    it(`${algo} sorts the array ascending`, () => {
      const events = runSort(sample, algo);
      expect(events.length).toBeGreaterThan(0);
      const final = deriveSort(sample, events, events.length - 1);
      const expected = [...sample].sort((a, b) => a - b);
      expect(final.array).toEqual(expected);
    });

    it(`${algo} marks every index sorted by the end`, () => {
      const events = runSort(sample, algo);
      const final = deriveSort(sample, events, events.length - 1);
      expect(final.sorted.size).toBe(sample.length);
    });

    it(`${algo} records comparisons`, () => {
      const events = runSort(sample, algo);
      expect(events.some((e) => e.t === "compare")).toBe(true);
    });
  }

  it("derives a partial frame without mutating the input", () => {
    const before = [...sample];
    const events = runSort(sample, "bubble");
    deriveSort(sample, events, 3);
    expect(sample).toEqual(before);
  });
});
