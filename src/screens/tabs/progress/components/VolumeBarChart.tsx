import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { Colors, Type } from '../../../../theme/tokens';
import type { WeeklyVolumePoint } from '../lib/aggregations';

interface Props {
  data: WeeklyVolumePoint[];
  width: number;
  height: number;
}

export default function VolumeBarChart({ data, width, height }: Props) {
  if (data.length === 0 || data.every((d) => d.volume === 0)) {
    return (
      <View style={[styles.empty, { width, height }]}>
        <Text style={styles.emptyText}>Volumen aparecerá al completar sesiones</Text>
      </View>
    );
  }

  const pad = 6;
  const innerW = width - pad * 2;
  const labelRowH = 14;
  const innerH = height - pad * 2 - labelRowH;
  const gap = 4;
  const barW = (innerW - gap * (data.length - 1)) / data.length;
  const maxV = Math.max(...data.map((d) => d.volume), 1);

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height - labelRowH}>
        {data.map((d, i) => {
          const isCurrent = i === data.length - 1;
          const h = (d.volume / maxV) * innerH;
          const x = pad + i * (barW + gap);
          const y = pad + innerH - h;
          return (
            <Rect
              key={i}
              x={x}
              y={y}
              width={barW}
              height={Math.max(h, 2)}
              rx={2}
              fill={isCurrent ? Colors.gold.base : Colors.hair.strong}
            />
          );
        })}
      </Svg>
      <View style={styles.weekLabelRow}>
        <Text style={styles.weekLabel}>−{data.length - 1} sem</Text>
        <Text style={styles.weekLabelBold}>Esta sem</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...Type.micro, color: Colors.ink.muted },
  weekLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginTop: 2,
  },
  weekLabel: { ...Type.micro, color: Colors.ink.tertiary },
  weekLabelBold: { ...Type.micro, color: Colors.gold.deep, fontWeight: '600' },
});
