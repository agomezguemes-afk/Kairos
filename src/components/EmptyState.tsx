import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';

import KIcon, { type KIconName } from './icons/KIcon';
import { useTheme } from '../theme/ThemeContext';
import { Typography, Spacing } from '../theme/tokens';

export type EmptyStateType = 'exercises' | 'canvas' | 'blocks';

interface Props {
  type: EmptyStateType;
  style?: ViewStyle;
}

const COPY: Record<EmptyStateType, { text: string; icon: KIconName }> = {
  exercises: { text: 'Aquí no hay ejercicios todavía', icon: 'barbell' },
  canvas:    { text: 'Tu lienzo está vacío. Arrastra algo aquí.', icon: 'grid' },
  blocks:    { text: 'Crea tu primer bloque', icon: 'note' },
};

export default function EmptyState({ type, style }: Props) {
  const { colors } = useTheme();
  const { text, icon } = COPY[type];
  return (
    <View style={[styles.wrap, style]}>
      <View style={{ opacity: 0.6 }}>
        <KIcon name={icon} size={48} color={colors.gold[500]} />
      </View>
      <Text style={[styles.text, { color: colors.text.secondary }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl * 2,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  text: {
    fontSize: Typography.body.fontSize,
    fontWeight: Typography.body.fontWeight,
    lineHeight: Typography.body.lineHeight,
    textAlign: 'center',
  },
});
