# Changelog

## 2.0.0

Full rewrite as **Algoscope**: a React + TypeScript + Vite application built on a
framework-free algorithm core.

### Added
- Framework-free `core/` engine (pathfinding, sorting, k-means, gradient descent)
  with a replayable event-trace model, covered by unit tests.
- React 18 UI with Tailwind and shadcn/ui primitives, a Zustand trace store, a
  command palette, and JSON trace export.
- Vitest test suite (engine + UI smoke tests), ESLint flat config, and Prettier.
- CI workflow and GitHub Pages deployment via GitHub Actions.

### Changed
- Migrated from a single-file vanilla build to a typed, componentized architecture.
- Carried over the accessibility work (WCAG AA contrast, high-visibility focus ring).

The previous vanilla version is preserved on the `legacy-vanilla` branch.
