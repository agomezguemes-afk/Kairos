// KAIROS — WordRow: loose words as the picking surface. No cards, no chips —
// the options ARE words (gold italic, hairline-underlined) that read like the
// margin of a manuscript. Used for single choice (goal, experience) and
// multi choice (equipment). The quiet skip word sits last, in muted sans.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Type } from '../../../../theme/tokens';
import { Fonts } from '../../../../theme/fonts';
import type { ChoiceOption } from '../manuscript';

interface WordRowProps {
  options: readonly ChoiceOption[];
  /** Selected values (single-choice passes 0–1 items). */
  selected: readonly string[];
  onToggle: (option: ChoiceOption) => void;
  skipLabel: string;
  onSkip: () => void;
  /** Shown once the selection is confirmable (multi-choice). */
  confirmLabel?: string;
  onConfirm?: () => void;
}

export default function WordRow({
  options,
  selected,
  onToggle,
  skipLabel,
  onSkip,
  confirmLabel,
  onConfirm,
}: WordRowProps) {
  return (
    <View style={styles.row}>
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onToggle(o);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.word}
            style={styles.word}
            hitSlop={4}
          >
            <Text style={[styles.wordText, on && styles.wordTextOn]}>{o.word}</Text>
            <View style={[styles.underline, on && styles.underlineOn]} />
          </Pressable>
        );
      })}

      {confirmLabel != null && onConfirm != null && selected.length > 0 ? (
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            onConfirm();
          }}
          accessibilityRole="button"
          accessibilityLabel={confirmLabel}
          style={styles.word}
          hitSlop={4}
        >
          <Text style={styles.confirm}>{confirmLabel}</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={onSkip}
          accessibilityRole="button"
          accessibilityLabel={skipLabel}
          style={styles.word}
          hitSlop={4}
        >
          <Text style={styles.skip}>{skipLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: Spacing.lg,
    rowGap: Spacing.xs,
  },
  // ≥44pt touch target via vertical padding; the visible part stays a word.
  word: { paddingVertical: 10, justifyContent: 'center' },
  wordText: {
    fontFamily: Fonts.serifSemiBoldItalic,
    fontSize: 21,
    lineHeight: 28,
    color: Colors.gold.deep,
    opacity: 0.85,
  },
  wordTextOn: { opacity: 1, color: Colors.gold.base },
  underline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.gold.deep,
    opacity: 0.5,
    marginTop: 1,
  },
  underlineOn: { height: 2, backgroundColor: Colors.gold.base, opacity: 1 },
  skip: { ...Type.caption, color: Colors.ink.muted },
  confirm: { ...Type.caption, color: Colors.gold.deep, fontFamily: Fonts.sansSemiBold },
});
