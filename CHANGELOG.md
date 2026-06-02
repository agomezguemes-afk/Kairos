# Changelog

All notable changes to Kairos will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **AI client migration to proxy (Sprint 7 · Commit 2)**:
  - `src/lib/ai/client.ts` now routes through the Supabase Edge
    Function `ai-chat` whenever an authenticated session is present.
    The Groq endpoint stays wired as a fallback for `SKIP_AUTH=true`
    local development only.
  - New `QuotaExceededError` surfacing the server 429 payload (tier,
    cap, used, resetsAt, upgradeAvailable). Streaming path catches the
    429 mid-XHR and rejects with the typed error.
  - `isGroqAvailable()` is now a thin alias of `isAIAvailable()`,
    which returns true if either a Supabase session OR a Groq env key
    is available. Cached access token is kept in sync via
    `supabase.auth.onAuthStateChange`.
  - `globalChat` and `blockChat` re-throw `QuotaExceededError`
    untouched so the chat UI can present the paywall without losing
    the payload. Generic Groq failures become `AIUnavailableError`.
  - `insights.ts` falls back to the deterministic plateau suggestion
    when quota is exhausted, so background insight generation never
    spends the user's daily budget unprompted.
  - `.env.example` updated to mark `EXPO_PUBLIC_GROQ_API_KEY` as
    DEV-ONLY; production builds should ship with it empty.

- **AI proxy backend (Sprint 7 · Commit 1) — Edge Function with per-user quota**:
  - New `supabase/` folder with config, migrations, and Edge Functions
    checked into git.
  - Migration `20260602125950_ai_quota.sql`:
    - `subscription_tier` enum (`free` / `pro`) added to `profiles`,
      defaulting to `free`.
    - `ai_quota` ledger table (append-only) recording every AI call
      with tokens, tier, provider, and model.
    - `ai_quota_count_24h(uuid)` security-definer RPC for fast rolling
      window quota checks.
    - RLS: users can read their own quota rows; only `service_role`
      writes.
    - `pg_cron` job (`kairos-ai-quota-prune`) deletes ledger rows
      older than 7 days at 03:17 UTC daily.
  - Edge Function `ai-chat` (Deno): authenticates the caller, checks
    their 24h quota against their tier policy, proxies the chat
    completion upstream (Groq for free, Anthropic placeholder for
    pro), and records the call ledger row only on success — failed
    upstream calls do not burn quota. Returns HTTP 429 with
    `{ error: 'quota_exceeded', tier, dailyCap, usedToday, resetsAt,
    upgradeAvailable }` so the client can present the Pro paywall.
  - Tier policy lives in code (`supabase/functions/_shared/tiers.ts`)
    so caps/models are tunable without a migration.
  - `supabase/README.md` documents the deploy commands and secrets
    matrix (`GROQ_API_KEY`, `ANTHROPIC_API_KEY`).
  - `tsconfig.json` and `eslint.config.mjs` updated to exclude
    `supabase/functions/**` so the Deno code doesn't clash with the
    RN typecheck/lint pipeline.

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
