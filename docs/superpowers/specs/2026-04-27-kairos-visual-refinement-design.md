# Kairos · Visual Refinement Design

**Date:** 2026-04-27
**Status:** Design — pending review
**Owner:** Álvaro
**Scope:** Tokens, typography, components, per-screen polish, twelve motion vignettes.

---

## 1 · Vision

A motion language between **Apple's spring physics** and **Notion's calm**. Refined minimalism executed with precision: every animation earns its place, every detail compounds. The app already has the right palette and right type philosophy — this spec consolidates them into a single coherent system and adds the motion + detail layer that turns "premium minimal" from an intent into a felt experience.

**Non-negotiables, preserved:**
- Warm off-white canvas (`#F7F7F5`) + gold accent (`#C9A96E`) + deep charcoal text.
- System sans (SF Pro / Roboto) as the body workhorse.
- Single accent color, used sparingly.

**One new addition:**
- An **editorial serif** (Fraunces with `New York` system fallback on iOS, Georgia on Android) for hero numerals and screen titles only. Nowhere else.

---

## 2 · Root cause: three palettes coexist

The current visual fragmentation traces to **three competing color systems** that grew in parallel:

| System | Found in | Surface | Text | Gold |
|---|---|---|---|---|
| v1 | `Colors.background.*`, `Welcome`, `BlockLibrary` | `#F7F7F5` warm | `#1C1C1E` | `#C9A96E` |
| v2 (theme-aware) | `buildThemeColors`, `Home`, `Canvas` | `#FFFFFF` pure | `#1A1A2E` navy | `#D4AF37` brighter |
| Dark chrome | `SplashScreen`, `KairosTabBar` | `#000000` / `#0D1117` | `#F5F0E8` | `#D4AF37` |

The single biggest visual win is collapsing these into **one palette**. The dark chrome is replaced with translucent warm materials. The two text inks merge to `#1C1C1E` (Apple HIG). The two golds merge to `#C9A96E` (warmer, more sophisticated; `#D4AF37` reads as Christmas-leaf when sustained).

---

## 3 · Tokens v3 — consolidated source of truth

> File: `src/theme/tokens.ts` — replaces both v1 `Colors` and v2 `surface_v2/text_v2/gold` blocks with a single, flat, semantically-named structure. `buildThemeColors` is removed; light is the only mode for now (dark deferred — see §11). Backwards-compat re-exports keep existing call sites compiling during migration.

### 3.1 · Color

```ts
export const Colors = {
  bg: {
    void:     '#F7F7F5',  // primary screen background
    surface:  '#FFFFFF',  // cards, sheets, modals
    elevated: '#F2F0EC',  // raised surfaces, pressed states
    warm:     '#FAF6EE',  // "premium" zones — hero cards, PR badges
    warm2:    '#F5EFE2',  // deeper warm — PR celebration, editorial blocks
  },
  ink: {
    primary:   '#1C1C1E',  // headlines, body
    secondary: '#3A3A3C',  // emphasized secondary
    tertiary:  '#636366',  // metadata
    muted:     '#9B9B9E',  // labels, placeholders
    inverse:   '#FFFFFF',  // text on dark/gold buttons
  },
  gold: {
    base:  '#C9A96E',      // signature accent — primary CTAs, indicators
    deep:  '#8C6E2A',      // gold-on-warm text (eyebrows, chapter labels)
    light: '#E8D5B7',      // gold tint, subtle accents
    glow:  'rgba(201,169,110,0.18)',  // halos, ripples, pill backgrounds
  },
  hair: {
    subtle: 'rgba(28,28,30,0.06)',   // section dividers
    base:   'rgba(28,28,30,0.08)',   // card borders (default)
    strong: 'rgba(28,28,30,0.14)',   // pressed borders, dividers in white
  },
  discipline: {
    /* preserved unchanged from current — they already work */
    strength: '#E84545', running: '#5B8DEF', calisthenics: '#1DB88E',
    mobility: '#8B5CF6', team_sport: '#F0A030', cycling: '#06B6D4',
    swimming: '#3B82F6', general: '#C9A96E',
  },
  semantic: {
    success: '#1AA870', error: '#D94040', warning: '#E08C20', info: '#4A7DE8',
    successMuted: 'rgba(26,168,112,0.10)',
    errorMuted:   'rgba(217,64,64,0.10)',
    warningMuted: 'rgba(224,140,32,0.10)',
    infoMuted:    'rgba(74,125,232,0.10)',
  },
} as const;
```

**What's removed:** `surface_v2`, `text_v2`, `gold.300/500/700`, `success_v2`, `warning_v2`, `danger`, `accent.muted/dim`, `border.warm`. Migration via codemod / find-replace.

### 3.2 · Typography

```ts
export const FontFamily = {
  sans:   'System',  // SF Pro on iOS, Roboto on Android
  serif:  Platform.select({ ios: 'New York', android: 'serif', default: 'Georgia' }),
  mono:   Platform.select({ ios: 'Menlo', default: 'monospace' }),
} as const;

export const Type = {
  // Editorial — serif. Reserved for hero numerals + screen titles.
  hero:        { fontFamily: FontFamily.serif, fontSize: 56, lineHeight: 56,
                 fontWeight: '500', letterSpacing: -2, fontVariant: ['tabular-nums'] },
  title:       { fontFamily: FontFamily.serif, fontSize: 32, lineHeight: 36,
                 fontWeight: '600', letterSpacing: -0.6 },
  titleSmall:  { fontFamily: FontFamily.serif, fontSize: 22, lineHeight: 28,
                 fontWeight: '600', letterSpacing: -0.3 },

  // System sans — workhorse.
  heading:    { fontFamily: FontFamily.sans, fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.2 },
  subheading: { fontFamily: FontFamily.sans, fontSize: 17, lineHeight: 24, fontWeight: '600' },
  body:       { fontFamily: FontFamily.sans, fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyEmph:   { fontFamily: FontFamily.sans, fontSize: 15, lineHeight: 22, fontWeight: '600' },
  caption:    { fontFamily: FontFamily.sans, fontSize: 13, lineHeight: 18, fontWeight: '500' },
  micro:      { fontFamily: FontFamily.sans, fontSize: 11, lineHeight: 14, fontWeight: '500' },

  // Editorial label — uppercase, tracked. The "CHAPTER 03" voice.
  eyebrow:    { fontFamily: FontFamily.sans, fontSize: 11, lineHeight: 14,
                fontWeight: '600', letterSpacing: 1.6, textTransform: 'uppercase' },

  // Numerical — tabular for any UI showing weight/reps/time/distance.
  numHero:    { fontFamily: FontFamily.serif, fontSize: 56, lineHeight: 60,
                fontWeight: '500', letterSpacing: -2, fontVariant: ['tabular-nums'] },
  numLarge:   { fontFamily: FontFamily.sans, fontSize: 28, lineHeight: 32,
                fontWeight: '700', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  numMedium:  { fontFamily: FontFamily.sans, fontSize: 18, lineHeight: 22,
                fontWeight: '700', fontVariant: ['tabular-nums'] },
  numSmall:   { fontFamily: FontFamily.sans, fontSize: 13, lineHeight: 16,
                fontWeight: '600', fontVariant: ['tabular-nums'] },
} as const;
```

**Rule:** serif appears in exactly four places — splash wordmark, screen large-titles (V08), hero stat numerals (streak, weekly volume, PR), and editorial cards (V10). Everywhere else is system sans.

### 3.3 · Spacing — preserved

The existing `Spacing` (4/8/12/16/20/24/32) plus `gap` and `screen` presets is kept. It works.

### 3.4 · Radius

```ts
export const Radius = {
  xs: 6, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 22, '3xl': 28,
  pill: 99, full: 9999,
} as const;
```

Adds `2xl: 22` for sheets and large hero cards (matches iOS sheet corner). Adds `3xl: 28` for tab-bar capsule.

### 3.5 · Shadows — adds warm option

```ts
export const Shadows = {
  none, subtle, card, icon, elevated, modal,  // existing — kept
  cardWarm: {
    shadowColor: '#C9A96E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 4,
  },
  pressed: {
    shadowColor: '#1C1C1E',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.10,
    shadowRadius: 28,
    elevation: 8,
  },
} as const;
```

`cardWarm` is the gold-tinted shadow for V06 (press depth bloom). `pressed` is the deeper neutral shadow for cards held down.

### 3.6 · Motion tokens

`src/theme/animations.ts` is updated to add **semantic** spring presets so call sites read intent, not numbers.

```ts
export const springs = {
  // Existing (kept): ios, drag, gentle, bouncy, tap, tabIcon, pop, heavy

  // New — semantic
  enter:     { damping: 18, stiffness: 220, mass: 0.8 },   // entering elements
  exit:      { damping: 22, stiffness: 280, mass: 0.7 },   // leaving elements (faster than enter)
  indicator: { damping: 24, stiffness: 380, mass: 0.7 },   // tab pill, segment selector
  press:     { damping: 16, stiffness: 360, mass: 0.6 },   // card/button press depth
  sheet:     { damping: 26, stiffness: 220, mass: 1.0 },   // bottom sheet present
  celebrate: { damping: 9,  stiffness: 200, mass: 0.7 },   // PR, streak increment
} as const;

export const easings = {
  // For Easing-based timings where springs aren't appropriate
  emphasized:  Easing.bezier(0.20, 0, 0, 1),     // material 3 emphasized
  decelerate:  Easing.bezier(0.16, 1, 0.3, 1),   // notion-style soft arrival
  accelerate:  Easing.bezier(0.4, 0, 1, 1),      // exits
  standard:    Easing.bezier(0.4, 0, 0.2, 1),    // default
} as const;
```

**Asymmetry rule (Apple convention):** entrances are slower than exits. Default 280 ms in / 220 ms out. Always.

---

## 4 · Component specifications

### 4.1 · Tab bar — `KairosTabBar` rewrite (V02)

**Replaces** the dark `#0D1117` bar entirely.

- **Container:** floating capsule. `position: absolute` with `bottom: insets.bottom + 16`, `left: 16`, `right: 16`, `height: 56`, `borderRadius: Radius['3xl']` (28).
- **Material:** `expo-blur` `<BlurView intensity={28} tint="light">` with overlay `rgba(255,255,255,0.72)`. Hairline border (`StyleSheet.hairlineWidth`, `Colors.hair.base`). Drop shadow `Shadows.elevated`. **Note:** `BlurView` content layout requires the screen content to extend behind the bar — `Tab.Navigator` `tabBarStyle.position: absolute` is set, with screens adding `paddingBottom: 88` to their `ScrollView` content so the last row isn't hidden.
- **Indicator:** a single gold `glow`-bg pill (36×36, `borderRadius: 18`) absolutely positioned, animated on the `springs.indicator` preset using a single shared `useSharedValue`. **Never** four pills cross-fading.
- **Icons:** existing `KIcon` set. Active: `stroke = Colors.gold.base, strokeWidth = 2`. Inactive: `stroke = Colors.ink.muted, strokeWidth = 1.6`. Stroke transitions on a 280 ms `easings.standard` timing.
- **Labels:** removed (current `KairosTabBar` has `LABELS` map — delete it). The capsule is icon-only. `accessibilityLabel` on each tab carries the human name for VoiceOver. Saves ~14 px of vertical space.
- **Haptic:** `Haptics.selectionAsync()` on tab change (already present, kept). Maps to `hapticEvents.tabSwitch` in `animations.ts`.

### 4.2 · Pressable card recipe (V06)

Every card surface (block card, today card, streak card, history row) uses the same press recipe. Implemented as a single shared component `<PressableCard>`.

- **Idle:** `scale: 1, shadowOpacity: 0.04, shadowColor: ink`.
- **PressIn:** `scale: 0.97` via `springs.press`. Shadow morphs to `Shadows.cardWarm` (gold-tinted, deeper) over 200 ms.
- **PressOut:** `scale: 1` via `springs.press`. Shadow morphs back over 240 ms.
- **Haptic:** `Haptics.impactAsync(Light)` on `pressIn`. **Never on `pressOut`** — that's overkill.

### 4.3 · Sheet — bottom sheet pattern (V11)

Adds `@gorhom/bottom-sheet` for the slash menu, block creation, and any current modal.

- **Presentation:** sheet rises with `springs.sheet`. Background screen scales to `0.94` and dims to `brightness 0.9` simultaneously. Shadow `Shadows.modal`.
- **Corners:** `Radius['2xl']` (22) on top corners. Bottom flush with screen.
- **Grabber:** 36×4 px, `Colors.ink.muted` at 40% opacity, centered, 14 px from top.
- **Backdrop:** scrim `rgba(0,0,0,0.32)` fading in over 280 ms.
- **Dismiss:** sheet drops with `springs.exit` (faster than entry — asymmetry rule). Background screen springs back simultaneously.

### 4.4 · Buttons

```
Primary    : bg = Colors.ink.primary (deep charcoal), text = inverse, height 52, radius lg (16)
Gold       : bg = Colors.gold.base, text = ink.primary, height 52, radius lg
Secondary  : transparent, border 1.5 px Colors.gold.base, text = gold.deep, height 52
Ghost      : transparent, no border, text = ink.secondary, height 44
```

**Default for primary CTAs is `ink.primary` (black-on-warm), not gold.** Gold is reserved for *moments*: streak active, PR celebration, "Start session" hero button on Today card. This restores gold's meaning. Today's `HomeScreen.tsx` uses gold for the "OK" name button and "Start session" — that's gold inflation. Demote the OK button to ghost.

### 4.5 · Inputs

- Height 44 px, radius `Radius.md` (12), border 1 px `Colors.hair.base`.
- Focused: border becomes 1.5 px `Colors.gold.base`, with a subtle 4 px gold glow ring (`shadowColor: gold.base, shadowOpacity: 0.18, shadowRadius: 8`).
- Placeholder: `Colors.ink.muted`.

### 4.6 · Section header — large title pattern (V08)

iOS-native large-title behavior. Implemented once as `<LargeTitleHeader title="Hoy" eyebrow="SECCIÓN" />`.

- **At rest:** title in `Type.title` (32 px serif), eyebrow above in `Type.eyebrow` with a 28 px gold rule beneath.
- **On scroll (`scrollY > 32`):** title interpolates `scale: 1 → 0.55, opacity: 1 → 0` while a smaller `Type.subheading` title fades into the navigation bar.
- **Nav bar background:** transparent at rest, fades to `BlurView(28) + rgba(255,255,255,0.7)` once `scrollY > 16`. Hairline appears at the same threshold.

---

## 5 · Per-screen application

### 5.1 · `SplashScreen.tsx` → continuous handoff (V01)

**Current:** black background, gold ring, hard fade-out.
**New:**
- Background = `Colors.bg.void` (warm off-white) with a radial gradient `bg.warm → bg.void` blooming once at 400 ms.
- Mark = same K-glyph in gold, but on a `bg.surface` (white) circle with a 1.5 px gold border. Sits centered initially.
- At exit (2.3 s): mark animates *up* to the welcome-screen logo position (40 % from top) instead of fading out. Welcome screen mounts beneath, mark tracks the same coordinate. **No color flash.** Total handoff 800 ms.
- Wordmark "Kairos" appears **after** the handoff in `Type.title` (32 px serif, italic capital "K" optional), tagline below in `Type.eyebrow` gold-deep.

### 5.2 · `WelcomeScreen.tsx`

- Update token references from v1 `Colors.background.void` / `Colors.accent.primary` → new flat `Colors.bg.void` / `Colors.gold.base`.
- Wordmark: switch from system sans (`fontSize: 46, fontWeight: 700`) to `Type.title` serif. Letter-spacing `-1.2` is preserved.
- Tagline: keep "The Training OS" but in `Type.eyebrow` style (uppercase tracked) rather than current sentence-case.
- Primary CTA: keep gold bg — this is a moment screen.
- Idle pulse: keep current 2-second breathing scale (`1 → 1.035 → 1`).

### 5.3 · `HomeScreen.tsx`

Apply five vignettes here — this is the most-touched screen.

- **Layout:** wrap in `LargeTitleHeader` (V08). Eyebrow = "HOY", title = greeting (`Buenos días, Álvaro`).
- **Streak card:** redesign to match V05. Icon zaps with `springs.celebrate` once on mount if `streak.current > 0`. Number uses `Type.numLarge` with vertical roll on increment (key the `Animated.View` on the value).
- **Today card:** wrap in `<PressableCard>` (V06). Title in `Type.titleSmall` serif. Meta row uses `Type.eyebrow` for labels, `Type.numSmall` for values. CTA "Comenzar Sesión" stays gold (moment screen).
- **Insight card:** keep current structure but use `Type.eyebrow` for "KAIROS COACH", restored gold-deep text. Body in `Type.body`.
- **List entrance (V03):** when `blocks.length` changes, items in any list (today, recents) stagger in 80 ms apart using `springs.enter`.

### 5.4 · `BlockLibraryScreen.tsx`

- Apply `LargeTitleHeader` ("BIBLIOTECA" eyebrow, "Bloques" title).
- List rows use `<PressableCard>` recipe (V06). Stagger entrance (V03).
- **Slash command (V09):** add an inline "+" trigger at the bottom of every block. Tapping opens the bottom sheet with insertable nodes (Block / Exercise / Timer / Note / Image / Spacer). Keyboard with hardware key bindings on iPad in a later phase.

### 5.5 · `CanvasScreen.tsx`

- Apply `LargeTitleHeader` to the canvas header (current top bar already has block name — convert to the same pattern).
- Replace the gold FAB icon color: keep gold bg but icon should be `Colors.ink.primary`, not white. Black-on-gold is more legible and consistent with primary CTA convention.
- **Drag (V07):** when a widget begins drag, render a 1.5 px dashed gold ghost at its starting position (matches `GuideLines.tsx` styling). Show gold guide hairlines on edge alignment (already partially implemented). Drop snaps with `springs.indicator` (light overshoot).
- Shadow on dragged widget: morph from `Shadows.subtle` → `Shadows.elevated` over 160 ms on drag start, reverse on drop.

### 5.6 · `SessionScreen.tsx` / `ActiveWorkoutScreen.tsx`

- **Set completion (V04):** when a set is logged:
  1. Checkmark circle animates from outline to filled gold (`springs.celebrate`).
  2. Gold ripple radiates from the checkmark center using a Reanimated `withSequence` (scale 0.4 → 2, opacity 1 → 0 over 360 ms).
  3. Numerals (weight × reps) translate up 2 px and tint to `Colors.gold.deep` over 240 ms, then settle.
  4. Haptic `Haptics.impactAsync(Medium)` synchronized with step 1.
- After 5 s of stillness, the set row gently collapses to a half-height "completed" state (height 56 → 38 px), de-emphasizing it visually so focus stays on the active set.

### 5.7 · `ProgressScreen.tsx`

- **Editorial layout (V10):** weekly summary uses serif numerals (`Type.numHero` for total volume, `Type.titleSmall` for body), eyebrow labels with gold rules.
- **PR cards (V12):** redesign existing PR cards.
  - Background: `linear-gradient(160deg, bg.surface 0%, bg.warm2 100%)`.
  - Border: 1 px `Colors.gold.glow`.
  - Hero number: `Type.numHero` serif.
  - Aura: a radial gold glow behind the card scales from 0.6 → 1.1 → 0.6 over 4 s on first appearance, then idles. Once-per-PR, not on every render.

### 5.8 · `OnboardingScreen.tsx`, `AuthScreen.tsx`

Apply token migration and large-title pattern. No new motion required — these are already linear flows.

---

## 6 · Motion vignettes — exact specifications

| # | Trigger | Duration | Easing | Haptic |
|---|---|---|---|---|
| 01 | Splash mount → Welcome handoff | 800 ms | `springs.enter` for mark, `easings.emphasized` for fade | none |
| 02 | Tab change | 380 ms (pill), 280 ms (icon stroke) | `springs.indicator`, `easings.standard` | `selectionAsync` |
| 03 | List mount | 80 ms stagger × N items, each 320 ms | `springs.enter` | none |
| 04 | Set complete | 360 ms total | `springs.celebrate` (check), timing-based ripple | `impactMedium` (`hapticEvents.setComplete`) |
| 05 | Streak increment | 700 ms | `springs.celebrate` (icon), `easings.emphasized` (number roll) | `impactLight` (once/day) |
| 06 | Card pressIn | 200 ms | `springs.press` | `impactLight` |
| 07 | Widget drag | continuous | `springs.drag` | `impactLight` (`hapticEvents.dragStart`), `selectionAsync` (snap) |
| 08 | Scroll → large title collapse | scroll-driven (interpolated) | linear interpolation against `scrollY ∈ [16, 64]` | none |
| 09 | Slash menu open | 320 ms | `springs.sheet` | `impactLight` |
| 10 | Editorial card mount | 480 ms | `easings.decelerate` | none |
| 11 | Bottom sheet present | 460 ms (sheet), 460 ms (bg drift) | `springs.sheet` | `impactLight` |
| 12 | PR celebration | 1.6 s total | `springs.celebrate` (number), 4 s aura cycle | `notificationSuccess` |

**Total motion budget per screen mount:** ≤ 1.2 s. After that, the screen is interactive and at rest.

---

## 7 · Detail polish — the silent multipliers

These are the small things that compound into "Apple-grade" without being any single bold move:

1. **Tabular numerals everywhere a number changes** — weights, reps, times, distances, dates, streaks. Already partially in code; make systematic via `Type.num*` presets.
2. **Hairline separators** — replace any `borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)'` with `StyleSheet.hairlineWidth` + `Colors.hair.base`. On a 3× device this becomes a true 0.33 pt line.
3. **Backdrop blur with saturation** — every translucent surface (tab bar, nav bar, sheet) uses `BlurView intensity={28} tint="light"` overlaid with `rgba(255,255,255,0.72)`. Not just blur — saturation boost makes warm tones richer underneath.
4. **Asymmetric durations** — entrances ~280 ms, exits ~220 ms. Apple's house style.
5. **Stroke thickness as state** — active icons gain 0.4 px stroke (1.6 → 2.0). Far more refined than color-swap-only.
6. **Eyebrow + 28 px gold rule** — every section header gets the editorial label + rule pattern. Rule is `Colors.gold.base`, height 1 px, width 28 px, margin-bottom 8 px.
7. **No multi-line shadows** — every shadow is a single tuned recipe from `Shadows.*`. Never inline `shadowOpacity: 0.05` etc.
8. **Pressable hit slop** — every icon button gets `hitSlop={8}`. Already present in `CanvasScreen.tsx`; make systematic.
9. **One haptic per gesture** — never compound (e.g., light + medium together). The `hapticEvents` map in `animations.ts` is the canonical reference.
10. **No emoji icons** — current code uses `⚡` and similar inline. Replace with `KIcon` consistently.

---

## 7.5 · Dependency audit

**Already installed** (verified `package.json`):
- `react-native-reanimated@~4.1.1` — all spring/timing animations.
- `react-native-gesture-handler@~2.28.0` — drag, swipe.
- `expo-blur@~15.0.8` — translucent tab bar, sheet backdrop, large-title header blur.
- `expo-haptics@~15.0.8` — every motion-paired haptic.

**To add in Phase 1:**
- `@gorhom/bottom-sheet@^5` — V09 (slash command), V11 (sheet present), block creation modal.
- `@expo-google-fonts/fraunces` + `expo-font` — editorial serif loading. Required only for parity with iOS `New York`; Android falls back to `Georgia` natively (no fetch). Loads must be non-blocking — splash must render before fonts resolve.

**Not added** — `react-native-skia`, `lottie-react-native`, `moti`. Reanimated + native APIs cover every vignette; introducing more motion runtimes inflates the bundle without a payoff for Phase 1–3.

---

## 8 · Out of scope (explicit)

Hold the line on these — each is a separate future spec:

- **Dark mode redesign.** Current `buildThemeColors` dark branch is removed; theme preference UI becomes light-only. Re-introduced once the light system is stable.
- **New illustrations or icon set.** Existing `KIcon` set is preserved.
- **Localization changes.** Spanish strings stay as-is.
- **AI / coach copy rewrites.** Not a visual concern.
- **New navigation structure.** Tab bar reskin; tabs themselves unchanged.
- **Custom font hosting.** Fraunces is loaded via Expo Google Fonts on iOS as enhancement; system serif (`New York` / `Georgia`) is the guaranteed fallback. App must look correct without the network.

---

## 9 · Implementation phasing

Three PRs, each compiles independently (bisectable commits rule).

### Phase 1 · Foundation — `tokens.ts` + typography
- Consolidate `Colors`, `Type`, `FontFamily`, `Radius`, `Shadows`, `springs`, `easings` into the new shape.
- Run codemod / find-replace for legacy keys (`accent.primary` → `gold.base`, `text.primary` → `ink.primary`, `surface_v2.light` → `bg.surface`, etc.). Temporary backwards-compat re-exports are added at the start of the phase and **removed before merge** — no legacy keys ship.
- Update `ThemeContext.tsx` to return a flat light-only `colors` object (no `buildThemeColors`). `useTheme` and `useThemeColors` keep their public signatures; `mode` always resolves to `'light'`. The `themePreference` store field is preserved for future dark-mode reintroduction but resolves to light unconditionally for now.
- Remove dark-branch tokens (`surface_v2.dark`, dark text variants). Theme switcher UI in `CanvasScreen.tsx` becomes a no-op or is hidden.
- Wire Fraunces font loading via `expo-google-fonts/fraunces` with `New York` (iOS) / `Georgia` (Android) fallback. App must render correctly before the font resolves.
- **Acceptance:** project compiles, all screens render visually identical or improved (no regressions). Bisectable commits: (1) new tokens + re-exports, (2) codemod, (3) ThemeContext update, (4) font loading, (5) re-exports removed.

### Phase 2 · Chrome — system surfaces
- Rewrite `KairosTabBar` (V02).
- Rewrite `SplashScreen` (V01).
- Build `LargeTitleHeader` component (V08); apply to Home, Library, Canvas, Progress.
- Build `<PressableCard>` recipe (V06); replace inline `Pressable` styling on Home, Library, Today, History.
- Add `@gorhom/bottom-sheet` and build `<KairosSheet>` wrapper (V11).
- **Acceptance:** every screen gets the new chrome; all interactions still work; on-device test on iPhone 12 Pro.

### Phase 3 · Moments — emotional motion
- Set completion (V04).
- Streak increment (V05).
- List stagger (V03).
- Canvas drag refinement (V07).
- Slash command palette (V09).
- Editorial weekly summary (V10).
- PR celebration (V12).
- **Acceptance:** each vignette demoable in isolation. Motion budget ≤ 1.2 s/screen verified by hand on device.

---

## 10 · Success criteria

The work is done when:

1. **No file references the removed token keys** (CI grep check or eslint rule).
2. **No dark surfaces remain** in light mode (no `#0D1117`, no `#000000` outside of legitimate content like the iPhone notch in mockups).
3. **One palette, one type ramp, one motion vocabulary** — verifiable by reading `tokens.ts` and `animations.ts` end-to-end in under 3 minutes.
4. **Each of the 12 vignettes is implemented** and visually matches the brainstorm references.
5. **On-device feel test:** every gesture has weight (press depth), every state change has motion (no instant swaps), every transition has haptic if it represents a discrete event.

---

## 11 · Open decisions for review

Items I made an opinionated call on that the user should confirm or override:

- **`#C9A96E` over `#D4AF37` as the single gold.** The warmer one is more "Notion + Apple Books"; the brighter one trends festive. → Confirm `#C9A96E`.
- **Tab bar labels removed.** Icon-only is more iOS-native and saves space. → Confirm or keep labels.
- **Editorial serif scope: 4 places only.** Splash wordmark, large-title screen headers, hero numerals, editorial cards. Anywhere else and serif loses its charge. → Confirm scope.
- **Dark mode deferred.** Removing it now to prevent the three-palette problem from regrowing. → Confirm deferral.
- **Primary CTAs become `ink.primary` (black) by default.** Gold reserved for moments. → Confirm — this is the most opinionated change, restores gold's meaning.

---

*End of spec.*
