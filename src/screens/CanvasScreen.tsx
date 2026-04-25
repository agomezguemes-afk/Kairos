import React, { useMemo, useCallback, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import CanvasView from '../components/CanvasView';
import Widget from '../components/Widget';
import { useWorkoutStore } from '../store/workoutStore';
import type { RootStackParamList } from '../types/navigation';
import type { WidgetData } from '../types/core';
import { DEFAULT_CANVAS_SETTINGS } from '../types/core';
import { Colors, Typography, Spacing, Radius, Shadows } from '../theme/index';

type CanvasRoute = RouteProp<RootStackParamList, 'Canvas'>;

const CANVAS_W = 2400;
const CANVAS_H = 3200;

export default function CanvasScreen() {
  const route = useRoute<CanvasRoute>();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { blockId } = route.params;

  const block = useWorkoutStore(
    useCallback((s) => s.blocks.find((b) => b.id === blockId) ?? null, [blockId]),
  );
  const ensureCanvasData = useWorkoutStore((s) => s.ensureCanvasData);
  const hydrateCanvas = useWorkoutStore((s) => s.hydrateCanvasFromContent);
  const addWidget = useWorkoutStore((s) => s.addWidget);
  const updateCanvasSettings = useWorkoutStore((s) => s.updateCanvasSettings);

  useEffect(() => {
    ensureCanvasData(blockId);
    hydrateCanvas(blockId);
  }, [blockId, ensureCanvasData, hydrateCanvas]);

  const widgets = useMemo<WidgetData[]>(() => {
    const map = block?.canvasData?.widgets ?? {};
    return Object.values(map).sort((a, b) => a.zIndex - b.zIndex);
  }, [block?.canvasData?.widgets]);

  const settings = block?.canvasData?.settings ?? DEFAULT_CANVAS_SETTINGS;

  const handleToggleGrid = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateCanvasSettings(blockId, { showGrid: !settings.showGrid });
  }, [blockId, settings.showGrid, updateCanvasSettings]);

  const handleAddNodeWidget = useCallback(() => {
    if (!block) return;
    const remaining = block.content.find(
      (n) =>
        n.type !== 'columnSection' &&
        !Object.values(block.canvasData?.widgets ?? {}).some((w) => w.contentNodeId === n.id),
    );
    if (!remaining) return;
    const count = Object.keys(block.canvasData?.widgets ?? {}).length;
    addWidget(blockId, remaining.id, { x: 24 + count * 32, y: 24 + count * 48 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [block, blockId, addWidget]);

  const handleZoomChange = useCallback(
    (zoom: number) => updateCanvasSettings(blockId, { zoom }),
    [blockId, updateCanvasSettings],
  );

  if (!block) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.empty}>Bloque no encontrado</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={styles.iconBtn}>
          <Feather name="arrow-left" size={20} color={Colors.text.primary} />
        </Pressable>
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>{block.name}</Text>
          <Text style={styles.subtitle}>Canvas · {widgets.length} widgets</Text>
        </View>
        <Pressable onPress={handleToggleGrid} hitSlop={8} style={styles.iconBtn}>
          <Feather
            name="grid"
            size={18}
            color={settings.showGrid ? Colors.accent.primary : Colors.text.tertiary}
          />
        </Pressable>
      </View>

      <CanvasView
        width={CANVAS_W}
        height={CANVAS_H}
        settings={settings}
        onZoomChange={handleZoomChange}
      >
        {widgets.map((w) => (
          <Widget key={w.id} blockId={blockId} widget={w} />
        ))}
      </CanvasView>

      <Pressable
        onPress={handleAddNodeWidget}
        style={[styles.fab, { bottom: insets.bottom + 24 }]}
      >
        <Feather name="plus" size={22} color={Colors.text.inverse} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background.surface,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    fontSize: Typography.size.body,
    color: Colors.text.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border.light,
    backgroundColor: Colors.background.surface,
  },
  iconBtn: {
    padding: Spacing.xs,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontSize: Typography.size.subheading,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.primary,
  },
  subtitle: {
    fontSize: Typography.size.micro,
    color: Colors.text.tertiary,
  },
  fab: {
    position: 'absolute',
    right: 24,
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent.primary,
    ...Shadows.modal,
  },
});
