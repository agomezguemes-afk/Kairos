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

## Type identity — the creative voice (shipped)
The app had no type identity of its own (System sans + the OS serif "New York").
It now has one, grounded in the studied editorial language and propagated
app-wide through `tokens.ts` (every `Type.*` consumer inherits it):

- **Fraunces** — signature editorial serif (soft/wonk character). The creative
  voice: oversized greetings (`Type.heroDisplay`, Fraunces Black), large titles
  (`Type.title`), the **italic gold accent word** (`Type.serifAccent` /
  `serifSemiBoldItalic`) that carries one word per headline, and hero numerals
  (`Type.numHero`). Heavy-upright + light-italic is the recognizable move.
- **Plus Jakarta Sans** — warm geometric workhorse for body, labels, controls,
  and tabular numerals.
- Vendored to `assets/fonts/` (offline, OFL-licensed) and loaded via
  `src/theme/fonts.ts` (`useKairosFonts`) behind `src/theme/FontGate.tsx` so the
  first paint never flashes system → brand. RN gotcha handled: each weight is a
  separately-registered family (fontWeight is ignored for custom faces), and
  italic uses a dedicated TTF (no synthetic Android skew).

## Composition lift (shipped)
The earlier screens floated in the top ~60% of the frame — the single biggest
gap vs Senso/Notis+. Fixed: the onboarding now composes the whole frame.
- Welcome is a 3-zone layout: `Kairos.` wordmark (top) · editorial hero
  (centred) · CTAs (anchored bottom).
- Question steps anchor the primary CTA near the bottom via a flex spacer; the
  goal grid centres vertically.
- Goal cards gained a one-line descriptor (label + muted caption) for Senso-style
  product-card depth. GoldButton sheen reworked for real metallic dimension.

Verified live on the iOS simulator (iPhone 16e) across all five screens —
captures in `/tmp/kairos-shots/`.

## Identity guardrails (kept)
- White/warm-off-white ground, gold is rare and meaningful (never decorative).
- Serif (Fraunces) reserved for hero titles/accents/numerals; Jakarta elsewhere.
- Hairlines + soft shadows over hard borders. Motion serves comprehension.
