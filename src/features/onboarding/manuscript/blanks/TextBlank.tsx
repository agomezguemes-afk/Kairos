// KAIROS — TextBlank: inline free text (name / the line in your words). A
// serif input styled as manuscript ink over a gold hairline — no boxes, no
// cards. Submit typesets; the quiet skip word keeps it optional.
//
// The input is deliberately UNCONTROLLED (defaultValue + ref mirror): a
// controlled `value` round-trip can push a stale render back into the native
// field mid-typing and truncate fast input (the «Alvaro»→«A» P0). The commit
// always resolves from the submit event's own text — never from render state.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Type } from '../../../../theme/tokens';
import { Fonts } from '../../../../theme/fonts';
import { resolveSubmitText } from './textCommit';

interface TextBlankProps {
  /** Initial text when the editor (re)opens — the input owns it afterwards. */
  value: string;
  /** Keystroke mirror for the live prose fill — never fed back into the input. */
  onChange: (t: string) => void;
  /** Receives the FULL input text at the moment of commit (return or «así»). */
  onConfirm: (text: string) => void;
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
  const latest = useRef(value);
  const [hasText, setHasText] = useState(value.trim().length > 0);

  useEffect(() => {
    // Focus after the ink settles — the keyboard is part of the instrument.
    const t = setTimeout(() => ref.current?.focus(), 260);
    return () => clearTimeout(t);
  }, []);

  const commit = useCallback(
    (t: string) => {
      latest.current = t;
      if (t.trim().length > 0) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onConfirm(t);
      } else {
        onSkip();
      }
    },
    [onConfirm, onSkip],
  );

  const handleChange = useCallback(
    (t: string) => {
      latest.current = t;
      setHasText(t.trim().length > 0);
      onChange(t);
    },
    [onChange],
  );

  return (
    <View>
      <View style={styles.inputWrap}>
        <TextInput
          ref={ref}
          defaultValue={value}
          onChangeText={handleChange}
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
          onSubmitEditing={(e) => commit(resolveSubmitText(e.nativeEvent.text, latest.current))}
          onEndEditing={(e) => {
            // Blur without submit: refresh the mirror so a later «así» tap
            // commits the full text even if a keystroke render was dropped.
            latest.current = resolveSubmitText(e.nativeEvent.text, latest.current);
          }}
          accessibilityLabel={placeholder}
        />
        <View style={styles.rule} />
      </View>

      <View style={styles.actions}>
        {hasText ? (
          <Pressable
            onPress={() => commit(latest.current)}
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
