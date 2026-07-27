// KAIROS — FolderGrid (STORY-05)
// The grid-view container for Blocks: groups `blocks` by discipline
// (groupBlocksIntoFolders) and renders full-width DisciplineFolders interleaved
// with rows of loose BlockCards (2 columns). Replaces the plain FlatList in the
// grid branch of BlocksScreen so folders + loose cards can coexist and reflow
// smoothly when a folder expands.
//
// A ScrollView (not FlatList) because we mix full-width folders with 2-col rows
// and need in-place accordion expansion with animated reflow — layouts a
// FlatList's row recycling would fight. Block counts here are personal-scale
// (tens, not thousands), so the tradeoff is sound.

import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, LinearTransition, useReducedMotion } from 'react-native-reanimated';

import type { WorkoutBlock } from '../../../types/core';
import { Spacing } from '../../../theme/tokens';
import BlockCard from './BlockCard';
import DisciplineFolder from './DisciplineFolder';
import { groupBlocksIntoFolders, type BlockFolder } from '../lib/blockFolders';

const H_PAD = Spacing.screen.horizontal;

interface FolderGridProps {
  blocks: WorkoutBlock[];
  onOpenBlock: (b: WorkoutBlock) => void;
  onBlockOptions: (b: WorkoutBlock) => void;
  highlightTargetId?: string | null;
  bottomInset: number;
}

type SingleEntry = { block: WorkoutBlock; index: number };
type RenderRow =
  | { key: string; kind: 'folder'; folder: BlockFolder; containsHighlight: boolean; startIndex: number }
  | { key: string; kind: 'singles'; entries: SingleEntry[] };

function FolderGridInner({
  blocks,
  onOpenBlock,
  onBlockOptions,
  highlightTargetId,
  bottomInset,
}: FolderGridProps) {
  const reduceMotion = useReducedMotion();
  const layoutAnim = reduceMotion
    ? undefined
    : LinearTransition.duration(220).easing(Easing.out(Easing.cubic));

  // Build render rows: consecutive loose singles chunk into 2-column rows;
  // folders break the chunk and render full-width in between. A running global
  // index keeps each BlockCard's entrance stagger monotonic across the grid.
  const rows = useMemo<RenderRow[]>(() => {
    const items = groupBlocksIntoFolders(blocks);
    const out: RenderRow[] = [];
    let buffer: SingleEntry[] = [];
    let globalIndex = 0;

    const flush = () => {
      for (let i = 0; i < buffer.length; i += 2) {
        const pair = buffer.slice(i, i + 2);
        out.push({ key: `s-${pair[0].block.id}`, kind: 'singles', entries: pair });
      }
      buffer = [];
    };

    for (const item of items) {
      if (item.kind === 'single') {
        buffer.push({ block: item.block, index: globalIndex });
        globalIndex += 1;
      } else {
        flush();
        // Honest name: this is "does this folder hold the highlighted block".
        // DisciplineFolder resolves the actual open state (persisted vs highlight).
        const containsHighlight = highlightTargetId
          ? item.blocks.some((b) => b.id === highlightTargetId)
          : false;
        out.push({
          key: `f-${item.discipline}`,
          kind: 'folder',
          folder: item,
          containsHighlight,
          startIndex: globalIndex,
        });
        globalIndex += item.blocks.length;
      }
    }
    flush();
    return out;
  }, [blocks, highlightTargetId]);

  // Plain helper, not useCallback: only ever invoked inline via .map() inside
  // JSX (never passed to a memoized child as a stable-identity prop), so
  // memoizing it bought nothing but an extra dependency-array allocation.
  const renderSingle = ({ block, index }: SingleEntry) => (
    <View key={block.id} style={styles.singleCell}>
      <BlockCard
        block={block}
        index={index}
        onPress={() => onOpenBlock(block)}
        onLongPress={() => onBlockOptions(block)}
        isHighlighted={block.id === highlightTargetId}
      />
    </View>
  );

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 100 }]}
      showsVerticalScrollIndicator={false}
    >
      {rows.map((row) =>
        row.kind === 'folder' ? (
          <Animated.View key={row.key} layout={layoutAnim}>
            <DisciplineFolder
              discipline={row.folder.discipline}
              blocks={row.folder.blocks}
              containsHighlight={row.containsHighlight}
              startIndex={row.startIndex}
              onOpenBlock={onOpenBlock}
              onBlockOptions={onBlockOptions}
              highlightTargetId={highlightTargetId}
            />
          </Animated.View>
        ) : (
          <Animated.View key={row.key} layout={layoutAnim} style={styles.singleRow}>
            {row.entries.map(renderSingle)}
            {row.entries.length === 1 && <View style={styles.singleCell} />}
          </Animated.View>
        ),
      )}
    </ScrollView>
  );
}

export default React.memo(FolderGridInner);

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    // Mirrors BlocksScreen's old gridContent: H_PAD minus half a card gutter so
    // BlockCard's own gap.cards/2 padding lands the cards at H_PAD.
    paddingHorizontal: H_PAD - Spacing.gap.cards / 2,
    paddingTop: Spacing.sm,
  },
  singleRow: {
    flexDirection: 'row',
  },
  singleCell: {
    width: '50%',
  },
});
