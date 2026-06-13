// KAIROS — KaiSpeech: Kai's voice. Sequenced "typed" dialogue.
//
// This is what turns Kai from a label into a character: lines are typed out one
// after another like game-cutscene dialogue, with a soft gold cursor. Tap to
// fast-forward (a game convention). Reduce-motion shows everything at once.
// Calls onComplete when the last line finishes so the parent can reveal a CTA.

import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '../../../theme/tokens';

interface KaiSpeechProps {
  lines: string[];
  /** ms per character (default 26 — quick but legible). */
  speed?: number;
  /** Pause between lines, ms (default 360). */
  linePause?: number;
  /** Set true (e.g. on tap) to reveal everything immediately. */
  revealAll?: boolean;
  onComplete?: () => void;
  lineStyle?: StyleProp<TextStyle>;
}

export default function KaiSpeech({
  lines,
  speed = 26,
  linePause = 360,
  revealAll = false,
  onComplete,
  lineStyle,
}: KaiSpeechProps) {
  const reduce = useReducedMotion();
  const instant = reduce || revealAll;

  // How many characters of each line are currently visible.
  const [shown, setShown] = useState<number[]>(() => lines.map(() => 0));
  const [done, setDone] = useState(false);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (instant) {
      setShown(lines.map((l) => l.length));
      if (!done) {
        setDone(true);
        onCompleteRef.current?.();
      }
      return;
    }

    let line = 0;
    let char = 0;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (line >= lines.length) {
        setDone(true);
        onCompleteRef.current?.();
        return;
      }
      char += 1;
      setShown((prev) => {
        const next = [...prev];
        next[line] = char;
        return next;
      });
      if (char >= lines[line].length) {
        line += 1;
        char = 0;
        timer = setTimeout(tick, linePause);
      } else {
        timer = setTimeout(tick, speed);
      }
    };
    timer = setTimeout(tick, speed);
    return () => clearTimeout(timer);
    // Re-running on `instant` flip is intended (tap-to-skip).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instant]);

  const lastVisible = shown.findIndex((c, i) => c < lines[i].length);
  const typingLine = done ? -1 : lastVisible === -1 ? lines.length - 1 : lastVisible;

  return (
    <View>
      {lines.map((line, i) => {
        if (shown[i] === 0 && i !== typingLine) return null;
        return (
          <Text key={i} style={[styles.line, lineStyle]}>
            {line.slice(0, shown[i])}
            {i === typingLine && !done ? <Cursor /> : null}
          </Text>
        );
      })}
    </View>
  );
}

function Cursor() {
  const reduce = useReducedMotion();
  const blink = useSharedValue(1);
  useEffect(() => {
    if (reduce) return;
    blink.value = withRepeat(withTiming(0, { duration: 520, easing: Easing.linear }), -1, true);
  }, [reduce, blink]);
  const style = useAnimatedStyle(() => ({ opacity: blink.value }));
  return <Animated.Text style={[styles.cursor, style]}>▍</Animated.Text>;
}

const styles = StyleSheet.create({
  line: { textAlign: 'center' },
  cursor: { color: Colors.gold.base },
});
