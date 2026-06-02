# Changelog

All notable changes to Kairos will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Canvas layout (Sprint 6) — widget-style block arrangement**:
  - New home-canvas surface on the Bloques tab. Blocks now live on a
    4-column grid as iOS-style widgets (`small` 2×2, `medium` 4×2,
    `large` 4×4).
  - Long-press a block to enter **edit mode**: all widgets jiggle, the
    corner badge appears, and the canvas scroll is disabled so drag
    gestures don't fight the ScrollView. Tap on empty canvas to exit.
  - **Drag to reposition**: PanGesture activates after a 120ms hold;
    snap-to-grid on release with collision-aware re-packing so two
    widgets never overlap.
  - **Resize**: corner badge cycles `S → M → L → S`. Reflow is animated
    via `springs.gentle`.
  - **Toggle** in the header switches between "Lienzo" (canvas) and
    "Cuadrícula" (the previous FlatList grid) so the legacy view
    remains available.
  - Pure layout math (`canvasLayout.ts`) is covered by 21 vitest cases
    — packing, collision detection, pixel ↔ cell round-trip, and edge
    cases (out-of-bounds repack, overflow clamp).
  - `WorkoutBlock.canvasPosition` added to the model. Store gains
    `setBlockCanvasPosition` and `setBlockSize` actions, persisted via
    Zustand v3 migration (existing blocks default to `null` and get
    auto-packed by the renderer on first paint).

- **Environments — three build variants (Fase 2)**:
  - Dynamic `app.config.ts` resolves bundle ID, name, and scheme from
    `APP_ENV` (`development` / `staging` / `production`).
  - Three iOS variants coexist on the same device:
    `com.alvaro.kairos.dev`, `com.alvaro.kairos.staging`,
    `com.alvaro.kairos`.
  - Supabase URL pulled from `EXPO_PUBLIC_SUPABASE_URL` so dev/staging
    can share a DEV project while production points at its own.
  - `scripts/use-env.mjs` symlinks `.env` → `.env.<env>`; npm scripts
    `env:dev`, `env:staging`, `env:prod`, `start:staging`, `start:prod`.
  - `eas.json` profiles (development/preview/production) for when EAS
    Build is adopted.
  - `docs/ENVIRONMENTS.md` documents the matrix, setup, gotchas.

- **CI/CD foundation (Fase 1)**:
  - Vitest as the formal test runner.
  - ESLint flat config (`eslint-config-expo` + prettier compatibility).
  - Prettier as the single source of formatting truth.
  - `husky` pre-commit hook running `lint-staged` over staged files.
  - GitHub Actions workflow `.github/workflows/ci.yml` running
    typecheck, lint, test, and format check on every PR + push to main.

### Changed

- Project-wide prettier baseline applied to 195 files (cosmetic only).
- Fixed 6 real conditional-hook bugs found by `react-hooks/rules-of-hooks`:
  hooks living after early returns in `BlockEditorScreen` and `AIChatScreen`.

## [0.1.0] — 2026-05-27

First clean baseline after consolidating six months of work onto `main`.

### Added

- **Spine + Bento editor**: vertical spine with station nodes (six states),
  Compound + Accessory + Note + InlineDashboard + Superset + SectionHeader
  tile variants, drag-reorder, add-station inline menu.
- **History correlation**: stable `libraryId` on `ExerciseCard` so
  progression carries across blocks. Indexed lookup map shared by all
  tiles in a render (O(1) per-exercise reads).
- **Per-exercise dashboards**: lookback windows (session / 4w / 12w /
  all), five new metrics (max weight, volume, 1RM, frequency, last top),
  new `sparkline` viz.
- **Sparkline progression** in tile headers, **ghost set values** drawn
  from last completed session, **temporal context** label ("Última
  sesión · hace 3 días").
- **Editorial post-session summaries**: `CompletionCelebration` and
  `WorkoutSummary` both surface auto-detected PRs (weight / 1RM /
  volume) via `detectPr`, comparative deltas vs prior session, and
  contextual closing lines.
- **Shell polish**:
  - Premium loading state (`AnimatedKairosLogo` breathing) and adaptive
    `<StatusBar style="dark" />` baseline.
  - `KairosTabBar` snap color + scale-pop (dropped the dual-icon
    cross-fade).
  - `BlockEditorScreen` sticky header with blur backdrop + discipline
    color strip + labeled back button.
  - `ActiveWorkout` enters as `fullScreenModal` with cinematic 380ms
    slide-from-bottom.
  - `HomeHeroStats` editorial-serif hero numerals above the planner,
    tiered streak pill (start / steady / veteran 30+).
- **Push notifications** scheduler (pure logic + idempotent adapter
  stub) and TestFlight readiness docs.

### Removed

- 6 dead screens (BlockLibraryScreen, HomeScreen, ProgressScreen,
  SessionScreen, two WorkoutTab duplicates).
- 9 legacy components (BlockDetailModal, WorkoutBlock, ExerciseCard,
  BlockAppIcon, TrainingCard, DurationSlider, Slider/, CustomTabBar,
  GradientText, KairosLogotype, SignInWithAppleButton, StepperSlider).
- `src/types/legacy.ts` (zero references).
- v2 token aliases (`gold_v2`, `surface_v2`, `text_v2`, …) — single
  token surface.
- Slash-command zombi flow inside `BlockEditorScreen` (~250 LOC).
- `backup-all-work` branch.

Net: **−5910 LOC** of obsolete code; 296 dev asserts green; tsc strict
clean across the cleaned codebase.

### Architecture

- `src/lib/history/` — pure selectors for exercise history correlation.
- `src/lib/stats/weekStats.ts` — rolling 7-day windows for HomeHeroStats.
- `src/lib/notifications/` — pure scheduler + idempotent adapter.
- `src/features/blocks/components/tiles/` — Bento tile library.

## Pre-0.1.0

Six months of pre-baseline work lived on the `feat/canvas` branch.
History preserved via `--no-ff` merge into `main`. See the commit log
for granular detail.
