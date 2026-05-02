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
