// KAIROS — Canvas layout math (pure)
//
// All functions here are deterministic and side-effect free so the
// canvas behaviour is fully testable without a renderer. Coords are
// in "cells" (logical grid units). Pixel conversion lives at the
// rendering edge.

import {
  CANVAS_COLUMNS,
  CANVAS_SPANS,
  type CanvasPosition,
  type CanvasSpan,
  type CanvasWidgetSize,
} from '../../../types/canvas';

export interface CanvasItem {
  id: string;
  size: CanvasWidgetSize;
  canvasPosition: CanvasPosition | null;
}

export interface PlacedItem<T extends CanvasItem> {
  item: T;
  position: CanvasPosition;
  span: CanvasSpan;
}

/**
 * Span (w,h) for a widget size. Always defined.
 */
export function getSpan(size: CanvasWidgetSize): CanvasSpan {
  return CANVAS_SPANS[size];
}

/**
 * True if a placement of (col,row,span) falls outside the grid horizontally
 * or below 0. The canvas has no row ceiling (it scrolls).
 */
export function isOutOfBounds(col: number, row: number, span: CanvasSpan): boolean {
  if (col < 0 || row < 0) return true;
  if (col + span.w > CANVAS_COLUMNS) return true;
  return false;
}

/**
 * True if two rectangles overlap on the grid.
 */
export function rectsOverlap(
  a: { col: number; row: number; span: CanvasSpan },
  b: { col: number; row: number; span: CanvasSpan },
): boolean {
  const aRight = a.col + a.span.w;
  const aBottom = a.row + a.span.h;
  const bRight = b.col + b.span.w;
  const bBottom = b.row + b.span.h;
  return a.col < bRight && aRight > b.col && a.row < bBottom && aBottom > b.row;
}

/**
 * Scan-line search for the first free spot that fits `span`, starting at
 * row 0 col 0. Considers `occupied` as immovable obstacles. Returns the
 * first {col,row} where the candidate rectangle does not overlap anything.
 *
 * Used both for auto-packing brand-new blocks and for snapping after a
 * drop when the dropped cell happens to be occupied.
 */
export function findFreeSpot(
  occupied: readonly { col: number; row: number; span: CanvasSpan }[],
  span: CanvasSpan,
  startRow = 0,
): CanvasPosition {
  // Scan-line is bounded by occupied.length + 1 rows per column — a
  // brand-new spot always exists below the last occupied row.
  const maxRow = occupied.reduce((max, o) => Math.max(max, o.row + o.span.h), startRow) + span.h;

  for (let row = startRow; row <= maxRow; row++) {
    for (let col = 0; col + span.w <= CANVAS_COLUMNS; col++) {
      const candidate = { col, row, span };
      if (occupied.some((o) => rectsOverlap(candidate, o))) continue;
      return { col, row };
    }
  }
  // Fallback (unreachable in practice): drop at row maxRow, col 0.
  return { col: 0, row: maxRow };
}

/**
 * Place every item on the canvas. Items with an existing `canvasPosition`
 * keep their slot (unless that slot would collide with another anchored
 * item — then the colliding item gets repacked). Items without a position
 * get auto-packed into the next free spot.
 *
 * Deterministic order: anchored items first (sorted by row, then col),
 * then unanchored items in their input order. This means input order
 * decides ties for fresh blocks, so calling code can pass a sorted list
 * (e.g. by sort_order or created_at).
 */
export function packLayout<T extends CanvasItem>(items: T[]): PlacedItem<T>[] {
  const anchored: T[] = [];
  const floating: T[] = [];
  for (const it of items) {
    if (it.canvasPosition) anchored.push(it);
    else floating.push(it);
  }

  // Stable ordering: anchored by row asc, col asc.
  anchored.sort((a, b) => {
    const ap = a.canvasPosition!;
    const bp = b.canvasPosition!;
    if (ap.row !== bp.row) return ap.row - bp.row;
    return ap.col - bp.col;
  });

  const placed: PlacedItem<T>[] = [];
  const occupied: { col: number; row: number; span: CanvasSpan }[] = [];

  for (const item of anchored) {
    const span = getSpan(item.size);
    const pos = item.canvasPosition!;
    const bounded = isOutOfBounds(pos.col, pos.row, span);
    const collides = occupied.some((o) => rectsOverlap({ ...pos, span }, o));
    const finalPos = bounded || collides ? findFreeSpot(occupied, span, pos.row) : pos;
    placed.push({ item, position: finalPos, span });
    occupied.push({ col: finalPos.col, row: finalPos.row, span });
  }

  for (const item of floating) {
    const span = getSpan(item.size);
    const pos = findFreeSpot(occupied, span);
    placed.push({ item, position: pos, span });
    occupied.push({ col: pos.col, row: pos.row, span });
  }

  return placed;
}

// ── Pixel ↔ cell conversion ────────────────────────────────────────────

export interface GridMetrics {
  cellSize: number; // px — one cell is square
  gap: number; // px — gap between cells
  padding: number; // px — outer padding from screen edge
}

/**
 * Compute cell size from container width so the grid fills horizontally.
 *   width = padding*2 + cellSize*CANVAS_COLUMNS + gap*(CANVAS_COLUMNS-1)
 */
export function computeMetrics(containerWidth: number, gap: number, padding: number): GridMetrics {
  const usable = containerWidth - padding * 2 - gap * (CANVAS_COLUMNS - 1);
  const cellSize = Math.floor(usable / CANVAS_COLUMNS);
  return { cellSize, gap, padding };
}

/** Top-left pixel of a (col,row) cell, relative to the canvas origin. */
export function cellToPx(col: number, row: number, m: GridMetrics): { x: number; y: number } {
  return {
    x: m.padding + col * (m.cellSize + m.gap),
    y: row * (m.cellSize + m.gap),
  };
}

/** Pixel size of a span (w,h) including internal gaps. */
export function spanToPx(span: CanvasSpan, m: GridMetrics): { width: number; height: number } {
  return {
    width: span.w * m.cellSize + (span.w - 1) * m.gap,
    height: span.h * m.cellSize + (span.h - 1) * m.gap,
  };
}

/** Nearest cell for a pixel coord, clamped horizontally to grid bounds. */
export function pxToCell(x: number, y: number, span: CanvasSpan, m: GridMetrics): CanvasPosition {
  const stride = m.cellSize + m.gap;
  const rawCol = Math.round((x - m.padding) / stride);
  const rawRow = Math.round(y / stride);
  const maxCol = CANVAS_COLUMNS - span.w;
  return {
    col: Math.max(0, Math.min(maxCol, rawCol)),
    row: Math.max(0, rawRow),
  };
}

/** Total height (in px) of a packed layout, useful for the scroll container. */
export function layoutHeight<T extends CanvasItem>(
  placed: PlacedItem<T>[],
  m: GridMetrics,
): number {
  if (placed.length === 0) return 0;
  const maxBottom = placed.reduce((acc, p) => Math.max(acc, p.position.row + p.span.h), 0);
  return maxBottom * (m.cellSize + m.gap);
}
