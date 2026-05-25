// AccessoryTile — compact secondary-lift variant.
//
// Standard white surface, hairline border, tighter padding. No eyebrow
// (the station node on the spine encodes type). The embedded ExerciseRow
// renders in compact mode.

import React from 'react';
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
  const { isActive, onLongPress } = props;

  return (
    <TileFrame variant="standard" isActive={isActive} onLongPress={onLongPress}>
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

const AccessoryTile = React.memo(AccessoryTileImpl);
export default AccessoryTile;

const styles = StyleSheet.create({
  body: {
    marginHorizontal: -Spacing.xs,
  },
});
