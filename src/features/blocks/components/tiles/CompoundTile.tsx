// CompoundTile — Spine-Bento hero variant for the anchor exercise.
//
// Visual contract:
//   • Warm canvas (bg.warm) marks this tile as the primary lift, against
//     the cooler bg.void of the screen and the white surfaces of accessory
//     tiles. The hierarchy reads at a glance.
//   • Exercise name renders editorial-large (Type.heading). Tabular target
//     summary sits beneath as a quiet support line.
//   • The embedded ExerciseRow keeps owning sets editing; this tile only
//     owns the header chrome.
//
// No eyebrow label — the shape (hero variant) and the station node on the
// spine already encode "this is an exercise". Repeating "EJERCICIO" on
// every tile is noise. We reserve eyebrows for editorial moments (PR cards,
// section breaks).

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ExerciseCard, FieldValue } from '../../../../types/core';
import { Colors, Spacing, Type } from '../../../../theme/tokens';
import TileFrame from './TileFrame';
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
  const targetSummary = useMemo(() => formatTarget(exercise), [exercise]);

  return (
    <TileFrame variant="hero" isActive={isActive} onLongPress={onLongPress}>
      {targetSummary && (
        <Text style={styles.targetLine}>{targetSummary}</Text>
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

/**
 * Quiet target summary above the exercise row: "4 × 8 · 80 kg target".
 * Drawn from goal data when present, falls back to set count + first set.
 * Returns null when there's nothing meaningful to say.
 */
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

  // Fallback: peek at first set values.
  const s = exercise.sets[0];
  const w = typeof s.values['weight'] === 'number' ? (s.values['weight'] as number) : null;
  const r = typeof s.values['reps'] === 'number' ? (s.values['reps'] as number) : null;
  if (w != null || r != null) {
    const repsStr = r != null ? `${setsCount} × ${r}` : `${setsCount} series`;
    const wStr = w != null ? ` · ${trimZero(w)} kg` : '';
    return repsStr + wStr;
  }

  return `${setsCount} ${setsCount === 1 ? 'serie' : 'series'}`;
}

function trimZero(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

const CompoundTile = React.memo(CompoundTileImpl);
export default CompoundTile;

const styles = StyleSheet.create({
  targetLine: {
    ...Type.caption,
    color: Colors.ink.tertiary,
    marginBottom: Spacing.xs,
  },
  body: {
    marginHorizontal: -Spacing.sm,
  },
});
