// KAIROS — DisciplineFolder (STORY-05)
// A per-discipline "app folder" for the Blocks grid view: a header-tile that
// reads as an iOS home-screen folder (2×2 mini-preview of member icons +
// discipline label + count + chevron) which expands in-place (accordion) to
// reveal its member blocks as BlockCards in a 2-column sub-grid.
//
// NOT HomeFolder: multiple of these exist (one per discipline), each with its
// own EPHEMERAL open state (no store — STORY-06 persists). It only *mirrors*
// HomeFolder's height-collapse technique. Key lesson carried from STORY-01:
// re-measure the body on every layout (no `measuredOnce` cache) so content that
// grows after mount is never clipped forever.
//
// Gold stays reserved for Kai: the tile wears the discipline tint + ink, never
// gold (AC #8).

import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import type { Discipline, WorkoutBlock } from '../../../types/core';
import { DISCIPLINE_CONFIGS } from '../../../types/core';
import { Colors, Radius, Shadows, Spacing, Type } from '../../../theme/tokens';
import { useAccordion } from '../../../hooks/useAccordion';
import BlockCard from './BlockCard';
import { ICON_FOR } from './CanvasWidget';

interface DisciplineFolderProps {
  discipline: Discipline;
  blocks: WorkoutBlock[]; // ≥2
  /** true when this folder contains the highlighted block (§3.4) → starts open. */
  initialOpen?: boolean;
  /** FolderGrid's running grid position for this folder's first member — keeps
   * the entrance stagger monotonic with the surrounding loose cards instead of
   * restarting at 0 (matters for initialOpen=true, which mounts immediately). */
  startIndex: number;
  onOpenBlock: (b: WorkoutBlock) => void;
  onBlockOptions: (b: WorkoutBlock) => void;
  highlightTargetId?: string | null;
}

const FALLBACK_ICON = '\u{1F3CB}'; // 🏋️ — same fallback as CanvasWidget/BlockCard

function DisciplineFolderInner({
  discipline,
  blocks,
  initialOpen,
  startIndex,
  onOpenBlock,
  onBlockOptions,
  highlightTargetId,
}: DisciplineFolderProps) {
  const [open, setOpen] = useState(initialOpen ?? false);

  // Shared accordion mechanics (STORY-05b): height-collapse + rise + chevron,
  // re-measuring the body on every layout so content that grows after mount is
  // never clipped forever (STORY-01 lesson, now owned by the hook).
  const { onContentLayout, containerStyle, contentStyle, chevronStyle } = useAccordion(open);

  const handleToggle = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setOpen((o) => !o);
  }, []);

  const label = DISCIPLINE_CONFIGS[discipline]?.name ?? discipline;
  const count = blocks.length;
  const tint = Colors.tint[discipline] ?? Colors.tint.general;

  // Mini 2×2 preview: first 4 member icons, or 3 icons + "+N" overflow badge
  // when the folder holds more than 4 (§3.2).
  const preview = useMemo<{ key: string; glyph: string; isOverflow: boolean }[]>(() => {
    const overflow = count > 4;
    const shown = overflow ? blocks.slice(0, 3) : blocks.slice(0, 4);
    const cells = shown.map((b) => ({
      key: b.id,
      glyph: ICON_FOR[b.icon] ?? FALLBACK_ICON,
      isOverflow: false,
    }));
    if (overflow) {
      cells.push({ key: '__overflow', glyph: `+${count - 3}`, isOverflow: true });
    }
    return cells;
  }, [blocks, count]);

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={handleToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${label}, ${count} bloques`}
        accessibilityHint="Toca para mostrar u ocultar los bloques"
        style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
      >
        <View style={[styles.tile, { backgroundColor: tint }]}>
          <View style={styles.miniGrid}>
            {preview.map((cell) => (
              <View key={cell.key} style={styles.miniCell}>
                <Text
                  style={cell.isOverflow ? styles.miniOverflow : styles.miniGlyph}
                  numberOfLines={1}
                  allowFontScaling={false}
                >
                  {cell.glyph}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.labelCol}>
          <Text style={styles.title} numberOfLines={1} maxFontSizeMultiplier={1.5}>
            {label}
          </Text>
          <Text style={styles.count} numberOfLines={1} maxFontSizeMultiplier={1.5}>
            {count} bloques
          </Text>
        </View>

        <Animated.View style={chevronStyle}>
          <Feather name="chevron-down" size={18} color={Colors.ink.tertiary} />
        </Animated.View>
      </Pressable>

      <Animated.View
        style={[styles.collapsible, containerStyle]}
        // Collapsed the members stay mounted (clipped to height 0), which would
        // otherwise keep them in the a11y tree — gate the subtree on `open` so
        // the header is the only focusable element when closed (STORY-07).
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
      >
        <Animated.View style={[styles.memberGrid, contentStyle]} onLayout={onContentLayout}>
          {blocks.map((b, i) => (
            <View key={b.id} style={styles.memberCell}>
              <BlockCard
                block={b}
                index={startIndex + i}
                onPress={() => onOpenBlock(b)}
                onLongPress={() => onBlockOptions(b)}
                isHighlighted={b.id === highlightTargetId}
              />
            </View>
          ))}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

export default React.memo(DisciplineFolderInner);

const TILE = 56;

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: Spacing.gap.cards / 2,
  },
  header: {
    // Only the header carries the H_PAD inset (via gap.cards/2). The member grid
    // below stays full-width so its 50% cells + BlockCard padding land members
    // at exactly H_PAD — pixel-aligned with the loose cards outside the folder.
    marginHorizontal: Spacing.gap.cards / 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.paper.raised,
    borderRadius: Radius.lg,
    ...Shadows.card,
  },
  headerPressed: {
    opacity: 0.82,
  },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: Radius.lg, // WHY: brief §3.2 — iOS folder-icon roundness
    padding: Spacing.xs + 1,
    justifyContent: 'center',
  },
  miniGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  miniCell: {
    width: 20,
    height: 20,
    borderRadius: Radius.xs,
    backgroundColor: Colors.paper.raised,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.subtle,
  },
  miniGlyph: {
    fontSize: 12,
  },
  miniOverflow: {
    ...Type.micro,
    color: Colors.ink.secondary,
    fontVariant: ['tabular-nums'],
  },
  labelCol: {
    flex: 1,
  },
  title: {
    ...Type.subheading,
    color: Colors.ink.primary,
  },
  count: {
    ...Type.caption,
    color: Colors.ink.tertiary,
    marginTop: 1,
  },
  collapsible: {
    overflow: 'hidden',
  },
  memberGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: Spacing.gap.cards / 2,
  },
  // 50% cell mirrors the FlatList numColumns={2} geometry — BlockCard's own
  // gap.cards/2 padding supplies the gutter and outer inset.
  memberCell: {
    width: '50%',
  },
});
