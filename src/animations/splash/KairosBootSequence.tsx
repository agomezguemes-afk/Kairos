// src/animations/splash/KairosBootSequence.tsx
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { GoldBlock, MorphCube } from './primitives';

// ── Stage ──────────────────────────────────────────────────────────────
const STAGE_SIZE = 380;
const CENTER = STAGE_SIZE / 2;
const LETTERS = ['K', 'A', 'I', 'R', 'O', 'S'] as const;

// ── Visual sizes ───────────────────────────────────────────────────────
const SPHERE_SIZE = 38;
const CUBE_SIZE = 56;
const SATELLITE_SIZE = 16;
const DIVISION_BLOCK_SIZE = 28;
const LETTER_SPACING = 36; // px between letter centers
const WORDMARK_TOTAL = (LETTERS.length - 1) * LETTER_SPACING;
const SPHERE_RX = SPHERE_SIZE / 2;
const CUBE_RX = 4;

// ── Easings (custom, more cinematic than the defaults) ─────────────────
const EASE_FLUID = Easing.bezier(0.22, 0.9, 0.32, 1.0);
const EASE_GENTLE_OUT = Easing.bezier(0.25, 0.46, 0.45, 0.94);
const EASE_ACCEL = Easing.bezier(0.55, 0.05, 0.85, 0.3);

// ── Phase timings (faster + tighter than before) ───────────────────────
const _T_ORIGIN = 0;
const ORIGIN_MS = 480;

const T_EMISSION = 520;
const EMISSION_FADE_MS = 180;
const _EMISSION_TRAVEL_MS = 640;
const EMISSION_DISTANCE = 70;
const EMISSION_ANGLES = [-115, -25, 70]; // degrees, asymmetric like the reference
const EMISSION_STAGGER = 70;

const T_RETURN = 1280;
const RETURN_MS = 520;

const T_CUBE_MORPH = 1820;
const CUBE_MORPH_MS = 540;

const T_DIVISION = 2380;
const DIVISION_FADE_OUT_MS = 280;
const DIVISION_EMERGE_MS = 520;
const DIVISION_STAGGER = 70; // left-to-right ripple

const T_MUTATION = 3060;
const MUTATION_MS = 720;
const MUTATION_STAGGER = 60;
const ZOOM_PEAK = 1.13;

const _T_FINAL = 3820;
const _FINAL_MS = 800;

const T_REVERSE = 4640;
const REVERSE_LETTER_MS = 360;
const REVERSE_LETTER_STAGGER = 50;
const REVERSE_GATHER_MS = 560;
const REVERSE_GATHER_DELAY = 160;

const T_EXIT = 5400;
const EXIT_MS = 380;

// ── Helpers ────────────────────────────────────────────────────────────
interface BlockState {
  x: ReturnType<typeof useSharedValue<number>>;
  y: ReturnType<typeof useSharedValue<number>>;
  rotation: ReturnType<typeof useSharedValue<number>>;
  opacity: ReturnType<typeof useSharedValue<number>>;
  scale: ReturnType<typeof useSharedValue<number>>;
}

function useBlockState(initialX: number, initialY: number): BlockState {
  return {
    x: useSharedValue(initialX),
    y: useSharedValue(initialY),
    rotation: useSharedValue(0),
    opacity: useSharedValue(0),
    scale: useSharedValue(0.7),
  };
}

interface KairosBootSequenceProps {
  onDone: () => void;
}

export default function KairosBootSequence({ onDone }: KairosBootSequenceProps) {
  // ── Root + camera ─────────────────────────────────────────────────────
  const rootOpacity = useSharedValue(1);
  const stageScale = useSharedValue(1);

  // ── The ONE central shape that morphs sphere→cube ─────────────────────
  const coreX = useSharedValue(CENTER);
  const coreY = useSharedValue(CENTER);
  const coreOpacity = useSharedValue(0);
  const coreScale = useSharedValue(0.7);
  const coreRotation = useSharedValue(0);
  const coreVisualSize = useSharedValue(SPHERE_SIZE);
  const coreRoundness = useSharedValue(SPHERE_RX);

  // ── 3 emission satellites ────────────────────────────────────────────
  const e0 = useBlockState(CENTER, CENTER);
  const e1 = useBlockState(CENTER, CENTER);
  const e2 = useBlockState(CENTER, CENTER);
  const emissionBlocks = [e0, e1, e2];

  // ── 6 division blocks (carry letters) ────────────────────────────────
  const startX = CENTER - WORDMARK_TOTAL / 2;
  const d0 = useBlockState(CENTER, CENTER);
  const d1 = useBlockState(CENTER, CENTER);
  const d2 = useBlockState(CENTER, CENTER);
  const d3 = useBlockState(CENTER, CENTER);
  const d4 = useBlockState(CENTER, CENTER);
  const d5 = useBlockState(CENTER, CENTER);
  const divisionBlocks = [d0, d1, d2, d3, d4, d5];

  // letter reveal per division block
  const lr0 = useSharedValue(0);
  const lr1 = useSharedValue(0);
  const lr2 = useSharedValue(0);
  const lr3 = useSharedValue(0);
  const lr4 = useSharedValue(0);
  const lr5 = useSharedValue(0);
  const letterReveals = [lr0, lr1, lr2, lr3, lr4, lr5];

  useEffect(() => {
    const timers: number[] = [];
    const t = (ms: number, fn: () => void) => {
      const id = setTimeout(fn, ms) as unknown as number;
      timers.push(id);
    };

    // ═════════════════════ PHASE 1: ORIGIN ═════════════════════════════
    Haptics.selectionAsync().catch(() => {});
    coreOpacity.value = withTiming(1, { duration: ORIGIN_MS, easing: EASE_FLUID });
    coreScale.value = withTiming(1, { duration: ORIGIN_MS, easing: EASE_FLUID });

    // ═════════════════════ PHASE 2: EMISSION ═══════════════════════════
    t(T_EMISSION, () => {
      EMISSION_ANGLES.forEach((angleDeg, i) => {
        const angleRad = (angleDeg * Math.PI) / 180;
        const targetX = CENTER + Math.cos(angleRad) * EMISSION_DISTANCE;
        const targetY = CENTER + Math.sin(angleRad) * EMISSION_DISTANCE;

        t(i * EMISSION_STAGGER, () => {
          const block = emissionBlocks[i];
          block.opacity.value = withTiming(1, { duration: EMISSION_FADE_MS, easing: EASE_FLUID });
          block.scale.value = withTiming(1, { duration: EMISSION_FADE_MS, easing: EASE_FLUID });
          // Soft, low-stiffness spring for an organic settle (mercury-drop feel).
          block.x.value = withSpring(targetX, { stiffness: 90, damping: 18, mass: 1 });
          block.y.value = withSpring(targetY, { stiffness: 90, damping: 18, mass: 1 });
        });
      });
    });

    // ═════════════════════ PHASE 3: RETURN ═════════════════════════════
    t(T_RETURN, () => {
      emissionBlocks.forEach((block) => {
        block.x.value = withTiming(CENTER, { duration: RETURN_MS, easing: EASE_ACCEL });
        block.y.value = withTiming(CENTER, { duration: RETURN_MS, easing: EASE_ACCEL });
      });
    });

    // ═════════════════════ PHASE 4: SPHERE → CUBE ══════════════════════
    t(T_CUBE_MORPH, () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      // Emission satellites fade as they merge back into the core.
      emissionBlocks.forEach((block) => {
        block.opacity.value = withTiming(0, {
          duration: CUBE_MORPH_MS * 0.6,
          easing: EASE_GENTLE_OUT,
        });
        block.scale.value = withTiming(0.4, {
          duration: CUBE_MORPH_MS * 0.6,
          easing: EASE_GENTLE_OUT,
        });
      });

      // The core shape grows and squares off — single continuous morph.
      coreVisualSize.value = withTiming(CUBE_SIZE, { duration: CUBE_MORPH_MS, easing: EASE_FLUID });
      coreRoundness.value = withTiming(CUBE_RX, { duration: CUBE_MORPH_MS, easing: EASE_FLUID });

      // Subtle perspective reveal: tiny rotation that resolves to 0.
      coreRotation.value = withSequence(
        withTiming(-0.1, { duration: CUBE_MORPH_MS * 0.45, easing: EASE_GENTLE_OUT }),
        withTiming(0, { duration: CUBE_MORPH_MS * 0.55, easing: EASE_FLUID }),
      );
    });

    // ═════════════════════ PHASE 5: LEFT-TO-RIGHT DIVISION ═════════════
    t(T_DIVISION, () => {
      // Core fades while 6 blocks ripple out from left to right.
      coreOpacity.value = withTiming(0, {
        duration: DIVISION_FADE_OUT_MS,
        easing: EASE_GENTLE_OUT,
      });

      divisionBlocks.forEach((block, i) => {
        const targetX = startX + i * LETTER_SPACING;

        t(i * DIVISION_STAGGER, () => {
          block.opacity.value = withTiming(1, { duration: 140, easing: EASE_FLUID });
          block.scale.value = withTiming(1, { duration: 140, easing: EASE_FLUID });
          block.x.value = withTiming(targetX, { duration: DIVISION_EMERGE_MS, easing: EASE_FLUID });
          block.y.value = withTiming(CENTER, { duration: DIVISION_EMERGE_MS, easing: EASE_FLUID });
        });
      });
    });

    // ═════════════════════ PHASE 6: BLOCKS → KAIROS + ZOOM ═════════════
    t(T_MUTATION, () => {
      // Camera zooms in slightly to focus on the wordmark birth.
      stageScale.value = withSequence(
        withTiming(ZOOM_PEAK, { duration: MUTATION_MS * 0.55, easing: EASE_FLUID }),
        withTiming(1.0, { duration: MUTATION_MS * 0.65, easing: EASE_FLUID }),
      );

      letterReveals.forEach((reveal, i) => {
        t(i * MUTATION_STAGGER, () => {
          reveal.value = withTiming(1, {
            duration: MUTATION_MS - i * MUTATION_STAGGER,
            easing: EASE_FLUID,
          });
        });
      });

      t(MUTATION_MS - 80, () => {
        Haptics.selectionAsync().catch(() => {});
      });
    });

    // ═════════════════════ PHASE 7: BREATHING WORDMARK ═════════════════
    // No glow per design brief — subtle breath only.
    // (Wordmark sits naturally on stage; no extra animation in this phase.)

    // ═════════════════════ PHASE 8: REVERSE ═══════════════════════════
    t(T_REVERSE, () => {
      // Letters retract back into blocks with a faster left-to-right ripple.
      letterReveals.forEach((reveal, i) => {
        t(i * REVERSE_LETTER_STAGGER, () => {
          reveal.value = withTiming(0, { duration: REVERSE_LETTER_MS, easing: EASE_GENTLE_OUT });
        });
      });

      // Gather: blocks 3-5 fade and dissolve, blocks 0-2 slide to a tight
      // triangular formation around the stage center — the resting glyph.
      t(REVERSE_GATHER_DELAY, () => {
        [3, 4, 5].forEach((i) => {
          divisionBlocks[i].opacity.value = withTiming(0, {
            duration: REVERSE_GATHER_MS * 0.6,
            easing: EASE_GENTLE_OUT,
          });
        });

        const isoOffset = 16;
        [0, 1, 2].forEach((i) => {
          const angle = (i * 120 - 90) * (Math.PI / 180);
          const tx = CENTER + Math.cos(angle) * isoOffset;
          const ty = CENTER + Math.sin(angle) * isoOffset;
          divisionBlocks[i].x.value = withTiming(tx, {
            duration: REVERSE_GATHER_MS,
            easing: EASE_FLUID,
          });
          divisionBlocks[i].y.value = withTiming(ty, {
            duration: REVERSE_GATHER_MS,
            easing: EASE_FLUID,
          });
        });
      });
    });

    // ═════════════════════ EXIT ═══════════════════════════════════════
    t(T_EXIT, () => {
      rootOpacity.value = withTiming(0, { duration: EXIT_MS, easing: EASE_ACCEL }, (finished) => {
        if (finished) runOnJS(onDone)();
      });
    });

    return () => {
      timers.forEach((id) => clearTimeout(id));
    };
  }, []);

  const rootStyle = useAnimatedStyle(() => ({ opacity: rootOpacity.value }));
  const stageStyle = useAnimatedStyle(() => ({
    transform: [{ scale: stageScale.value }],
  }));

  return (
    <Animated.View style={[styles.root, rootStyle]} pointerEvents="auto">
      <Animated.View style={[styles.stage, stageStyle]}>
        <View style={styles.stageInner}>
          {/* The single morphing core: starts as sphere, becomes cube. */}
          <MorphCube
            x={coreX}
            y={coreY}
            opacity={coreOpacity}
            scale={coreScale}
            rotation={coreRotation}
            visualSize={coreVisualSize}
            roundness={coreRoundness}
            maxSize={CUBE_SIZE}
          />

          {/* Three emission satellites (mercury-drop emanations). */}
          {emissionBlocks.map((block, i) => (
            <GoldBlock
              key={`em-${i}`}
              x={block.x}
              y={block.y}
              rotation={block.rotation}
              opacity={block.opacity}
              scale={block.scale}
              size={SATELLITE_SIZE}
            />
          ))}

          {/* Six division blocks that morph into KAIROS letters. */}
          {divisionBlocks.map((block, i) => (
            <GoldBlock
              key={`div-${i}`}
              x={block.x}
              y={block.y}
              rotation={block.rotation}
              opacity={block.opacity}
              scale={block.scale}
              size={DIVISION_BLOCK_SIZE}
              letter={LETTERS[i]}
              letterReveal={letterReveals[i]}
            />
          ))}
        </View>
      </Animated.View>
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
  stage: {
    width: STAGE_SIZE,
    height: STAGE_SIZE,
  },
  stageInner: {
    width: STAGE_SIZE,
    height: STAGE_SIZE,
    position: 'relative',
  },
});
