// KAIROS — Block folder grouping (pure)
//
// The literal reading of CLAUDE.md's "apps as activity groups": in the grid
// view of Blocks, ≥2 blocks of the same discipline collapse into a folder
// (iOS home-screen rule — nobody makes a folder of one app). Deterministic and
// side-effect free so the grouping is fully testable without a renderer; the UI
// (DisciplineFolder/FolderGrid) reads its output. Mirrors the shape of
// canvasLayout.ts — pure math at the core, pixels/animation at the edge.

import type { WorkoutBlock, Discipline } from '../../../types/core';

export interface BlockFolder {
  kind: 'folder';
  discipline: Discipline;
  blocks: WorkoutBlock[]; // ≥2, in input order (respects the caller's sort)
}
export interface BlockSingleton {
  kind: 'single';
  block: WorkoutBlock;
}
export type BlockGridItem = BlockFolder | BlockSingleton;

/**
 * Groups blocks by discipline, preserving input order. A discipline with ≥2
 * blocks becomes one folder placed at its FIRST block's position; exactly 1
 * stays a loose card. The caller passes an already-filtered (no archived) and
 * sorted list — this function neither filters nor sorts, it only groups
 * stably. Output order = order of first appearance of each discipline, so the
 * active sort (recent/name/…) stays meaningful both across folders and within
 * each folder's members.
 */
export function groupBlocksIntoFolders(blocks: WorkoutBlock[]): BlockGridItem[] {
  // Single pass: bucket by discipline while remembering first-appearance order
  // via Map insertion order. Then emit each bucket as folder (≥2) or single.
  const buckets = new Map<Discipline, WorkoutBlock[]>();
  for (const block of blocks) {
    const existing = buckets.get(block.discipline);
    if (existing) {
      existing.push(block);
    } else {
      buckets.set(block.discipline, [block]);
    }
  }

  const items: BlockGridItem[] = [];
  for (const [discipline, members] of buckets) {
    if (members.length >= 2) {
      items.push({ kind: 'folder', discipline, blocks: members });
    } else {
      items.push({ kind: 'single', block: members[0] });
    }
  }
  return items;
}

/**
 * Initial open state of a discipline folder (STORY-06b). A folder holding a
 * freshly-created (highlighted) block always opens — revealing the new block
 * wins over memory; otherwise the remembered choice decides; default closed.
 * `persisted === undefined` means the user never toggled this folder. Mirrors
 * planner's resolveFolderOpen idiom, keyed by discipline instead of DayCard.
 */
export function resolveBlockFolderOpen(
  persisted: boolean | undefined,
  containsHighlight: boolean,
): boolean {
  return containsHighlight || persisted === true;
}
