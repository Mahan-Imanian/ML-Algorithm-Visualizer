# Changelog

## 3.1.0

Stability, smoothness and presentation. See [docs/AUDIT.md](docs/AUDIT.md#310-follow-up-audit) for the measurements.

### Fixed

- **The visualization no longer moves when text changes.** In 3.0.0 the caption and the pane header could wrap, which resized the stage and made the canvas re-centre on every step: three different canvas sizes during one BFS run and fourteen during a comparison. The stage now sits in fixed grid tracks with `contain: strict`, and captions, headers and counters have fixed sizes. Across about 150 frames for each algorithm, every canvas keeps exactly one size.
- **Large comparisons no longer stutter.** p95 frame time on the largest weighted comparison fell from 233 ms to 17 ms. Canvases draw in `requestAnimationFrame` from the live cursor; text panels update at most 20 times a second during playback.
- A run switched from the palette could hand the code panel a cursor from the previous run and crash it.
- Typing `BFS` in the palette ranked the "BFS floods a maze" experiment above breadth-first search itself. Arrow-key order now matches the grouped order on screen.
- Sorting and gradient runs ended on a leftover sub-step ("First value is in place"). They now end with a summary of the run.
- Pointer labels in sorting and searching overlapped when two pointers sat on neighbouring bars.
- Dark-theme maze walls were brighter than the search itself.
- Phones lost the B tag in the comparison header, and the stage left empty space around wide grids.
- Accessibility: the orange actions fell below 4.5:1 contrast, empty lists were exposed as lists, headings skipped levels, the page had no main landmark, and four buttons had accessible names that didn't contain their visible text.

### Added

- **Presentation mode** (`P`): full screen, large type, toggleable code, state, explanation and metrics (`C`, `S`, `E`, `M`).
- **Motion that shows cause:** cells grow in when discovered, the edge to each queued neighbour draws in, the expanded cell crossfades, the path traces back from the target, bars travel to their new positions, and frontier rows slide as the queue changes. Motion is time-based, so it behaves the same at any refresh rate.
- **Graph editor:** connect, disconnect, add and delete nodes. Disconnected graphs produce a spanning forest and say so.
- **Bookmarks** (`B`) on the timeline, used as milestones by `[` and `]`.
- **Comparison:** grids overlay by default, the verdict names the cell where the two expansion orders diverge, and a chart plots both runs' progress.
- **Depth notes** for every algorithm: the state it keeps, guarantees, common mistakes, when to use it.
- **Frame monitor** (`H`): rAF frame times, dropped frames, per-surface draw time and per-component commit rate.

## 3.0.0

A rebuild of the product around what the October 2026 audit found. See [docs/AUDIT.md](docs/AUDIT.md) for each finding and how it was resolved.

### Added

- **Explore page** with 14 prepared experiments, an algorithm reference table, recent and saved experiments.
- **Interactive tour** that waits for you to run, inspect, edit and compare.
- **Data-structure inspectors** for every algorithm: queue, stack, min-heap with stale entries, open set with g, h and f, call stack, merge buffer, pointers, candidate heap, sorted edges and union-find fragments, k-means clusters, gradient and velocity.
- **Explanations** for every operation, built from real values, plus a preview of the next one.
- **Comparison** of two algorithms, or two settings of one, on a shared input, with a metric table, written verdict and a grid overlay mode.
- **New algorithms:** greedy best-first, merge sort, heapsort, linear, binary and jump search, Prim, Kruskal.
- **New controls:** heuristics and heuristic weight for A\*, pivot rules for quicksort, diagonal moves, grid sizes, six terrain generators, mud cost, draggable start and target, keyboard and touch drawing, custom arrays, array orders, search target placement, draggable graph nodes, k-means datasets and initialisations (including hand-placed), learning rate, momentum, starting parameters and step count.
- **Playback:** logical steps or single operations, checkpoints, an activity minimap on the timeline, adaptive speed.
- **Sharing:** links that reproduce the exact experiment, optionally at a step; JSON export and a working import; a saved-experiment library; automatic resume.
- **Command palette** with grouped, keyboard-navigable results over every action, algorithm and experiment.
- **Settings:** theme (Paper, Scope, system), motion (system, reduced, full), single-key shortcuts on or off.
- **Chrome extension** (Manifest V3) built from the same source.
- **New visual identity:** custom mark and icons, self-hosted IBM Plex, colour tokens that support opacity, two themes.

### Fixed

- Gradient descent drew every point outside the canvas.
- k-means converged in two frames with nothing to watch; k-means++ picked the wrong point.
- Pseudocode highlighted the wrong line for Dijkstra, A\*, selection sort and quicksort, and never moved for the learning algorithms.
- Opacity utilities on colour tokens produced no CSS.
- Hidden inspector tabs kept taking up space.
- The phone layout hid the target and tools; there was no touch drawing and no inspector below 1024px.
- Global shortcuts hijacked sliders, buttons and the grid; sliders had no accessible names; the grid was 680 tab stops.
- The status line said "Press Run" during playback.
- The palette could not find "bfs"; export omitted the grid and could not be imported.
- Dijkstra and A\* were labelled O(E log V) but scanned a set; they now use a binary heap.
- The README claimed WCAG AA and cited a branch that did not exist.

### Removed

- `lucide-react`, `sonner` and the Google Fonts request.
- Radial gradient background, glassy overlays, glow shadows and the violet palette.
- The trailing "sorted" padding events and the duplicated per-cell events that made a default BFS take six minutes.

## 2.0.0

Rewrite as a React, TypeScript and Vite application on a framework-free core.
