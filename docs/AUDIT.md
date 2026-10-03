# Audit and resolution

This document tracks every finding from the October 2026 audit of version 2.0.0 and how version 3.0.0 resolves it. A finding is marked **fixed** only after the original failure was reproduced and the corrected behaviour verified, in the running app or by a test that fails on the old behaviour.

## Status of every finding

| #   | Finding (2.0.0)                                                                                                      | Status           | Evidence                                                                                                                                                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Gradient descent drew all points outside the canvas: data y ∈ [1, 2.9], plot y ∈ [0, 1]                              | **Fixed**        | Datasets are normalised to the unit square; the stage has axes, residuals and a loss surface. Test: _keeps every dataset inside the unit square_. Verified visually.                                                                                                    |
| 2   | k-means always finished in 2 frames with identical inertia                                                           | **Fixed**        | Assign and update are separate steps; overlapping, uneven, moon and uniform datasets; k-means++, random, deliberately bad and hand-placed starts. Test: _alternates assign and update_ (more than 4 steps on overlap).                                                  |
| 3   | k-means++ picked the point after the one where the cumulative weight crossed r                                       | **Fixed**        | `plusPlus` in `core/learn/kmeans.ts`. Test: _k-means++ picks the point where the cumulative weight crosses r_.                                                                                                                                                          |
| 4   | Pseudocode highlighted wrong lines (Dijkstra, A\*, selection, quick) and never moved for ML; `Math.min` clamp hid it | **Fixed**        | Every event names a line anchor in `core/info.ts`; no clamp. Test: _pseudocode synchronisation_ runs all 18 algorithms on defaults and every scenario, checking each event's line exists and matches the operation. UI test checks the highlighted line after stepping. |
| 5   | `bg-x/15`-style opacity classes on `var()` colours emitted no CSS                                                    | **Fixed**        | Tokens are RGB channels with `<alpha-value>` in `tailwind.config.ts`. Built CSS checked for opacity variants.                                                                                                                                                           |
| 6   | Hidden inspector tab stayed `display:flex` and pushed content down                                                   | **Fixed**        | Inspector tabs carry no display utilities; UI test asserts exactly one tab panel is rendered.                                                                                                                                                                           |
| 7   | Phone: target and tools off-screen, no scrolling, no touch, no inspector below 1024px                                | **Fixed**        | Purpose-built phone layout: portrait grid, pinned transport, inline Setup / Inspect / Log / About tabs, overlay comparison, pointer events. Measured at 320–430px: no horizontal overflow.                                                                              |
| 8   | Default BFS took ~6 minutes; two events per cell; padding events                                                     | **Fixed**        | Pop and visit merged; padding removed; logical-step granularity; speed adapts so 1× finishes a run in about 12 s; checkpoints.                                                                                                                                          |
| 9   | Global shortcuts hijacked sliders and buttons                                                                        | **Fixed**        | `shortcutFor` ignores composite widgets, text fields, activatable controls and the grid. Tests: _never steals keys…_.                                                                                                                                                   |
| 10  | Slider thumbs had no accessible name                                                                                 | **Fixed**        | Names go on `Slider.Thumb`. UI test: _gives every slider an accessible name_.                                                                                                                                                                                           |
| 11  | 680 grid cells were 680 tab stops; invalid `role="grid"`                                                             | **Fixed**        | The grid is one canvas with one tab stop, arrow-key cursor, Space/S/T editing and a polite live region describing the focused cell.                                                                                                                                     |
| 12  | Status said "Press Run to record a trace" during sort and learn playback                                             | **Fixed**        | Status is replaced by the per-step explanation for every family.                                                                                                                                                                                                        |
| 13  | Palette couldn't find "bfs"; its own placeholder matched nothing; no arrow keys                                      | **Fixed**        | Aliases, ranked search, combobox/listbox ARIA, arrow/Home/End/Enter. Tests: _command search_, _command palette_.                                                                                                                                                        |
| 14  | Export omitted the grid and had no import                                                                            | **Fixed**        | Versioned format with validation; file import and pasted-link import. Tests: _imports exactly what it exports_, _round-trips every scenario_.                                                                                                                           |
| 15  | Dijkstra/A\* labelled O(E log V) but scanned a set (O(V²))                                                           | **Fixed**        | `core/heap.ts` binary heap with lazy deletion; stale entries are shown in the inspector.                                                                                                                                                                                |
| 16  | README claimed WCAG AA, used a static test badge, cited a missing branch                                             | **Fixed**        | Rewritten README and changelog with no unverifiable claims.                                                                                                                                                                                                             |
| 17  | No data-structure view                                                                                               | **Fixed**        | Algorithm-specific inspectors for every family.                                                                                                                                                                                                                         |
| 18  | No comparison, presets, mazes, draggable endpoints or sharing                                                        | **Fixed**        | All implemented; see the README.                                                                                                                                                                                                                                        |
| 19  | Whole-store subscriptions and an unvirtualised event log                                                             | **Fixed**        | Selector subscriptions; the log shows a ±30 window that follows the cursor.                                                                                                                                                                                             |
| 20  | Every scrub re-folded the trace from event 0                                                                         | **Fixed**        | `core/player.ts` keyframe cache. 38,640-event trace: random seek 0.33 ms.                                                                                                                                                                                               |
| 21  | Unused dependencies, dead exports, Google Fonts request                                                              | **Fixed**        | `lucide-react` and `sonner` removed; every Radix package in use; fonts self-hosted.                                                                                                                                                                                     |
| 22  | Visual identity was a default violet SaaS template                                                                   | **Fixed**        | See _Design decisions_.                                                                                                                                                                                                                                                 |
| 23  | Repo name promises ML; ML was the weakest part                                                                       | **Repositioned** | The product is an algorithm lab; learning is one of five families and works properly. The repository name is unchanged because renaming it would break the Pages URL.                                                                                                   |

### Found and fixed during the rebuild

- Weighted A\* on the "rooms" terrain never produced a worse path, so that scenario showed nothing. Moved to weighted terrain and covered by a scenario-claim test.
- "Weights change the answer" used a seed where BFS and Dijkstra tie. New seeds give BFS a path 3× (desktop) and 2× (phone) more expensive; tested.
- The binary-search scenario claimed 7 probes for 128 values; the correct bound is 8. Title fixed and tested.
- Graph share links were lossy because node positions were rounded on export. Positions are now rounded at creation, so links reproduce exactly; tested.
- Thumbnails crashed where `IntersectionObserver` is missing. Guarded.
- The pseudocode highlight bar went stale after resize, and measuring it forced a synchronous page layout on every step. Replaced with row styling.
- The canvas palette called `getComputedStyle().getPropertyValue` per fill, forcing style recalculation. Values are cached per theme.
- Weighted terrain redrew its hatching on every frame. The static terrain is now pre-rendered once per input, size and theme.
- Compare on a 320px phone shrank each grid to about 25px tall. Phones now get a single overlaid grid.

## Scorecard

| Area               | 2.0.0   | 3.0.0   | Why it isn't higher                                                                                                               |
| ------------------ | ------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Product concept    | 4       | 8       | Not yet validated with real students or teachers                                                                                  |
| Differentiation    | 2       | 7.5     | Data-structure views, comparison verdicts and share links are rare in this category, but graph editing is limited to moving nodes |
| Feature depth      | 2       | 7.5     | No data-structure family (heaps, BSTs, hash tables) and no topological sort or Bellman-Ford                                       |
| UX                 | 3       | 7.5     | Tour and explanations exist; no usability study                                                                                   |
| UI                 | 4       | 8       |                                                                                                                                   |
| Visual identity    | 2       | 7.5     |                                                                                                                                   |
| Design system      | 4       | 8       | Tokens, type scale, radii, motion and focus are defined; no published component docs                                              |
| Interaction design | 3       | 7.5     |                                                                                                                                   |
| Motion             | 3       | 7       | Bar travel, cell flashes, path draw-on and centroid glide; no animated transitions between families                               |
| Accessibility      | 2       | 7       | Keyboard paths, names, live regions and reduced motion are tested; no screen-reader session with NVDA or VoiceOver                |
| Responsive         | 1       | 8       |                                                                                                                                   |
| Performance        | 6       | 7.5     | Large grids in compare mode drop below 60 fps at the highest speeds                                                               |
| Code quality       | 5       | 8       |                                                                                                                                   |
| Architecture       | 6       | 8.5     |                                                                                                                                   |
| Reliability        | 3       | 8       | No browser end-to-end tests in CI                                                                                                 |
| Security           | 8       | 8.5     |                                                                                                                                   |
| Documentation      | 4       | 8       |                                                                                                                                   |
| Onboarding         | 1       | 7.5     |                                                                                                                                   |
| Content and copy   | 3       | 8       |                                                                                                                                   |
| Overall polish     | 3       | 7.5     |                                                                                                                                   |
| **Overall**        | **3.3** | **7.8** |                                                                                                                                   |

7.8 is a credible, coherent product. Reaching 9 needs evidence this audit can't produce from inside the repository: sessions with students, a screen-reader pass, cross-browser end-to-end tests, and one more family (data structures) to round out a course's worth of content.

## Major product decisions

1. **Positioning:** an algorithm lab for CS students, not an "ML visualizer". The differentiator is the visible data structure and the reason behind each step.
2. **Never an empty screen.** Every algorithm opens with a prepared input and a run already recorded, at step 0. "Run" is just play.
3. **Steps, not frames.** The default unit is a logical step (one expansion, pass, partition or iteration); single operations are one key away.
4. **Compare means a verdict.** Two runs share one input, and the app states the difference in numbers.
5. **The URL is the experiment.** Every change updates a shareable link; files and the library use the same format.
6. **Learning stays, but only as real experiments**: a bad start, non-round clusters, too-high learning rate, momentum. Each one demonstrates a failure mode a student should see.
7. **Phones get their own layout**, not a squeezed desktop.

## Design decisions

- **Two themes from one token set.** _Paper_ (warm off-white, ink, hairline rules) for projectors and daylight; _Scope_ (graphite) for the dark.
- **One signal colour** (vermilion) means "now": the current cell, the active pseudocode line, the Run button. Algorithm states each have a fixed hue on every surface: amber frontier, steel expanded, green path, ink walls, hatched mud. A and B are terracotta and cobalt everywhere.
- **IBM Plex Sans and Mono**, self-hosted. Numbers are tabular mono readouts.
- **Rules, not cards.** Panels are separated by 1px lines; radii are 2–6px; the only shadow is on popovers.
- **A custom mark** (a scope reticle with a stepped path) and a 16px custom icon set replace lucide.
- **Motion explains causality:** cells flash when the algorithm changes them, the path draws itself in, bars travel when swapped, values move from the merge buffer back into the array, centroids glide to their new means, and the active code row eases between lines. All of it respects reduced motion, which can also be forced on in Settings.

## Rebuilt rather than patched

The learning family; the grid renderer (canvas with a cached terrain layer, a keyboard cursor and pointer editing); the inspector; the transport and scheduler; the command palette; the experiment model and share format; the layout system; the visual identity; the README.

## Kept and improved

The framework-free core with event traces, seeded randomness, Zustand, Radix dialog, tabs and slider, TypeScript strict, Vitest, CI and Pages deploy, and reduced-motion support.

## QA results

**Automated:** 92 tests covering:

- algorithm correctness for every family
- pseudocode synchronisation and scenario claims
- player random access
- share and file round-trips, plus damaged links and invalid files
- shortcut conflicts and command search
- layout and routing
- UI journeys: first visit, tour start, stepping with the code highlight, slider names, inspector panels, compare verdict, shared link at a step, broken link, palette keyboard navigation

**Manual (in a browser):**

- every family run, stepped and scrubbed
- target dragged and walls drawn by pointer
- compare in all families
- k-means manual placement and the corner start
- gradient divergence
- command palette queries
- light and dark themes
- phone layout

**Responsive:** measured at 320, 375, 390, 430, 768, 1024, 1280, 1440 and 1920px on Explore, a single-run lab, a comparison and Saved.

- No horizontal overflow at any width.
- Controls are at least 24px, except inline text links (exempt under WCAG 2.5.8) and slider thumbs, which carry an extended hit area.

**Accessibility:**

- one tab stop per widget
- skip link
- named controls
- radiogroup and toolbar semantics
- combobox and listbox palette
- live regions that stay quiet during playback
- reduced motion
- single-key shortcuts can be disabled
- contrast of secondary text at least 4.5:1 in both themes

Not verified: a real screen-reader session.

## Performance (production build)

| Measure                                          | Result                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------ |
| Initial JS                                       | 440 KB (144 KB gzip); the lab loads separately (86 KB, 29 KB gzip) |
| Third-party requests                             | none                                                               |
| Trace build, largest grid (61×37)                | 1.5–7 ms                                                           |
| Random seek, largest grid                        | ≤ 3.5 ms; 0.33 ms on a 200×120 stress trace with 38,640 events     |
| Playback at 8×, medium grid, two runs            | 56 fps                                                             |
| Playback at 8×, sorting, k-means, gradient       | 60 fps                                                             |
| Playback at 8×, largest grid, two runs, weighted | 16.7 ms median frame; p95 233 ms                                   |
| JS heap during playback                          | 14–15 MB                                                           |

The large-grid figures come from a Chrome instance driven by DevTools with the accessibility tree enabled, which makes DOM text updates unusually expensive; ordinary sessions should do better. Profiling found three bottlenecks, which were removed:

- forced layout on every step from the code highlight
- style recalculation from palette reads
- per-frame terrain hatching
