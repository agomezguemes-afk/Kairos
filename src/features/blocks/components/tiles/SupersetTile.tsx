// SupersetTile — wide hero tile that renders a superset as a stack of
// mini-tiles (sub-bento) plus a cycle/rest indicator. Mini-tiles are
// read-only quick previews; tapping the chevron expands the embedded
// exercises for inline editing (deferred — wired in a future iteration).

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Type, Spacing, Radius } from '../../../../theme/tokens';
import TileFrame from './TileFrame';
import type { SupersetContentNode } from '../../../../types/content';

interface Props {
  node: SupersetContentNode;
  isActive?: boolean;
  onLongPress?: () => void;
  onUpdate?: (nodeId: string, data: Partial<SupersetContentNode['data']>) => void;
}

function SupersetTileImpl({ node, isActive, onLongPress, onUpdate }: Props) {
  const { exercises, cycles, restSeconds, label } = node.data;
  const restLabel = formatRest(restSeconds);

  const adjustCycles = (delta: number) => {
    if (!onUpdate) return;
    const next = Math.max(1, Math.min(10, cycles + delta));
    onUpdate(node.id, { cycles: next });
  };

  return (
    <TileFrame
      eyebrow="SUPERSERIE"
      isActive={isActive}
      onLongPress={onLongPress}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{label || 'Superserie'}</Text>
        <View style={styles.meta}>
          <Pressable
            onPress={() => adjustCycles(-1)}
            hitSlop={10}
            disabled={!onUpdate}
            accessibilityLabel="Reducir ciclos"
            style={({ pressed }) => [styles.metaBtn, pressed && styles.metaBtnPressed]}
          >
            <Feather name="minus" size={12} color={Colors.gold.deep} />
          </Pressable>
          <Text style={styles.metaText}>
            {cycles} {cycles === 1 ? 'ciclo' : 'ciclos'} · {restLabel}
          </Text>
          <Pressable
            onPress={() => adjustCycles(+1)}
            hitSlop={10}
            disabled={!onUpdate}
            accessibilityLabel="Añadir ciclo"
            style={({ pressed }) => [styles.metaBtn, pressed && styles.metaBtnPressed]}
          >
            <Feather name="plus" size={12} color={Colors.gold.deep} />
          </Pressable>
        </View>
      </View>

      {exercises.length > 0 ? (
        <View style={styles.bento}>
          {exercises.map((ex, i) => (
            <View key={ex.id} style={styles.miniTile}>
              <View style={styles.miniIndex}>
                <Text style={styles.miniIndexText}>{i + 1}</Text>
              </View>
              <View style={styles.miniBody}>
                <Text style={styles.miniName} numberOfLines={1}>
                  {ex.name}
                </Text>
                {ex.sets[0] && (
                  <Text style={styles.miniDetail}>
                    {formatSetPreview(ex.sets[0])}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.empty}>
          <Feather name="plus-circle" size={14} color={Colors.ink.muted} />
          <Text style={styles.emptyText}>
            Mantén pulsado para añadir ejercicios
          </Text>
        </View>
      )}
    </TileFrame>
  );
}

function formatRest(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}min` : `${m}m ${s}s`;
}

function formatSetPreview(set: { values: Record<string, unknown> }): string {
  const w = typeof set.values['weight'] === 'number' ? (set.values['weight'] as number) : null;
  const r = typeof set.values['reps']   === 'number' ? (set.values['reps']   as number) : null;
  if (w != null && r != null) return `${w} kg × ${r}`;
  if (w != null) return `${w} kg`;
  if (r != null) return `× ${r}`;
  return '—';
}

const SupersetTile = React.memo(SupersetTileImpl);
export default SupersetTile;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  title: {
    ...Type.heading,
    color: Colors.ink.primary,
    flex: 1,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: Colors.gold.glow,
    borderRadius: Radius.pill,
  },
  metaText: {
    ...Type.micro,
    color: Colors.gold.deep,
    fontWeight: '700',
  },
  metaBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaBtnPressed: {
    backgroundColor: Colors.gold.light,
  },
  bento: {
    gap: 6,
    marginTop: Spacing.xs,
  },
  miniTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.bg.warm,
    borderRadius: Radius.md,
  },
  miniIndex: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.gold.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniIndexText: {
    ...Type.micro,
    color: Colors.ink.inverse,
    fontWeight: '700',
  },
  miniBody: {
    flex: 1,
    minWidth: 0,
  },
  miniName: {
    ...Type.bodyEmph,
    color: Colors.ink.primary,
  },
  miniDetail: {
    ...Type.micro,
    color: Colors.ink.tertiary,
    marginTop: 1,
  },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
  },
  emptyText: {
    ...Type.caption,
    color: Colors.ink.muted,
    fontStyle: 'italic',
  },
});
