# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Start Expo dev server
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
npm run web        # Run on web
```

No test or lint scripts are configured yet.

> **Important:** `react-native-reanimated/plugin` must remain the **last** plugin in `babel.config.js`.

## Architecture

**KAIROS** — a React Native/Expo fitness tracking app ("The Training OS").

### Navigation tree

```
AppNavigator (native stack)
├── WelcomeScreen
├── SetupScreen          ← 4-step onboarding form
└── Dashboard (bottom tabs)
    ├── HomeTab
    ├── BlockLibraryScreen
    ├── ProgressTab
    └── ProfileTab
```

### State management

A single **`TrainingContext`** (`src/context/TrainingContext.tsx`) holds all global state: day entries, streak, weekly stats, and sessions. Consume it with `useTraining()`. Local block/exercise state lives in `BlockLibraryScreen` via `useState`.

Persistence (AsyncStorage) and analytics are **not yet implemented** — both have TODO comments in context.

### Styling

Two styling mechanisms coexist:
- **Design tokens** at `src/theme/tokens.ts` — colors, typography, spacing, radii, shadows, animation presets. Dark mode by default (background `#0A0A0F`, accent gold `#C9A96E`).
- **NativeWind v4** (`nativewind`) is configured but minimally used.

Prefer design tokens (`src/theme/tokens.ts`) over hardcoded values for new UI work.

### Animation

- `react-native-reanimated` (entering/exiting animations, e.g. `FadeInDown`)
- `react-native-reanimated`'s `Animated` API for spring/scale/opacity transitions

Use animation presets from `tokens.ts` (`tokens.animation.spring.*`) for consistency.

### Types

```
src/types/
├── core.ts      ← Discipline, ExerciseCard, WorkoutBlock, Sets
├── training.ts  ← TrainingSession, MuscleGroup, TrainingType
├── progress.ts  ← DayEntry, StreakData, WeeklyLog
├── legacy.ts    ← Deprecated — avoid
└── index.ts     ← Barrel re-exports from core.ts
```

TypeScript strict mode is enabled.

### Performance conventions

- Wrap pure display components in `React.memo()`
- Use `useMemo` for derived/computed values
- Use `useCallback` for event handlers passed as props

Extended Guidelines (Kairos Product Vision)
The following sections describe the long‑term direction. Use them as inspiration, not as a straightjacket. You are encouraged to propose better approaches, new libraries, or entirely different architectural patterns that still honour the core philosophy.

1. Philosophy & User Freedom
Kairos is not a typical fitness app. It is a personal creation space where each user builds their own training ecosystem. No rigid categories, no forced disciplines.

Core principles (non‑negotiable):

- User decides what to track – Every exercise can have custom metrics (weight, reps, distance, pace, RPE, etc.).
- Editing feels fluid – Prefer inline editing over modals.
- Gestures feel natural – Swipe to delete, drag & drop to reorder.
- Feedback is tangible – Animations, haptics, visual cues.
- Premium minimalism – Clean hierarchy, generous spacing, accent gold (#C9A96E).
- AI is helpful, not intrusive – It analyzes, recommends, generates plans; it never interrupts.

What you can change / improve:
You may propose a different visual identity, new interaction paradigms (e.g., haptic‑first, voice‑assisted), or alternative ways to achieve user freedom (e.g., allowing users to create custom UI layouts). As long as the user feels empowered, anything is on the table.

2. Dynamic Data Model (the heart of Kairos)
The current dynamic model uses FieldDefinition, ExerciseCardDynamic, SetDynamic, WorkoutBlock. This is a solid foundation, but you may:

- Replace it with a different NoSQL‑like structure (e.g., using jsonb fields from the start).
- Integrate a local database like realm or watermelonDB for better performance.
- Add versioning, conflict resolution, or offline sync capabilities.

The only requirement: The user must be able to define custom metrics per exercise, and the AI must be able to analyse any numeric field over time.

3. Component Library (Premium UI)
We have started building components like ExerciseCardDynamic, WorkoutBlockDynamic, IconPicker, ColorPicker, NumericSelector. However, you are free to:

- Replace them with more polished libraries (e.g., dripsy, gluestack-ui, or fully custom animated components).
- Introduce new interaction patterns (e.g., long‑press context menus, bottom sheets for quick editing).
- Implement drag & drop using react-native-draggable-flatlist or react-native-gesture-handler + Reanimated.
- Add skeletal loading, shimmer effects, or micro‑interactions.

Goal: The UI should feel top‑tier – something that could be featured by Apple. If you know a better way to achieve that, go for it.

4. State Management & Persistence
Current plan: AsyncStorage + later Zustand + Supabase. You may:

- Use react-native-mmkv for faster offline storage.
- Adopt react-query (TanStack Query) for remote sync.
- Implement expo-sqlite for complex queries.
- Build a custom offline‑first engine.

Only constraint: The user should never lose data, and the app must work offline from day one.

5. AI & Gamification
- Two AI roles (conceptual)
- Ecosystem generator – User describes a goal (e.g., “10k training plan”), AI returns draft blocks.
- Performance advisor – AI analyses recorded sets and suggests improvements.

You are free to:

Use any AI service (OpenAI, Gemini, Anthropic, local LLM via Ollama, etc.).

Build the AI as a set of deterministic heuristics first (mock), then upgrade to a real model.

Add voice input, real‑time coaching, or computer vision for form analysis.

Create a completely different gamification system (e.g., narrative‑driven, social‑first, or based on real‑world rewards).

Only requirement: The AI must be able to evolve with the user's data. Gamification must feel earned, not arbitrary.

6. Coding Conventions (suggested)
TypeScript strict – you may loosen only if a third‑party library forces you.

React.memo, useMemo, useCallback – use them when they actually help performance.

File naming: PascalCase for components, camelCase for utilities – flexible if you have a better convention.

Import order: not enforced; aim for readability.

Comments: Explain why, not what – but you may adopt a different doc style.

7. Useful Commands (recap)
bash
# Clean everything
rm -rf node_modules .expo package-lock.json
npx expo start --clear --reset-cache

# Verbose logs
npx expo start --verbose 2>&1 | tee expo.log

# Rebuild native (if compilation fails)
npx expo prebuild --clean
npx expo run:ios

# Fix dependency conflicts
npm install --legacy-peer-deps
8. Known Issues & Solutions (for reference)
Error	Common Cause	Possible Solution
[runtime not ready]	Reanimated plugin misconfigured	Ensure plugin is last in babel.config.js; clear caches.
use-latest-callback warning	Corrupted dependency	Run npm dedupe; reinstall react-native-reanimated.
App entry not found	Top‑level module error	Test with minimal App.tsx; check for circular imports.
Hermes conflict	Reanimated requires JSC	Force "jsEngine": "jsc" in app.json temporarily.
If you encounter other issues, research and propose a fix. You may also suggest upgrading Expo or changing the toolchain.

9. Roadmap (suggested, not mandatory)
This is a possible sequence of sprints. You can reorder, skip, or add new phases.

Sprint 0 (dynamic types) – Ensure data model is flexible.

Sprint 1 (core UI components) – Build or integrate high‑quality components.

Sprint 2 (offline persistence) – Implement storage with sync capabilities.

Sprint 3 (AI mock & real integration) – Start with mock, then plug in an LLM.

Sprint 4 (gamification) – Badges, trees, cards.

Sprint 5 (social features) – Friends, challenges.

10. What you are ENCOURAGED to do
✅ Experiment with new libraries, even if they replace current ones.

✅ Propose architectural changes (e.g., move to Expo Router, use Tamagui, adopt Zustand + persist).

✅ Implement external services (analytics, crash reporting, push notifications).

✅ Redesign the UI/UX from scratch if it leads to a more professional product.

✅ Add features not mentioned here (e.g., Apple Health / Google Fit integration, export to PDF, dark/light mode toggle).

✅ Challenge any part of this document – if a principle or constraint does not serve the user, suggest an alternative.

11. What you should AVOID (unless you have a good reason)
❌ Hardcoding colors or metrics without a design system – but you can replace the design system.

❌ Creating modals for trivial edits – but you can invent a different paradigm (e.g., swipe actions).

❌ Assuming the user only does strength training – but you can support all activities.

❌ Blocking the UI with synchronous heavy operations – but you can use workers or native modules.

When you deviate, document your reasoning and the expected benefit.

This document is a living guide. Your creativity is the only limit. Build something remarkable. 🚀