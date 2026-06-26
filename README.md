<div align="center">

# Algorithm Cockpit

**A browser lab for watching search, sorting, and learning algorithms run one event at a time.**

Draw a grid, pick an algorithm, and replay the whole run forward or backward with the frontier, visited cells, and final path laid out in front of you. No server, no build step, no dependencies.

<br>

[![Live demo](https://img.shields.io/badge/Live%20Demo-Open%20App-2563eb?style=for-the-badge&logo=googlechrome&logoColor=white&labelColor=0d1117)](https://mahan-imanian.github.io/ML-Algorithm-Visualizer/)
[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge&labelColor=0d1117)](LICENSE)

![Version](https://img.shields.io/badge/version-1.1.0-7c3aed?style=flat-square&labelColor=0d1117)
![Vanilla JS](https://img.shields.io/badge/Vanilla%20JS-zero%20deps-facc15?style=flat-square&labelColor=0d1117)
![Chrome MV3](https://img.shields.io/badge/Chrome-MV3-0ea5e9?style=flat-square&logo=googlechrome&logoColor=white&labelColor=0d1117)
![Accessibility](https://img.shields.io/badge/WCAG-AA-15803d?style=flat-square&labelColor=0d1117)
![PRs welcome](https://img.shields.io/badge/PRs-welcome-f97316?style=flat-square&labelColor=0d1117)

<br>

[**Live demo**](https://mahan-imanian.github.io/ML-Algorithm-Visualizer/) · [Features](#features) · [Quick start](#quick-start) · [Usage](#usage) · [How it works](#how-it-works) · [Roadmap](#roadmap)

</div>

<!-- Drop a screenshot or GIF of a run here for the best first impression:
<p align="center"><img src="docs/demo.gif" alt="Algorithm Cockpit replaying an A* run" width="900"></p> -->

---

## Contents

- [What it is](#what-it-is)
- [Features](#features)
- [Quick start](#quick-start)
- [Usage](#usage)
- [How it works](#how-it-works)
- [Project structure](#project-structure)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## What it is

The idea behind Algorithm Cockpit is that a run is data, not an animation. Every state change (a cell visited, a node pushed to the frontier, a comparison, a swap, a centroid moving) is recorded as one discrete event. Once a run finishes you can step through it event by event, drag the scrubber to any moment, line up two points in the same run, and read the live state panel and the highlighted pseudocode right beside the grid.

Three algorithm families share the same transport, timeline, and inspector:

- **Pathfinding** on a grid you draw yourself
- **Sorting** on arrays you generate
- **Learning**, a small machine-learning corner with k-means clustering and gradient descent

Runs save to local storage, export to JSON, and import back later. The whole thing is a single static page, so opening `index.html` is the entire setup. The same code also loads as a Chrome MV3 extension that takes over the new tab page.

## Features

### Pathfinding
- Paint walls and weighted terrain straight onto the grid: `W` for walls, `G` for weighted cells, `E` to erase
- Run **BFS**, **DFS**, **Dijkstra**, or **A\***, and drag the start and target nodes anywhere
- Frontier, visited cells, the current node, and the reconstructed path are each color coded as the trace plays
- Time complexity and weighted / unweighted classification show in the header

### Sorting
- Generate random arrays and run **insertion**, **selection**, **bubble**, or **quicksort**
- Every comparison and swap is its own trace event, with bars colored by role (comparing, swapping, pivot, sorted)
- The same timeline and pseudocode inspector drive sorting runs unchanged

### Learning
- **k-means** clustering and **gradient descent** plotted live on a canvas
- Watch centroids settle or a regression line converge, step by step, with the same replay controls

### Trace and replay
- Full event log captured on every run
- Step forward and back with the arrow keys or the transport buttons
- Timeline scrubber with a step counter and event markers
- Eight playback speeds
- Inspector with three tabs: live state, raw trace log, and highlighted pseudocode

### Workflow
- **Command palette** (`⌘K` / `Ctrl K`) to run algorithms, load scenarios, and export without leaving the keyboard
- Name and save runs locally, export any run to JSON, and reimport it later
- A **Library** view for managing saved scenarios
- Autosave, reduced-motion, and trace-log preferences on the options page

### Accessibility
- All text meets WCAG AA contrast, verified against the sRGB luminance formula
- A solid, high-visibility keyboard focus ring on every control
- `prefers-reduced-motion` is honored throughout, and an ARIA live region announces run status

## Quick start

### Run it as a web app

```bash
git clone https://github.com/Mahan-Imanian/ML-Algorithm-Visualizer.git
cd ML-Algorithm-Visualizer
```

Then open `index.html` in any modern browser. Double-click it, or:

```bash
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows
```

There is nothing to install and no server to run. You can also use the [hosted version](https://mahan-imanian.github.io/ML-Algorithm-Visualizer/).

### Install it as a Chrome extension

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked** and choose the repository root
4. Open a new tab to load the workbench, or click the toolbar icon for the popup

## Usage

### Build a grid

Build mode is on by default. Click or drag to place walls. Hold `W` for walls, `G` for weighted cells (a higher traversal cost that Dijkstra and A\* respect), and `E` to erase. Drag the start or target node to reposition it.

### Run an algorithm

Switch to Run mode or press `Space` from Build mode. Pick an algorithm from the workspace header. The run records and plays at the current speed.

| Key | Action |
|-----|--------|
| `Space` | Run / pause |
| `→` | Step forward one event |
| `←` | Step back one event |
| `⌘K` / `Ctrl K` | Command palette |
| `W` | Wall tool |
| `G` | Weight tool |
| `E` | Erase tool |

### Inspect a run

The right panel has three tabs:

- **State**: the current event up close, including node coordinates, frontier size, visited count, and path length
- **Trace**: the full event log
- **Pseudocode**: the algorithm's pseudocode with the active line highlighted

### Save and share

Export the current run to JSON with the export button, and import a `.json` run with the import button. Saved scenarios live in the **Library** view.

## How it works

A run never animates directly off the algorithm. Instead the algorithm emits a flat list of events, and the UI is a pure function of a cursor into that list.

```
algorithm  ──▶  event[]  ──▶  cursor (step / scrub)  ──▶  grid · state panel · pseudocode
```

Because the trace is just an array, stepping forward, stepping back, scrubbing, and exporting are all the same operation: move or serialize the cursor. Backward replay needs no inverse logic, and an exported JSON file is a complete, replayable recording of a session.

| File | Responsibility |
|------|----------------|
| `index.html` | Application shell and layout |
| `src/app.js` | Trace engine, pathfinding and sorting, and all UI wiring |
| `src/learning.js` | k-means and gradient descent, plotted to a canvas |
| `test/run.js` | Assertions for the learning algorithms (`npm test`) |
| `manifest.json`, `popup.html`, `sidepanel.html`, `options.html` | Chrome MV3 surfaces |

Everything is vanilla JavaScript (ES2020+) and plain CSS with custom-property design tokens. No framework, no bundler, no compile step.

```bash
npm test   # runs the learning-algorithm checks in test/run.js
```

## Project structure

```text
ML-Algorithm-Visualizer/
├── index.html          # Application shell
├── src/
│   ├── app.js          # Trace engine, pathfinding, sorting, UI
│   ├── learning.js     # k-means and gradient descent
│   └── styles.css      # Design tokens and component styles
├── popup.html          # Extension popup
├── sidepanel.html      # Extension side panel
├── options.html        # Extension options (playback + storage)
├── manifest.json       # Chrome Manifest V3 config
├── test/run.js         # Test suite
└── CHANGELOG.md
```

## Roadmap

- Maze generators (recursive division, randomized Prim's)
- Bidirectional search variants (BFS and Dijkstra)
- Runtime-configurable grid dimensions
- Merge sort and heap sort traces
- Shareable run URLs that encode the grid and trace in the hash
- Full keyboard navigation for grid editing

## Contributing

Issues and pull requests are welcome.

For anything past a typo, open an issue first so we can check it fits the project's direction. The one hard constraint is that the app stays zero-dependency and runs by opening a single HTML file. Changes that introduce a build step or npm packages are unlikely to land.

When you open a PR:

- Keep it focused and skip unrelated reformatting
- Test in at least one Chromium browser (Chrome, Edge, Brave) and in Firefox
- New algorithms should ship with the pseudocode entries the inspector needs

## License

MIT. See [`LICENSE`](LICENSE) for the full text.
