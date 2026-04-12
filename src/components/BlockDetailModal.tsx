// KAIROS — BlockDetailModal
// Slide-up sheet showing the full WorkoutBlock editing interface.
// Exercises can be deleted via swipe-left.

import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Dimensions,
  ScrollView,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';
import WorkoutBlock from './WorkoutBlock';
import { Colors, Typography, Spacing, Radius, Shadows } from '../theme/index';
import type {
  WorkoutBlock as WorkoutBlockType,
  ExerciseCard as ExerciseCardType,
  FieldValue,
} from '../types/core';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_H = SCREEN_H * 0.92;

// ======================== PROPS ========================

interface BlockDetailModalProps {
  block: WorkoutBlockType | null;
  visible: boolean;
  onClose: () => void;
  onUpdateSetValue: (exerciseId: string, setIndex: number, fieldId: string, value: FieldValue) => void;
  onToggleSetComplete: (exerciseId: string, setIndex: number) => void;
  onAddSet: (exerciseId: string) => void;
  onRemoveSet: (exerciseId: string, setIndex: number) => void;
  onUpdateExercise: (exerciseId: string, updates: Partial<ExerciseCardType>) => void;
  onAddExercise: (blockId: string) => void;
  onUpdateBlock: (blockId: string, updates: Partial<WorkoutBlockType>) => void;
  onDeleteExercise: (blockId: string, exerciseId: string) => void;
}

// ======================== MODAL ========================

export default function BlockDetailModal({
  block,
  visible,
  onClose,
  onUpdateSetValue,
  onToggleSetComplete,
  onAddSet,
  onRemoveSet,
  onUpdateExercise,
  onAddExercise,
  onUpdateBlock,
  onDeleteExercise,
}: BlockDetailModalProps) {
  const translateY = useSharedValue(SHEET_H);
  const backdropOpacity = useSharedValue(0);

  const animateIn = useCallback(() => {
    backdropOpacity.value = withTiming(1, { duration: 220 });
    translateY.value = withSpring(0, { damping: 18, stiffness: 180, mass: 1 });
  }, [backdropOpacity, translateY]);

  const animateOut = useCallback(
    (cb?: () => void) => {
      backdropOpacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(SHEET_H, { duration: 280 }, () => {
        if (cb) runOnJS(cb)();
      });
    },
    [backdropOpacity, translateY]
  );

  useEffect(() => {
    if (visible) {
      animateIn();
    }
  }, [visible, animateIn]);

  const handleClose = useCallback(() => {
    animateOut(onClose);
  }, [animateOut, onClose]);

  // Swipe-down to dismiss
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
        backdropOpacity.value = Math.max(0, 1 - e.translationY / SHEET_H);
      }
    })
    .onEnd((e) => {
      if (e.translationY > 130 || e.velocityY > 700) {
        runOnJS(handleClose)();
      } else {
        translateY.value = withSpring(0, { damping: 18, stiffness: 180 });
        backdropOpacity.value = withTiming(1, { duration: 150 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (!visible || !block) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={handleClose}>
      {/* Blur + dim backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]} pointerEvents="none">
        <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.backdrop} />
      </Animated.View>
      <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

      {/* Sheet */}
      <Animated.View style={[styles.sheet, sheetStyle]}>
        {/* Drag handle */}
        <GestureDetector gesture={panGesture}>
          <View style={styles.handleBar}>
            <View style={styles.handle} />
          </View>
        </GestureDetector>

        {/* Header */}
        <View
          style={[
            styles.header,
            { borderBottomColor: `${block.color}30` },
          ]}
        >
          <View style={[styles.headerIcon, { backgroundColor: `${block.color}20` }]}>
            <Text style={{ fontSize: 20 }}>{block.icon}</Text>
          </View>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {block.name}
          </Text>
          <Pressable
            onPress={handleClose}
            hitSlop={12}
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        {/* Color accent line */}
        <View style={[styles.colorLine, { backgroundColor: block.color }]} />

        {/* Content */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <WorkoutBlock
            block={block}
            onUpdateSetValue={onUpdateSetValue}
            onToggleSetComplete={onToggleSetComplete}
            onAddSet={onAddSet}
            onRemoveSet={onRemoveSet}
            onUpdateExercise={onUpdateExercise}
            onAddExercise={onAddExercise}
            onUpdateBlock={onUpdateBlock}
            onDeleteExercise={onDeleteExercise}
            isActive
            isDetailView
          />
          <View style={{ height: Platform.OS === 'ios' ? 60 : 40 }} />
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ======================== STYLES ========================

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background.scrim,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_H,
    backgroundColor: Colors.background.surface,
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    borderTopWidth: 0.5,
    borderColor: Colors.border.light,
    overflow: 'hidden',
    ...Shadows.modal,
  },
  handleBar: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border.medium,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 0.5,
    gap: Spacing.md,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: Typography.size.subheading,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.primary,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.background.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 13,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.secondary,
  },
  colorLine: { height: 2, width: '100%' },
  scroll: { flex: 1 },
  scrollContent: {
    padding: Spacing.lg,
  },
});
