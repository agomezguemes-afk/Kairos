// KAIROS — DisciplineFolder (STORY-05)
// A per-discipline "app folder" for the Blocks grid view: a header-tile that
// reads as an iOS home-screen folder (2×2 mini-preview of member icons +
// discipline label + count + chevron) which expands in-place (accordion) to
// reveal its member blocks as BlockCards in a 2-column sub-grid.
//
// NOT HomeFolder: multiple of these exist (one per discipline), each with its
// own open state PERSISTED per discipline in uiStore (STORY-06b). It only
// *mirrors* HomeFolder's height-collapse technique + its no-flash cold-start
// restore (jump `progress` before `setOpen`). Key lesson carried from STORY-01:
// re-measure the body on every layout (no `measuredOnce` cache) so content that
// grows after mount is never clipped forever.
//
// Gold stays reserved for Kai: the tile wears the discipline tint + ink, never
// gold (AC #8).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import type { Discipline, WorkoutBlock } from '../../../types/core';
import { DISCIPLINE_CONFIGS } from '../../../types/core';
import { Colors, Radius, Shadows, Spacing, Type } from '../../../theme/tokens';
import { useAccordion } from '../../../hooks/useAccordion';
import { useUIStore } from '../../../store/uiStore';
import { resolveBlockFolderOpen } from '../lib/blockFolders';
import BlockCard from './BlockCard';
import { ICON_FOR } from './CanvasWidget';

interface DisciplineFolderProps {
  discipline: Discipline;
  blocks: WorkoutBlock[]; // ≥2
  /** true when this folder holds the freshly-created (highlighted) block — opens
   *  the folder regardless of remembered state (STORY-06b §3.4, highlight wins). */
  containsHighlight: boolean;
  /** FolderGrid's running grid position for this folder's first member — keeps
   * the entrance stagger monotonic with the surrounding loose cards instead of
   * restarting at 0 (matters for initialOpen=true, which mounts immediately). */
  startIndex: number;
  onOpenBlock: (b: WorkoutBlock) => void;
  onBlockOptions: (b: WorkoutBlock) => void;
  highlightTargetId?: string | null;
}

const FALLBACK_ICON = '\u{1F3CB}'; // 🏋️ — same fallback as CanvasWidget/BlockCard

// Staggered "pop out of the folder" (STORY-06a): instead of the accordion's
// uniform rise, each member derives its own scale+fade+lift from the shared
// `progress`, offset by its position INSIDE the folder so cards emerge 1-by-1
// (like iOS zooming apps out of a folder) yet all land within the same 240ms
// open. The per-card offset is capped so big folders don't trail a late card.
interface FolderMemberProps {
  progress: SharedValue<number>;
  localIndex: number; // position WITHIN this folder — visual stagger only
  children: React.ReactNode;
}

function FolderMemberInner({ progress, localIndex, children }: FolderMemberProps) {
  const start = Math.min(localIndex * 0.07, 0.35);
  const style = useAnimatedStyle(() => {
    const p = interpolate(progress.value, [start, start + 0.5], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: p,
      transform: [
        { scale: interpolate(p, [0, 1], [0.85, 1], Extrapolation.CLAMP) },
        { translateY: interpolate(p, [0, 1], [8, 0], Extrapolation.CLAMP) },
      ],
    };
  });
  return <Animated.View style={[styles.memberCell, style]}>{children}</Animated.View>;
}

const FolderMember = React.memo(FolderMemberInner);

function DisciplineFolderInner({
  discipline,
  blocks,
  containsHighlight,
  startIndex,
  onOpenBlock,
  onBlockOptions,
  highlightTargetId,
}: DisciplineFolderProps) {
  const { blockFoldersOpen, _hasHydrated, setBlockFolderOpen } = useUIStore();
  const persisted = blockFoldersOpen[discipline];
  const resolved = resolveBlockFolderOpen(persisted, containsHighlight);

  // Starts collapsed + progress 0 — the safe state before persist has told us
  // what the user last chose for THIS discipline. The cold-start restore below
  // jumps straight to `resolved` without animating.
  const [open, setOpen] = useState(false);

  // Shared accordion mechanics (STORY-05b): height-collapse + chevron, re-measuring
  // the body on every layout so content that grows after mount is never clipped
  // forever (STORY-01 lesson, now owned by the hook). `contentStyle` (uniform rise)
  // is intentionally NOT used here — STORY-06a replaces it with a per-member pop
  // derived from the same `progress` — which is ALSO the SharedValue the hydration
  // restore below jumps, so an instant jump lands every FolderMember on its final
  // state (opacity/scale) with no flash and no pop, exactly like a closed folder.
  const { progress, onContentLayout, containerStyle, chevronStyle } = useAccordion(open);

  // Cold-start restore (mirror of HomeFolder STORY-03) — the no-flash wiring.
  // Fires once persist finishes rehydrating (and on a fresh mount at runtime,
  // e.g. a new folder forming). We JUMP `progress` to the resolved state
  // instantly (no withTiming) so the folder appears already in place, then align
  // `open`. Setting progress before the state change means the hook's [open]
  // effect lands its withTiming on a value that's already the target → no motion.
  // Only genuine user toggles animate.
  useEffect(() => {
    if (!_hasHydrated) return;
    if (open !== resolved) {
      progress.value = resolved ? 1 : 0;
      setOpen(resolved);
    }
    // Keyed on hydration only: `resolved`/`open` are read fresh in the commit
    // where `_hasHydrated` flips true; re-running on every toggle would re-trigger
    // the instant jump and defeat the toggle animation (same reasoning as HomeFolder).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_hasHydrated]);

  const handleToggle = useCallback(() => {
    // Guard the narrow pre-hydration window: persist's default `merge` lets the
    // disk-read value win over live state, so a tap before `_hasHydrated` could be
    // silently reverted once hydration completes (STORY-03 lesson).
    if (!_hasHydrated) return;
    Haptics.selectionAsync().catch(() => {});
    const next = !open;
    setOpen(next);
    // Persist the explicit choice for THIS discipline — from now on it wins.
    setBlockFolderOpen(discipline, next);
  }, [open, _hasHydrated, discipline, setBlockFolderOpen]);

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
        <View style={styles.memberGrid} onLayout={onContentLayout}>
          {blocks.map((b, i) => (
            // localIndex=i → visual stagger of the pop (position inside the folder).
            // index=startIndex+i → BlockCard's own mount-entrance stagger, kept
            // monotonic with the surrounding loose cards. Two distinct concerns.
            <FolderMember key={b.id} progress={progress} localIndex={i}>
              <BlockCard
                block={b}
                index={startIndex + i}
                onPress={() => onOpenBlock(b)}
                onLongPress={() => onBlockOptions(b)}
                isHighlighted={b.id === highlightTargetId}
              />
            </FolderMember>
          ))}
        </View>
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
