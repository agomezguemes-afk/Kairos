// AccessoryTile — compact variant of CompoundTile. Same content surface but
// tighter chrome: no eyebrow, ExerciseRow in compact mode, smaller padding.
// Used for secondary lifts and accessory work.

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import type { ExerciseCard, FieldValue } from '../../../../types/core';
import { Spacing } from '../../../../theme/tokens';
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

function AccessoryTileImpl(props: Props) {
  const { exercise, isActive, onLongPress } = props;
  const lastRef = useMemo(() => formatLastReference(exercise), [exercise]);

  return (
    <TileFrame
      pill={lastRef}
      isActive={isActive}
      compact
      onLongPress={onLongPress}
    >
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

function formatLastReference(exercise: ExerciseCard): string | null {
  for (let i = exercise.sets.length - 1; i >= 0; i--) {
    const s = exercise.sets[i];
    if (!s.completed) continue;
    const w = typeof s.values['weight'] === 'number' ? (s.values['weight'] as number) : null;
    const r = typeof s.values['reps']   === 'number' ? (s.values['reps']   as number) : null;
    if (w == null && r == null) continue;
    const wStr = w != null ? `${trimZero(w)} kg` : '';
    const rStr = r != null ? `× ${r}` : '';
    return ['última:', wStr, rStr].filter(Boolean).join(' ');
  }
  return null;
}

function trimZero(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

const AccessoryTile = React.memo(AccessoryTileImpl);
export default AccessoryTile;

const styles = StyleSheet.create({
  body: {
    marginHorizontal: -Spacing.sm,
  },
});
