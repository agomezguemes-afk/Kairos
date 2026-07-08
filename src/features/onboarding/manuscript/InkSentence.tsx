// KAIROS — InkSentence: one manuscript line. Kai's ink types itself in serif;
// the blank lives inline and mirrors the value being edited below; when the
// answer settles, the closing ink ("after") writes and the line becomes part
// of the page. Skipped answers rewrite the whole sentence with dignity.

import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '../../../theme/tokens';
import { Fonts } from '../../../theme/fonts';
import type { SentenceSpec } from './manuscript';

const TYPE_MS = 24;

export type SentencePhase = 'writing' | 'filling' | 'settling' | 'done';

/** Typed-ink hook — exported so the page can write Kai's own lines too. */
export { useTyped };

interface InkSentenceProps {
  spec: SentenceSpec;
  phase: SentencePhase;
  /** Live prose for the blank (mirrors the editor below). */
  fill: string | null;
  /** True when the user skipped — the sentence rewrites to spec.skipRewrite. */
  skipped: boolean;
  /** Kai finished writing the opening ink → the blank is ready to edit. */
  onReady: () => void;
  /** The closing ink finished → the line is part of the page. */
  onSettled: () => void;
  /** Re-open a settled line (tap to edit — the page stays yours). */
  onReopen?: () => void;
}

function useTyped(target: string, enabled: boolean, instant: boolean, onDone?: () => void) {
  const [count, setCount] = useState(instant ? target.length : 0);
  const doneRef = useRef(false);
  const prevTarget = useRef(target);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  // A new target (e.g. the skip rewrite) restarts the ink.
  useEffect(() => {
    if (prevTarget.current !== target) {
      prevTarget.current = target;
      doneRef.current = false;
      setCount(instant ? target.length : 0);
    }
  }, [target, instant]);

  useEffect(() => {
    if (!enabled) return;
    if (instant || count >= target.length) {
      if (!doneRef.current) {
        doneRef.current = true;
        if (instant && count < target.length) setCount(target.length);
        onDoneRef.current?.();
      }
      return;
    }
    const t = setTimeout(() => setCount((c) => c + 1), TYPE_MS);
    return () => clearTimeout(t);
  }, [enabled, instant, count, target.length]);

  return instant ? target : target.slice(0, count);
}

function Caret() {
  const reduce = useReducedMotion();
  const blink = useSharedValue(1);
  useEffect(() => {
    if (reduce) return;
    blink.value = withRepeat(withTiming(0.3, { duration: 640, easing: Easing.linear }), -1, true);
  }, [reduce, blink]);
  const style = useAnimatedStyle(() => ({ opacity: blink.value }));
  return <Animated.Text style={[styles.caret, style]}>▍</Animated.Text>;
}

export default function InkSentence({
  spec,
  phase,
  fill,
  skipped,
  onReady,
  onSettled,
  onReopen,
}: InkSentenceProps) {
  const reduce = useReducedMotion();

  // Skipped lines rewrite entirely — Kai's ink, quick and final.
  const rewriting = skipped;
  const beforeText = rewriting ? spec.skipRewrite : spec.before;
  const beforeShown = useTyped(beforeText, true, reduce, rewriting ? onSettled : onReady);

  const settling = phase === 'settling' || phase === 'done';
  const afterShown = useTyped(spec.after, !rewriting && settling, reduce, onSettled);

  const showCaret = !rewriting && phase === 'filling' && (fill == null || fill.length === 0);

  const line = (
    <Text style={styles.ink}>
      {beforeShown}
      {!rewriting && fill != null && fill.length > 0 && <Text style={styles.filled}>{fill}</Text>}
      {showCaret && <Caret />}
      {!rewriting && afterShown}
    </Text>
  );

  return (
    <Animated.View entering={reduce ? undefined : FadeIn.duration(220)} style={styles.row}>
      {phase === 'done' && onReopen ? (
        <Pressable
          onPress={onReopen}
          accessibilityRole="button"
          accessibilityLabel={`Editar: ${beforeText}${fill ?? ''}${spec.after}`}
          hitSlop={6}
        >
          {line}
        </Pressable>
      ) : (
        line
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: 22 },
  ink: {
    fontFamily: Fonts.serifRegular,
    fontSize: 24,
    lineHeight: 34,
    letterSpacing: -0.2,
    color: Colors.ink.primary,
  },
  filled: {
    fontFamily: Fonts.serifSemiBoldItalic,
    color: Colors.gold.deep,
  },
  caret: { color: Colors.gold.base, fontSize: 20, opacity: 0.7 },
});
