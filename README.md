# Algorithm Cockpit

A browser-native workbench for stepping through pathfinding and sorting algorithms one event at a time. Build a grid, draw walls and weighted terrain, pick an algorithm, and watch the frontier, visited cells, current node, and final path evolve—or scrub backwards through the timeline to compare any two moments in the run.

No install, no build step, no dependencies.

---

## Overview

Most algorithm visualizers play an animation and stop. Algorithm Cockpit records the entire run as a replayable event trace. Every state change—cell visited, node pushed to the frontier, array comparison, swap—is stored as a discrete event. You can pause mid-run, step forward or backward one event at a time, drag the timeline scrubber to any point, and inspect the live state panel or the highlighted pseudocode alongside it.

The tool has two algorithm families: a grid-based pathfinder and an array-based sorter. Both share the same transport controls, timeline, and inspector. Runs can be saved locally, exported as JSON, and reimported later.

The repository also ships a complete Manifest V3 Chrome extension scaffold—popup, side panel, and options page—so the workbench can be installed as a browser extension that replaces the new tab page.

---

## Features

**Pathfinding**
- Paint walls and weighted terrain directly on the grid with three tools: Wall (`W`), Weight (`G`), and Erase (`E`)
- Run BFS, DFS, Dijkstra, or A* against any grid configuration
- Live color coding of frontier nodes, visited cells, the current node under examination, and the final reconstructed path
- Algorithm metadata (time complexity, weighted/unweighted classification) shown in the header

**Sorting**
- Generate random arrays and run insertion sort, selection sort, bubble sort, or quicksort
- Each comparison and swap is recorded as a separate trace event
- The same timeline and pseudocode inspector works identically for sorting runs

**Trace & replay**
- Full event log recorded on every run
- Step forward and backward through events with arrow keys or transport buttons
- Timeline scrubber with step counter and markers
- Adjustable playback speed (8 levels)
- Inspector panel with three tabs: live state, raw trace log, and highlighted pseudocode

**Scenarios & persistence**
- Name and save runs locally (no server required)
- Export any run to JSON and import it back later
- Library view for managing saved scenarios
- Autosave, reduced-motion, and trace-log preferences in the options page

**Command palette**
- `⌘K` opens a command palette for running algorithms, loading scenarios, and triggering exports without touching the mouse

**Chrome extension**
- `manifest.json` targets Manifest V3 with `storage` and `sidePanel` permissions
- Popup provides quick links to open the workbench, resume the last run, or jump to the library
- Side panel shows a compact trace inspector with last-run status and keyboard shortcuts
- Options page exposes playback and storage preferences

---

## Tech stack

| Layer | Detail |
|---|---|
| Runtime | Vanilla JavaScript (ES2020+), no framework |
| Styling | Plain CSS with custom properties, no preprocessor |
| Storage | `localStorage` for local saves; JSON file for export/import |
| Extension | Chrome Manifest V3 |
| Build | None — open `index.html` directly |

The entire application logic lives in `src/app.js` (~55% of the codebase by line count). There are no npm packages, no bundler, and no compilation step.

---

## Getting started

### As a standalone web app

Clone the repository and open `index.html` in any modern browser:

```bash
git clone https://github.com/Mahan-Imanian/ML-Algorithm-Visualizer.git
cd ML-Algorithm-Visualizer
open index.html   # macOS
# or: xdg-open index.html on Linux
# or: just double-click the file
```

No server required. Everything runs locally.

### As a Chrome extension

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (toggle in the top right)
3. Click **Load unpacked** and select the repository root
4. The extension installs; opening a new tab will load the workbench, or click the extension icon for the popup

---

## Usage

### Building a grid

Switch to **Build** mode (default on load). Click or drag on the grid to place walls. Hold `W` for walls, `G` for weighted terrain (higher traversal cost for Dijkstra and A*), `E` to erase. Start and end nodes can be repositioned by dragging.

### Running an algorithm

Switch to **Run** mode, or stay in Build mode and press `Space`. Select an algorithm from the dropdown in the workspace header. The run begins immediately and plays through at the current speed setting.

| Control | Action |
|---|---|
| `Space` | Run / pause |
| `→` | Step forward one event |
| `←` | Step back one event |
| `⌘K` | Open command palette |
| `W` | Wall tool |
| `G` | Weight tool |
| `E` | Erase tool |

### Inspecting a run

The right panel has three tabs:

- **State** — live snapshot of the current event: node coordinates, frontier size, visited count, path length
- **Trace** — full event log with timestamps
- **Pseudocode** — the algorithm's pseudocode with the current line highlighted

### Sorting

Click the **Sorting** tab in the workspace header. Generate a new array with the toolbar, pick a sort algorithm, and run it. The same controls apply. Each bar is colored by its current role (comparing, swapped, sorted, unsorted).

### Saving and sharing

Click the export button (⇧) to download the current run as JSON. Click the import button (⇩) and select a `.json` file to load a previous run. Saved scenarios appear in the **Library** view.

---

## Project structure

```
ML-Algorithm-Visualizer/
├── index.html          # Main application shell
├── src/
│   ├── app.js          # All application logic — algorithms, trace engine, UI
│   └── styles.css      # Design tokens and component styles
├── popup.html          # Chrome extension popup
├── sidepanel.html      # Chrome extension side panel
├── options.html        # Extension options page (playback + storage settings)
├── manifest.json       # Chrome Manifest V3 config
└── README.md
```

---

## Roadmap / future improvements

- Maze generation presets (recursive division, randomized Prim's, etc.)
- Bidirectional search variants (bidirectional BFS, bidirectional Dijkstra)
- Configurable grid dimensions at runtime
- Merge sort and heap sort traces
- Shareable run URLs (encode grid + trace as a URL hash or short link)
- GitHub Pages deployment so the app is accessible without cloning
- Accessibility pass: full keyboard navigation for grid editing, ARIA live regions for trace events

---

## Contributing

Issues and pull requests are welcome.

For anything beyond a typo fix, open an issue first to describe the change and check it aligns with the project direction. The core design constraint is that everything stays zero-dependency and runs by opening a single HTML file—changes that require a build step or npm packages are unlikely to be accepted.

When submitting a PR:
- Keep changes focused; avoid unrelated reformatting
- Test in at least one Chromium-based browser (Chrome, Edge, Brave) and Firefox
- If adding a new algorithm, include the pseudocode entries it needs for the inspector panel

---

## License

MIT. See [`LICENSE`](LICENSE) for the full text.
