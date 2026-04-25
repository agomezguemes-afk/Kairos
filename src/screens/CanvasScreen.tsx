import React, { useMemo, useCallback, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useSharedValue } from 'react-native-reanimated';

import CanvasView from '../components/CanvasView';
import Widget, { type CanvasInteraction, type BoundsSnapshot } from '../components/Widget';
import GuideLines, { emptyGuides, type GuideSlot } from '../components/GuideLines';
import EmptyState from '../components/EmptyState';
import KIcon from '../components/icons/KIcon';
import { useWorkoutStore } from '../store/workoutStore';
import { useTheme } from '../theme/ThemeContext';
import { getNodeLabel } from '../features/blocks/components/nodeMeta';
import type { RootStackParamList } from '../types/navigation';
import type { WidgetData } from '../types/core';
import { DEFAULT_CANVAS_SETTINGS } from '../types/core';
import { Typography, Spacing, Radius, Shadows } from '../theme/tokens';

type CanvasRoute = RouteProp<RootStackParamList, 'Canvas'>;

const CANVAS_W = 2400;
const CANVAS_H = 3200;

export default function CanvasScreen() {
  const route = useRoute<CanvasRoute>();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { blockId } = route.params;
  const { colors, preference, setPreference, mode } = useTheme();

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

  const boundsSV = useSharedValue<BoundsSnapshot[]>([]);
  const guideV = useSharedValue<GuideSlot[]>(emptyGuides());
  const guideH = useSharedValue<GuideSlot[]>(emptyGuides());
  const zoomSV = useSharedValue<number>(settings.zoom);
  const draggingId = useSharedValue<string | null>(null);

  useEffect(() => {
    if (!block) {
      boundsSV.value = [];
      return;
    }
    const next: BoundsSnapshot[] = widgets.map((w) => {
      const node = block.content.find((n) => n.id === w.contentNodeId);
      return {
        id: w.id,
        x: w.position.x,
        y: w.position.y,
        w: w.size.w,
        h: w.size.h,
        label: node ? getNodeLabel(node) : '',
      };
    });
    boundsSV.value = next;
  }, [widgets, block, boundsSV]);

  const handleSizeMatch = useCallback((_text: string) => {}, []);

  const ctx: CanvasInteraction = useMemo(
    () => ({
      bounds: boundsSV,
      guideV,
      guideH,
      zoom: zoomSV,
      canvasW: CANVAS_W,
      canvasH: CANVAS_H,
      gridSize: settings.gridSize,
      draggingId,
      onSizeMatch: handleSizeMatch,
    }),
    [boundsSV, guideV, guideH, zoomSV, settings.gridSize, draggingId, handleSizeMatch],
  );

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

  const cycleTheme = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (preference === 'system') setPreference('light');
    else if (preference === 'light') setPreference('dark');
    else setPreference('system');
  }, [preference, setPreference]);

  const themeIcon = preference === 'system' ? 'settings' : preference === 'dark' ? 'lock' : 'eye';

  if (!block) {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: colors.surface }]}>
        <Text style={[styles.empty, { color: colors.text.secondary }]}>Bloque no encontrado</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={styles.iconBtn}>
          <KIcon name="x" size={18} color={colors.text.primary} />
        </Pressable>
        <View style={styles.titleWrap}>
          <Text style={[styles.title, { color: colors.text.primary }]} numberOfLines={1}>
            {block.name}
          </Text>
          <Text style={[styles.subtitle, { color: colors.text.muted }]}>
            Canvas · {widgets.length} widgets · {mode}
          </Text>
        </View>
        <Pressable onPress={cycleTheme} hitSlop={8} style={styles.iconBtn}>
          <KIcon name={themeIcon} size={18} color={colors.gold[500]} />
        </Pressable>
        <Pressable onPress={handleToggleGrid} hitSlop={8} style={styles.iconBtn}>
          <KIcon
            name="grid"
            size={18}
            color={settings.showGrid ? colors.gold[500] : colors.text.muted}
          />
        </Pressable>
      </View>

      <CanvasView
        width={CANVAS_W}
        height={CANVAS_H}
        settings={settings}
        zoom={zoomSV}
        onZoomChange={handleZoomChange}
      >
        <GuideLines guideV={guideV} guideH={guideH} width={CANVAS_W} height={CANVAS_H} />
        {widgets.map((w) => (
          <Widget key={w.id} blockId={blockId} widget={w} ctx={ctx} />
        ))}
      </CanvasView>

      {widgets.length === 0 && (
        <View pointerEvents="none" style={styles.emptyOverlay}>
          <EmptyState type="canvas" />
        </View>
      )}

      <Pressable
        onPress={handleAddNodeWidget}
        style={[styles.fab, { backgroundColor: colors.gold[500], bottom: insets.bottom + 24 }]}
      >
        <KIcon name="plus" size={22} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  empty: {
    fontSize: Typography.body.fontSize,
    lineHeight: Typography.body.lineHeight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: { padding: Spacing.xs },
  titleWrap: { flex: 1 },
  title: {
    fontSize: Typography.heading.fontSize,
    fontWeight: Typography.heading.fontWeight,
    lineHeight: Typography.heading.lineHeight,
  },
  subtitle: {
    fontSize: Typography.caption.fontSize,
    fontWeight: Typography.caption.fontWeight,
    lineHeight: Typography.caption.lineHeight,
  },
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    right: 24,
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.modal,
  },
});
