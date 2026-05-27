import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line as SvgLine } from 'react-native-svg';
import { Colors, Type } from '../../../../theme/tokens';

interface Point {
  x: number;
  y: number;
}

interface Props {
  points: Point[];
  width: number;
  height: number;
  stroke?: string;
  baseline?: number;
  showLastDot?: boolean;
  showRange?: boolean;
}

export default function Sparkline({
  points,
  width,
  height,
  stroke,
  baseline,
  showLastDot = true,
  showRange = false,
}: Props) {
  if (points.length < 2) {
    return (
      <View style={[styles.empty, { width, height }]}>
        <Text style={styles.emptyText}>Sin datos aún</Text>
      </View>
    );
  }

  const strokeColor = stroke ?? Colors.gold.base;
  const pad = 4;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMinRaw = Math.min(...ys);
  const yMaxRaw = Math.max(...ys);
  const yMin = baseline != null ? Math.min(yMinRaw, baseline) : yMinRaw;
  const yMax = baseline != null ? Math.max(yMaxRaw, baseline) : yMaxRaw;
  const yRange = yMax - yMin || 1;
  const xRange = xMax - xMin || 1;

  const project = (p: Point) => ({
    x: pad + ((p.x - xMin) / xRange) * innerW,
    y: pad + (1 - (p.y - yMin) / yRange) * innerH,
  });

  const projected = points.map(project);
  const path = buildSmoothPath(projected);
  const last = projected[projected.length - 1];

  const baselineY = baseline != null ? pad + (1 - (baseline - yMin) / yRange) * innerH : null;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        {baselineY != null && (
          <SvgLine
            x1={pad}
            y1={baselineY}
            x2={pad + innerW}
            y2={baselineY}
            stroke={Colors.hair.strong}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}
        <Path
          d={path}
          stroke={strokeColor}
          strokeWidth={1.75}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {showLastDot && <Circle cx={last.x} cy={last.y} r={3} fill={strokeColor} />}
      </Svg>
      {showRange && (
        <View style={styles.rangeRow} pointerEvents="none">
          <Text style={styles.rangeText}>{Math.round(yMin)}</Text>
          <Text style={styles.rangeText}>{Math.round(yMax)}</Text>
        </View>
      )}
    </View>
  );
}

function buildSmoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...Type.micro, color: Colors.ink.muted },
  rangeRow: {
    position: 'absolute',
    bottom: 0,
    left: 4,
    right: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rangeText: { ...Type.micro, fontSize: 9, color: Colors.ink.tertiary },
});
