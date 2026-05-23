import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import KairosLogo from './KairosLogo';
import { Colors, Type } from '../theme/tokens';

export interface KairosLogotypeProps {
  size?: number;
  color?: string;
  gap?: number;
}

/**
 * Isotype + wordmark, vertically stacked.
 * Used in marketing surfaces, the about screen, and any "full lockup" context.
 */
export default function KairosLogotype({
  size = 80,
  color,
  gap = 16,
}: KairosLogotypeProps) {
  const tint = color ?? Colors.gold.base;

  return (
    <View style={styles.wrap}>
      <KairosLogo size={size} color={tint} />
      <Text style={[styles.word, { color: tint, marginTop: gap }]}>Kairos</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  word: {
    // Spec §5.2: serif wordmark (Type.title is 32px serif)
    ...Type.title,
    letterSpacing: 1,
  },
});
