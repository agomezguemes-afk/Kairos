// src/features/blocks/components/TemplatePickerSheet.tsx
// Bottom-sheet picker that lets a brand-new user spin up a working block
// in one tap. Reads from BLOCK_TEMPLATES (Full Body, Push, Pull, Legs).
// Tap a card → instantiate the template via store.addBlockFromTemplate
// and let the parent decide whether to navigate or highlight on the grid.

import React, { useCallback } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Colors, Type, Spacing, Radius, Shadows } from '../../../theme/tokens';
import { useWorkoutStore } from '../../../store/workoutStore';
import { BLOCK_TEMPLATES, type BlockTemplate } from '../../../data/blockTemplates';
import { DISCIPLINE_CONFIGS, type Discipline } from '../../../types/core';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated?: (blockId: string) => void;
}

function disciplineColor(d: Discipline): string {
  return Colors.discipline[d] ?? Colors.gold.base;
}

export default function TemplatePickerSheet({ visible, onClose, onCreated }: Props) {
  const insets = useSafeAreaInsets();
  const addBlockFromTemplate = useWorkoutStore((s) => s.addBlockFromTemplate);

  const handleSelect = useCallback(
    (tpl: BlockTemplate) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const id = addBlockFromTemplate(tpl.id);
      if (id) onCreated?.(id);
      onClose();
    },
    [addBlockFromTemplate, onCreated, onClose],
  );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View
        entering={FadeIn.duration(200).easing(Easing.out(Easing.cubic))}
        exiting={FadeOut.duration(160).easing(Easing.in(Easing.cubic))}
        style={styles.scrim}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          entering={SlideInDown.duration(280).easing(Easing.out(Easing.cubic))}
          exiting={SlideOutDown.duration(220).easing(Easing.in(Easing.cubic))}
          style={[styles.sheet, { paddingBottom: Spacing.xl + insets.bottom }]}
        >
          <View style={styles.handle} />
          <View style={styles.headerBlock}>
            <Text style={styles.title}>Empezar con plantilla</Text>
            <Text style={styles.hint}>Crea un bloque listo para entrenar.</Text>
          </View>

          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {BLOCK_TEMPLATES.map((tpl) => (
              <TemplateCard key={tpl.id} template={tpl} onPress={() => handleSelect(tpl)} />
            ))}
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

interface CardProps {
  template: BlockTemplate;
  onPress: () => void;
}

const TemplateCard = React.memo(function TemplateCard({ template, onPress }: CardProps) {
  const color = disciplineColor(template.discipline);
  const disciplineLabel = DISCIPLINE_CONFIGS[template.discipline]?.name ?? template.discipline;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={template.name}
      accessibilityHint="Toca para crear un bloque desde esta plantilla"
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={[styles.cardStripe, { backgroundColor: color }]} />
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={2}>
          {template.name}
        </Text>
        <Text style={styles.cardDesc} numberOfLines={2}>
          {template.description}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {`${template.exercises.length} ejercicios · ${template.recommendedFrequency}×/sem · ${disciplineLabel}`}
        </Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.32)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bg.surface,
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.screen.horizontal,
    maxHeight: '88%',
    ...Shadows.card,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.hair.strong,
    marginBottom: Spacing.md,
  },
  headerBlock: {
    paddingBottom: Spacing.md,
  },
  title: {
    ...Type.bodyEmph,
    color: Colors.ink.primary,
  },
  hint: {
    ...Type.micro,
    color: Colors.ink.tertiary,
    marginTop: 2,
  },
  list: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.bg.elevated,
    borderRadius: Radius.md,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  cardStripe: {
    width: 3,
  },
  cardBody: {
    flex: 1,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  cardName: {
    ...Type.bodyEmph,
    color: Colors.ink.primary,
  },
  cardDesc: {
    ...Type.caption,
    color: Colors.ink.tertiary,
  },
  cardMeta: {
    ...Type.micro,
    color: Colors.ink.muted,
    marginTop: 2,
  },
});
