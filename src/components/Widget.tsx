import React, { useCallback, useEffect, useState, useRef } from 'react';
import { StyleSheet, Pressable, View, Text } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withSpring,
  withSequence,
  withTiming,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import NodeRenderer from '../features/blocks/components/NodeRenderer';
import { getNodeIcon, getNodeLabel } from '../features/blocks/components/nodeMeta';
import type { WidgetData } from '../types/core';
import { useWorkoutStore } from '../store/workoutStore';
import { Radius, Shadows, Spacing, Typography } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { type GuideSlot } from './GuideLines';
import KIcon from './icons/KIcon';

const MIN_W = 80;
const MIN_H = 60;
const MAX_W = 1600;
const MAX_H = 2000;

const SNAP_THRESHOLD = 8;
const EDGE_MARGIN = 16;
const COMPACT_PX = 100;

export type BoundsSnapshot = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
};

export interface CanvasInteraction {
  bounds: SharedValue<BoundsSnapshot[]>;
  guideV: SharedValue<GuideSlot[]>;
  guideH: SharedValue<GuideSlot[]>;
  zoom: SharedValue<number>;
  canvasW: number;
  canvasH: number;
  gridSize: number;
  draggingId: SharedValue<string | null>;
  onSizeMatch: (text: string) => void;
}

interface WidgetProps {
  blockId: string;
  widget: WidgetData;
  ctx: CanvasInteraction;
}

type Corner = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const CORNERS: Corner[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

function clearGuides(arr: GuideSlot[]) {
  'worklet';
  for (let i = 0; i < arr.length; i++) arr[i].visible = 0;
}

function pushGuide(arr: GuideSlot[], val: number) {
  'worklet';
  for (let i = 0; i < arr.length; i++) {
    if (arr[i].visible === 1 && Math.abs(arr[i].value - val) < 0.5) return;
  }
  for (let i = 0; i < arr.length; i++) {
    if (arr[i].visible === 0) {
      arr[i].value = val;
      arr[i].visible = 1;
      return;
    }
  }
}

function triggerHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

function WidgetInner({ blockId, widget, ctx }: WidgetProps) {
  const { colors, mode } = useTheme();
  const isDark = mode === 'dark';
  const updatePosition = useWorkoutStore((s) => s.updateWidgetPosition);
  const updateSize = useWorkoutStore((s) => s.updateWidgetSize);
  const toggleFreeze = useWorkoutStore((s) => s.toggleWidgetFreeze);
  const removeWidget = useWorkoutStore((s) => s.removeWidget);
  const node = useWorkoutStore(
    useCallback(
      (s) =>
        s.blocks
          .find((b) => b.id === blockId)
          ?.content.find((n) => n.id === widget.contentNodeId) ?? null,
      [blockId, widget.contentNodeId],
    ),
  );

  const x = useSharedValue(widget.position.x);
  const y = useSharedValue(widget.position.y);
  const w = useSharedValue(widget.size.w);
  const h = useSharedValue(widget.size.h);

  const interacting = useSharedValue(0);
  const releasePulse = useSharedValue(1);
  const lastSnapX = useSharedValue<number>(Number.NEGATIVE_INFINITY);
  const lastSnapY = useSharedValue<number>(Number.NEGATIVE_INFINITY);
  const lastMatchW = useSharedValue<number>(Number.NEGATIVE_INFINITY);
  const lastMatchH = useSharedValue<number>(Number.NEGATIVE_INFINITY);

  useEffect(() => {
    x.value = widget.position.x;
    y.value = widget.position.y;
    w.value = widget.size.w;
    h.value = widget.size.h;
  }, [widget.position.x, widget.position.y, widget.size.w, widget.size.h, x, y, w, h]);

  const persistPosition = useCallback(
    (nx: number, ny: number) => updatePosition(blockId, widget.id, { x: nx, y: ny }),
    [blockId, widget.id, updatePosition],
  );
  const persistSize = useCallback(
    (nw: number, nh: number, nx: number, ny: number) => {
      updateSize(blockId, widget.id, { w: nw, h: nh });
      updatePosition(blockId, widget.id, { x: nx, y: ny });
    },
    [blockId, widget.id, updateSize, updatePosition],
  );

  // ===== Compact rendering reaction =====
  const [isCompact, setIsCompact] = useState(false);
  useAnimatedReaction(
    () => w.value * ctx.zoom.value < COMPACT_PX || h.value * ctx.zoom.value < COMPACT_PX,
    (compact, prev) => {
      if (compact !== prev) runOnJS(setIsCompact)(compact);
    },
    [],
  );

  // ===== Size-match label =====
  const [matchLabel, setMatchLabel] = useState<string | null>(null);
  const matchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showMatchLabel = useCallback((text: string) => {
    setMatchLabel(text);
    if (matchTimerRef.current) clearTimeout(matchTimerRef.current);
    matchTimerRef.current = setTimeout(() => setMatchLabel(null), 1000);
    triggerHaptic();
  }, []);
  useEffect(() => () => {
    if (matchTimerRef.current) clearTimeout(matchTimerRef.current);
  }, []);

  // ===== Drag gesture =====
  const dragStartX = useSharedValue(0);
  const dragStartY = useSharedValue(0);

  const widgetId = widget.id;
  const snapToGrid = widget.snapToGrid;
  const gridSize = ctx.gridSize;
  const canvasW = ctx.canvasW;
  const canvasH = ctx.canvasH;

  const dragGesture = Gesture.Pan()
    .enabled(!widget.frozen)
    .onStart(() => {
      dragStartX.value = x.value;
      dragStartY.value = y.value;
      interacting.value = 1;
      ctx.draggingId.value = widgetId;
      lastSnapX.value = Number.NEGATIVE_INFINITY;
      lastSnapY.value = Number.NEGATIVE_INFINITY;
    })
    .onUpdate((e) => {
      const rawX = dragStartX.value + e.translationX;
      const rawY = dragStartY.value + e.translationY;

      const ww = w.value;
      const hh = h.value;

      let snapX = rawX;
      let snapY = rawY;
      let bestDX = SNAP_THRESHOLD;
      let bestDY = SNAP_THRESHOLD;
      let snappedX = false;
      let snappedY = false;

      const vSlots = ctx.guideV.value;
      const hSlots = ctx.guideH.value;
      clearGuides(vSlots);
      clearGuides(hSlots);

      const selfCx = rawX + ww / 2;
      const selfCy = rawY + hh / 2;
      const selfRight = rawX + ww;
      const selfBottom = rawY + hh;

      const candidatesX: { selfEdge: number; targetEdge: number; line: number }[] = [];
      const candidatesY: { selfEdge: number; targetEdge: number; line: number }[] = [];

      // Canvas edges
      candidatesX.push({ selfEdge: rawX, targetEdge: 0, line: 0 });
      candidatesX.push({ selfEdge: rawX, targetEdge: EDGE_MARGIN, line: EDGE_MARGIN });
      candidatesX.push({ selfEdge: selfRight, targetEdge: canvasW, line: canvasW });
      candidatesX.push({
        selfEdge: selfRight,
        targetEdge: canvasW - EDGE_MARGIN,
        line: canvasW - EDGE_MARGIN,
      });
      candidatesX.push({ selfEdge: selfCx, targetEdge: canvasW / 2, line: canvasW / 2 });

      candidatesY.push({ selfEdge: rawY, targetEdge: 0, line: 0 });
      candidatesY.push({ selfEdge: rawY, targetEdge: EDGE_MARGIN, line: EDGE_MARGIN });
      candidatesY.push({ selfEdge: selfBottom, targetEdge: canvasH, line: canvasH });
      candidatesY.push({
        selfEdge: selfBottom,
        targetEdge: canvasH - EDGE_MARGIN,
        line: canvasH - EDGE_MARGIN,
      });
      candidatesY.push({ selfEdge: selfCy, targetEdge: canvasH / 2, line: canvasH / 2 });

      const others = ctx.bounds.value;
      for (let i = 0; i < others.length; i++) {
        const o = others[i];
        if (o.id === widgetId) continue;
        const oL = o.x, oR = o.x + o.w, oCx = o.x + o.w / 2;
        const oT = o.y, oB = o.y + o.h, oCy = o.y + o.h / 2;
        // Self-left aligns with other-left/right/center
        candidatesX.push({ selfEdge: rawX, targetEdge: oL, line: oL });
        candidatesX.push({ selfEdge: rawX, targetEdge: oR, line: oR });
        candidatesX.push({ selfEdge: rawX, targetEdge: oCx, line: oCx });
        candidatesX.push({ selfEdge: selfRight, targetEdge: oL, line: oL });
        candidatesX.push({ selfEdge: selfRight, targetEdge: oR, line: oR });
        candidatesX.push({ selfEdge: selfRight, targetEdge: oCx, line: oCx });
        candidatesX.push({ selfEdge: selfCx, targetEdge: oL, line: oL });
        candidatesX.push({ selfEdge: selfCx, targetEdge: oR, line: oR });
        candidatesX.push({ selfEdge: selfCx, targetEdge: oCx, line: oCx });

        candidatesY.push({ selfEdge: rawY, targetEdge: oT, line: oT });
        candidatesY.push({ selfEdge: rawY, targetEdge: oB, line: oB });
        candidatesY.push({ selfEdge: rawY, targetEdge: oCy, line: oCy });
        candidatesY.push({ selfEdge: selfBottom, targetEdge: oT, line: oT });
        candidatesY.push({ selfEdge: selfBottom, targetEdge: oB, line: oB });
        candidatesY.push({ selfEdge: selfBottom, targetEdge: oCy, line: oCy });
        candidatesY.push({ selfEdge: selfCy, targetEdge: oT, line: oT });
        candidatesY.push({ selfEdge: selfCy, targetEdge: oB, line: oB });
        candidatesY.push({ selfEdge: selfCy, targetEdge: oCy, line: oCy });
      }

      for (let i = 0; i < candidatesX.length; i++) {
        const c = candidatesX[i];
        const d = Math.abs(c.selfEdge - c.targetEdge);
        if (d < SNAP_THRESHOLD) {
          if (d < bestDX) {
            bestDX = d;
            snapX = rawX + (c.targetEdge - c.selfEdge);
            snappedX = true;
          }
          pushGuide(vSlots, c.line);
        }
      }
      for (let i = 0; i < candidatesY.length; i++) {
        const c = candidatesY[i];
        const d = Math.abs(c.selfEdge - c.targetEdge);
        if (d < SNAP_THRESHOLD) {
          if (d < bestDY) {
            bestDY = d;
            snapY = rawY + (c.targetEdge - c.selfEdge);
            snappedY = true;
          }
          pushGuide(hSlots, c.line);
        }
      }

      if (!snappedX && snapToGrid) snapX = Math.round(rawX / gridSize) * gridSize;
      if (!snappedY && snapToGrid) snapY = Math.round(rawY / gridSize) * gridSize;

      x.value = snapX;
      y.value = snapY;

      // Trigger haptic exactly when entering a new snap target.
      if (snappedX) {
        if (Math.abs(snapX - lastSnapX.value) > 0.5) {
          lastSnapX.value = snapX;
          runOnJS(triggerHaptic)();
        }
      } else {
        lastSnapX.value = Number.NEGATIVE_INFINITY;
      }
      if (snappedY) {
        if (Math.abs(snapY - lastSnapY.value) > 0.5) {
          lastSnapY.value = snapY;
          runOnJS(triggerHaptic)();
        }
      } else {
        lastSnapY.value = Number.NEGATIVE_INFINITY;
      }

      // Force-react guide arrays so the worklet re-reads them.
      ctx.guideV.value = vSlots;
      ctx.guideH.value = hSlots;
    })
    .onEnd(() => {
      const finalX = Math.max(0, Math.min(canvasW - w.value, x.value));
      const finalY = Math.max(0, Math.min(canvasH - h.value, y.value));
      x.value = withSpring(finalX, { damping: 20, stiffness: 220 });
      y.value = withSpring(finalY, { damping: 20, stiffness: 220 });
      releasePulse.value = withSequence(
        withTiming(1.03, { duration: 80 }),
        withTiming(1, { duration: 70 }),
      );
      interacting.value = 0;
      ctx.draggingId.value = null;
      const cleared = ctx.guideV.value;
      const cleared2 = ctx.guideH.value;
      clearGuides(cleared);
      clearGuides(cleared2);
      ctx.guideV.value = cleared;
      ctx.guideH.value = cleared2;
      runOnJS(persistPosition)(finalX, finalY);
    });

  // ===== Resize gestures (8 handles) =====
  const resizeStartX = useSharedValue(0);
  const resizeStartY = useSharedValue(0);
  const resizeStartW = useSharedValue(0);
  const resizeStartH = useSharedValue(0);

  const buildResizeGesture = (corner: Corner) =>
    Gesture.Pan()
      .enabled(!widget.frozen)
      .onStart(() => {
        resizeStartX.value = x.value;
        resizeStartY.value = y.value;
        resizeStartW.value = w.value;
        resizeStartH.value = h.value;
        interacting.value = 1;
        lastMatchW.value = Number.NEGATIVE_INFINITY;
        lastMatchH.value = Number.NEGATIVE_INFINITY;
      })
      .onUpdate((e) => {
        let nx = resizeStartX.value;
        let ny = resizeStartY.value;
        let nw = resizeStartW.value;
        let nh = resizeStartH.value;

        const dx = e.translationX;
        const dy = e.translationY;

        if (corner === 'nw' || corner === 'w' || corner === 'sw') {
          nx = resizeStartX.value + dx;
          nw = resizeStartW.value - dx;
        }
        if (corner === 'ne' || corner === 'e' || corner === 'se') {
          nw = resizeStartW.value + dx;
        }
        if (corner === 'nw' || corner === 'n' || corner === 'ne') {
          ny = resizeStartY.value + dy;
          nh = resizeStartH.value - dy;
        }
        if (corner === 'sw' || corner === 's' || corner === 'se') {
          nh = resizeStartH.value + dy;
        }

        if (nw < MIN_W) {
          if (corner === 'nw' || corner === 'w' || corner === 'sw') {
            nx = resizeStartX.value + (resizeStartW.value - MIN_W);
          }
          nw = MIN_W;
        }
        if (nh < MIN_H) {
          if (corner === 'nw' || corner === 'n' || corner === 'ne') {
            ny = resizeStartY.value + (resizeStartH.value - MIN_H);
          }
          nh = MIN_H;
        }
        if (nw > MAX_W) nw = MAX_W;
        if (nh > MAX_H) nh = MAX_H;

        // Size matching
        let matchedWLabel: string | null = null;
        let matchedHLabel: string | null = null;
        const others = ctx.bounds.value;
        const movesW = corner !== 'n' && corner !== 's';
        const movesH = corner !== 'e' && corner !== 'w';
        if (movesW) {
          for (let i = 0; i < others.length; i++) {
            const o = others[i];
            if (o.id === widgetId) continue;
            if (Math.abs(nw - o.w) < SNAP_THRESHOLD) {
              const delta = o.w - nw;
              nw = o.w;
              if (corner === 'nw' || corner === 'w' || corner === 'sw') nx -= delta;
              matchedWLabel = `Ancho igualado con ${o.label}`;
              break;
            }
          }
        }
        if (movesH) {
          for (let i = 0; i < others.length; i++) {
            const o = others[i];
            if (o.id === widgetId) continue;
            if (Math.abs(nh - o.h) < SNAP_THRESHOLD) {
              const delta = o.h - nh;
              nh = o.h;
              if (corner === 'nw' || corner === 'n' || corner === 'ne') ny -= delta;
              matchedHLabel = `Alto igualado con ${o.label}`;
              break;
            }
          }
        }

        if (snapToGrid) {
          if (movesW) {
            nw = Math.round(nw / gridSize) * gridSize;
            if (corner === 'nw' || corner === 'w' || corner === 'sw') {
              nx = Math.round(nx / gridSize) * gridSize;
            }
          }
          if (movesH) {
            nh = Math.round(nh / gridSize) * gridSize;
            if (corner === 'nw' || corner === 'n' || corner === 'ne') {
              ny = Math.round(ny / gridSize) * gridSize;
            }
          }
        }

        x.value = nx;
        y.value = ny;
        w.value = nw;
        h.value = nh;

        if (matchedWLabel) {
          if (Math.abs(nw - lastMatchW.value) > 0.5) {
            lastMatchW.value = nw;
            runOnJS(showMatchLabel)(matchedWLabel);
          }
        } else {
          lastMatchW.value = Number.NEGATIVE_INFINITY;
        }
        if (matchedHLabel) {
          if (Math.abs(nh - lastMatchH.value) > 0.5) {
            lastMatchH.value = nh;
            runOnJS(showMatchLabel)(matchedHLabel);
          }
        } else {
          lastMatchH.value = Number.NEGATIVE_INFINITY;
        }
      })
      .onEnd(() => {
        const fx = x.value;
        const fy = y.value;
        const fw = w.value;
        const fh = h.value;
        releasePulse.value = withSequence(
          withTiming(1.03, { duration: 80 }),
          withTiming(1, { duration: 70 }),
        );
        interacting.value = 0;
        runOnJS(persistSize)(fw, fh, fx, fy);
      });

  const resizeGestures = CORNERS.map((c) => ({ corner: c, gesture: buildResizeGesture(c) }));

  const containerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: releasePulse.value },
    ],
    width: w.value,
    height: h.value,
    opacity: interacting.value === 1 ? 0.85 : 1,
    zIndex: widget.zIndex + (interacting.value === 1 ? 1000 : 0),
    elevation: interacting.value === 1 ? 12 : 2,
    shadowOpacity: interacting.value === 1 ? 0.25 : 0.08,
  }));

  const handleFreeze = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleFreeze(blockId, widget.id);
  }, [blockId, widget.id, toggleFreeze]);

  const handleRemove = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    removeWidget(blockId, widget.id);
  }, [blockId, widget.id, removeWidget]);

  const widgetBg = colors.surface;
  const handleBg = colors.surfaceElevated;
  const borderCol = widget.frozen ? colors.gold[500] : colors.border;

  return (
    <Animated.View
      style={[
        styles.widget,
        { backgroundColor: widgetBg, borderColor: borderCol, borderWidth: widget.frozen ? 1 : StyleSheet.hairlineWidth, shadowOpacity: isDark ? 0 : 0.06 },
        containerStyle,
      ]}
    >
      <GestureDetector gesture={dragGesture}>
        <View style={[styles.handle, { backgroundColor: handleBg, borderBottomColor: colors.border }]}>
          <KIcon
            name={widget.frozen ? 'lock' : 'drag'}
            size={11}
            color={widget.frozen ? colors.gold[500] : colors.text.muted}
          />
          <Text style={[styles.handleText, { color: colors.text.secondary }]} numberOfLines={1}>
            {node ? getNodeLabel(node) : widget.frozen ? 'Bloqueado' : 'Mover'}
          </Text>
          <View style={styles.handleActions}>
            <Pressable onPress={handleFreeze} hitSlop={8} style={styles.iconBtn}>
              <KIcon name={widget.frozen ? 'unlock' : 'lock'} size={12} color={colors.text.secondary} />
            </Pressable>
            <Pressable onPress={handleRemove} hitSlop={8} style={styles.iconBtn}>
              <KIcon name="x" size={12} color={colors.danger} />
            </Pressable>
          </View>
        </View>
      </GestureDetector>

      <View style={styles.content}>
        {isCompact && node ? (
          <View style={styles.compact}>
            <KIcon name={mapNodeKIcon(node.type)} size={20} color={colors.gold[500]} />
            <Text style={[styles.compactLabel, { color: colors.text.secondary }]} numberOfLines={2}>
              {getNodeLabel(node)}
            </Text>
          </View>
        ) : (
          <NodeRenderer blockId={blockId} nodeId={widget.contentNodeId} />
        )}
      </View>

      {matchLabel && (
        <View style={[styles.matchLabelWrap, { backgroundColor: colors.gold[500] }]} pointerEvents="none">
          <Text style={[styles.matchLabel, { color: '#1A1A2E' }]}>{matchLabel}</Text>
        </View>
      )}

      {!widget.frozen && resizeGestures.map(({ corner, gesture }) => (
        <GestureDetector key={corner} gesture={gesture}>
          <View style={[styles.handleDot, { backgroundColor: colors.surface, borderColor: colors.gold[500] }, handlePositions[corner]]} />
        </GestureDetector>
      ))}
    </Animated.View>
  );
}

function mapNodeKIcon(type: string): import('./icons/KIcon').KIconName {
  switch (type) {
    case 'text': return 'note';
    case 'exercise': return 'barbell';
    case 'subBlock': return 'file';
    case 'image': return 'image';
    case 'divider': return 'columns';
    case 'customField': return 'note';
    case 'dashboard': return 'dashboard';
    case 'timer': return 'clock';
    case 'spacer': return 'columns';
    case 'columnSection': return 'columns';
    default: return 'note';
  }
}

export default React.memo(WidgetInner);

const HANDLE_SIZE = 14;
const HANDLE_OFFSET = -HANDLE_SIZE / 2;

const handlePositions: Record<Corner, any> = {
  nw: { top: HANDLE_OFFSET, left: HANDLE_OFFSET },
  n:  { top: HANDLE_OFFSET, left: '50%', marginLeft: HANDLE_OFFSET },
  ne: { top: HANDLE_OFFSET, right: HANDLE_OFFSET },
  e:  { top: '50%', right: HANDLE_OFFSET, marginTop: HANDLE_OFFSET },
  se: { bottom: HANDLE_OFFSET, right: HANDLE_OFFSET },
  s:  { bottom: HANDLE_OFFSET, left: '50%', marginLeft: HANDLE_OFFSET },
  sw: { bottom: HANDLE_OFFSET, left: HANDLE_OFFSET },
  w:  { top: '50%', left: HANDLE_OFFSET, marginTop: HANDLE_OFFSET },
};

const styles = StyleSheet.create({
  widget: {
    position: 'absolute',
    borderRadius: Radius.lg,
    ...Shadows.subtle,
  },
  handle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
  },
  handleText: {
    flex: 1,
    fontSize: Typography.caption.fontSize,
    fontWeight: Typography.caption.fontWeight,
    lineHeight: Typography.caption.lineHeight,
  },
  handleActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  iconBtn: {
    padding: 2,
  },
  content: {
    flex: 1,
    padding: Spacing.sm,
    overflow: 'hidden',
  },
  compact: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  compactLabel: {
    fontSize: Typography.caption.fontSize,
    fontWeight: Typography.caption.fontWeight,
    lineHeight: Typography.caption.lineHeight,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  matchLabelWrap: {
    position: 'absolute',
    top: -22,
    left: '50%',
    transform: [{ translateX: -80 }],
    width: 160,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: Radius.xs,
    alignItems: 'center',
  },
  matchLabel: {
    fontSize: 10,
    fontWeight: Typography.weight.semibold,
  },
  handleDot: {
    position: 'absolute',
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    borderRadius: HANDLE_SIZE / 2,
    borderWidth: 1.5,
    zIndex: 100,
  },
});
