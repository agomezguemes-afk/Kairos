// KAIROS — TextBlank: inline free text (name / the line in your words). A
// serif input styled as manuscript ink over a gold hairline — no boxes, no
// cards. Submit typesets; the quiet skip word keeps it optional.

import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Type } from '../../../../theme/tokens';
import { Fonts } from '../../../../theme/fonts';

interface TextBlankProps {
  value: string;
  onChange: (t: string) => void;
  onConfirm: () => void;
  skipLabel: string;
  onSkip: () => void;
  placeholder: string;
  maxLength: number;
  multiline?: boolean;
  confirmLabel?: string;
}

export default function TextBlank({
  value,
  onChange,
  onConfirm,
  skipLabel,
  onSkip,
  placeholder,
  maxLength,
  multiline = false,
  confirmLabel = 'así',
}: TextBlankProps) {
  const ref = useRef<TextInput>(null);
  useEffect(() => {
    // Focus after the ink settles — the keyboard is part of the instrument.
    const t = setTimeout(() => ref.current?.focus(), 260);
    return () => clearTimeout(t);
  }, []);

  const confirm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onConfirm();
  };

  return (
    <View>
      <View style={styles.inputWrap}>
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={Colors.ink.muted}
          cursorColor={Colors.gold.base}
          selectionColor={Colors.gold.base}
          style={[styles.input, multiline && styles.inputMultiline]}
          maxLength={maxLength}
          autoCapitalize={multiline ? 'sentences' : 'words'}
          returnKeyType="done"
          blurOnSubmit
          multiline={multiline}
          onSubmitEditing={() => {
            if (value.trim().length > 0) confirm();
            else onSkip();
          }}
          accessibilityLabel={placeholder}
        />
        <View style={styles.rule} />
      </View>

      <View style={styles.actions}>
        {value.trim().length > 0 ? (
          <Pressable
            onPress={confirm}
            accessibilityRole="button"
            accessibilityLabel="Confirmar"
            style={styles.action}
            hitSlop={4}
          >
            <Text style={styles.confirm}>{confirmLabel}</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onSkip}
          accessibilityRole="button"
          accessibilityLabel={skipLabel}
          style={styles.action}
          hitSlop={4}
        >
          <Text style={styles.skip}>{skipLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inputWrap: { paddingTop: 2 },
  input: {
    fontFamily: Fonts.serifSemiBoldItalic,
    fontSize: 22,
    lineHeight: 30,
    color: Colors.gold.deep,
    paddingVertical: 6,
    paddingHorizontal: 0,
  },
  inputMultiline: { minHeight: 64, textAlignVertical: 'top' },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.gold.deep, opacity: 0.5 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.xl,
    marginTop: Spacing.xs,
  },
  action: { paddingVertical: 10 },
  confirm: {
    fontFamily: Fonts.serifSemiBoldItalic,
    fontSize: 21,
    color: Colors.gold.base,
  },
  skip: { ...Type.caption, color: Colors.ink.muted },
});
