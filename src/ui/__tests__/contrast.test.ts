import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.resolve(__dirname, "../../index.css"), "utf8");

function tokens(selector: string): Record<string, number[]> {
  const start = css.indexOf(selector);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  const out: Record<string, number[]> = {};
  for (const m of body.matchAll(/--([\w-]+):\s*(\d+) (\d+) (\d+);/g))
    out[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])];
  return out;
}

const luminance = (rgb: number[]) => {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (a: number[], b: number[]) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const THEMES = { light: '[data-theme="light"]', dark: '[data-theme="dark"]' };
const TEXT = ["ink", "ink-2", "ink-3", "signal-ink"];
const SURFACES = ["bg", "surface", "field", "sunken"];
const TEXT_MIN = 4.5;
const NON_TEXT_MIN = 3;

describe("colour tokens meet WCAG 2.x contrast", () => {
  for (const [theme, selector] of Object.entries(THEMES)) {
    const t = tokens(selector);

    it(`${theme}: every text token on every surface is at least ${TEXT_MIN}:1`, () => {
      for (const fg of TEXT)
        for (const bg of SURFACES)
          expect(ratio(t[fg], t[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(TEXT_MIN);
    });

    it(`${theme}: text on the signal colour is at least ${TEXT_MIN}:1`, () => {
      expect(ratio(t["on-signal"], t.signal)).toBeGreaterThanOrEqual(TEXT_MIN);
    });

    it(`${theme}: the focus ring is at least ${NON_TEXT_MIN}:1 against every surface`, () => {
      for (const bg of SURFACES)
        expect(ratio(t.focus, t[bg]), `focus on ${bg}`).toBeGreaterThanOrEqual(NON_TEXT_MIN);
    });
  }
});
