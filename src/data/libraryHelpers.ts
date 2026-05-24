import type { ExerciseCard, WorkoutBlock, FieldDefinition } from '../types/core';
import { createWorkoutBlock, createExerciseCard, createEmptySet, DISCIPLINE_CONFIGS } from '../types/core';
import { type ExerciseLibraryEntry, getLibraryEntry } from './exerciseLibrary';
import { type BlockTemplate } from './blockTemplates';

export function cloneLibraryEntry(
  entry: ExerciseLibraryEntry,
  blockId: string,
  order: number,
  overrides?: { setsCount?: number; goalWeight?: number; goalReps?: number },
): ExerciseCard {
  const fields: FieldDefinition[] = entry.fields && entry.fields.length > 0
    ? entry.fields
    : DISCIPLINE_CONFIGS[entry.discipline].defaultFields;

  const card = createExerciseCard(blockId, order, entry.discipline, {
    name: entry.name,
    icon: entry.icon,
    fields,
    muscle_groups: entry.muscleGroups,
  });

  const targetSets = overrides?.setsCount ?? entry.defaultSetsCount;
  card.sets = Array.from({ length: targetSets }, (_, i) => createEmptySet(card.id, i, fields));
  card.default_sets_count = targetSets;
  card.rest_seconds = entry.defaultRestSeconds;
  if (overrides?.goalWeight != null) card.goalWeight = overrides.goalWeight;
  if (overrides?.goalReps != null) card.goalReps = overrides.goalReps;
  return card;
}

export function instantiateTemplate(
  tpl: BlockTemplate,
  userId: string,
  sortOrder: number,
): { block: WorkoutBlock; exercises: ExerciseCard[] } {
  const block = createWorkoutBlock(userId, sortOrder, tpl.discipline, {
    name: tpl.name,
    description: tpl.description,
  });

  const exercises: ExerciseCard[] = [];
  let order = 0;
  for (const te of tpl.exercises) {
    const entry = getLibraryEntry(te.libraryId);
    if (!entry) continue;
    exercises.push(
      cloneLibraryEntry(entry, block.id, order, {
        setsCount: te.setsCount,
        goalWeight: te.goalWeight,
        goalReps: te.goalReps,
      }),
    );
    order++;
  }
  return { block, exercises };
}
