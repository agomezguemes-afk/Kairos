// Sparkline — minimal time-series viz for progression in tile headers.
//
// Polyline + last-point dot + soft area fill. The line color reflects
// trend: gold when the last point is the all-time best (PR-territory),
// ink.secondary otherwise. The fill area uses a vertical linear-gradient
// fading to transparent so the chart sits inside the tile without a
// boxy outline.
//
// Pure React Native SVG, ~60×16 default. Renders silently when given an
// empty array — callers don't need to gate.

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Polyline, Polygon, Circle } from 'react-native-svg';
import { Colors } from '../../../../theme/tokens';

interface Props {
  data: number[];
  width?: number;
  height?: number;
  /** Highlight color when the last point is at/near the all-time max. */
  highlight?: boolean;
  /** Stroke color override. */
  strokeColor?: string;
  /** Drop the final emphasis dot. */
  hideDot?: boolean;
}

function SparklineImpl({
  data,
  width = 64,
  height = 18,
  highlight = false,
  strokeColor,
  hideDot = false,
}: Props) {
  const { points, fillPoints, lastX, lastY, line } = useMemo(() => {
    if (data.length < 2)
      return { points: '', fillPoints: '', lastX: 0, lastY: 0, line: Colors.ink.muted };
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min;
    const stepX = width / (data.length - 1);
    // 1.5px inset so the stroke doesn't clip at top/bottom edges.
    const innerH = height - 3;
    const ys = data.map((v) => {
      if (range === 0) return height / 2;
      return 1.5 + (1 - (v - min) / range) * innerH;
    });
    const xs = data.map((_, i) => i * stepX);
    const ptStr = xs.map((x, i) => `${x.toFixed(2)},${ys[i].toFixed(2)}`).join(' ');
    const lineColor = strokeColor ?? (highlight ? Colors.gold.base : Colors.ink.secondary);
    return {
      points: ptStr,
      fillPoints: `0,${height} ${ptStr} ${width},${height}`,
      lastX: xs[xs.length - 1],
      lastY: ys[ys.length - 1],
      line: lineColor,
    };
  }, [data, width, height, highlight, strokeColor]);

  if (data.length < 2) {
    return <View style={[styles.empty, { width, height }]} />;
  }

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={line} stopOpacity={0.18} />
          <Stop offset="1" stopColor={line} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Polygon points={fillPoints} fill="url(#sparkFill)" />
      <Polyline
        points={points}
        fill="none"
        stroke={line}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {!hideDot && <Circle cx={lastX} cy={lastY} r={2} fill={line} />}
    </Svg>
  );
}

const Sparkline = React.memo(SparklineImpl);
export default Sparkline;

const styles = StyleSheet.create({
  empty: {
    // Reserved space for layout stability when there's no history yet.
  },
});
