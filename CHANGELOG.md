# Changelog

All notable changes to this project are documented here.

## [1.1.0] — 2026-06-25

### Added
- **Learning family** — the project now visualizes machine-learning algorithms,
  making the repository name accurate:
  - **k-means clustering** — points are assigned to the nearest of K moving
    centroids; watch centroids slide to cluster means and inertia fall each
    iteration.
  - **Gradient descent (linear regression)** — a line is fit to scattered data
    by following the MSE gradient; watch slope `w`, bias `b`, and loss update
    per step.
  - Rendered on a `<canvas>` scatter plot that reuses the existing timeline,
    scrubber, inspector, and pseudocode panels.
- `src/learning.js` — pure, DOM-free algorithm cores shared by the app and the
  test runner.
- `test/run.js` — framework-free correctness checks (k-means separation and
  non-increasing inertia; gradient descent line recovery and monotonic loss).
- `LICENSE` (MIT), `package.json`, and this changelog.
- Command-palette command **Switch to learning**.

### Fixed
- **Quick sort metrics were fabricated.** Every quick-sort event reported the
  event index as its comparison/swap count instead of the real totals. Quick
  sort now shares the same counting path as the other sorts, so the inspector
  shows true comparison and swap counts.
- **Command palette was mouse-only.** Added `↑`/`↓` to move the selection and
  `Enter` to run the highlighted command.
- **Dead deep links.** `popup.html` linked to `index.html#run` and
  `#library`, but the app ignored the URL hash. The app now reads the hash on
  load and on change (`#run`, `#analyze`, `#library`, `#pathfinding`,
  `#sorting`, `#learning`).

### Changed
- Consistent product name (**Algorithm Cockpit**) across the manifest, page
  title, and README.
- README rewritten to cover all three algorithm families, project structure,
  and how to run the tests.
