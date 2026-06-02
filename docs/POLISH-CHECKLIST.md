# Kairos — Polish Checklist

The canonical reference any screen must satisfy before it can be considered
"shipped". This is the difference between code that works and a product that
feels premium. Apply on every new screen, and use it as the audit lens for
existing screens during the polish sweep.

> **Principle**: Kairos's moat is the **Aesthetic-Usability Effect** — apps
> that feel beautiful are perceived as more usable, even if functionally
> identical. Cheap visuals leak across the whole product. Polish is not
> decoration; it's a feature.

---

## 1. Visual identity (the non-negotiables)

### Tokens

- [ ] **Zero hardcoded colors.** All color values come from `src/theme/tokens.ts`.
      Run `npm run audit:design` before shipping — any new hardcoded hex is a
      regression.
- [ ] **Modern token surface only.** Use `Colors.bg.*`, `Colors.ink.*`,
      `Colors.gold.*`, `Colors.hair.*`. Deprecated shims (`Colors.background`,
      `Colors.text`, `Colors.border`, `Colors.accent`) MAY appear in code you
      don't own this sprint, but NEW code MUST use the modern keys.
- [ ] **Typography from `Type.*`** (new code), not `Typography.*` (legacy).
      `Type` gives you serif for editorial moments and tabular numerals for
      stats — both critical to the brand feel.
- [ ] **Spacing from `Spacing.*`.** No raw numbers larger than `2px` in
      stylesheets. `padding: 16` → `padding: Spacing.lg`.
- [ ] **Radii from `Radius.*`.** Sheets use `Radius['2xl']`, tab capsule uses
      `Radius['3xl']` — these are spec-locked.

### Gold accent (the one rule that defines the brand)

> Gold is rare and meaningful. If you can remove a gold element without losing
> meaning, remove it.

- [ ] **One gold-primary element per screen.** Not two. The single moment
      where attention should land — the hero CTA, the active state, the PR
      number — gets gold. Everything else stays ink/grey.
- [ ] **Gold for action and value, never decoration.** A border, a divider,
      a background tint that's "just there" is wrong.
- [ ] **`Colors.gold.glow` for halos and pill backgrounds**, not solid gold.
      Solid gold reads as primary CTA.

### Material + depth

- [ ] **Shadows from `Shadows.*`.** No custom `shadowOffset` numbers.
- [ ] **Hairlines from `Colors.hair.*`.** Borders should be 0.5px with
      `Colors.hair.base` for cards, `Colors.hair.subtle` for dividers.
- [ ] **White surfaces sit on warm off-white backgrounds.** The `Colors.bg.surface`
      (#FFFFFF) cards floating on `Colors.bg.void` (#F7F7F5) is the canonical
      depth model — no Material-style elevations.

---

## 2. Typography rhythm

- [ ] **One large title per screen.** `Type.title` (32px serif) for the screen
      hero — no more. Repeating large titles flattens hierarchy.
- [ ] **Eyebrows above sections.** `Type.eyebrow` (11px uppercase tracked)
      labels every section like an editorial spread.
- [ ] **Tabular numerals on every metric.** `Type.numHero`, `numLarge`,
      `numMedium`, `numSmall` apply `fontVariant: ['tabular-nums']` so digits
      align in columns — critical for stats screens.
- [ ] **Body text minimum 15pt, line-height 22.** Smaller than that needs
      explicit justification (caption / micro for metadata only).
- [ ] **Letter-spacing negative on large titles** (-0.5 to -0.6) so big
      type doesn't look airy. Already in `Type.title`.

---

## 3. Motion vocabulary

> Motion serves comprehension. If removing an animation doesn't hurt clarity,
> remove it.

- [ ] **Springs from `src/theme/animations.ts`** (`springs.gentle`, `bouncy`,
      `tap`, `enter`, `exit`, `press`, `celebrate`). Never inline numbers.
- [ ] **Asymmetric enter/exit.** Enter is slightly slower (welcoming), exit
      is faster (gets out of the way). The `springs.enter` / `springs.exit`
      presets encode this — use them.
- [ ] **Press feedback on every tappable element.** Default: scale to 0.97 on
      pressIn (`springs.tap`), back to 1 on pressOut (`springs.bouncy`).
- [ ] **Duration budget**: micro 100ms · standard 180-280ms · complex
      layout 480ms MAX. Anything longer feels broken.
- [ ] **No gratuitous motion.** Particle effects, parallax, idle animations
      — only when they help the user understand something. Confetti for PRs
      is justified; confetti for "saved" is noise.
- [ ] **Reduce-motion support.** Wrap entering animations in
      `useReducedMotion()`-aware logic. Reanimated layout animations should
      degrade to fades.

---

## 4. Haptics (the invisible polish)

- [ ] **Selection** (`Haptics.selectionAsync`) for picker / toggle changes.
- [ ] **Impact light** for taps that confirm a small action.
- [ ] **Impact medium** for entering edit mode or opening sheets.
- [ ] **Impact heavy** for completing a workout, hitting a PR — meaningful
      moments only. Overuse devalues every other haptic.
- [ ] **Notification success/warning/error** at celebratory or critical
      moments. PR detected = success. Workout cancelled = warning.

---

## 5. CTAs (copy + behavior)

- [ ] **Verb + value, never just verb.** "Empezar entrenamiento" beats
      "Empezar". "Crear mi bloque" beats "Crear".
- [ ] **First person possessive in user-owned content.** "Mi plan", "Mi
      sistema", "Mi entrenamiento" — never "El plan".
- [ ] **One primary CTA per screen.** Gold fill. Other actions are ghost,
      text-link, or icon-only.
- [ ] **Empty state CTA leads to action immediately.** "Crear mi primer
      bloque" → opens sheet. Not "Tu espacio está vacío" with no path.
- [ ] **Loading states show context.** "Guardando…" beats spinner-only.
      Apple HIG: users wait 3× longer when they see progress.

---

## 6. Empty states (NN/g pattern)

Every empty state must do three things:

- [ ] **Communicate**: explicitly say what's empty and why (not just "no data").
- [ ] **Educate**: a one-line hint about what fills this space.
- [ ] **Offer the action**: a CTA right there to populate it.

❌ "Sin PRs aún"
✅ "Tu primer set se convertirá en tu primer PR. Empieza un entrenamiento ↓"

---

## 7. Accessibility (table stakes)

- [ ] **Touch targets ≥ 44×44pt** (Apple HIG). Use `hitSlop` to enlarge tap
      areas of icon-only buttons without disturbing visual size.
- [ ] **`accessibilityLabel` on every interactive element.** Especially icon
      buttons — VoiceOver reads "boton" otherwise.
- [ ] **`accessibilityRole`** on Pressables (`button`, `link`, `header`).
- [ ] **Dynamic Type respected.** Use Type tokens (not raw `fontSize: 14`)
      so iOS settings scale typography.
- [ ] **Color is not the only signal.** Status badges must have text or
      icons in addition to color — colorblindness affects ~8% of users.

---

## 8. Performance

- [ ] **`React.memo` on row / card components** that render in lists.
- [ ] **`useCallback` for handlers passed as props** to memoized children.
- [ ] **`useMemo` for derived data** that isn't trivial.
- [ ] **`FlatList` over `ScrollView` for >20 items.**
- [ ] **No inline styles in render** when the style depends on state — use
      `useAnimatedStyle` or precomputed style arrays.

---

## 9. Screen-level audit pass

Before declaring a screen "polished":

- [ ] Run `npm run audit:design` — must show 0 new hardcoded colors and 0
      new deprecated-token imports introduced by this screen.
- [ ] Run `npm run typecheck` — clean.
- [ ] Run `npm run lint` — only pre-existing warnings, no new errors.
- [ ] Take screenshots at light + Dynamic Type largest + VoiceOver focus
      ring visible. If any of these look broken, it's not done.
- [ ] **Open the screen on the iPhone 12 Pro device build.** Simulator
      is for development; the device is the truth.

---

## 10. The taste tests

After ticking every box above, the screen still needs to pass three
subjective tests:

1. **The two-second test.** Open the screen. In two seconds, the user
   should know what it's for, where to look first, and what to do next.
2. **The serif test.** The serif numeral / serif title is the brand voice.
   If the screen doesn't use serif anywhere, is it because it shouldn't, or
   because we forgot? (Most screens deserve one serif moment.)
3. **The remove-half test.** Remove half the elements. Is the screen worse?
   If only slightly, the original was over-designed. Premium minimalism is
   ruthless about what earns its place.

---

## References

- `src/theme/tokens.ts` — single source of truth for visual properties.
- `src/theme/animations.ts` — spring + timing presets.
- `CLAUDE.md` § "Styling & Design System" — high-level philosophy.
- Apple Human Interface Guidelines (motion, materials, typography).
- Nielsen Norman Group — empty states, progress indicators, peak-end rule.
- BJ Fogg behavior model — Ability × Motivation × Trigger.
