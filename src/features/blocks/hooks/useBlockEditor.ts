import { useCallback, useMemo } from 'react';
import * as Haptics from 'expo-haptics';

import { useWorkoutStore } from '../../../store/workoutStore';
import { useGamification } from '../../../context/GamificationContext';
import { useTree } from '../../../context/TreeContext';
import { useMission } from '../../../context/MissionContext';
import type { ExerciseCard, FieldValue, WorkoutBlock, Discipline } from '../../../types/core';
import { getBlockExercises } from '../../../types/core';

export function useBlockEditor(blockId: string) {
  const block = useWorkoutStore(
    useCallback((s) => s.blocks.find((b) => b.id === blockId) ?? null, [blockId]),
  );

  const updateBlock = useWorkoutStore((s) => s.updateBlock);
  const deleteBlock = useWorkoutStore((s) => s.deleteBlock);
  const addExercise = useWorkoutStore((s) => s.addExercise);
  const updateExercise = useWorkoutStore((s) => s.updateExercise);
  const deleteExercise = useWorkoutStore((s) => s.deleteExercise);
  const updateSetValue = useWorkoutStore((s) => s.updateSetValue);
  const toggleSetComplete = useWorkoutStore((s) => s.toggleSetComplete);
  const addSet = useWorkoutStore((s) => s.addSet);
  const removeSet = useWorkoutStore((s) => s.removeSet);

  const { streak, onSetCompleted, onBlockCreated } = useGamification();
  const { onTreeSetCompleted, onTreePRCreated } = useTree();
  const { updateMissionProgress, recordPRForMission } = useMission();

  const handleUpdateName = useCallback(
    (name: string) => updateBlock(blockId, { name }),
    [blockId, updateBlock],
  );

  const handleUpdateDescription = useCallback(
    (description: string) => updateBlock(blockId, { description: description || null }),
    [blockId, updateBlock],
  );

  const handleToggleFavorite = useCallback(() => {
    if (!block) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateBlock(blockId, { is_favorite: !block.is_favorite });
  }, [blockId, block, updateBlock]);

  const handleDelete = useCallback(() => {
    deleteBlock(blockId);
  }, [blockId, deleteBlock]);

  const handleAddExercise = useCallback(
    (opts: { name: string; discipline: Discipline; section?: string; column?: number; fields?: import('../../../types/core').FieldDefinition[] }) => {
      addExercise(blockId, {
        name: opts.name,
        discipline: opts.discipline,
        section: opts.section,
        column: opts.column,
        fields: opts.fields,
      });
    },
    [blockId, addExercise],
  );

  const handleUpdateExerciseName = useCallback(
    (exerciseId: string, name: string) => {
      updateExercise(blockId, exerciseId, { name });
    },
    [blockId, updateExercise],
  );

  const handleDeleteExercise = useCallback(
    (exerciseId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      deleteExercise(blockId, exerciseId);
    },
    [blockId, deleteExercise],
  );

  const handleUpdateSetValue = useCallback(
    (exerciseId: string, setId: string, fieldId: string, value: FieldValue) => {
      updateSetValue(blockId, exerciseId, setId, fieldId, value);
    },
    [blockId, updateSetValue],
  );

  const handleToggleSetComplete = useCallback(
    (exerciseId: string, setId: string) => {
      const toggled = toggleSetComplete(blockId, exerciseId, setId);
      if (!toggled || !toggled.wasCompleted) return null;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const freshBlocks = useWorkoutStore.getState().blocks;
      const ownerBlock = freshBlocks.find((b) => b.id === blockId);

      onSetCompleted(toggled.exercise, toggled.set, freshBlocks).then(({ prCard }) => {
        onTreeSetCompleted(toggled.exercise, toggled.set);
        if (prCard) {
          onTreePRCreated();
          recordPRForMission();
        }
        updateMissionProgress(freshBlocks, streak).then(() => {});
      });

      const ownerExercises = ownerBlock ? getBlockExercises(ownerBlock) : [];
      if (ownerBlock && ownerExercises.length > 0) {
        const allDone = ownerExercises.every(
          (ex) => ex.sets.length > 0 && ex.sets.every((s) => s.completed),
        );
        if (allDone) return ownerBlock;
      }
      return null;
    },
    [blockId, toggleSetComplete, onSetCompleted, onTreeSetCompleted, onTreePRCreated, recordPRForMission, updateMissionProgress, streak],
  );

  const handleAddSet = useCallback(
    (exerciseId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      addSet(blockId, exerciseId);
    },
    [blockId, addSet],
  );

  const handleRemoveSet = useCallback(
    (exerciseId: string, setId: string) => {
      removeSet(blockId, exerciseId, setId);
    },
    [blockId, removeSet],
  );

  return {
    block,
    handleUpdateName,
    handleUpdateDescription,
    handleToggleFavorite,
    handleDelete,
    handleAddExercise,
    handleUpdateExerciseName,
    handleDeleteExercise,
    handleUpdateSetValue,
    handleToggleSetComplete,
    handleAddSet,
    handleRemoveSet,
  };
}
