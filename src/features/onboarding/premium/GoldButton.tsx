// KAIROS — GoldButton: the primary action, with depth.
//
// A flat gold pill reads cheap; a subtle vertical metallic gradient + a soft
// gold-tinted glow shadow makes it feel tactile and premium (the depth seen in
// best-in-class apps) while staying on-brand. Optional hint line beneath.

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors, Radius, Shadows, Type } from '../../../theme/tokens';

interface GoldButtonProps {
  label: string;
  onPress: () => void;
  hint?: string;
  style?: StyleProp<ViewStyle>;
}

// Soft top-lit metallic sheen: a touch lighter at the top, base in the middle,
// slightly deeper at the bottom. Kept subtle — it should read as one gold.
const SHEEN = ['#D8BD83', Colors.gold.base, '#B89456'] as const;

function GoldButton({ label, onPress, hint, style }: GoldButtonProps) {
  const handlePress = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onPress();
  }, [onPress]);

  return (
    <View style={[styles.wrap, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={hint}
        onPress={handlePress}
        style={({ pressed }) => [styles.shadow, pressed && styles.pressed]}
      >
        <LinearGradient
          colors={SHEEN}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.cta}
        >
          <Text style={styles.text}>{label}</Text>
        </LinearGradient>
      </Pressable>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center', gap: 8 },
  shadow: {
    width: '88%',
    borderRadius: Radius.pill,
    backgroundColor: Colors.gold.base, // backing so the glow shadow has a shape
    ...Shadows.cardWarm,
  },
  pressed: { opacity: 0.96, transform: [{ scale: 0.99 }] },
  cta: {
    height: 56,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  text: { ...Type.subheading, color: Colors.ink.inverse },
  hint: { ...Type.caption, color: Colors.ink.muted },
});

export default React.memo(GoldButton);
