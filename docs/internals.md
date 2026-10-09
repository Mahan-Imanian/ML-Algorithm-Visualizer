# Algoscope internals

Reference material moved out of the README: source layout, rendering model, performance and accessibility notes, the full keyboard map and how to add an algorithm. For the audit history and how each number was measured, see [AUDIT.md](AUDIT.md).

## Source layout

```text
src/core/        Framework-free engine: no React, no DOM
  grid/ sort/ search/ graph/ learn/   algorithms emit typed events; machines fold events into state
  trace.ts       TraceBuilder: events, step groups, milestones
  player.ts      keyframe cache: any step of a 40k-event trace in well under a millisecond
  info.ts        names, complexity, depth notes and pseudocode with named line anchors
  scenarios.ts   the 14 prepared experiments
  experiment.ts  experiment → runs, metrics, comparison verdicts
  share.ts       versioned, validated link and file format
src/store/       Zustand: lab (experiment, runs, cursors, playback), library, settings, UI
src/ui/          React: Explore, Lab (Setup / Stage / Inspector / Transport), Present, palette, dialogs
  clock.ts       the two clocks: live cursor for canvases, 20 Hz presented cursor for panels
  perf.ts        frame, draw and commit counters behind the frame monitor (H)
extension/       Manifest V3 build of the same app
```

## Rendering model

**Simulation and presentation are separate.** The recorded trace is the simulation. Canvases subscribe to the live cursor and draw imperatively in `requestAnimationFrame`. Motion is time-based (`1 − e^(−dt/τ)`), so it looks the same at 60, 120 or 144 Hz. Text panels follow a presented cursor that is throttled to 20 Hz while playing and immediate when paused. React never renders per frame.

**The layout is a contract.** The stage sits in fixed grid tracks (`minmax(0,1fr) 104px 28px 88px`) with `contain: strict`. Captions are fixed-height and clamped, headers are single-line with tabular, fixed-width readouts, and scrolling panes reserve their scrollbar gutter. No amount or length of text can resize the visualization.

**Pseudocode can't drift.** Every event names the pseudocode line it belongs to. A test runs every algorithm and scenario and checks that each line exists and describes the event.

## Performance

Budgets, and how the production build measured against them on 2026-10-09 (Chrome 142 headless on a 60 Hz desktop, Node 24 for trace generation):

| Budget                                                                      | Measured                                                                                                     |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Recording a run (trace plus keyframes) for the largest input: under 100 ms  | Worst case 7.2 ms median, 11 ms max: Dijkstra on the 61×37 mud field with diagonals, 4,262 events            |
| Playback at 1× and 4×: p95 frame interval at most one 60 Hz frame (≤ 17 ms) | p95 16.8 ms, worst 17.3 ms, no frame over 25 ms and no long tasks across all 18 algorithms and 5 comparisons |
| Canvas draw per frame: average under 2.5 ms                                 | Average 0.1 to 2.3 ms, single draws up to 4.3 ms                                                             |

Other inputs at their maximum (64-value sorts, 128-value searches, 30-node graphs, 400 points with k = 8, 500 gradient steps) record in under 2 ms. Frame intervals come from a `requestAnimationFrame` loop in the page while it plays; draw costs come from the frame monitor (`H`). With 4× CPU throttling the two largest grid comparisons drop to 30–60 fps: the 20 Hz panel commits cost about 5 ms each unthrottled, and that work grows with the throttle.

- Text panels commit about 9–18 times per second during playback, under the 20 Hz cap, regardless of speed.
- JS heap is 48 MB on the largest comparison.
- Initial JS is 459 KB (150 KB gzip). The lab chunk loads separately (104 KB, 35 KB gzip). These two figures match `npm run build` output on 2026-10-09. There are no third-party requests.
- For 120 and 144 Hz, the per-frame budgets are 8.3 ms and 6.9 ms. The worst canvas draw above (4.3 ms) is inside both. This was not measured on a high-refresh display.
- Version 3.0.0 had a p95 of 233 ms on the same large comparison and resized the stage whenever the caption wrapped.

## Accessibility

- Lighthouse accessibility is 100 on Explore and the Lab, in both themes, on desktop and mobile (author's measurement on 3.1.0). Re-checked on 2026-10-09 with Lighthouse 12.8.2 against the production build, default (light) theme: accessibility and best practices 100 on Explore and the Lab, desktop and mobile; performance 100 on desktop, 87 to 89 on mobile, and cumulative layout shift 0.
- Every control is keyboard reachable with visible focus. The grid is an application region with arrow-key navigation, `Space` to apply a tool, and `S` / `T` to place the start and target.
- Live regions announce the current step when paused and stay quiet during playback.
- Motion respects the reduced-motion setting, with an override in Settings. Single-key shortcuts can be turned off.
- Text meets 4.5:1 contrast in both themes, including the orange actions.
- Not yet done: a session with a real screen reader (NVDA or VoiceOver).

## Interface

Press `P` for presentation mode. The visualization takes the screen, type gets larger, and `C`, `S`, `E` and `M` toggle the code, state, explanation and metrics. `Esc` leaves.

![Presentation mode at 1600×900: BFS in a maze with the live queue](screenshots/present.jpg)

| Command palette (`Ctrl K` or `/`)                                                             | Phone, 390 px                                                        |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| ![Command palette with BFS typed, breadth-first search ranked first](screenshots/palette.jpg) | ![A* and Dijkstra overlaid on a phone screen](screenshots/phone.jpg) |

Input editors:

- **Grid:** draw walls and mud with mouse, touch or keyboard; drag the start and target; generate mazes, rooms, scatter, mud fields or a heuristic trap; four grid sizes.
- **Graph:** move nodes (weights follow distance), connect or disconnect nodes, add and delete nodes. A disconnected graph is reported as a spanning forest.
- **Array:** five orders (random, nearly sorted, reversed, sorted, few unique) or your own values.
- **Learning:** datasets, k, initialisation, learning rate, momentum, start point, step budget.
- **Timeline:** an activity tape coloured by event type, milestones such as _target discovered_, your own bookmarks (`B`), six speeds, step or single-operation granularity.

## Keyboard

`Space` play/pause · `←` `→` step · `⇧←` `⇧→` one operation · `[` `]` milestones · `B` bookmark · `Home` `End` · `−` `=` speed · `G` step size · `N` new input · `M` maze · `C` compare · `1`–`5` grid tools · `P` present · `H` frame monitor · `Ctrl K` palette · `?` all shortcuts.

## Adding an algorithm

1. Emit typed events from `src/core/<family>/` through a `TraceBuilder`, with an `op` that names a pseudocode line.
2. Add its entry, pseudocode and depth notes in `src/core/info.ts`.
3. Run `npm test`: the pseudocode test fails if any event points at a line that doesn't exist.

Keep `npm run lint`, `npm run typecheck` and `npm test` green.
