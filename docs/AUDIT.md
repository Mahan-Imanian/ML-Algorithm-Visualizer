# Audit history

This file records each audit of Algoscope: what it found, what changed, and how the result was checked. Newest first.

Figures for versions 2.0.0 and 3.0.0 come from one-off measurements taken during those audits with scripts that were not committed. They cannot be reproduced from this repository and are kept only as history. Measurements of the current code use the scripts described in [internals.md](internals.md#measurements).

## Credibility audit (2026-10-09, unreleased)

This audit checked every number and verification claim in the README, `docs/` and the changelog against something that can be run from the repository, and looked for the same weaknesses in the code: unvalidated input, unexplained constants and dead code.

### Findings and changes

1. **Numbers that could not be reproduced.** Frame times, recording times, Lighthouse scores, heap size and contrast ratios were measured with scripts kept outside the repository. Added `npm run bench` (Vitest benchmarks for recording and seeking), `npm run perf` (frame times, canvas size stability, draw cost, render rate and third-party requests in headless Chrome), `npm run lighthouse` (Lighthouse 12.8.2), a contrast test that reads the colour tokens from `src/index.css`, and a test that recomputes the figures quoted in the README from the engine. Figures that none of these produce were removed. The ones kept were re-measured and are listed with date and environment.
2. **Self-assigned scorecards.** Earlier versions of this file graded the project from 1 to 10 on 20 to 25 dimensions and averaged the grades. These were the author's opinions presented like measurements, and were removed.
3. **Input handling.**
   - A shared graph whose edges had all been removed came back with generated edges, because an empty edge list fell through to `connectEdges` (`src/core/share.ts`).
   - Duplicate and reversed edges in a link were kept as separate edges.
   - Grid run lengths accepted trailing characters, because `parseInt` stops at the first invalid one.
   - An imported file with a missing or non-integer `version` was reported as "made by a newer version".
   - Links accepted parameter values the editor cannot produce: 500 gradient steps, a learning rate of 3, 30 k-means points, 1 or 6 edges per node.
   - Custom sort input accepted `0x10`, `1e2` and `0b11` and silently converted them.
   - A saved-experiment entry with an unknown family crashed the saved list, and a stored library that was not an array crashed the app on load (`src/store/library.ts`).
   - Importing a file or link at a saved step seeked 50 ms after navigating. When the lab chunk took longer to load, the import opened at step 0.

   Each has a test that failed before the fix.

4. **Constants without names or rationale.** Parameter ranges were written three times, in the editor sliders, the link decoder and the generators, and the three disagreed (gradient steps were 10–300 in the editor and 1–500 elsewhere). Each parameter now has one `Range` next to its algorithm. Playback rates, keyframe intervals, motion timing, layout heights, breakpoints and generator thresholds are named, and [internals.md](internals.md#tuning-constants) explains each one and how it was chosen.
5. **Dead code.** `knip` found an unused function, an unused helper, three unused icons and about fifteen exports used only inside their own module. `scripts/make-images.mjs` imported `esbuild` without declaring it. Union-find, node clamping and rounding were implemented more than once in the graph family.

### Left as is

- `src/ui/lab/Setup.tsx` (about 830 lines) and `src/ui/lab/GridCanvas.tsx` (about 790 lines) are long. Setup is a set of small per-family editors and GridCanvas is one drawing routine with its input handling; splitting either into more files would move code without removing any coupling.
- Not verified: a screen-reader session, a high-refresh-rate display, a real phone.

## 3.1.0 follow-up audit (of 3.0.0)

### What was wrong in 3.0.0

1. **The visualization moved when text changed.** The caption sat inside the stage's flex column and grew as explanations wrapped, and pane-header metrics wrapped too. Each change resized the stage, fired the ResizeObserver, resized the canvas and re-centred the grid. On the 3.0.0 build, one BFS run produced 3 distinct canvas sizes and a comparison produced 14.
2. **Rendering was tied to React.** Every cursor change re-rendered the stage tree. On the largest weighted comparison at 8×, the 95th-percentile frame time was 233 ms.
3. **Motion showed state but not cause.** Cells snapped between colours, and nothing connected a dequeued cell to the neighbours it enqueued.
4. **There was no presentation layout.** On a projector, the lab chrome took more room than the visualization.
5. **Graph editing was limited to moving nodes**, and a disconnected graph produced a tree with no warning.
6. **Smaller defects:** a crash when switching runs from the palette, palette ranking (`BFS` matched an experiment before the algorithm), end-of-run captions stopping on a sub-step, overlapping pointer labels, dark-theme walls brighter than the search, and five accessibility failures reported by Lighthouse (contrast 4.06:1 on the main action, empty list roles, heading order, no main landmark, name/label mismatches).

### Changes in 3.1.0

| Finding            | Change                                                                                                                                                             | How it is checked now                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Layout instability | Stage in fixed grid tracks with `contain: strict`; fixed-height, clamped captions; single-line headers with fixed-width tabular readouts; stable scrollbar gutters | `npm run perf` samples every canvas's box on every frame and reports how many distinct boxes each run produced                   |
| Smoothness         | Two clocks: canvases draw from the live cursor in rAF; panels follow a presented cursor throttled to 20 Hz during playback; time-based easing                      | `npm run perf` frame intervals, draw cost and React renders per second                                                           |
| Motion             | Discovery grows from the centre, enqueue edges draw in, expansion crossfades, the path traces back from the target, bars and pointers travel, frontier rows slide  | Visual review only                                                                                                               |
| Presentation       | Full-screen mode with large type and toggleable panels                                                                                                             | UI test for `P`, `C`, `S`, `E`, `M` and `Escape`                                                                                 |
| Graph editing      | Connect, disconnect, add and delete nodes; forest detection                                                                                                        | Engine tests for edits, re-indexing, two components and the "Disconnected" milestone                                             |
| Palette            | An exact alias match on an algorithm outranks a prefix match on anything else; arrow keys follow the visual order                                                  | Tests against the real command list (`BFS`, `bfs`, `breadth`, `A*`, `astar`, …) and a UI test that types `BFS` and presses Enter |
| Accessibility      | Contrast token for text on orange, roles, headings, landmark, names                                                                                                | `npm run lighthouse`; `src/ui/__tests__/contrast.test.ts` checks the text and focus tokens in both themes                        |

## 2.0.0 → 3.0.0 audit

| #   | Finding in 2.0.0                                                                                                     | Status       | Evidence                                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Gradient descent drew all points outside the canvas: data y ∈ [1, 2.9], plot y ∈ [0, 1]                              | Fixed        | Datasets are normalised to the unit square. Test: _keeps every dataset inside the unit square_.                                                                      |
| 2   | k-means always finished in 2 frames with identical inertia                                                           | Fixed        | Assign and update are separate steps; more datasets and initialisations. Test: _alternates assign and update_.                                                       |
| 3   | k-means++ picked the point after the one where the cumulative weight crossed r                                       | Fixed        | `plusPlus` in `core/learn/kmeans.ts`. Test: _k-means++ picks the point where the cumulative weight crosses r_.                                                       |
| 4   | Pseudocode highlighted wrong lines (Dijkstra, A\*, selection, quick) and never moved for ML; `Math.min` clamp hid it | Fixed        | Every event names a line anchor in `core/info.ts`; no clamp. The pseudocode test runs all 18 algorithms and every scenario and checks each event's line.             |
| 5   | `bg-x/15`-style opacity classes on `var()` colours emitted no CSS                                                    | Fixed        | Tokens are RGB channels with `<alpha-value>` in `tailwind.config.ts`.                                                                                                |
| 6   | Hidden inspector tab stayed `display:flex` and pushed content down                                                   | Fixed        | UI test asserts exactly one tab panel is rendered.                                                                                                                   |
| 7   | Phone: target and tools off-screen, no scrolling, no touch, no inspector below 1024px                                | Fixed        | Separate phone layout with pointer events. Checked by hand at 320–430 px during the audit; no script.                                                                |
| 8   | Default BFS took about 6 minutes; two events per cell; padding events                                                | Fixed        | Pop and visit merged, padding removed, logical-step playback, and a rate that targets about 12 s per run at 1× (test: _plays a mid-sized run in 12 s_).              |
| 9   | Global shortcuts hijacked sliders and buttons                                                                        | Fixed        | `shortcutFor` ignores composite widgets, text fields, activatable controls and the grid. Tests: _never steals keys…_.                                                |
| 10  | Slider thumbs had no accessible name                                                                                 | Fixed        | UI test: _gives every slider an accessible name_.                                                                                                                    |
| 11  | 680 grid cells were 680 tab stops; invalid `role="grid"`                                                             | Fixed        | The grid is one canvas with one tab stop, an arrow-key cursor, Space/S/T editing and a polite live region describing the focused cell.                               |
| 12  | Status said "Press Run to record a trace" during sort and learn playback                                             | Fixed        | The status line is replaced by the per-step explanation for every family.                                                                                            |
| 13  | Palette couldn't find "bfs"; its own placeholder matched nothing; no arrow keys                                      | Fixed        | Aliases, ranked search, combobox/listbox ARIA, arrow/Home/End/Enter. Tests: _command search_, _command palette_.                                                     |
| 14  | Export omitted the grid and had no import                                                                            | Fixed        | Versioned format with validation; file and pasted-link import. Tests: _imports exactly what it exports_, _round-trips every scenario_, and the malformed-link tests. |
| 15  | Dijkstra/A\* labelled O(E log V) but scanned a set (O(V²))                                                           | Fixed        | `core/heap.ts` binary heap with lazy deletion; stale entries are shown in the inspector.                                                                             |
| 16  | README claimed WCAG AA, used a static test badge, cited a missing branch                                             | Fixed        | README rewritten. (The 2026-10-09 audit found that later README versions again made claims without a script behind them.)                                            |
| 17  | No data-structure view                                                                                               | Fixed        | Algorithm-specific inspectors for every family.                                                                                                                      |
| 18  | No comparison, presets, mazes, draggable endpoints or sharing                                                        | Fixed        | All implemented; see the README.                                                                                                                                     |
| 19  | Whole-store subscriptions and an unvirtualised event log                                                             | Fixed        | Selector subscriptions; the log shows 30 operations either side of the cursor.                                                                                       |
| 20  | Every scrub re-folded the trace from event 0                                                                         | Fixed        | `core/player.ts` keyframe cache. `npm run bench` times random seeks.                                                                                                 |
| 21  | Unused dependencies, dead exports, Google Fonts request                                                              | Fixed        | `lucide-react` and `sonner` removed; fonts self-hosted. `npm run perf` reports any request to another origin.                                                        |
| 22  | Visual identity was a default violet template                                                                        | Fixed        | See _Visual design_ below.                                                                                                                                           |
| 23  | Repository name promises ML; ML was the weakest part                                                                 | Repositioned | The app is an algorithm lab with learning as one of five families. The repository keeps its name because renaming it would change the Pages URL.                     |

### Found and fixed during the rebuild

- Weighted A\* on the "rooms" terrain never produced a worse path, so that scenario showed nothing. Moved to weighted terrain and covered by a scenario test.
- "Weights change the answer" used a seed where BFS and Dijkstra tie. The new seeds make BFS's path more expensive; tested.
- The binary-search scenario claimed 7 probes for 128 values; the correct bound is 8. Title fixed and tested.
- Graph share links were lossy because node positions were rounded on export. Positions are now rounded when created, so links reproduce exactly; tested.
- Thumbnails crashed where `IntersectionObserver` is missing. Guarded.
- The pseudocode highlight bar forced a synchronous layout on every step. Replaced with row styling.
- The canvas palette called `getComputedStyle().getPropertyValue` per fill. Values are cached per theme.
- Weighted terrain redrew its hatching on every frame. The static terrain is pre-rendered once per input, size and theme.
- Compare on a 320 px phone shrank each grid to about 25 px tall. Phones get a single overlaid grid.

### Product decisions made in 3.0.0

1. The app is an algorithm lab for CS students rather than an "ML visualizer". What it adds over a plain animation is the visible data structure and the reason for each step.
2. Every algorithm opens with a prepared input and a recorded run at step 0, so there is never an empty screen.
3. The default playback unit is a logical step (one expansion, pass, partition or iteration); single operations are one key away.
4. A comparison runs two algorithms on one input and states the difference in numbers.
5. The URL encodes the experiment; files and the saved library use the same format.
6. The learning family stays, limited to cases that show a failure mode: a bad start, non-round clusters, too high a learning rate, momentum.
7. Phones get their own layout.

### Visual design

- Two themes from one token set: _Paper_ (warm off-white, ink, hairline rules) and _Scope_ (graphite).
- One signal colour (vermilion) marks the current cell, the active pseudocode line and the Run button. Algorithm states keep a fixed hue on every surface: amber frontier, steel expanded, green path, ink walls, hatched mud. Runs A and B are terracotta and cobalt everywhere.
- IBM Plex Sans and Mono, self-hosted. Numbers use tabular mono figures.
- Panels are separated by 1 px rules; radii are 2–6 px; only popovers have a shadow.
- A custom mark and a 16 px icon set replaced lucide.
- Motion follows what the algorithm changed: cells flash when changed, the path draws in, bars travel when swapped, values move from the merge buffer back into the array, centroids glide to their new means. Reduced motion is respected and can be forced in Settings.

### Rebuilt in 3.0.0

The learning family, the grid renderer (canvas with a cached terrain layer, a keyboard cursor and pointer editing), the inspector, the transport and scheduler, the command palette, the experiment model and share format, the layout, the visual identity and the README.

Kept from 2.0.0: the framework-free core with event traces, seeded randomness, Zustand, Radix dialog, tabs and slider, strict TypeScript, Vitest, CI and the Pages deploy, and reduced-motion support.

### Checks at the 3.0.0 release

These were done once for 3.0.0. Only the automated ones can be repeated.

- Automated: 92 tests at the time, covering algorithm correctness, pseudocode lines and scenario claims, player random access, share and file round-trips including damaged input, shortcut conflicts, command search, layout and routing, and UI journeys.
- By hand in a browser: every family run, stepped and scrubbed; pointer drawing and dragging; compare in all families; manual k-means placement; gradient divergence; palette queries; both themes; the phone layout.
- By hand at 320, 375, 390, 430, 768, 1024, 1280, 1440 and 1920 px: no horizontal overflow, and controls at least 24 px except inline links and slider thumbs (which have an extended hit area).
- Not done: a screen-reader session.

One-off performance figures for the 3.0.0 production build, from a Chrome instance driven over DevTools with the accessibility tree enabled: initial JS 440 KB (144 KB gzip), lab chunk 86 KB (29 KB gzip), 56 fps at 8× on a medium two-run grid, and a 233 ms 95th-percentile frame on the largest weighted comparison. Profiling then found three causes, all removed in 3.0.0 or 3.1.0: a forced layout on every step from the code highlight, style recalculation from palette reads, and per-frame terrain hatching.
