# UI/UX Study — Behance "app ui ux" → Kairos premium language

Field study of current best-in-class app design (Behance, June 2026) to raise
Kairos' "UIUX-pro" identity. Screenshots captured locally to
`/tmp/behance-study/` (Senso, Notis+, and the search grid of ~10 premium apps:
Pilo, Niva, Fintech AI Wallet, Crypto Platform, Docuverse Health, etc.).

## References studied
1. **Senso — skincare tracking** (closest analog: a light, premium health
   tracker). Bottom tab bar with a **center FAB** (Home · History · ＋ · Routine
   · Progress), soft rounded product/result cards, a personalized **"Hi, Maria"**
   greeting, one accent color, a clean flow: Welcome → Create account →
   onboarding → Home.
2. **Notis+ — AI workspace** (analog: Kai copilot + the blocks/canvas).
   Oversized friendly headline ("Write something"), **pill filters**, muted
   earthy accent, very generous whitespace, big rounded surfaces, minimal
   wordmark.
3. **Overview grid** — recurring 2026 patterns: phone hero mockups on soft
   gradient grounds, AI-first framing, one bold-or-earthy accent, rounded
   everything, confident type, lots of air.

## The distilled "UIUX-pro" language (and how Kairos already maps)
| Pattern observed | Kairos token / move |
| --- | --- |
| Generous whitespace, nothing cramped | `Spacing.gap.sections` (24), bigger screen padding |
| Large soft-rounded surfaces | `Radius['2xl'|'3xl']` (22/28) |
| Layered soft shadow + hairline (not borders) | `Shadows.card` + `Colors.hair.base` |
| **One** meaningful accent, used sparingly | `Colors.gold.base` (#C9A96E) — CTAs/selection only |
| Oversized, confident, *editorial* headings | `Type.title` (serif 32) for hero greeting |
| Uppercase tracked eyebrow labels | `Type.eyebrow` in `Colors.gold.deep` |
| Pill chips / pill tabs | `Radius.pill` |
| Personalization up front ("Hi, Maria") | greeting uses the name once captured |
| Warm "premium zone" surfaces for hero moments | `Colors.bg.warm` + `Shadows.cardWarm` (gold-tint) |
| Motion that reacts to state | reanimated springs + `useMotionPlan` (reduce-motion aware) |

**Conclusion:** Kairos' token system is already premium; what was missing was a
small set of **reusable, opinionated primitives** that consistently apply this
language, and an onboarding that *shows it off*. Both shipped here.

## What shipped from this study
- `src/features/onboarding/premium/` reusable primitives (token-driven,
  reduce-motion aware): `SoftCard`, `PillChip`, `GoldProgressBar`, `Reveal`.
- `PremiumOnboarding` — a goal-first, <2-minute, visually rich onboarding that
  composes those primitives with the flow logic (`onboardingFlow.ts`),
  `useMotionPlan`, and `SkipToValueButton`. Additive (new files); does not touch
  the screens the night-run is editing. One-line mount documented in the
  component header.

## Identity guardrails (kept)
- White/warm-off-white ground, gold is rare and meaningful (never decorative).
- Serif reserved for hero titles/numerals only; system sans elsewhere.
- Hairlines + soft shadows over hard borders. Motion serves comprehension.
