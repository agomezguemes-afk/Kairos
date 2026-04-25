import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import type { ContentNode } from '../../../types/content';
import type { TextFormat } from '../../../types/content';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../../theme/index';

const TIMING_IN = { duration: 250, easing: Easing.out(Easing.cubic) };

const TEXT_FORMATS: { format: TextFormat; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { format: 'paragraph', label: 'Texto', icon: 'type' },
  { format: 'h1', label: 'Título 1', icon: 'bold' },
  { format: 'h2', label: 'Título 2', icon: 'bold' },
  { format: 'h3', label: 'Título 3', icon: 'bold' },
  { format: 'bullet', label: 'Lista', icon: 'list' },
  { format: 'numbered', label: 'Numerada', icon: 'list' },
  { format: 'checklist', label: 'Checklist', icon: 'check-square' },
];

const NODE_TYPE_LABELS: Record<string, string> = {
  text: 'Texto',
  exercise: 'Ejercicio',
  subBlock: 'Sub-bloque',
  image: 'Imagen',
  divider: 'Separador',
  customField: 'Campo',
  dashboard: 'Dashboard',
};

interface BlockActionSheetProps {
  visible: boolean;
  node: ContentNode | null;
  isFirst: boolean;
  isLast: boolean;
  onTurnInto: (nodeId: string, format: TextFormat) => void;
  onDuplicate: (nodeId: string) => void;
  onMoveUp: (nodeId: string) => void;
  onMoveDown: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onClose: () => void;
}

function BlockActionSheet({
  visible,
  node,
  isFirst,
  isLast,
  onTurnInto,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onDelete,
  onClose,
}: BlockActionSheetProps) {
  const translateY = useSharedValue(400);
  const backdropOp = useSharedValue(0);
  const [view, setView] = useState<'main' | 'turnInto'>('main');

  useEffect(() => {
    if (visible) {
      setView('main');
      backdropOp.value = withTiming(1, TIMING_IN);
      translateY.value = withTiming(0, TIMING_IN);
    }
  }, [visible, backdropOp, translateY]);

  const dismiss = (cb: () => void) => {
    backdropOp.value = withTiming(0, { duration: 180 });
    translateY.value = withTiming(400, { duration: 200, easing: Easing.in(Easing.cubic) }, () => {
      runOnJS(cb)();
    });
  };

  const handleClose = () => dismiss(onClose);

  const doAction = (action: () => void) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dismiss(action);
  };

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOp.value,
  }));

  if (!visible || !node) return null;

  const isText = node.type === 'text';
  const currentFormat = isText ? node.data.format : null;
  const typeLabel = NODE_TYPE_LABELS[node.type] ?? node.type;

  return (
    <Modal visible transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents="none" />
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <Animated.View style={[styles.sheet, sheetStyle]}>
          <View style={styles.handle} />

          {view === 'turnInto' ? (
            <>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setView('main');
                }}
                style={styles.backRow}
              >
                <Feather name="arrow-left" size={16} color={Colors.text.secondary} />
                <Text style={styles.backText}>Convertir en</Text>
              </Pressable>

              {TEXT_FORMATS.map(opt => {
                const active = currentFormat === opt.format;
                return (
                  <Pressable
                    key={opt.format}
                    onPress={() => doAction(() => onTurnInto(node.id, opt.format))}
                    style={[styles.actionRow, active && styles.actionRowActive]}
                  >
                    <Feather
                      name={opt.icon}
                      size={18}
                      color={active ? Colors.accent.primary : Colors.text.secondary}
                    />
                    <Text style={[styles.actionLabel, active && styles.actionLabelActive]}>
                      {opt.label}
                    </Text>
                    {active && <Feather name="check" size={16} color={Colors.accent.primary} />}
                  </Pressable>
                );
              })}
            </>
          ) : (
            <>
              <View style={styles.header}>
                <Text style={styles.headerLabel}>{typeLabel}</Text>
              </View>

              {isText && (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setView('turnInto');
                  }}
                  style={styles.actionRow}
                >
                  <Feather name="repeat" size={18} color={Colors.text.secondary} />
                  <Text style={styles.actionLabel}>Convertir en</Text>
                  <Feather name="chevron-right" size={16} color={Colors.text.tertiary} />
                </Pressable>
              )}

              <Pressable onPress={() => doAction(() => onDuplicate(node.id))} style={styles.actionRow}>
                <Feather name="copy" size={18} color={Colors.text.secondary} />
                <Text style={styles.actionLabel}>Duplicar</Text>
              </Pressable>

              {!isFirst && (
                <Pressable onPress={() => doAction(() => onMoveUp(node.id))} style={styles.actionRow}>
                  <Feather name="arrow-up" size={18} color={Colors.text.secondary} />
                  <Text style={styles.actionLabel}>Mover arriba</Text>
                </Pressable>
              )}

              {!isLast && (
                <Pressable onPress={() => doAction(() => onMoveDown(node.id))} style={styles.actionRow}>
                  <Feather name="arrow-down" size={18} color={Colors.text.secondary} />
                  <Text style={styles.actionLabel}>Mover abajo</Text>
                </Pressable>
              )}

              <View style={styles.separator} />

              <Pressable onPress={() => doAction(() => onDelete(node.id))} style={styles.actionRow}>
                <Feather name="trash-2" size={18} color="#E84545" />
                <Text style={[styles.actionLabel, styles.deleteLabel]}>Eliminar</Text>
              </Pressable>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

export default React.memo(BlockActionSheet);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: Colors.background.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['3xl'] + 20,
    paddingTop: Spacing.md,
    ...Shadows.modal,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border.medium,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  header: {
    paddingBottom: Spacing.md,
    marginBottom: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border.light,
  },
  headerLabel: {
    fontSize: Typography.size.micro,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border.light,
  },
  backText: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.primary,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.sm,
  },
  actionRowActive: {
    backgroundColor: Colors.accent.dim,
  },
  actionLabel: {
    flex: 1,
    fontSize: Typography.size.body,
    color: Colors.text.primary,
  },
  actionLabelActive: {
    color: Colors.accent.primary,
    fontWeight: Typography.weight.semibold,
  },
  deleteLabel: {
    color: '#E84545',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border.light,
    marginVertical: Spacing.sm,
  },
});
