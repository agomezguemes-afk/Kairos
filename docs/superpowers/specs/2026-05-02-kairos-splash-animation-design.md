# Kairos · Splash Animation Design

**Date:** 2026-05-02
**Status:** Design — pending review
**Owner:** Álvaro
**Scope:** Animated splash sequence (full + condensed), trigger logic, animation primitives, performance gates.

---

## 1 · Vision

Two splash experiences sharing one motion vocabulary:

- **`KairosBootSequence`** — ceremonial, ~7.4s, eight phases. Plays exactly twice in a user's lifetime by default: at first install and on manual replay from About. Tells the brand story (atom → structure → identity → reposo).
- **`SplashCondensed`** — daily, ~3.1s, four phases. Reuses the same primitives, skips the redundant phases. The everyday face of the app.

References absorbed: **Atoms** (single geometric element on a flat color field, total simplicity), **Tiimo** (Apple Design Award 2024 — meditative quietness, single animated element per phase), **Notion** (volumetric isometric cube as identity), **Endel** (asymmetric tempo, slower exhale than inhale).

**Non-negotiables, preserved from `CLAUDE.md`:**
- White background — no dark splash interrupting the white+gold app identity.
- Motion serves comprehension. Every animation earns its place.
- Single accent color, used sparingly. Glow is warm chromatic spread on white, not neon halo.

---

## 2 · Open question — gold value to use

The codebase currently has **two golds in tokens**:

| Token | Value | Notes |
|---|---|---|
| `Colors.accent.primary` | `#C9A96E` | v1 — warmer, editorial |
| `Colors.gold[500]` | `#D4AF37` | v2 — brighter, "Christmas leaf" per visual-refinement spec |

The pending [visual-refinement spec (2026-04-27)](2026-04-27-kairos-visual-refinement-design.md) recommends converging to `#C9A96E`. The user's original splash prompt specified `#D4AF37`.

**Decision for this spec:** use `gold[500]` token (`#D4AF37`) as the variable name. Whichever value the token resolves to at any point in time is what the splash renders. This gives us decoupling: if visual-refinement lands and converges golds to `#C9A96E`, splash follows automatically with no spec change needed.

**Action item:** confirm with Álvaro before implementation. If he wants splash to lock specifically to `#D4AF37` regardless of token evolution, we hardcode the hex. Otherwise we reference the token.

---

## 3 · Architecture

```
src/
├── animations/splash/
│   ├── index.ts                       (barrel export)
│   ├── KairosBootSequence.tsx         (full version, 7.4s, 8 phases)
│   ├── SplashCondensed.tsx            (daily version, 3.1s, 4 phases)
│   ├── primitives/
│   │   ├── GoldSphere.tsx             (animated sphere with breathing)
│   │   ├── GoldBlock.tsx              (cube block, optionally carries a letter path)
│   │   ├── IsoCube.tsx                (3-face isometric cube via SVG paths)
│   │   ├── KairosWordmark.tsx         (six letter paths with stroke-draw)
│   │   └── SoftGlow.tsx               (warm chromatic spread, calibrated for white bg)
│   ├── choreography.ts                (single source of truth for timings/easings)
│   └── useSplashTrigger.ts            (decides full | condensed | skip)
└── screens/SplashScreen.tsx           (refactor: thin router that delegates)
```

### Design decisions

1. **`animations/splash/` as a self-contained module.** Concentrates everything in one cohesive boundary. Migrating to Lottie later (escape hatch) is a swap of the module's internals without touching anything outside.
2. **`choreography.ts` as the timing source of truth.** All delays, durations, springs and easings live in one file — the equivalent of `tokens.ts` for motion. Tweaking the animation = editing one file. This is what enables fast iteration during the 24h checkpoint review (§ 9).
3. **Primitives shared between full and condensed.** The condensed version does not duplicate animation logic — it imports the same primitives and orchestrates fewer phases.
4. **`useSplashTrigger` hook** owns AsyncStorage persistence + replay logic. Single entry point for both the splash itself and any future "Replay intro" surface (About screen).
5. **`SplashScreen.tsx` becomes a thin router.** Decides which version to mount, preserves the existing `onDone` contract with `AppNavigator`. The current implementation moves into `SplashCondensed` (it is essentially the condensed flow already, but more polished).

---

## 4 · Animation primitives

### 4.1 · `GoldSphere`

```ts
interface GoldSphereProps {
  scale: SharedValue<number>;
  opacity: SharedValue<number>;
  glow: SharedValue<number>;        // 0..1 — drives a secondary blurred circle behind
  size?: number;                     // base diameter, default 40
}
```

A `<Circle>` filled `gold[500]` (`#D4AF37`) plus a secondary `<Circle>` underneath at `1.4×` radius, fill `rgba(212,175,55,0.35)`, opacity scaled by `glow`. The secondary circle reads as **warm chromatic spread** on white, not as luminous halo. Calibration: `glow` never exceeds `0.4` to avoid the "blurry / dirty" look on white.

### 4.2 · `GoldBlock`

```ts
interface GoldBlockProps {
  position: { x: SharedValue<number>; y: SharedValue<number> };
  rotation: SharedValue<number>;     // radians
  opacity: SharedValue<number>;
  scale: SharedValue<number>;
  letterPath?: string;               // optional — when present, used by block-stamp morph
  letterRevealProgress?: SharedValue<number>;  // 0 = block visible, 1 = letter visible
  size?: number;                     // base side, default 18
}
```

A rounded rectangle (`rx=2` for premium feel, not raw square). When `letterPath` is provided, the block also renders an `<AnimatedPath>` for that letter, controlled by `letterRevealProgress`.

### 4.3 · `IsoCube`

A 3D-looking isometric cube built with **three SVG paths** — top face, left face, right face — each filled with a different gold tone for volume:

| Face | Fill |
|---|---|
| Top | `gold[300]` (`#E8D48B`) |
| Left | `gold[500]` (`#D4AF37`) |
| Right | `gold[700]` (`#B8960F`) |

This produces a Notion-style volumetric cube with no 3D library. Phase-4 rotation is a 2D rotation of the SVG group (not real 3D rotation) — visually identical at this scale.

### 4.4 · `KairosWordmark`

Six SVG paths — one per letter `K A I R O S` — in geometric sans-serif weight 300, uppercase. Two reveal techniques combined:

1. **Stroke-draw progressive** via `strokeDasharray` + animated `strokeDashoffset` (same proven technique as the existing `AnimatedKairosLogo`).
2. **Fill-fade** after stroke completes — `fill-opacity` 0 → 1 in 200ms.

### 4.5 · `SoftGlow`

Wrapper that places a blurred `<Circle>` behind any element. On white background the glow is **chromatic warm spread**, not luminous halo — opacity capped at 35%.

### 4.6 · The block-stamp morph technique (cube → letters)

This is the central technique enabling cube → KAIROS without Rive. The same family of transitions — shared-center crossfade with simultaneous scale — appears throughout Apple's own UI (icon morphs, control state changes); whether their internal implementation matches ours exactly is unknown, but the visual idiom is established and reads as professional. Mechanism:

1. When the cube divides into 6 blocks (phase 5), each block already carries its target letter as a `letterPath` prop.
2. The 6 blocks position themselves at the X coordinates of their final letters in the wordmark, Y at vertical centerline.
3. Phase 6 begins — **simultaneously in each block**, with 100ms stagger:
   - Block square: `scale 1 → 1.6`, `opacity 1 → 0` (expanding fade-out)
   - Letter inside: `strokeDashoffset full → 0` (stroke-draw)
   - Letter inside: `scale 0.7 → 1.0` (grows from block center)
4. Center of mass is preserved — the eye reads **transformation**, not crossfade.

Why this is correct, not a workaround: true vertex-by-vertex morph between a square (4 points) and a letter glyph (variable points, often 30+) requires either (a) artificially inflating the square's vertex count or (b) using path interpolation libraries that produce visible artifacts at intermediate frames. Block-stamp avoids both by leveraging the brain's preference for shared-center transformations. Even Rive uses crossfade-with-shared-center for cases like this where vertex morph would degrade.

---

## 5 · Choreography — full sequence (`KairosBootSequence`)

### 5.1 · Easing constants

```ts
// choreography.ts
export const EASE = {
  primary:    Easing.bezier(0.25, 0.1, 0.15, 1.0),
  decelerate: Easing.out(Easing.cubic),
  accelerate: Easing.in(Easing.cubic),
  spring:     { stiffness: 120, damping: 14, mass: 1 },
};
```

### 5.2 · Phase table

| Phase | Time | Duration | What happens | Easing |
|---|---|---|---|---|
| **1. Origin** | 0–600ms | 600 | `GoldSphere` appears at center: `opacity 0→1`, `scale 0.7→1.0`. Glow rises to 0.4 in last 200ms. **Haptic: `Haptics.selectionAsync()` at frame 0** | `decelerate` |
| (contemplative pause) | 600–700ms | 100 | Sphere static, micro-breathing | — |
| **2. Emission** | 700–1500ms | 800 | 3 `GoldBlock`s emit from sphere center at angles `10°, 135°, 250°`, distance ~120pt. Stagger 80ms between blocks. Each block has subtle ±18° rotation. Sphere glow falls to 0 | `spring` |
| **3. Return** | 1500–2200ms | 700 | The 3 blocks return to center with acceleration. Converge simultaneously | `accelerate` |
| **4. Cube morph** | 2200–2900ms | 700 | Sphere (`opacity 1→0`, `scale 1→0.5`) + 3 blocks (`opacity 1→0`, position → center) crossfade with `IsoCube` (`scale 0.7→1.0`, `rotation 0→15°`, `opacity 0→1`). **Haptic: `impactAsync(Medium)` at t=2400ms** | `primary` |
| (isometric reposo) | 2900–3000ms | 100 | Cube static with micro-breathing (±0.5% scale) | — |
| **5. Chained division** | 3000–4000ms | 1000 | Cube decomposes into 6 `GoldBlock`s, each carrying its target letter path. Stagger 120ms. Final positions: 6 horizontal points spaced like the wordmark. Subtle bounce on arrival | `spring` |
| **6. Mutation to "KAIROS"** | 4000–5200ms | 1200 | Block-stamp morph (technique detailed in §4.6) in each block, stagger 100ms. Block: `scale 1→1.6`, `opacity 1→0`. Letter: `strokeDashoffset full→0`, `scale 0.7→1.0`, `opacity 0→1`. **Haptic: `Haptics.selectionAsync()` at t=5000ms (S completes)** | `primary` |
| **7. Final state** | 5200–6400ms | 1200 | "KAIROS" complete. Soft glow rises and falls behind letters (`opacity 0→0.35→0` arc). Contemplative pause | `inOut(ease)` |
| **8. Reverse** | 6400–7400ms | 1000 | Letters → 6 blocks (block-stamp inverse, stagger 60ms) → collapse to 3 blocks in isometric formation → background `opacity 1→0` ceding to HomeScreen. Tempo ~10% slower than forward (meditative exhale) | `accelerate` |

**Total: 7400ms** (precise — not "approximately 7.5s").

### 5.3 · Craft details that distinguish pro from amateur

1. **Stagger never uniform** — division uses 120ms, mutation uses 100ms, reverse uses 60ms. Variation breaks robotic feel.
2. **Haptics on 3 key beats** (origin, cube formation, wordmark complete) — body+screen synchronization elevates perceived quality at a level the user cannot consciously name.
3. **Persistent micro-breathing** (±0.5% scale) during static states (phase 1 pause, phase 4 reposo, phase 7 final) — without this the animation feels "dead" between phases.
4. **Glow capped at 35% opacity** — on white, this avoids the "blurry / dirty" look that higher opacity produces.
5. **Asymmetric tempo forward vs reverse** — phase 8 is 10% slower than its forward equivalent. This is the Endel/Tiimo signature of "meditative exhale".

---

## 6 · Choreography — condensed (`SplashCondensed`)

Reuses primitives, skips redundant phases.

| Phase | Time | Duration | What happens |
|---|---|---|---|
| 1. Origin | 0–500ms | 500 | Sphere appears (faster than full) |
| 2. Compressed emit + return | 500–1300ms | 800 | 3 blocks emit and return in a single brief arc, no contemplative pause |
| 6. Mutation to "KAIROS" | 1300–2400ms | 1100 | Direct crossfade to wordmark via block-stamp (skips cube + division phases) |
| 7. Brief final state | 2400–2900ms | 500 | Wordmark with subtle glow |
| Exit | 2900–3100ms | 200 | Fade-out hands off to app |

**Total: 3100ms** (vs 2500ms for current splash — +600ms justified by significantly richer animation).

---

## 7 · Trigger logic and persistence

### 7.1 · Hook contract

```ts
// useSplashTrigger.ts
type SplashMode = 'full' | 'condensed' | 'skip';

interface SplashTriggerResult {
  mode: SplashMode;
  markCompleted: () => Promise<void>;  // called at end of full sequence
  replayBoot: () => void;              // exposed to About screen
}
```

### 7.2 · Decision logic

```
1. Read AsyncStorage key 'kairos.splash.bootSeen'
2. If NOT present                    → mode = 'full'
3. If present                        → mode = 'condensed'
4. If replayBoot() was called this session → mode = 'full' (forced)
```

### 7.3 · Storage format

```ts
const STORAGE_KEY = 'kairos.splash.bootSeen';
const STORAGE_VALUE = JSON.stringify({ version: 1, seenAt: '<ISO timestamp>' });
```

Versioned so a future redesign can compare `version` and force-replay on existing installs.

### 7.4 · Integration

```
AppNavigator
  └─ if showSplash:
       SplashScreen
         ├─ const { mode } = useSplashTrigger()
         ├─ if mode === 'full':      <KairosBootSequence onDone={...} />
         └─ if mode === 'condensed': <SplashCondensed onDone={...} />
       (then: app)
```

`onDone` fires `markCompleted()` (only if mode was full) and then the navigator's hide callback.

### 7.5 · Replay surface

`replayBoot()` is exposed but **not consumed in this sprint** — the About screen does not exist yet (per roadmap). Once it lands, wiring is a single import.

### 7.6 · Edge cases

| Edge case | Behavior |
|---|---|
| AsyncStorage read fails (corrupted/full storage) | Treat as "first time" → show full. Better than crashing. |
| User force-quits during phase 7 of full sequence | Flag NOT written. Next launch shows full again. **Decision per Álvaro:** acceptable — user did not complete the ceremony. |
| App reinstalled | AsyncStorage clears → mode = 'full'. Coherent: new install = new "first launch". |
| Replay from About during a session | In-memory state only, AsyncStorage untouched. Next natural open is condensed again. |

---

## 8 · Performance targets

| Metric | Target | Verification |
|---|---|---|
| FPS sustained | 60 across all phases | RN Performance Monitor on device + Reanimated DevTools |
| Frame drops | 0 during transition phases (4, 6, 8) | Visual inspection on device, slow-mo recording if needed |
| Time-to-interactive | ≤ 100ms from `onDone` to first tap response | Manual stopwatch on device |
| Memory delta | < 5MB during splash | Xcode memory profiler |

All animations run on the UI thread via Reanimated worklets. JavaScript bridge contention does not affect the splash — this is what makes 60fps achievable on iPhone 12 Pro.

---

## 9 · Quality gates and the 24h checkpoint

The non-negotiable validation step. After first working implementation:

1. **Release build on iPhone 12 Pro** using the existing `xcodebuild` chain in `CLAUDE.md`.
2. **Screen recording at 60fps** of both versions (full + condensed) from the device.
3. **Side-by-side comparison** with reference apps Álvaro provides (Atoms, Tiimo, Notion captures).
4. **Binary decision by Álvaro:**
   - **Yes, ships** → continue refining timings in production.
   - **No, does not reach the level** → migrate the module's internals to **Lottie** (`lottie-react-native`). The component API stays identical; only the engine swaps. Lottie `.json` authored in After Effects or Rive editor (escape hatch from the start).

### 9.1 · Expected polish iterations (2–3 cycles)

Likely tweaks before the splash feels final, all isolated to `choreography.ts`:

- Letter stagger 100ms may feel robotic → drop to 80ms or vary 70/90/100/110/130/150
- Spring stiffness 120 may feel rigid → drop to 90–100
- Glow at 35% on device may read "dirty" → tune to 25–30%
- Final state 1.2s pause may feel long → 0.9s

These are hours, not days. Architecture is built so a single value change in `choreography.ts` is sufficient.

---

## 10 · Testing strategy

Honest assessment: Reanimated does not have good unit-test workflow for animations. What we will do:

1. **Unit tests for `useSplashTrigger`** — AsyncStorage interaction, replay state, version handling.
2. **Snapshot tests for primitive components in static states** — initial and final frames of each phase. Catches layout regressions, not motion regressions.
3. **Structured manual test on device** — checklist verifying primitives mount, timings respect `choreography.ts`, no visible frame drops.

We do not promise E2E animation tests. The human eye is the only valid validator for splash quality.

---

## 11 · Honest risk assessment

1. **`react-native-svg` performance on dense paths** — letter glyphs of KAIROS could cause drops if the path has too many control points. **Mitigation:** simplify paths preserving form. Improbable but possible.
2. **AsyncStorage read latency on cold start** — if reading the flag takes >50ms, full splash could play unnecessarily on first warm open. **Mitigation:** read flag during phase 1 (the first 600ms); if not arrived in time, assume "already seen".
3. **Bundle memory** — ~3-5KB added (6 letter paths + 3 cube paths). Negligible.

---

## 12 · Out of scope for this spec

- About screen / Settings → Replay intro (separate spec; the hook is exposed but not consumed).
- Dark mode variant of the splash (current app is light-only per visual-refinement spec).
- Sound design (Kairos has no audio system yet).
- Skip-on-tap gesture (could be added later; current decision is full sequence is uninterruptible to preserve ceremony).
- Migration of the existing `AnimatedKairosLogo.tsx` (kept as-is for non-splash uses; not deprecated).

---

## 13 · Summary

| Aspect | Decision |
|---|---|
| Theme | White background, gold (`gold[500]` token), warm chromatic glow |
| Scope | Bifurcated: `KairosBootSequence` 7.4s + `SplashCondensed` 3.1s |
| Tech | `react-native-reanimated` + `react-native-svg`, Lottie as escape hatch |
| Trigger | Full on first install + replay from About; condensed otherwise |
| Architecture | `src/animations/splash/` module with shared primitives |
| Cube → letters | Block-stamp morph (Apple-style shared-center transformation) |
| Quality gate | 24h device checkpoint with binary go/Lottie decision |
| Testing | Hook unit tests + snapshot tests on static states + structured device checklist |

---

**Implementation plan to follow** in a separate document via `superpowers:writing-plans` after this spec is approved.
