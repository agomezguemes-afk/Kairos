# Kairos Splash Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a bifurcated animated splash screen — `KairosBootSequence` (~7.4s, 8 phases, ceremonial first-install) and `SplashCondensed` (~3.1s, 4 phases, daily) — sharing animation primitives.

**Architecture:** Self-contained `src/animations/splash/` module. Five primitive components (`GoldSphere`, `GoldBlock`, `IsoCube`, `KairosWordmark`, `SoftGlow`) orchestrated by two composers. Single `choreography.ts` as timing source of truth. `useSplashTrigger` hook owns AsyncStorage flag for full-vs-condensed decision.

**Tech Stack:** `react-native-reanimated` (existing), `react-native-svg` (existing), `expo-haptics` (existing), `@react-native-async-storage/async-storage` (existing). Zero new dependencies.

---

## Pre-flight notes

- **Verification per task:** `npx tsc --noEmit` (no Jest configured per `CLAUDE.md`). Visual validation deferred to the §9 24h checkpoint in the spec.
- **AsyncStorage key naming:** spec said `kairos.splash.bootSeen`; aligning to the existing project convention (`kairos_blocks_v1` in `workoutStore.ts`), this plan uses `kairos_splash_boot_v1`.
- **Letter rendering decision:** spec mentioned stroke-draw on letter paths. Implementation switches to `react-native-svg`'s `<Text>` element with system font weight 300 — gives real typographic correctness, eliminates hand-authored path data, and the block-stamp morph still reads as transformation via scale+opacity. Stroke-draw remains for geometric primitives (cube edges, sphere ring). This is a small craft refinement from the spec, not a deviation from intent.
- **Working branch:** `feat/canvas` (current). Each task commits atomically — bisectable.

---

## File map

```
src/animations/splash/
├── index.ts                          [Task 1]
├── choreography.ts                   [Task 2]
├── primitives/
│   ├── index.ts                      [Task 1]
│   ├── SoftGlow.tsx                  [Task 3]
│   ├── GoldSphere.tsx                [Task 4]
│   ├── GoldBlock.tsx                 [Task 5]
│   ├── IsoCube.tsx                   [Task 6]
│   └── KairosWordmark.tsx            [Task 7]
├── useSplashTrigger.ts               [Task 8]
├── SplashCondensed.tsx               [Task 9]
└── KairosBootSequence.tsx            [Task 10]

src/screens/SplashScreen.tsx          [Task 11 — refactor as router]
docs/superpowers/checklists/
└── 2026-05-02-splash-device-verification.md  [Task 12]
```

---

## Task 1: Module skeleton

**Files:**
- Create: `src/animations/splash/index.ts`
- Create: `src/animations/splash/primitives/index.ts`

- [ ] **Step 1: Create the splash module barrel**

```ts
// src/animations/splash/index.ts
export { default as KairosBootSequence } from './KairosBootSequence';
export { default as SplashCondensed } from './SplashCondensed';
export { useSplashTrigger } from './useSplashTrigger';
export type { SplashMode } from './useSplashTrigger';
```

- [ ] **Step 2: Create the primitives barrel**

```ts
// src/animations/splash/primitives/index.ts
export { default as SoftGlow } from './SoftGlow';
export { default as GoldSphere } from './GoldSphere';
export { default as GoldBlock } from './GoldBlock';
export { default as IsoCube } from './IsoCube';
export { default as KairosWordmark } from './KairosWordmark';
```

- [ ] **Step 3: Run type-check**

Run: `npx tsc --noEmit`
Expected: errors about missing modules (`./KairosBootSequence`, etc.) — confirms the barrels are pointing to the right names. We will resolve them as each task lands.

- [ ] **Step 4: Commit**

```bash
git add src/animations/splash/index.ts src/animations/splash/primitives/index.ts
git commit -m "feat(splash): module skeleton and barrel exports"
```

---

## Task 2: Choreography file (timings, easings)

**Files:**
- Create: `src/animations/splash/choreography.ts`

- [ ] **Step 1: Create the choreography source-of-truth**

```ts
// src/animations/splash/choreography.ts
import { Easing } from 'react-native-reanimated';

/**
 * Single source of truth for splash animation timings, easings, and motion constants.
 * Tweaking the splash should never require touching anything else.
 */

// ── Easing primitives ────────────────────────────────────────────────────────
export const EASE = {
  primary:    Easing.bezier(0.25, 0.1, 0.15, 1.0),
  decelerate: Easing.out(Easing.cubic),
  accelerate: Easing.in(Easing.cubic),
  meditative: Easing.inOut(Easing.ease),
} as const;

export const SPRING = {
  block:   { stiffness: 120, damping: 14, mass: 1 },
  bounce:  { stiffness: 180, damping: 10, mass: 0.8 },
} as const;

// ── Full sequence (KairosBootSequence) — 7400ms total ───────────────────────
export const FULL = {
  total: 7400,

  origin:        { start: 0,    duration: 600,  pause: 100 },
  emission:      { start: 700,  duration: 800,  staggerMs: 80,  angles: [10, 135, 250], distance: 120, blockRotation: 18 },
  return:        { start: 1500, duration: 700 },
  cubeMorph:     { start: 2200, duration: 700,  pause: 100, rotation: 15 },
  division:      { start: 3000, duration: 1000, staggerMs: 120 },
  mutation:      { start: 4000, duration: 1200, staggerMs: 100 },
  finalState:    { start: 5200, duration: 1200 },
  reverse:       { start: 6400, duration: 1000, staggerMs: 60 },

  hapticBeats: [0, 2400, 5000] as const,  // origin, cube formation, wordmark complete
} as const;

// ── Condensed sequence (SplashCondensed) — 3100ms total ─────────────────────
export const CONDENSED = {
  total: 3100,

  origin:        { start: 0,    duration: 500 },
  compressedArc: { start: 500,  duration: 800,  staggerMs: 60 },
  mutation:      { start: 1300, duration: 1100, staggerMs: 80 },
  finalState:    { start: 2400, duration: 500 },
  exit:          { start: 2900, duration: 200 },

  hapticBeats: [0, 2200] as const,
} as const;

// ── Visual constants ────────────────────────────────────────────────────────
export const VISUAL = {
  sphereSize: 40,
  blockSize:  18,
  cubeSize:   56,

  glowMaxOpacity:    0.35,
  breathScaleDelta:  0.005,  // ±0.5% during static states
  breathDuration:    3000,

  wordmarkSpacing: 36,  // px between letter centers
  letterFontSize:  44,  // for KairosWordmark <Text>
} as const;

// ── Storage ─────────────────────────────────────────────────────────────────
export const STORAGE_KEY    = 'kairos_splash_boot_v1';
export const STORAGE_VERSION = 1;
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit`
Expected: no new errors introduced by `choreography.ts` (only the previous barrel-related ones remain).

- [ ] **Step 3: Commit**

```bash
git add src/animations/splash/choreography.ts
git commit -m "feat(splash): choreography constants — timings, easings, visual tokens"
```

---

## Task 3: `SoftGlow` primitive

**Files:**
- Create: `src/animations/splash/primitives/SoftGlow.tsx`

- [ ] **Step 1: Implement the warm chromatic glow**

```tsx
// src/animations/splash/primitives/SoftGlow.tsx
import React from 'react';
import Animated, {
  SharedValue,
  useAnimatedProps,
} from 'react-native-reanimated';
import { Circle } from 'react-native-svg';

import { VISUAL } from '../choreography';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface SoftGlowProps {
  cx: number;
  cy: number;
  baseRadius: number;
  intensity: SharedValue<number>;  // 0..1; capped at VISUAL.glowMaxOpacity
  color?: string;                  // default: warm gold rgba
}

/**
 * Warm chromatic spread for the white-bg splash.
 * NOT a luminous halo — a soft, blurred-feeling stain that capped at 35% opacity
 * to avoid the "dirty / blurry" look on white.
 */
export default function SoftGlow({
  cx,
  cy,
  baseRadius,
  intensity,
  color = 'rgba(212,175,55,0.35)',
}: SoftGlowProps) {
  const animatedProps = useAnimatedProps(() => {
    const i = Math.min(intensity.value, 1);
    return {
      r: baseRadius * (1 + i * 0.4),
      opacity: i * VISUAL.glowMaxOpacity,
    };
  });

  return (
    <AnimatedCircle
      cx={cx}
      cy={cy}
      fill={color}
      animatedProps={animatedProps}
    />
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: errors about other primitive barrels (`./GoldSphere`, etc.) but `SoftGlow.tsx` itself reports no errors.

- [ ] **Step 3: Commit**

```bash
git add src/animations/splash/primitives/SoftGlow.tsx
git commit -m "feat(splash): SoftGlow primitive — warm chromatic spread for white bg"
```

---

## Task 4: `GoldSphere` primitive

**Files:**
- Create: `src/animations/splash/primitives/GoldSphere.tsx`

- [ ] **Step 1: Implement the sphere with breathing**

```tsx
// src/animations/splash/primitives/GoldSphere.tsx
import React from 'react';
import Animated, {
  SharedValue,
  useAnimatedProps,
} from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';

import { VISUAL } from '../choreography';
import SoftGlow from './SoftGlow';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

export interface GoldSphereProps {
  cx: number;
  cy: number;
  scale: SharedValue<number>;       // overall scale 0..1.5
  opacity: SharedValue<number>;     // 0..1
  glow: SharedValue<number>;        // 0..1
  color?: string;                   // defaults to gold[500]
  size?: number;                    // base diameter, default VISUAL.sphereSize
}

export default function GoldSphere({
  cx,
  cy,
  scale,
  opacity,
  glow,
  color = '#D4AF37',
  size = VISUAL.sphereSize,
}: GoldSphereProps) {
  const r = size / 2;

  const groupProps = useAnimatedProps(() => ({
    opacity: opacity.value,
    transform: `translate(${cx}, ${cy}) scale(${scale.value}) translate(${-cx}, ${-cy})`,
  }));

  return (
    <AnimatedG animatedProps={groupProps}>
      <SoftGlow cx={cx} cy={cy} baseRadius={r * 1.4} intensity={glow} />
      <Circle cx={cx} cy={cy} r={r} fill={color} />
    </AnimatedG>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: only previously-known barrel errors.

- [ ] **Step 3: Commit**

```bash
git add src/animations/splash/primitives/GoldSphere.tsx
git commit -m "feat(splash): GoldSphere primitive with composable glow"
```

---

## Task 5: `GoldBlock` primitive

**Files:**
- Create: `src/animations/splash/primitives/GoldBlock.tsx`

- [ ] **Step 1: Implement the block with optional letter overlay**

```tsx
// src/animations/splash/primitives/GoldBlock.tsx
import React from 'react';
import Animated, {
  SharedValue,
  useAnimatedProps,
} from 'react-native-reanimated';
import { G, Rect, Text } from 'react-native-svg';

import { VISUAL } from '../choreography';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedText = Animated.createAnimatedComponent(Text);

export interface GoldBlockProps {
  /** Position of the block's CENTER. */
  x: SharedValue<number>;
  y: SharedValue<number>;
  rotation: SharedValue<number>;     // radians
  opacity: SharedValue<number>;
  scale: SharedValue<number>;
  /** When provided, this letter is rendered overlaid; controlled by reveal. */
  letter?: string;
  /** 0 = block visible, letter hidden. 1 = block hidden, letter visible. */
  letterReveal?: SharedValue<number>;
  size?: number;                     // default VISUAL.blockSize
  color?: string;                    // default gold[500]
}

export default function GoldBlock({
  x,
  y,
  rotation,
  opacity,
  scale,
  letter,
  letterReveal,
  size = VISUAL.blockSize,
  color = '#D4AF37',
}: GoldBlockProps) {
  const half = size / 2;

  const groupProps = useAnimatedProps(() => {
    const cx = x.value;
    const cy = y.value;
    const deg = (rotation.value * 180) / Math.PI;
    return {
      opacity: opacity.value,
      transform: `translate(${cx}, ${cy}) rotate(${deg}) scale(${scale.value}) translate(${-cx}, ${-cy})`,
    };
  });

  const blockProps = useAnimatedProps(() => ({
    opacity: letterReveal ? 1 - letterReveal.value : 1,
  }));

  const textProps = useAnimatedProps(() => {
    if (!letterReveal) return { opacity: 0 };
    const r = letterReveal.value;
    return { opacity: r };
  });

  // Letter scale animates 0.7 → 1.0 as reveal goes 0 → 1
  const textGroupProps = useAnimatedProps(() => {
    const r = letterReveal ? letterReveal.value : 0;
    const s = 0.7 + r * 0.3;
    const cx = x.value;
    const cy = y.value;
    return {
      transform: `translate(${cx}, ${cy}) scale(${s}) translate(${-cx}, ${-cy})`,
    };
  });

  return (
    <AnimatedG animatedProps={groupProps}>
      <AnimatedRect
        x={-half}
        y={-half}
        width={size}
        height={size}
        rx={2}
        fill={color}
        animatedProps={blockProps}
        transform={`translate(0, 0)`}
      />
      {letter && (
        <AnimatedG animatedProps={textGroupProps}>
          <AnimatedText
            x={0}
            y={0}
            fontSize={VISUAL.letterFontSize}
            fontWeight="300"
            fill={color}
            textAnchor="middle"
            alignmentBaseline="central"
            animatedProps={textProps}
          >
            {letter}
          </AnimatedText>
        </AnimatedG>
      )}
    </AnimatedG>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors in `GoldBlock.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/animations/splash/primitives/GoldBlock.tsx
git commit -m "feat(splash): GoldBlock primitive with block-stamp letter morph"
```

---

## Task 6: `IsoCube` primitive

**Files:**
- Create: `src/animations/splash/primitives/IsoCube.tsx`

- [ ] **Step 1: Implement the 3-face isometric cube**

```tsx
// src/animations/splash/primitives/IsoCube.tsx
import React from 'react';
import Animated, {
  SharedValue,
  useAnimatedProps,
} from 'react-native-reanimated';
import { G, Path } from 'react-native-svg';

import { VISUAL } from '../choreography';

const AnimatedG = Animated.createAnimatedComponent(G);

export interface IsoCubeProps {
  cx: number;
  cy: number;
  scale: SharedValue<number>;
  rotation: SharedValue<number>;   // radians (2D rotation of the group)
  opacity: SharedValue<number>;
  size?: number;                   // default VISUAL.cubeSize
}

/**
 * Volumetric isometric cube built from 3 SVG <Path> faces, each in a different
 * gold tone for depth. NOT a real 3D rotation — group rotates as 2D, which reads
 * identical at this scale on a static-camera splash.
 */
export default function IsoCube({
  cx,
  cy,
  scale,
  rotation,
  opacity,
  size = VISUAL.cubeSize,
}: IsoCubeProps) {
  // Build the three face paths centered at (0,0); we transform via the group.
  // Iso projection: x' = (x - z) * cos(30°), y' = y + (x + z) * sin(30°)
  const s = size / 2;
  const cos30 = Math.cos(Math.PI / 6); // ≈ 0.866
  const sin30 = 0.5;

  // Top face (rhombus): four points {top, right, bottom, left} in iso
  const topPath = `
    M ${0},${-s}
    L ${s * cos30},${-s + s * sin30}
    L ${0},${0}
    L ${-s * cos30},${-s + s * sin30}
    Z
  `.trim();

  // Left face: top-left, bottom-left, bottom-mid, mid
  const leftPath = `
    M ${-s * cos30},${-s + s * sin30}
    L ${-s * cos30},${s * sin30}
    L ${0},${s}
    L ${0},${0}
    Z
  `.trim();

  // Right face: top-right, mid, bottom-mid, bottom-right
  const rightPath = `
    M ${s * cos30},${-s + s * sin30}
    L ${0},${0}
    L ${0},${s}
    L ${s * cos30},${s * sin30}
    Z
  `.trim();

  const groupProps = useAnimatedProps(() => {
    const deg = (rotation.value * 180) / Math.PI;
    return {
      opacity: opacity.value,
      transform: `translate(${cx}, ${cy}) rotate(${deg}) scale(${scale.value})`,
    };
  });

  return (
    <AnimatedG animatedProps={groupProps}>
      <Path d={topPath}   fill="#E8D48B" />
      <Path d={leftPath}  fill="#D4AF37" />
      <Path d={rightPath} fill="#B8960F" />
    </AnimatedG>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors in `IsoCube.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/animations/splash/primitives/IsoCube.tsx
git commit -m "feat(splash): IsoCube primitive — 3-face volumetric cube via SVG paths"
```

---

## Task 7: `KairosWordmark` primitive

**Files:**
- Create: `src/animations/splash/primitives/KairosWordmark.tsx`

- [ ] **Step 1: Implement the wordmark with per-letter reveal**

```tsx
// src/animations/splash/primitives/KairosWordmark.tsx
import React from 'react';
import Animated, {
  SharedValue,
  useAnimatedProps,
} from 'react-native-reanimated';
import Svg, { G, Text } from 'react-native-svg';

import { VISUAL } from '../choreography';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedText = Animated.createAnimatedComponent(Text);

const LETTERS = ['K', 'A', 'I', 'R', 'O', 'S'] as const;

export interface KairosWordmarkProps {
  cx: number;
  cy: number;
  /** One per letter, length must equal 6. Each value 0..1 controls reveal of that letter. */
  letterReveals: SharedValue<number>[];
  /** Group-level scale and opacity (used for final-state breathing + exit). */
  scale: SharedValue<number>;
  opacity: SharedValue<number>;
  color?: string;
  fontSize?: number;
}

/**
 * Six letters as <Text> elements positioned along a horizontal baseline.
 * Per-letter reveal controlled externally so the parent composer can stagger.
 */
export default function KairosWordmark({
  cx,
  cy,
  letterReveals,
  scale,
  opacity,
  color = '#D4AF37',
  fontSize = VISUAL.letterFontSize,
}: KairosWordmarkProps) {
  if (letterReveals.length !== 6) {
    throw new Error('KairosWordmark requires exactly 6 letterReveals');
  }

  const totalWidth = (LETTERS.length - 1) * VISUAL.wordmarkSpacing;
  const startX = cx - totalWidth / 2;

  const groupProps = useAnimatedProps(() => ({
    opacity: opacity.value,
    transform: `translate(${cx}, ${cy}) scale(${scale.value}) translate(${-cx}, ${-cy})`,
  }));

  return (
    <AnimatedG animatedProps={groupProps}>
      {LETTERS.map((letter, i) => (
        <LetterAt
          key={letter}
          letter={letter}
          x={startX + i * VISUAL.wordmarkSpacing}
          y={cy}
          reveal={letterReveals[i]}
          color={color}
          fontSize={fontSize}
        />
      ))}
    </AnimatedG>
  );
}

interface LetterAtProps {
  letter: string;
  x: number;
  y: number;
  reveal: SharedValue<number>;
  color: string;
  fontSize: number;
}

function LetterAt({ letter, x, y, reveal, color, fontSize }: LetterAtProps) {
  const textProps = useAnimatedProps(() => ({
    opacity: reveal.value,
  }));

  const groupProps = useAnimatedProps(() => {
    const s = 0.7 + reveal.value * 0.3;
    return {
      transform: `translate(${x}, ${y}) scale(${s}) translate(${-x}, ${-y})`,
    };
  });

  return (
    <AnimatedG animatedProps={groupProps}>
      <AnimatedText
        x={x}
        y={y}
        fontSize={fontSize}
        fontWeight="300"
        fill={color}
        textAnchor="middle"
        alignmentBaseline="central"
        animatedProps={textProps}
      >
        {letter}
      </AnimatedText>
    </AnimatedG>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors in `KairosWordmark.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/animations/splash/primitives/KairosWordmark.tsx
git commit -m "feat(splash): KairosWordmark primitive — per-letter staggered reveal"
```

---

## Task 8: `useSplashTrigger` hook

**Files:**
- Create: `src/animations/splash/useSplashTrigger.ts`

- [ ] **Step 1: Implement the trigger logic**

```ts
// src/animations/splash/useSplashTrigger.ts
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEY, STORAGE_VERSION } from './choreography';

export type SplashMode = 'full' | 'condensed' | 'loading';

interface StoredFlag {
  version: number;
  seenAt: string;
}

export interface SplashTriggerResult {
  mode: SplashMode;
  markCompleted: () => Promise<void>;
  replayBoot: () => void;
}

let pendingReplay = false;  // module-scoped — survives re-mount within session

export function useSplashTrigger(): SplashTriggerResult {
  const [mode, setMode] = useState<SplashMode>('loading');

  useEffect(() => {
    let cancelled = false;

    async function decide() {
      if (pendingReplay) {
        pendingReplay = false;
        if (!cancelled) setMode('full');
        return;
      }

      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;

        if (!raw) {
          setMode('full');
          return;
        }

        const parsed = JSON.parse(raw) as StoredFlag;
        if (parsed?.version === STORAGE_VERSION) {
          setMode('condensed');
        } else {
          // version mismatch — treat as never-seen so user can re-experience the
          // refreshed boot sequence
          setMode('full');
        }
      } catch {
        // corrupted / storage failure — treat as never-seen.
        // Better than crashing.
        if (!cancelled) setMode('full');
      }
    }

    decide();
    return () => {
      cancelled = true;
    };
  }, []);

  const markCompleted = useCallback(async () => {
    try {
      const value: StoredFlag = {
        version: STORAGE_VERSION,
        seenAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // silent fail — worst case: full sequence plays again next launch
    }
  }, []);

  const replayBoot = useCallback(() => {
    pendingReplay = true;
  }, []);

  return { mode, markCompleted, replayBoot };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors in `useSplashTrigger.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/animations/splash/useSplashTrigger.ts
git commit -m "feat(splash): useSplashTrigger hook — async storage-backed mode resolution"
```

---

## Task 9: `SplashCondensed` composer

**Files:**
- Create: `src/animations/splash/SplashCondensed.tsx`

- [ ] **Step 1: Implement the 4-phase daily splash**

```tsx
// src/animations/splash/SplashCondensed.tsx
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { CONDENSED, EASE, VISUAL } from './choreography';
import { GoldSphere, KairosWordmark } from './primitives';

const SVG_SIZE = 400;
const CENTER = SVG_SIZE / 2;

interface SplashCondensedProps {
  onDone: () => void;
}

export default function SplashCondensed({ onDone }: SplashCondensedProps) {
  // root
  const rootOpacity = useSharedValue(1);

  // sphere
  const sphereScale = useSharedValue(0.7);
  const sphereOpacity = useSharedValue(0);
  const sphereGlow = useSharedValue(0);

  // wordmark group
  const wordmarkScale = useSharedValue(1.0);
  const wordmarkOpacity = useSharedValue(0);

  // per-letter reveal
  const r0 = useSharedValue(0);
  const r1 = useSharedValue(0);
  const r2 = useSharedValue(0);
  const r3 = useSharedValue(0);
  const r4 = useSharedValue(0);
  const r5 = useSharedValue(0);
  const reveals = [r0, r1, r2, r3, r4, r5];

  useEffect(() => {
    // ── Phase 1: Origin ───────────────────────────────────────────────
    Haptics.selectionAsync().catch(() => {});
    sphereOpacity.value = withTiming(1, { duration: CONDENSED.origin.duration, easing: EASE.decelerate });
    sphereScale.value = withTiming(1.0, { duration: CONDENSED.origin.duration, easing: EASE.decelerate });
    sphereGlow.value = withDelay(
      CONDENSED.origin.duration - 200,
      withTiming(0.4, { duration: 200, easing: EASE.decelerate }),
    );

    // ── Phase 2: Compressed arc — sphere fades while wordmark begins ──
    sphereGlow.value = withDelay(
      CONDENSED.compressedArc.start,
      withTiming(0, { duration: CONDENSED.compressedArc.duration / 2, easing: EASE.accelerate }),
    );
    sphereOpacity.value = withDelay(
      CONDENSED.compressedArc.start + 400,
      withTiming(0, { duration: 400, easing: EASE.accelerate }),
    );
    sphereScale.value = withDelay(
      CONDENSED.compressedArc.start + 400,
      withTiming(0.5, { duration: 400, easing: EASE.accelerate }),
    );

    // ── Phase 3: Mutation — wordmark group fades in, letters stagger ──
    wordmarkOpacity.value = withDelay(
      CONDENSED.mutation.start,
      withTiming(1, { duration: 400, easing: EASE.primary }),
    );

    reveals.forEach((reveal, i) => {
      reveal.value = withDelay(
        CONDENSED.mutation.start + i * CONDENSED.mutation.staggerMs,
        withTiming(1, { duration: 600, easing: EASE.primary }),
      );
    });

    // Haptic at S complete
    setTimeout(() => {
      Haptics.selectionAsync().catch(() => {});
    }, CONDENSED.hapticBeats[1]);

    // ── Phase 4: Final state — subtle breathing ───────────────────────
    wordmarkScale.value = withDelay(
      CONDENSED.finalState.start,
      withRepeat(
        withSequence(
          withTiming(1 + VISUAL.breathScaleDelta, { duration: VISUAL.breathDuration / 2, easing: EASE.meditative }),
          withTiming(1, { duration: VISUAL.breathDuration / 2, easing: EASE.meditative }),
        ),
        -1,
        false,
      ),
    );

    // ── Exit ──────────────────────────────────────────────────────────
    rootOpacity.value = withDelay(
      CONDENSED.exit.start,
      withTiming(0, { duration: CONDENSED.exit.duration, easing: EASE.accelerate }, (finished) => {
        if (finished) runOnJS(onDone)();
      }),
    );
  }, [onDone, sphereScale, sphereOpacity, sphereGlow, wordmarkScale, wordmarkOpacity, r0, r1, r2, r3, r4, r5, rootOpacity]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: rootOpacity.value }));

  return (
    <Animated.View style={[styles.root, rootStyle]} pointerEvents="auto">
      <Svg width={SVG_SIZE} height={SVG_SIZE} viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}>
        <GoldSphere
          cx={CENTER}
          cy={CENTER}
          scale={sphereScale}
          opacity={sphereOpacity}
          glow={sphereGlow}
        />
        <KairosWordmark
          cx={CENTER}
          cy={CENTER}
          letterReveals={reveals}
          scale={wordmarkScale}
          opacity={wordmarkOpacity}
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    zIndex: 9999,
  },
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors in `SplashCondensed.tsx`. The `index.ts` barrel error should also resolve since this file now exists.

- [ ] **Step 3: Commit**

```bash
git add src/animations/splash/SplashCondensed.tsx
git commit -m "feat(splash): SplashCondensed composer — 4-phase daily splash"
```

---

## Task 10: `KairosBootSequence` composer (the full ceremony)

**Files:**
- Create: `src/animations/splash/KairosBootSequence.tsx`

- [ ] **Step 1: Implement the 8-phase ceremonial sequence**

```tsx
// src/animations/splash/KairosBootSequence.tsx
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { FULL, EASE, SPRING, VISUAL } from './choreography';
import { GoldSphere, GoldBlock, IsoCube, KairosWordmark } from './primitives';

const SVG_SIZE = 400;
const CENTER = SVG_SIZE / 2;
const LETTERS = ['K', 'A', 'I', 'R', 'O', 'S'] as const;

interface KairosBootSequenceProps {
  onDone: () => void;
}

export default function KairosBootSequence({ onDone }: KairosBootSequenceProps) {
  // ── Root ────────────────────────────────────────────────────────────
  const rootOpacity = useSharedValue(1);

  // ── Sphere ──────────────────────────────────────────────────────────
  const sphereScale = useSharedValue(0.7);
  const sphereOpacity = useSharedValue(0);
  const sphereGlow = useSharedValue(0);

  // ── 3 emission blocks ───────────────────────────────────────────────
  // each block has its own x, y, rotation, opacity, scale
  const e0 = useBlockState();
  const e1 = useBlockState();
  const e2 = useBlockState();
  const emissionBlocks = [e0, e1, e2];

  // ── Cube ────────────────────────────────────────────────────────────
  const cubeScale = useSharedValue(0.7);
  const cubeOpacity = useSharedValue(0);
  const cubeRotation = useSharedValue(0);

  // ── 6 division blocks (carry letters) ───────────────────────────────
  const d0 = useBlockState();
  const d1 = useBlockState();
  const d2 = useBlockState();
  const d3 = useBlockState();
  const d4 = useBlockState();
  const d5 = useBlockState();
  const divisionBlocks = [d0, d1, d2, d3, d4, d5];

  // letter reveal per division block (0..1)
  const lr0 = useSharedValue(0);
  const lr1 = useSharedValue(0);
  const lr2 = useSharedValue(0);
  const lr3 = useSharedValue(0);
  const lr4 = useSharedValue(0);
  const lr5 = useSharedValue(0);
  const letterReveals = [lr0, lr1, lr2, lr3, lr4, lr5];

  // ── Wordmark final-state ───────────────────────────────────────────
  // (separate from per-block reveals — used for the final glow + breathing)
  const wmGroupScale = useSharedValue(1);
  const wmGroupOpacity = useSharedValue(0);  // hidden until phase 7

  useEffect(() => {
    // ═════════════════════ PHASE 1: ORIGIN (0–600ms) ═════════════════════
    Haptics.selectionAsync().catch(() => {});

    sphereOpacity.value = withTiming(1, { duration: FULL.origin.duration, easing: EASE.decelerate });
    sphereScale.value = withTiming(1.0, { duration: FULL.origin.duration, easing: EASE.decelerate });
    sphereGlow.value = withDelay(
      FULL.origin.duration - 200,
      withTiming(0.4, { duration: 200, easing: EASE.decelerate }),
    );

    // ═════════════════════ PHASE 2: EMISSION (700–1500ms) ═══════════════
    // Sphere glow falls during emission
    sphereGlow.value = withDelay(
      FULL.emission.start,
      withTiming(0, { duration: FULL.emission.duration, easing: EASE.accelerate }),
    );

    FULL.emission.angles.forEach((angleDeg, i) => {
      const angleRad = (angleDeg * Math.PI) / 180;
      const targetX = CENTER + Math.cos(angleRad) * FULL.emission.distance;
      const targetY = CENTER + Math.sin(angleRad) * FULL.emission.distance;
      const targetRot = (FULL.emission.blockRotation * Math.PI) / 180 * (i % 2 === 0 ? 1 : -1);

      const block = emissionBlocks[i];
      block.opacity.value = withDelay(
        FULL.emission.start + i * FULL.emission.staggerMs,
        withTiming(1, { duration: 200, easing: EASE.decelerate }),
      );
      block.scale.value = withDelay(
        FULL.emission.start + i * FULL.emission.staggerMs,
        withTiming(1, { duration: 200, easing: EASE.decelerate }),
      );
      block.x.value = withDelay(
        FULL.emission.start + i * FULL.emission.staggerMs,
        withSpring(targetX, SPRING.block),
      );
      block.y.value = withDelay(
        FULL.emission.start + i * FULL.emission.staggerMs,
        withSpring(targetY, SPRING.block),
      );
      block.rotation.value = withDelay(
        FULL.emission.start + i * FULL.emission.staggerMs,
        withTiming(targetRot, { duration: FULL.emission.duration, easing: EASE.decelerate }),
      );
    });

    // ═════════════════════ PHASE 3: RETURN (1500–2200ms) ════════════════
    emissionBlocks.forEach((block) => {
      block.x.value = withDelay(
        FULL.return.start,
        withTiming(CENTER, { duration: FULL.return.duration, easing: EASE.accelerate }),
      );
      block.y.value = withDelay(
        FULL.return.start,
        withTiming(CENTER, { duration: FULL.return.duration, easing: EASE.accelerate }),
      );
      block.rotation.value = withDelay(
        FULL.return.start,
        withTiming(0, { duration: FULL.return.duration, easing: EASE.accelerate }),
      );
    });

    // ═════════════════════ PHASE 4: CUBE MORPH (2200–2900ms) ════════════
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}), 2400);

    // Sphere fades + shrinks
    sphereOpacity.value = withDelay(
      FULL.cubeMorph.start,
      withTiming(0, { duration: FULL.cubeMorph.duration, easing: EASE.primary }),
    );
    sphereScale.value = withDelay(
      FULL.cubeMorph.start,
      withTiming(0.5, { duration: FULL.cubeMorph.duration, easing: EASE.primary }),
    );

    // Emission blocks fade
    emissionBlocks.forEach((block) => {
      block.opacity.value = withDelay(
        FULL.cubeMorph.start,
        withTiming(0, { duration: FULL.cubeMorph.duration, easing: EASE.primary }),
      );
    });

    // Cube appears
    cubeOpacity.value = withDelay(
      FULL.cubeMorph.start,
      withTiming(1, { duration: FULL.cubeMorph.duration, easing: EASE.primary }),
    );
    cubeScale.value = withDelay(
      FULL.cubeMorph.start,
      withTiming(1.0, { duration: FULL.cubeMorph.duration, easing: EASE.primary }),
    );
    cubeRotation.value = withDelay(
      FULL.cubeMorph.start,
      withTiming((FULL.cubeMorph.rotation * Math.PI) / 180, {
        duration: FULL.cubeMorph.duration,
        easing: EASE.primary,
      }),
    );

    // Cube reposo breathing (continuous from phase 4 end onward, until phase 5 starts)
    // We let phase 5 override scale, so this is just the brief 100ms pause
    // (handled implicitly — the timing values overlap)

    // ═════════════════════ PHASE 5: DIVISION (3000–4000ms) ══════════════
    // Cube fades while 6 blocks emerge from cube center toward wordmark positions

    cubeOpacity.value = withDelay(
      FULL.division.start,
      withTiming(0, { duration: 400, easing: EASE.accelerate }),
    );

    const totalWidth = (LETTERS.length - 1) * VISUAL.wordmarkSpacing;
    const startX = CENTER - totalWidth / 2;

    divisionBlocks.forEach((block, i) => {
      const targetX = startX + i * VISUAL.wordmarkSpacing;
      const targetY = CENTER;

      // Start at cube center
      block.x.value = CENTER;
      block.y.value = CENTER;

      block.opacity.value = withDelay(
        FULL.division.start + i * FULL.division.staggerMs,
        withTiming(1, { duration: 100, easing: EASE.decelerate }),
      );
      block.scale.value = withDelay(
        FULL.division.start + i * FULL.division.staggerMs,
        withTiming(1, { duration: 100, easing: EASE.decelerate }),
      );
      block.x.value = withDelay(
        FULL.division.start + i * FULL.division.staggerMs,
        withSpring(targetX, SPRING.bounce),
      );
      block.y.value = withDelay(
        FULL.division.start + i * FULL.division.staggerMs,
        withSpring(targetY, SPRING.bounce),
      );
    });

    // ═════════════════════ PHASE 6: MUTATION (4000–5200ms) ══════════════
    setTimeout(() => Haptics.selectionAsync().catch(() => {}), 5000);

    letterReveals.forEach((reveal, i) => {
      reveal.value = withDelay(
        FULL.mutation.start + i * FULL.mutation.staggerMs,
        withTiming(1, { duration: 600, easing: EASE.primary }),
      );
    });

    // ═════════════════════ PHASE 7: FINAL STATE (5200–6400ms) ═══════════
    // Soft glow rises and falls behind letters (reusing sphereGlow for now —
    // visually centered; this is a craft choice that may be tuned in checkpoint)
    sphereOpacity.value = withDelay(FULL.finalState.start, withTiming(0, { duration: 1 }));  // ensure off
    sphereGlow.value = withDelay(
      FULL.finalState.start,
      withSequence(
        withTiming(0.35, { duration: FULL.finalState.duration / 2, easing: EASE.meditative }),
        withTiming(0, { duration: FULL.finalState.duration / 2, easing: EASE.meditative }),
      ),
    );

    // ═════════════════════ PHASE 8: REVERSE (6400–7400ms) ═══════════════
    // Letters → blocks: reverse the per-block letter reveal with shorter stagger
    letterReveals.forEach((reveal, i) => {
      reveal.value = withDelay(
        FULL.reverse.start + i * FULL.reverse.staggerMs,
        withTiming(0, { duration: 400, easing: EASE.accelerate }),
      );
    });

    // 6 blocks → 3 blocks isometric: fade 3, 4, 5 entirely; move 0, 1, 2 to iso positions
    [3, 4, 5].forEach((i) => {
      divisionBlocks[i].opacity.value = withDelay(
        FULL.reverse.start + 400,
        withTiming(0, { duration: 400, easing: EASE.accelerate }),
      );
    });

    // 3 surviving blocks rearrange into iso formation around center
    const isoOffset = 22;
    [0, 1, 2].forEach((i) => {
      const angle = (i * 120 - 90) * (Math.PI / 180);  // top, bottom-right, bottom-left
      const tx = CENTER + Math.cos(angle) * isoOffset;
      const ty = CENTER + Math.sin(angle) * isoOffset;
      divisionBlocks[i].x.value = withDelay(
        FULL.reverse.start + 200,
        withTiming(tx, { duration: 600, easing: EASE.accelerate }),
      );
      divisionBlocks[i].y.value = withDelay(
        FULL.reverse.start + 200,
        withTiming(ty, { duration: 600, easing: EASE.accelerate }),
      );
    });

    // Root fade-out at end
    rootOpacity.value = withDelay(
      FULL.reverse.start + FULL.reverse.duration - 200,
      withTiming(0, { duration: 400, easing: EASE.accelerate }, (finished) => {
        if (finished) runOnJS(onDone)();
      }),
    );
  }, []);  // intentional empty deps — fires once on mount

  const rootStyle = useAnimatedStyle(() => ({ opacity: rootOpacity.value }));

  return (
    <Animated.View style={[styles.root, rootStyle]} pointerEvents="auto">
      <Svg width={SVG_SIZE} height={SVG_SIZE} viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}>
        {/* Sphere + glow */}
        <GoldSphere
          cx={CENTER}
          cy={CENTER}
          scale={sphereScale}
          opacity={sphereOpacity}
          glow={sphereGlow}
        />

        {/* 3 emission blocks */}
        {emissionBlocks.map((block, i) => (
          <GoldBlock
            key={`em-${i}`}
            x={block.x}
            y={block.y}
            rotation={block.rotation}
            opacity={block.opacity}
            scale={block.scale}
          />
        ))}

        {/* Isometric cube */}
        <IsoCube
          cx={CENTER}
          cy={CENTER}
          scale={cubeScale}
          rotation={cubeRotation}
          opacity={cubeOpacity}
        />

        {/* 6 division blocks with letter overlays */}
        {divisionBlocks.map((block, i) => (
          <GoldBlock
            key={`div-${i}`}
            x={block.x}
            y={block.y}
            rotation={block.rotation}
            opacity={block.opacity}
            scale={block.scale}
            letter={LETTERS[i]}
            letterReveal={letterReveals[i]}
          />
        ))}
      </Svg>
    </Animated.View>
  );
}

// ── Helper hook: bundle of shared values for a single block ────────────
interface BlockState {
  x: ReturnType<typeof useSharedValue<number>>;
  y: ReturnType<typeof useSharedValue<number>>;
  rotation: ReturnType<typeof useSharedValue<number>>;
  opacity: ReturnType<typeof useSharedValue<number>>;
  scale: ReturnType<typeof useSharedValue<number>>;
}

function useBlockState(): BlockState {
  return {
    x: useSharedValue(CENTER),
    y: useSharedValue(CENTER),
    rotation: useSharedValue(0),
    opacity: useSharedValue(0),
    scale: useSharedValue(0.7),
  };
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    zIndex: 9999,
  },
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: zero errors. All barrel imports now resolve.

- [ ] **Step 3: Commit**

```bash
git add src/animations/splash/KairosBootSequence.tsx
git commit -m "feat(splash): KairosBootSequence — full 8-phase ceremonial sequence"
```

---

## Task 11: Refactor `SplashScreen.tsx` as router

**Files:**
- Modify: `src/screens/SplashScreen.tsx`

- [ ] **Step 1: Replace existing SplashScreen with router**

Read the current contents first (`src/screens/SplashScreen.tsx`), then replace entirely with:

```tsx
// src/screens/SplashScreen.tsx
import React from 'react';
import { View } from 'react-native';

import {
  KairosBootSequence,
  SplashCondensed,
  useSplashTrigger,
} from '../animations/splash';

interface SplashScreenProps {
  onDone: () => void;
}

export default function SplashScreen({ onDone }: SplashScreenProps) {
  const { mode, markCompleted } = useSplashTrigger();

  if (mode === 'loading') {
    // Brief blank-white moment while we read AsyncStorage. Always under ~50ms
    // on device. Showing nothing is correct — flashing a frame of any version
    // before the resolved choice would be worse.
    return <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />;
  }

  if (mode === 'full') {
    return (
      <KairosBootSequence
        onDone={async () => {
          await markCompleted();
          onDone();
        }}
      />
    );
  }

  return <SplashCondensed onDone={onDone} />;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors. The existing `AnimatedKairosLogo` import is gone — confirm no other consumer of SplashScreen breaks.

- [ ] **Step 3: Commit**

```bash
git add src/screens/SplashScreen.tsx
git commit -m "refactor(splash): SplashScreen becomes router for full vs condensed"
```

---

## Task 12: Device verification checklist

**Files:**
- Create: `docs/superpowers/checklists/2026-05-02-splash-device-verification.md`

- [ ] **Step 1: Author the checklist**

```markdown
# Splash Animation — Device Verification Checklist

**Date:** 2026-05-02
**Target device:** iPhone 12 Pro
**Build:** Release (`xcodebuild -workspace ios/Kairos.xcworkspace -scheme Kairos -configuration Release ...`)

## Pre-flight

- [ ] Clean install: delete app from device, run fresh install
- [ ] AsyncStorage is empty (verified via fresh install)

## Full sequence (`KairosBootSequence`) — first launch only

### Phase 1: Origin (0–600ms)
- [ ] Sphere appears at exact center
- [ ] Sphere fades from 0 → 1 opacity smoothly
- [ ] Sphere scales from 0.7 → 1.0 with deceleration
- [ ] Soft warm glow rises behind sphere in last 200ms
- [ ] Haptic tap felt at frame 0

### Phase 2: Emission (700–1500ms)
- [ ] Three blocks emit from sphere center
- [ ] Angles approximately 10°, 135°, 250° (top-right, bottom-left, bottom-right)
- [ ] Stagger between block emissions visible (~80ms)
- [ ] Each block has a slight rotation while flying
- [ ] Sphere glow recedes during emission

### Phase 3: Return (1500–2200ms)
- [ ] All three blocks return to center
- [ ] Acceleration is felt (slow start, fast finish)
- [ ] Convergence is simultaneous

### Phase 4: Cube morph (2200–2900ms)
- [ ] Sphere disappears as cube appears (no jarring crossfade)
- [ ] Three emission blocks fade as cube grows
- [ ] Cube has visible 3-face volume (top brighter than left, right darker)
- [ ] Cube rotates ~15° during transition
- [ ] Haptic medium impact felt at ~2400ms

### Phase 5: Division (3000–4000ms)
- [ ] Cube dissolves
- [ ] Six blocks emerge from center
- [ ] Stagger between block births is visible (~120ms)
- [ ] Each block lands with subtle bounce
- [ ] Final positions form a horizontal line spaced like the wordmark

### Phase 6: Mutation (4000–5200ms)
- [ ] Each block transforms into its letter (K, A, I, R, O, S in order)
- [ ] Stagger between letter reveals visible (~100ms)
- [ ] Block scale-up + opacity-down + letter scale-up + opacity-up read as morph
- [ ] No "two states fighting" feel
- [ ] Haptic tap felt at ~5000ms (when S completes)

### Phase 7: Final state (5200–6400ms)
- [ ] "KAIROS" reads cleanly in geometric sans-serif weight 300
- [ ] Soft warm glow rises and falls behind letters
- [ ] Subtle breathing on letters detectable
- [ ] No flicker

### Phase 8: Reverse (6400–7400ms)
- [ ] Letters fade back into blocks
- [ ] 6 blocks collapse to 3 in isometric formation
- [ ] Tempo feels slightly slower than forward
- [ ] Background fades cleanly to home screen
- [ ] No "snap" at end

### After completion
- [ ] App is interactive within 100ms of splash end
- [ ] Force quit + relaunch → condensed plays (NOT full)

## Condensed sequence (`SplashCondensed`) — every subsequent launch

- [ ] Total duration ~3.1s
- [ ] Sphere → wordmark transition without intermediate cube
- [ ] Two haptic beats (start, S-complete)
- [ ] Final state shows breathing
- [ ] Smooth fade to app

## Performance

- [ ] No frame drops visible during phase 4 (cube morph)
- [ ] No frame drops visible during phase 6 (letter mutation)
- [ ] No frame drops visible during phase 8 (reverse)
- [ ] Memory stays under 5MB delta during splash (verified via Xcode profiler)

## Reference comparison

After capturing 60fps screen recording from device:

- [ ] Side-by-side with Atoms — does Kairos hold up on visual quality?
- [ ] Side-by-side with Tiimo — does Kairos motion feel meditative, not frantic?
- [ ] Side-by-side with Notion — does the cube read as volumetric, not flat?

## Decision gate

- [ ] **PASS** → ship; iterate timings in production
- [ ] **FAIL** → migrate to Lottie (separate plan: `lottie-react-native` install + .json authoring)
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/checklists/2026-05-02-splash-device-verification.md
git commit -m "docs(splash): device verification checklist for the 24h checkpoint"
```

---

## Task 13: Final type-check and dev server smoke test

**Files:** none (pure verification)

- [ ] **Step 1: Full type-check**

Run: `npx tsc --noEmit`
Expected: zero errors across the entire project.

- [ ] **Step 2: Start dev server**

Run: `npm start`
Expected: Metro bundler launches without errors.

- [ ] **Step 3: Smoke test on simulator (optional pre-device)**

Run: `npm run ios`
Expected: App launches, splash plays (full sequence on first install). Verify no JS errors in console.

- [ ] **Step 4: Hand off to user for the 24h device checkpoint**

User performs Release build to physical iPhone 12 Pro per `CLAUDE.md` chain. User runs through the device verification checklist (Task 12 file). User decides PASS or FAIL.

---

## Task 14: 24h checkpoint review (handoff)

**This task is performed by the user, not the implementing agent.**

- [ ] User builds Release to iPhone 12 Pro
- [ ] User records 60fps screen capture of both versions
- [ ] User compares against Atoms / Tiimo / Notion references
- [ ] User makes binary call:
  - **PASS:** Open follow-up tasks for any timing tweaks identified
  - **FAIL:** Open new spec for Lottie migration (the API of `KairosBootSequence` and `SplashCondensed` stays identical; only their internals swap)

---

## Self-review summary

**Spec coverage:**
- §3 Architecture → Tasks 1–11 ✓
- §4 Primitives → Tasks 3–7 ✓
- §5 Full choreography → Task 10 ✓
- §6 Condensed choreography → Task 9 ✓
- §7 Trigger logic → Task 8 ✓
- §8 Performance targets → verified in Task 12 (manual)
- §9 24h checkpoint → Tasks 12, 14 ✓
- §10 Testing strategy → adapted (no Jest in project; manual checklist only — flagged in Pre-flight notes)
- §11 Risks → mitigations baked in (graceful AsyncStorage failure in Task 8, simple SVG paths in cube)
- §2 Open question on gold value → uses `#D4AF37` consistently (matches `gold[500]` in current tokens); a future visual-refinement migration would touch only the primitive defaults

**Type consistency:** verified — `SharedValue<number>` everywhere, prop names consistent across primitives and composers.

**Placeholder scan:** clean.

---

## Execution choice

Plan complete and saved to `docs/superpowers/plans/2026-05-02-kairos-splash-animation.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
