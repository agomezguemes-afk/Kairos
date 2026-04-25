# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Builder Methodology (inspired by gstack)

### Boil the Lake
With AI-assisted coding, implementation completeness has minimal marginal cost. Choose the thorough version when the difference is only minutes of additional work. Complete lakes (full test coverage, edge cases, error handling); flag oceans (system rewrites, platform migrations) as out of scope.

- Never select a shorter implementation that covers only 90% of requirements.
- Never defer tests or error handling to a subsequent PR.
- If adding 70 more lines makes the solution comprehensive, add them.

### Search Before Building
Before designing from scratch, check: (1) Does the runtime or framework already provide this? (2) Is there a battle-tested library? (3) Does the codebase already have a similar pattern?

Apply independent reasoning — don't accept new approaches uncritically, but don't reinvent the wheel either. The goal is "11 out of 10": understand why others chose their approach, then find where it falls short.

### User Sovereignty
Álvaro decides. AI recommends with explanations, acknowledges missing context, and requests permission before implementing changes that contradict stated direction. User context (domain knowledge, preferences, strategic timing) always exceeds model knowledge.

### Sprint Discipline
Think → Plan → Build → Review → Test → Ship → Reflect. Each feature should follow this loop. For non-trivial work:
1. Clarify scope and edge cases before coding.
2. Build the complete solution (boil the lake).
3. Test on-device before reporting done — type checking and test suites verify code correctness, not feature correctness.
4. Review your own changes for regressions before shipping.

### Bisectable Commits
Each commit should be one logical change — renames separate from rewrites, infrastructure separate from features. Every commit should compile and run.

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

### Styling & Design System

**Design tokens** at `src/theme/tokens.ts` — the single source of truth for all visual properties:
- **Colors**: warm off-white canvas (`#F7F7F5`), white surfaces, accent gold (`#C9A96E`).
- **Typography**: system sans-serif, 7-step scale (hero → micro), 5 weights.
- **Spacing**: base unit 4px, scale from xs(4) to 3xl(32), screen padding preset.
- **Radii, shadows, animation springs**: all tokenized.

**Gold accent is rare and meaningful.** Use it for primary actions, highlights, and important UI elements — not decoration. Data and user content get visual emphasis; chrome stays neutral.

**NativeWind v4** (`nativewind`) is configured but minimally used. Prefer tokens.

### Animation & Motion

Motion serves comprehension only — every animation must help the user understand what changed.
- `react-native-reanimated` for entering/exiting and gesture-driven animations.
- Spring presets in `tokens.ts` (`Animation.spring.*`) for consistency.
- **Duration guidelines**: micro interactions 100ms, standard transitions 180-280ms, complex layout shifts 480ms max.
- No gratuitous motion. If removing an animation doesn't hurt clarity, remove it.

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

6. Coding Conventions
TypeScript strict – loosen only if a third‑party library forces you.

React.memo, useMemo, useCallback – use when they actually help performance.

File naming: PascalCase for components, camelCase for utilities.

Comments: Explain WHY, not what. No multi-paragraph docstrings. If removing the comment wouldn't confuse a future reader, don't write it.

**Quality gates (gstack-inspired):**
- Every edge case within reach should be handled — don't build 90% solutions.
- No empty catch blocks — handle or propagate the error.
- Validate at system boundaries (user input, external APIs), trust internal code.
- Don't add features, refactor, or introduce abstractions beyond what the task requires.
- Three similar lines are better than a premature abstraction.

7. Useful Commands
```bash
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
```

### Physical iPhone Deployment (iPhone 12 Pro)
```bash
# Build Release (standalone, no Metro required)
xcodebuild -workspace ios/Kairos.xcworkspace -scheme Kairos \
  -configuration Release -destination 'id=00008101-00051D4C3C51003A' \
  CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM=FH6BYZT9F3

# Install on device
xcrun devicectl device install app --device 00008101-00051D4C3C51003A \
  path/to/Kairos.app

# Launch on device
xcrun devicectl device process launch --device 00008101-00051D4C3C51003A \
  com.alvaro.kairos
```
8. Known Issues & Solutions (for reference)
Error	Common Cause	Possible Solution
[runtime not ready]	Reanimated plugin misconfigured	Ensure plugin is last in babel.config.js; clear caches.
use-latest-callback warning	Corrupted dependency	Run npm dedupe; reinstall react-native-reanimated.
App entry not found	Top‑level module error	Test with minimal App.tsx; check for circular imports.
Hermes conflict	Reanimated requires JSC	Force "jsEngine": "jsc" in app.json temporarily.
If you encounter other issues, research and propose a fix. You may also suggest upgrading Expo or changing the toolchain.

9. Roadmap (sprint-based, gstack-style)
Each sprint follows: Think → Plan → Build → Review → Test → Ship.

Sprint 0 (DONE) – Dynamic types, flexible data model.
Sprint 1 (DONE) – Core UI components: ExerciseRow, SetRow, BlockEditor, ComponentPalette.
Sprint 2 (DONE) – Zustand + AsyncStorage persistence, block CRUD.
Sprint 3 (DONE) – Column system: 2/3-col sections, drag-and-drop, compact rendering.
Sprint 4 (DONE) – AI Lab + gamification: missions, chat, badges, streaks, progress tree, PR cards.
Sprint 5 (CURRENT) – Polish & completeness: on-device testing, edge case fixes, performance.
Sprint 6 – Canvas layout: drag/resize blocks within apps, widget-style arrangement.
Sprint 7 – Real AI integration: connect to LLM APIs, replace mock services.
Sprint 8 – Social features: friends, challenges, shared blocks.
Sprint 9 – Platform integrations: Apple Health, Google Fit, export, analytics.

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

## Vision: Kairos as a Personal Operating System for Physical Wellness

Kairos is **not a traditional fitness tracker**. It is a **personal OS** where the user builds their own wellness ecosystem from scratch, with the same freedom and modularity as an iPhone home screen.

### Core metaphor: "Apps" as activity groups

- The user’s main screen (Space) contains **custom "apps"** – each app represents a physical activity domain (e.g., Strength, Running, Yoga, Football, Mobility).
- Tapping an app opens a **second-level canvas** where the user can freely arrange **blocks** (training sessions, notes, routines, progress charts) – like a mix of Notion and Craft.
- Inside each block, the user adds **exercises** with dynamic fields (weight, reps, distance, pace, RPE, etc.). The exercise design is flexible, but we will refine its personality later.

### User freedom (Notion + Craft level)

- **Customizable layout** – Users can resize, reorder, and nest blocks. They can drag blocks to reposition them on the canvas (like widgets on iOS).
- **Inline editing** – Tap any text to edit (name, notes, fields). No modals.
- **Visual personalization** – Each app/block can have its own icon, color, cover image, and size (small/medium/large widget).
- **Blocks as windows** – When expanded, blocks rise with a depth effect (shared element transition), blurring the background. Users can resize them by dragging corners.

### AI as a constant copilot

The AI is present **at every stage** without being intrusive:

- **Creation assistant** – User types “Create a 12-week marathon plan” → AI generates a complete structure (apps, blocks, exercises, sets). User can accept, modify, or reject.
- **In-workout advisor** – After each set, the AI analyses performance and suggests adjustments (e.g., “Increase weight by 2.5kg next set” or “Try adding one more rep”).
- **Exercise recommendations** – Based on user’s history, the AI proposes new exercises to overcome plateaus or diversify training.
- **Progress analysis** – Weekly summaries with insights (strengths, weaknesses, recovery patterns). Shown as cards in the AI Lab, not as pushy notifications.

### Gamification (future, but planned)

Once the interface is polished, we will add:

- Badges for streaks, volume, diversity, PRs – each with AI‑generated personalized messages.
- Record cards (digital collectibles) for every personal best.
- A progress tree that grows with the user’s accumulated effort.

### Visual identity refresh

- **Background: white** (instead of dark/black) to align with minimalism and clarity.
- **Accent color: gold (#C9A96E)** – retained as the signature Kairos colour, used for buttons, highlights, and important UI elements.
- **Subtle depth** – soft shadows, very light borders, and a faint noise texture for richness.
- **Typography** – Clean sans‑serif (SF Pro, Inter) with generous spacing.

### Current status (what has been implemented)

- **Design system**: White background + gold accents fully tokenized (`src/theme/tokens.ts`).
- **Block editor**: Full content node system with text, exercises, images, timers, spacers, dashboards, dividers, custom fields.
- **Column system**: 2-col and 3-col sections with independent line editing, “+” buttons, “/” slash commands per column, compact rendering, cross-section drag-and-drop.
- **Persistence**: Zustand store (`src/store/workoutStore.ts`) with AsyncStorage hydration.
- **AI Lab**: Mock chat assistant, weekly missions system.
- **Gamification**: Streaks, badges, PR cards, visual progress tree with growth animations.
- **Physical device**: Builds and runs on iPhone 12 Pro (Release config, embedded JS bundle).

### Immediate next steps (prioritised)

1. **Polish & completeness** – Test all features on-device, fix edge cases, ensure no regressions.
2. **Canvas layout** – Widget-style block arrangement with drag/resize within apps.
3. **Real AI integration** – Replace mock AI services with actual LLM API calls.
4. **Apple Health / Google Fit** – Read/write health data for cross-platform tracking.

### What you (Claude Code) are free to do

- Propose new interaction patterns (e.g., haptic feedback, spring animations).
- Change the design system if you find a better way to achieve the “white+gold” premium look.
- Integrate external libraries that improve the experience (e.g., `react-native-reanimated-gesture-handler`, `react-native-draggable-grid`).
- Implement AI features using mock data first (we will later connect to real APIs).

### What to avoid

- Heavy modals – prefer inline editing or bottom sheets.
- Generic UI – always aim for Craft/Notion level of polish.
- Hardcoded colours – use tokens.

---

**This document evolves with the project. Keep it updated.** 🚀