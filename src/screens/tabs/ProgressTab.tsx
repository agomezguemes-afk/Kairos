import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../../theme/index';

export default function ProgressTab() {
  return (
    <View style={styles.container}>
      <View style={styles.iconBox}>
        <Feather name="bar-chart-2" size={32} color={Colors.accent.primary} />
      </View>
      <Text style={styles.title}>Progreso</Text>
      <Text style={styles.subtitle}>
        Pr&#243;ximamente: gr&#225;ficos y estad&#237;sticas detalladas
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.void,
    paddingHorizontal: Spacing.screen.horizontal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accent.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: Typography.size.heading,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: Typography.size.body,
    color: Colors.text.tertiary,
    textAlign: 'center',
  },
});
