// AccessoryTile — compact secondary-lift variant.
//
// Standard white surface, hairline border, tighter padding. When there's
// progression history a slim sparkline + last-value pill renders inline
// above the embedded ExerciseRow; otherwise the row stands alone. No
// eyebrow.

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

function AccessoryTileImpl(props: Props) {
  const { exercise, isActive, onLongPress } = props;

  const historyIndex = useExerciseHistoryIndex();
  const stats = useMemo(() => {
    const history = lookupExerciseHistory(exercise, historyIndex);
    return computeExerciseStats(history);
  }, [exercise, historyIndex]);

  const lastTop = stats.last?.topWeight ?? null;
  const lastReps = stats.last?.topReps ?? null;
  const atOrNearMax =
    stats.allTimeMaxWeight != null && lastTop != null && lastTop >= stats.allTimeMaxWeight - 0.01;
  const relativeLast = useMemo(
    () => (stats.last ? formatRelativeShort(Date.now() - stats.last.at) : null),
    [stats.last],
  );
  const showSparkline = stats.sparkline.length >= 3;

  return (
    <TileFrame variant="standard" isActive={isActive} onLongPress={onLongPress}>
      {lastTop != null && (
        <View style={styles.progressionRow}>
          <View style={styles.progressionLeft}>
            <Text style={styles.lastValue}>
              {trimZero(lastTop)}
              <Text style={styles.lastUnit}> kg</Text>
              {lastReps != null && <Text style={styles.lastReps}> × {lastReps}</Text>}
            </Text>
            {relativeLast && <Text style={styles.relativeLabel}>{relativeLast}</Text>}
          </View>
          {showSparkline && (
            <Sparkline
              data={stats.sparkline}
              width={48}
              height={14}
              highlight={atOrNearMax}
              hideDot
            />
          )}
        </View>
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
          compact
        />
      </View>
    </TileFrame>
  );
}

function trimZero(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

function formatRelativeShort(ms: number): string {
  const days = Math.floor(ms / 86400_000);
  if (days <= 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `hace ${weeks}sem`;
  const months = Math.floor(days / 30);
  return `hace ${months}m`;
}

const AccessoryTile = React.memo(AccessoryTileImpl);
export default AccessoryTile;

const styles = StyleSheet.create({
  progressionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: Spacing.sm,
  },
  progressionLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  lastValue: {
    ...Type.micro,
    color: Colors.ink.secondary,
    fontWeight: '700',
  },
  relativeLabel: {
    ...Type.micro,
    color: Colors.ink.muted,
    fontSize: 10,
  },
  lastUnit: {
    color: Colors.ink.tertiary,
    fontWeight: '500',
  },
  lastReps: {
    color: Colors.ink.tertiary,
    fontWeight: '500',
  },
  body: {
    marginHorizontal: -Spacing.xs,
  },
});
