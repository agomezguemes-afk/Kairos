import { describe, it, expect } from 'vitest';
import {
  cellToPx,
  computeMetrics,
  findFreeSpot,
  getSpan,
  isOutOfBounds,
  layoutHeight,
  packLayout,
  pxToCell,
  rectsOverlap,
  spanToPx,
  type CanvasItem,
} from './canvasLayout';

const item = (
  id: string,
  size: 'small' | 'medium' | 'large',
  pos: { col: number; row: number } | null = null,
): CanvasItem => ({
  id,
  size,
  canvasPosition: pos,
});

describe('getSpan', () => {
  it('returns iOS-style spans for each size', () => {
    expect(getSpan('small')).toEqual({ w: 2, h: 2 });
    expect(getSpan('medium')).toEqual({ w: 4, h: 2 });
    expect(getSpan('large')).toEqual({ w: 4, h: 4 });
  });
});

describe('isOutOfBounds', () => {
  it('flags negatives', () => {
    expect(isOutOfBounds(-1, 0, { w: 2, h: 2 })).toBe(true);
    expect(isOutOfBounds(0, -1, { w: 2, h: 2 })).toBe(true);
  });
  it('flags right-edge overflow', () => {
    expect(isOutOfBounds(3, 0, { w: 2, h: 2 })).toBe(true); // 3+2=5 > 4 cols
    expect(isOutOfBounds(2, 0, { w: 2, h: 2 })).toBe(false); // 2+2=4 fits exactly
  });
  it('does not cap rows (canvas scrolls)', () => {
    expect(isOutOfBounds(0, 9999, { w: 2, h: 2 })).toBe(false);
  });
});

describe('rectsOverlap', () => {
  const s = { w: 2, h: 2 };
  it('detects identical placement', () => {
    expect(rectsOverlap({ col: 0, row: 0, span: s }, { col: 0, row: 0, span: s })).toBe(true);
  });
  it('rejects neighbours that just touch', () => {
    // (0..2,0..2) and (2..4,0..2) share an edge, no overlap.
    expect(rectsOverlap({ col: 0, row: 0, span: s }, { col: 2, row: 0, span: s })).toBe(false);
  });
  it('detects partial overlap', () => {
    expect(rectsOverlap({ col: 0, row: 0, span: s }, { col: 1, row: 1, span: s })).toBe(true);
  });
});

describe('findFreeSpot', () => {
  it('returns (0,0) on empty canvas', () => {
    expect(findFreeSpot([], { w: 2, h: 2 })).toEqual({ col: 0, row: 0 });
  });

  it('packs two smalls side-by-side on row 0', () => {
    const occupied = [{ col: 0, row: 0, span: { w: 2, h: 2 } }];
    expect(findFreeSpot(occupied, { w: 2, h: 2 })).toEqual({ col: 2, row: 0 });
  });

  it('drops a medium below a full row of smalls', () => {
    const occupied = [
      { col: 0, row: 0, span: { w: 2, h: 2 } },
      { col: 2, row: 0, span: { w: 2, h: 2 } },
    ];
    expect(findFreeSpot(occupied, { w: 4, h: 2 })).toEqual({ col: 0, row: 2 });
  });

  it('does not place a medium beside a small (4-col canvas, no room)', () => {
    const occupied = [{ col: 0, row: 0, span: { w: 2, h: 2 } }];
    // Medium needs w=4; only 2 cols are free on row 0 → goes to row 2.
    expect(findFreeSpot(occupied, { w: 4, h: 2 })).toEqual({ col: 0, row: 2 });
  });
});

describe('packLayout', () => {
  it('preserves anchored positions and packs floating around them', () => {
    const items = [
      item('a', 'small', { col: 2, row: 0 }),
      item('b', 'small'), // floating
      item('c', 'small'), // floating
    ];
    const placed = packLayout(items);
    const byId = Object.fromEntries(placed.map((p) => [p.item.id, p.position]));
    expect(byId.a).toEqual({ col: 2, row: 0 });
    expect(byId.b).toEqual({ col: 0, row: 0 });
    expect(byId.c).toEqual({ col: 0, row: 2 });
  });

  it('repacks an anchored item that collides with an earlier anchor', () => {
    const items = [
      item('a', 'medium', { col: 0, row: 0 }), // 4×2
      item('b', 'small', { col: 0, row: 0 }), // also claims (0,0) — should be moved
    ];
    const placed = packLayout(items);
    const byId = Object.fromEntries(placed.map((p) => [p.item.id, p.position]));
    expect(byId.a).toEqual({ col: 0, row: 0 });
    // b's row must be >= 2 (below the medium).
    expect(byId.b.row).toBeGreaterThanOrEqual(2);
  });

  it('repacks an anchored item placed out of bounds', () => {
    const items = [item('a', 'medium', { col: 3, row: 0 })]; // 3+4 > 4 cols
    const placed = packLayout(items);
    expect(placed[0].position).toEqual({ col: 0, row: 0 });
  });

  it('auto-packs an all-floating list in input order', () => {
    const items = [item('a', 'medium'), item('b', 'small'), item('c', 'small')];
    const placed = packLayout(items);
    const byId = Object.fromEntries(placed.map((p) => [p.item.id, p.position]));
    expect(byId.a).toEqual({ col: 0, row: 0 });
    expect(byId.b).toEqual({ col: 0, row: 2 });
    expect(byId.c).toEqual({ col: 2, row: 2 });
  });
});

describe('grid metrics', () => {
  it('computes square cells that fill the container width', () => {
    // 390 - 16*2 - 12*3 = 322 / 4 = 80.5 → floor to 80
    const m = computeMetrics(390, 12, 16);
    expect(m.cellSize).toBe(80);
    expect(m.gap).toBe(12);
    expect(m.padding).toBe(16);
  });

  it('cellToPx + spanToPx + pxToCell round-trip', () => {
    const m = { cellSize: 80, gap: 12, padding: 16 };
    const px = cellToPx(2, 3, m);
    expect(px).toEqual({ x: 16 + 2 * (80 + 12), y: 3 * (80 + 12) });

    const back = pxToCell(px.x, px.y, { w: 2, h: 2 }, m);
    expect(back).toEqual({ col: 2, row: 3 });
  });

  it('pxToCell clamps a too-far-right drop to the rightmost legal col', () => {
    const m = { cellSize: 80, gap: 12, padding: 16 };
    // For a span w=2 the max col is 4-2=2.
    expect(pxToCell(9999, 0, { w: 2, h: 2 }, m)).toEqual({ col: 2, row: 0 });
  });

  it('spanToPx accounts for inter-cell gaps', () => {
    const m = { cellSize: 80, gap: 12, padding: 16 };
    expect(spanToPx({ w: 2, h: 2 }, m)).toEqual({ width: 80 * 2 + 12, height: 80 * 2 + 12 });
  });

  it('layoutHeight is 0 for empty canvas', () => {
    expect(layoutHeight([], { cellSize: 80, gap: 12, padding: 16 })).toBe(0);
  });

  it('layoutHeight reaches the bottom of the lowest item', () => {
    const m = { cellSize: 80, gap: 12, padding: 16 };
    const placed = packLayout([item('a', 'small', { col: 0, row: 4 })]);
    // bottom row = 4 + 2 = 6 → 6 * (80+12) = 552
    expect(layoutHeight(placed, m)).toBe(6 * (80 + 12));
  });
});
