// KAIROS — UserBubble
// Shows the user's selected answer in the chat thread (right-aligned).

import React from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme/index';

interface UserBubbleProps {
  text: string;
}

export default function UserBubble({ text }: UserBubbleProps) {
  return (
    <Animated.View
      entering={FadeInRight.duration(300).springify().damping(16)}
      style={styles.container}
    >
      <Text style={styles.text}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.accent.primary,
    borderRadius: Radius.lg,
    borderTopRightRadius: Radius.xs,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    marginLeft: 64,
    ...Shadows.subtle,
  },
  text: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.medium,
    color: Colors.text.inverse,
    lineHeight: Typography.size.body * Typography.lineHeight.normal,
  },
});
