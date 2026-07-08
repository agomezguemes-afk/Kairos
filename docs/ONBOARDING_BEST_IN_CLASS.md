# Kairos Onboarding — Best-in-Class Spec

**Goal (Álvaro):** the user is *using* the app within **2 minutes**, and the
flow is a visually unmatched experience. This spec turns that into a concrete,
buildable design grounded in how the best apps do it today.

> Status: design + pure flow logic landed on `feat/security-hardening`
> (`src/features/onboarding/flow/`). The screens themselves are being evolved
> in parallel on `feat/night-run`; this is the architecture they should plug
> into. Nothing here rewrites those screens — it's additive.

---

## 1. The one number that matters: Time-To-First-Value (TTFV)

Across every teardown, **TTFV is the strongest predictor of retention** — users
who don't feel value inside ~60s rarely come back, and they decide whether to
stay within the first ~20 seconds. Fitness benchmarks specifically target
**goal → plan → start in under 60 seconds**, and each onboarding step beyond
five drops completion 10–15%.

So Kairos onboarding is designed around two budgets, not one:

| Path | Budget | Outcome |
| --- | --- | --- |
| **First value** | **≤ 60s** (target ~30s) | A personalized starter space exists and the user can start their first workout. |
| **Full personalization** | **≤ 120s** | Name + goal + equipment captured; richer starter space. |

The second must never block the first. Profiling is *progressive* — deferred to
contextual moments later, not front-loaded.

## 2. Principles (from the market, adapted to Kairos)

1. **Value before profiling (the Duolingo inversion).** "Use the product, then
   sign up." Let the user reach a generated training space before asking for an
   account or a long questionnaire. This inversion is one of the highest-impact
   retention changes Duolingo has reported.
2. **One required answer.** Only the **goal** is needed to generate a
   personalized starter space. Everything else (name, experience, equipment) has
   a smart default and is deferrable. → `firstValueReady()` in the flow module.
3. **Skip-to-value always visible.** From the welcome screen, a single tap
   ("Empezar — 30s") applies smart defaults and drops the user straight into a
   ready space. No dead ends, no required typing to get in.
4. **Smart defaults over empty states.** Goal defaults to `health` (broadest
   starter routine); equipment defaults to bodyweight. The app is never empty.
5. **Progressive disclosure.** Name and equipment, if skipped, are requested
   later in-context (first time the user edits a profile, adds a barbell
   exercise, etc.) — not as upfront gates.
6. **Motion reacts to state, not decoration.** "Duolingo-style" = the mascot/
   logo *listens, waits, succeeds, celebrates*. Every animation maps to a
   product state change (see §4). Reduced-motion users get instant, legible
   states.

## 3. The flow (redesigned ordering)

Current order is Welcome → **Name** → Goal → Equipment, where Name gates Goal.
That front-loads personalization (typing) ahead of the value-driver (goal).
Reordered for TTFV:

```
Welcome ──tap "Empezar 30s"──────────────► [defaults applied] ─► Ready space ✦ (first value <30s)
   │
   └─tap "Personalizar"─► Goal* ─► Name ─► Equipment ─► Ready space ✦ (full, <120s)
                           ▲ only required step
```

- **Welcome (0–10s):** brand moment + two CTAs: primary "Empezar" (skip-to-
  value) and secondary "Personalizar" (full path). The hero animation plays once
  and is interruptible.
- **Goal (10–30s):** the only required step. 2×2 card grid, single tap selects
  *and* advances (no separate Next needed). This is what generates the routine.
- **Name (optional):** one field, prefilled-friendly, "Saltar" always present.
- **Equipment (optional):** multi-select chips, "Solo peso corporal" is the
  default if nothing is picked.
- **Reveal:** the generated space animates in (the "reward" state). This is the
  emotional payoff — the user sees *their* space build itself.

## 4. Motion language (maps to the existing reanimated setup)

The current screen already uses reanimated parallax, staggered fades, haptics,
and a closing-logo sequence — a strong base. Layer state-reactive motion on top:

| State | Motion | Haptic |
| --- | --- | --- |
| Idle / listening | logo breathing (existing `AnimatedLogoPulse breathing`) | — |
| Selection | card lifts + gold fill spring | `selectionAsync` |
| Advance | parallax slide (existing) | `impact Light` |
| Generating space | logo pulse accelerates + shimmer | — |
| Reward / reveal | space blocks stagger-in, gold accent sweep | `notification Success` |

Timings follow the design system: micro 100ms, standard 180–280ms, complex
layout ≤480ms. Honor `AccessibilityInfo.isReduceMotionEnabled` — when on,
replace slides/scales with instant cross-fades (≤120ms) and skip the breathing
loop. (A `useReducedMotion` hook from reanimated is available.)

## 5. How it composes with the generative "Kai space"

`feat/night-run` adds `src/lib/ai/onboardingSpace.ts` (AI generates a starter
space from discipline/level/frequency). That's great for the **full** path, but
it must not sit on the critical path to first value (an LLM round-trip can blow
the 60s budget and can fail offline). Rule: **generate a deterministic starter
space instantly** (`generateStarterRoutine(goal)`), then let Kai *enrich* it in
the background and offer the richer version as a non-blocking upgrade. Offline
and slow-network users still hit first value.

## 6. What landed here (pure, tested)

`src/features/onboarding/flow/onboardingFlow.ts` — framework-agnostic flow
logic the screens drive instead of ad-hoc `useState`:

- `firstValueReady(draft)` — is a starter space generatable now?
- `applySmartDefaults(draft)` / `skipToValue(draft)` — the one-tap path.
- `stepProgress(draft)` / `nextStep()` — progress + ordering.
- `normalizeName()` / `isValidGoal()` — boundary validation.
- `MAX_TTFV_MS` / `makeTtfvTracker()` — instrument time-to-first-value so we can
  prove the 2-minute promise with data instead of vibes.

## 7. Open follow-ups
- Wire the screens to this flow module (reorder Goal-first, add skip CTA).
- Add the reduced-motion fallback pass to `OnboardingScreen`.
- Background-enrich with Kai instead of blocking.
- Instrument TTFV to analytics once an analytics sink exists.

## Sources
- [12 Apps with Great User Onboarding (2026) — UXCam](https://uxcam.com/blog/10-apps-with-great-user-onboarding/)
- [Best Mobile App Onboarding Examples 2026 — Plotline](https://www.plotline.so/blog/mobile-app-onboarding-examples)
- [The Ultimate Mobile App Onboarding Guide (2026) — VWO](https://vwo.com/blog/mobile-app-onboarding-guide/)
- [Duolingo's onboarding teardown — Appcues](https://goodux.appcues.com/blog/duolingo-user-onboarding)
- [Designing a Fitness Platform: UX challenges — UXmatters](https://www.uxmatters.com/mt/archives/2025/07/designing-a-fitness-platform-ux-design-challenges-and-solutions.php)
- [Fitness app UX best practices 2025 — Dataconomy](https://dataconomy.com/2025/11/11/best-ux-ui-practices-for-fitness-apps-retaining-and-re-engaging-users/)
- [Duolingo-style (Rive) animation in 2026 — Medium](https://uianimation.medium.com/duolingo-style-animation-in-mobile-apps-2026-how-it-works-and-what-a-rive-animator-brings-to-53f21ab79cbc)
