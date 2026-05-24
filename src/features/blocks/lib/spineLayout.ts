// Spine-Bento layout engine — Batch M2 (conservative MVP).
//
// Maps a flat ContentNode[] into a sequence of SpineRow entries that the
// vertical spine renderer can consume.
//
// MVP rules (no auto-pairing, no half-width tiles):
//   1. Every node becomes exactly one row.
//   2. Every tile is full-width.
//   3. Column sections emit a "section" header row followed by one row per
//      child node. Children carry sectionId so future iterations can pair
//      them back into half-width bento rows.
//
// Future hooks (M3+): TileSize ('half' | 'wide') and multi-tile rows are
// already part of the type so we don't have to rewrite the renderer when
// pairing kicks in.

import type {
  ContentNode,
  ColumnSectionContentNode,
} from '../../../types/content';

export type StationKind =
  | 'exercise'   // ExerciseContentNode
  | 'note'       // TextContentNode
  | 'divider'    // DividerContentNode
  | 'section'    // ColumnSectionContentNode header
  | 'tool';      // image / timer / dashboard / spacer / subBlock / customField

export type StationState =
  | 'pending'
  | 'inProgress'
  | 'completed'
  | 'skipped';

export type TileSize = 'full' | 'half' | 'wide';

export interface SpineTile {
  node: ContentNode;
  size: TileSize;
}

export interface SpineRow {
  id: string;
  kind: StationKind;
  state: StationState;
  tiles: SpineTile[];
  sectionId?: string;
}

export function stationKindFor(node: ContentNode): StationKind {
  switch (node.type) {
    case 'exercise':       return 'exercise';
    case 'text':           return 'note';
    case 'divider':        return 'divider';
    case 'columnSection':  return 'section';
    default:               return 'tool';
  }
}

export function buildSpineRows(nodes: ContentNode[]): SpineRow[] {
  if (nodes.length === 0) return [];

  const sorted = [...nodes].sort((a, b) => a.order - b.order);

  const sectionNodes = sorted.filter(
    (n): n is ColumnSectionContentNode => n.type === 'columnSection',
  );
  const sectionIds = new Set(sectionNodes.map(n => n.id));

  const childrenBySection = new Map<string, ContentNode[]>();
  for (const id of sectionIds) childrenBySection.set(id, []);

  for (const n of sorted) {
    if (n.type === 'columnSection') continue;
    if (n.section && sectionIds.has(n.section)) {
      childrenBySection.get(n.section)!.push(n);
    }
  }
  for (const arr of childrenBySection.values()) {
    arr.sort((a, b) => a.order - b.order);
  }

  const rows: SpineRow[] = [];

  for (const n of sorted) {
    if (n.type === 'columnSection') {
      rows.push({
        id: n.id,
        kind: 'section',
        state: 'pending',
        tiles: [{ node: n, size: 'full' }],
      });
      const children = childrenBySection.get(n.id) ?? [];
      for (const c of children) {
        rows.push({
          id: c.id,
          kind: stationKindFor(c),
          state: 'pending',
          tiles: [{ node: c, size: 'full' }],
          sectionId: n.id,
        });
      }
    } else if (!n.section || !sectionIds.has(n.section)) {
      rows.push({
        id: n.id,
        kind: stationKindFor(n),
        state: 'pending',
        tiles: [{ node: n, size: 'full' }],
      });
    }
  }

  return rows;
}
