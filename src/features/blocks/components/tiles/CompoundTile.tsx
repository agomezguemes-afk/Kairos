// CompoundTile — Spine-Bento hero variant for the anchor exercise.
//
// Visual contract:
//   • Warm canvas (bg.warm) marks this tile as the primary lift, against
//     the cooler bg.void of the screen and the white surfaces of accessory
//     tiles. The hierarchy reads at a glance.
//   • Header line shows progression at a glance: last top-set value
//     (numHero serif), Δ vs previous session, and a sparkline of the
//     last ~7 sessions. When there's no history yet, the header collapses
//     to a quiet target summary instead of showing empty chrome.
//   • The embedded ExerciseRow keeps owning sets editing; this tile only
//     owns the header.
//
// No eyebrow — the hero variant + the spine station already encode type.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ExerciseCard, FieldValue } from '../../../../types/core';
import { Colors, Spacing, Type } from '../../../../theme/tokens';
import {
  lookupExerciseHistory,
  computeExerciseStats,
} from '../../../../lib/history/exerciseHistory';
import { useExerciseHistoryIndex } from '../../../../lib/history/useExerciseHistoryIndex';
import TileFrame from './TileFrame';
import Sparkline from './Sparkline';
import ExerciseRow from '../ExerciseRow';

interface Props {
  exercise: ExerciseCard;
  blockId: string;
  index: number;
  isActive?: boolean;
  onLongPress?: () => void;
  onUpdateName: (exerciseId: string, name: string) => void;
  onUpdateSetValue: (exerciseId: string, setId: string, fieldId: string, value: FieldValue) => void;
  onToggleSetComplete: (exerciseId: string, setId: string) => void;
  onAddSet: (exerciseId: string) => void;
  onRemoveSet: (exerciseId: string, setId: string) => void;
  onDeleteExercise: (exerciseId: string) => void;
}

function CompoundTileImpl(props: Props) {
  const { exercise, isActive, onLongPress } = props;

  const historyIndex = useExerciseHistoryIndex();
  const stats = useMemo(() => {
    const history = lookupExerciseHistory(exercise, historyIndex);
    return computeExerciseStats(history);
  }, [exercise, historyIndex]);

  const lastTop = stats.last?.topWeight ?? null;
  const lastReps = stats.last?.topReps ?? null;
  const delta = useMemo(() => {
    if (stats.last?.topWeight == null || stats.previous?.topWeight == null) return null;
    const d = stats.last.topWeight - stats.previous.topWeight;
    return Math.round(d * 10) / 10;
  }, [stats.last, stats.previous]);

  const atOrNearMax =
    stats.allTimeMaxWeight != null &&
    lastTop != null &&
    lastTop >= stats.allTimeMaxWeight - 0.01;

  const relativeLast = useMemo(
    () => stats.last ? formatRelativeShort(Date.now() - stats.last.at) : null,
    [stats.last],
  );

  const showSparkline = stats.sparkline.length >= 3;

  const targetSummary = useMemo(() => formatTarget(exercise), [exercise]);

  return (
    <TileFrame variant="hero" isActive={isActive} onLongPress={onLongPress}>
      {/* Header — progression at a glance, or quiet target line as fallback.
          Eyebrow "ÚLTIMA SESIÓN · hace 3 días" disambiguates historical data
          from the live sets shown by the ExerciseRow underneath. */}
      {lastTop != null ? (
        <View style={styles.headerProgression}>
          <View style={styles.headerLeft}>
            <Text style={styles.eyebrow}>
              Última sesión{relativeLast ? ` · ${relativeLast}` : ''}
            </Text>
            <View style={styles.lastValueRow}>
              <Text style={styles.lastValue}>{trimZero(lastTop)}</Text>
              <Text style={styles.lastUnit}>kg</Text>
              {lastReps != null && (
                <Text style={styles.lastReps}>× {lastReps}</Text>
              )}
            </View>
            {delta != null && (
              <Text
                style={[
                  styles.deltaValue,
                  delta > 0 && styles.deltaValuePositive,
                  delta < 0 && styles.deltaValueNegative,
                ]}
              >
                {delta > 0 ? '+' : ''}{trimZero(delta)} kg vs anterior
              </Text>
            )}
          </View>
          {showSparkline && (
            <View style={styles.sparkSlot}>
              <Sparkline
                data={stats.sparkline}
                width={72}
                height={22}
                highlight={atOrNearMax}
              />
            </View>
          )}
        </View>
      ) : (
        targetSummary && (
          <Text style={styles.targetLine}>{targetSummary}</Text>
        )
      )}

      <View style={styles.body}>
        <ExerciseRow
          exercise={props.exercise}
          blockId={props.blockId}
          index={props.index}
          onUpdateName={props.onUpdateName}
          onUpdateSetValue={props.onUpdateSetValue}
          onToggleSetComplete={props.onToggleSetComplete}
          onAddSet={props.onAddSet}
          onRemoveSet={props.onRemoveSet}
          onDeleteExercise={props.onDeleteExercise}
          compact={false}
        />
      </View>
    </TileFrame>
  );
}

function formatTarget(exercise: ExerciseCard): string | null {
  const setsCount = exercise.sets.length;
  if (setsCount === 0) return null;

  const goalW = exercise.goalWeight;
  const goalR = exercise.goalReps;
  if (goalW != null || goalR != null) {
    const repsStr = goalR != null ? `${setsCount} × ${goalR}` : `${setsCount} series`;
    const wStr = goalW != null ? ` · ${trimZero(goalW)} kg objetivo` : '';
    return repsStr + wStr;
  }

  return `${setsCount} ${setsCount === 1 ? 'serie' : 'series'}`;
}

function trimZero(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

function formatRelativeShort(ms: number): string {
  const days = Math.floor(ms / 86400_000);
  if (days <= 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 7)   return `hace ${days} días`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return 'hace 1 sem';
  if (weeks < 8)   return `hace ${weeks} sem`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'hace 1 mes' : `hace ${months} meses`;
}

const CompoundTile = React.memo(CompoundTileImpl);
export default CompoundTile;

const styles = StyleSheet.create({
  targetLine: {
    ...Type.caption,
    color: Colors.ink.tertiary,
    marginBottom: Spacing.sm,
  },

  headerProgression: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  headerLeft: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  eyebrow: {
    ...Type.eyebrow,
    color: Colors.ink.muted,
  },
  lastValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  lastValue: {
    ...Type.numLarge,
    color: Colors.ink.primary,
  },
  lastUnit: {
    ...Type.caption,
    color: Colors.ink.tertiary,
  },
  lastReps: {
    ...Type.caption,
    color: Colors.ink.secondary,
    marginLeft: 4,
  },
  deltaValue: {
    ...Type.micro,
    color: Colors.ink.tertiary,
    fontWeight: '600',
  },
  deltaValuePositive: {
    color: Colors.semantic.success,
  },
  deltaValueNegative: {
    color: Colors.semantic.error,
  },
  sparkSlot: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  body: {
    marginHorizontal: -Spacing.sm,
  },
});
