// KAIROS — Canvas types
//
// The canvas is a widget-style surface where blocks live at explicit
// {col,row} positions. Mirrors the iOS home-screen mental model:
// 4 columns wide on phone; widget sizes map to fixed cell spans.

export interface CanvasPosition {
  col: number; // 0..(CANVAS_COLUMNS - widget.w)
  row: number; // 0..N (canvas scrolls vertically)
}

export type CanvasWidgetSize = 'small' | 'medium' | 'large';

export interface CanvasSpan {
  w: number; // columns
  h: number; // rows
}

export const CANVAS_COLUMNS = 4;

// iOS-style widget spans on a 4-col grid:
//   small  → 2×2 (half width square)
//   medium → 4×2 (full width, short)
//   large  → 4×4 (full width, tall)
export const CANVAS_SPANS: Record<CanvasWidgetSize, CanvasSpan> = {
  small: { w: 2, h: 2 },
  medium: { w: 4, h: 2 },
  large: { w: 4, h: 4 },
};
