// src/hooks/useAccordion.ts
// The shared accordion mechanics DRY'd out of HomeFolder (planner) and
// DisciplineFolder (blocks) — STORY-05b. Two real consumers, 28 verbatim
// duplicated lines → justified extraction, not premature abstraction.
//
// Covers ONLY the shared motion: a height-collapse (0↔measured, CLAMP) with a
// content "rise" (opacity + translateY -8→0) and a chevron rotate (0→180),
// driven by a single `progress` SharedValue animated with a 240ms out-cubic
// timing (or jumped instantly under Reduce Motion).
//
// `progress` is exposed on purpose (not fully encapsulated): HomeFolder needs
// it to JUMP the folder to its resolved state on cold-start rehydration without
// animating (no-flash restore, STORY-03). Hydration/persistence logic stays in
// the consumer — the hook owns the movement, nothing else.

import { useCallback, useEffect } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

const DEFAULT_DURATION = 240; // WHY: inside the 180-280ms standard-transition band

export interface Accordion {
  /** Exposed so the caller can JUMP it without animating (e.g. HomeFolder's
   *  no-flash hydration restore). Normal use never touches it. */
  progress: SharedValue<number>;
  /** onLayout of the inner content (measures natural height; re-measures every
   *  layout so content that grows after mount is never clipped forever). */
  onContentLayout: (e: LayoutChangeEvent) => void;
  containerStyle: ReturnType<typeof useAnimatedStyle>;
  contentStyle: ReturnType<typeof useAnimatedStyle>;
  chevronStyle: ReturnType<typeof useAnimatedStyle>;
}

export function useAccordion(open: boolean, durationMs = DEFAULT_DURATION): Accordion {
  const reduceMotion = useReducedMotion();
  const measured = useSharedValue(0);
  const progress = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    progress.value = reduceMotion
      ? open
        ? 1
        : 0
      : withTiming(open ? 1 : 0, { duration: durationMs, easing: Easing.out(Easing.cubic) });
  }, [open, reduceMotion, durationMs, progress]);

  const onContentLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      if (h > 0) measured.value = h;
    },
    [measured],
  );

  const containerStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.value, [0, 1], [0, measured.value], Extrapolation.CLAMP),
  }));

  // The "rise": content zooms up into place as the height grows beneath it.
  const contentStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: interpolate(progress.value, [0, 1], [-8, 0], Extrapolation.CLAMP) }],
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(progress.value, [0, 1], [0, 180], Extrapolation.CLAMP)}deg` },
    ],
  }));

  return { progress, onContentLayout, containerStyle, contentStyle, chevronStyle };
}
