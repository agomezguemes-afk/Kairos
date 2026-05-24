// Shared visual frame for Spine-Bento tiles.
//
// Provides the rounded surface, hairline border, optional eyebrow label,
// and optional footer pill that all tile variants share. Internal content
// renders as children — each tile owns its own layout.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Type, Spacing, Radius } from '../../../../theme/tokens';

interface Props {
  eyebrow?: string;
  pill?: string | null;
  isActive?: boolean;
  compact?: boolean;
  onLongPress?: () => void;
  children: React.ReactNode;
}

function TileFrameImpl({ eyebrow, pill, isActive, compact, onLongPress, children }: Props) {
  const handleLongPress = () => {
    if (!onLongPress) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onLongPress();
  };

  return (
    <Pressable
      onLongPress={onLongPress ? handleLongPress : undefined}
      delayLongPress={350}
      style={[
        styles.frame,
        compact && styles.frameCompact,
        isActive && styles.frameActive,
      ]}
    >
      {(eyebrow || pill) && (
        <View style={styles.meta}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : <View />}
          {pill ? (
            <View style={styles.pill}>
              <Text style={styles.pillText}>{pill}</Text>
            </View>
          ) : null}
        </View>
      )}
      {children}
    </Pressable>
  );
}

const TileFrame = React.memo(TileFrameImpl);
export default TileFrame;

const styles = StyleSheet.create({
  frame: {
    backgroundColor: Colors.bg.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.hair.base,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  frameCompact: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  frameActive: {
    borderColor: Colors.gold.base,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  eyebrow: {
    ...Type.eyebrow,
    color: Colors.gold.deep,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: Colors.gold.glow,
    borderRadius: Radius.pill,
  },
  pillText: {
    ...Type.micro,
    color: Colors.gold.deep,
    fontWeight: '600',
  },
});
