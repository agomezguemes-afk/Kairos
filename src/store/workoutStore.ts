// KAIROS — Workout Store
// Zustand store for blocks with AsyncStorage persistence.
// Provides mutations for blocks/exercises and an AI action dispatcher.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  WorkoutBlock,
  ExerciseCard,
  ExerciseSet,
  FieldValue,
  Discipline,
  BlockCover,
} from '../types/core';
import {
  createWorkoutBlock,
  createExerciseCard,
  createEmptySet,
} from '../types/core';
import type { AIAction, AIExerciseTemplate } from '../types/ai';

// ======================== STORE SHAPE ========================

const MOCK_USER_ID = 'user_001';

interface WorkoutState {
  blocks: WorkoutBlock[];
  pendingHighlight: string | null;

  // Block actions
  addBlock: (
    discipline: Discipline,
    overrides?: { name?: string; icon?: string; color?: string; cover?: BlockCover },
  ) => string;
  updateBlock: (blockId: string, updates: Partial<WorkoutBlock>) => void;
  deleteBlock: (blockId: string) => void;
  reorderBlocks: (blocks: WorkoutBlock[]) => void;
  replaceAllBlocks: (blocks: WorkoutBlock[]) => void;

  // Exercise actions
  addExercise: (
    blockId: string,
    opts?: { name?: string; icon?: string; color?: string; discipline?: Discipline },
  ) => void;
  updateExercise: (
    blockId: string,
    exerciseId: string,
    updates: Partial<ExerciseCard>,
  ) => void;
  deleteExercise: (blockId: string, exerciseId: string) => void;
  deleteExerciseByName: (blockId: string, name: string) => void;

  // Set actions
  updateSetValue: (
    blockId: string,
    exerciseId: string,
    setIndex: number,
    fieldId: string,
    value: FieldValue,
  ) => void;
  toggleSetComplete: (
    blockId: string,
    exerciseId: string,
    setIndex: number,
  ) => { exercise: ExerciseCard; set: ExerciseSet; wasCompleted: boolean } | null;
  addSet: (blockId: string, exerciseId: string) => void;
  removeSet: (blockId: string, exerciseId: string, setIndex: number) => void;

  // AI dispatcher
  dispatchAIActions: (actions: AIAction[]) => string | null;

  // Highlight
  setHighlight: (blockId: string | null) => void;
}

// ======================== TEMPLATE HELPER ========================

/**
 * Rebuild an ExerciseCard's sets/rest/default_sets_count from an AI template.
 * Keeps the exercise structurally identical to manually created exercises —
 * the new sets flow through createEmptySet with the exercise's own fields.
 */
function applyTemplateToExercise(
  ex: ExerciseCard,
  template: AIExerciseTemplate,
): ExerciseCard {
  const setsCount = template.sets_count ?? ex.default_sets_count;
  const nextRest = template.rest_seconds ?? ex.rest_seconds;

  const sets = Array.from({ length: setsCount }, (_, i) =>
    createEmptySet(ex.id, i, ex.fields),
  );

  if (template.reps !== undefined) {
    const repsField = ex.fields.find((f) => f.id === 'reps');
    const durationField = ex.fields.find(
      (f) =>
        f.id === 'duration' ||
        f.name.toLowerCase().includes('duration') ||
        f.name.toLowerCase().includes('hold'),
    );

    if (typeof template.reps === 'number' && repsField) {
      for (const s of sets) s.values[repsField.id] = template.reps;
    } else if (typeof template.reps === 'string') {
      const seconds = parseInt(template.reps, 10);
      if (!Number.isNaN(seconds) && durationField) {
        for (const s of sets) s.values[durationField.id] = seconds;
      } else if (!Number.isNaN(seconds) && repsField) {
        for (const s of sets) s.values[repsField.id] = seconds;
      }
    }
  }

  return {
    ...ex,
    sets,
    default_sets_count: setsCount,
    rest_seconds: nextRest,
    updated_at: new Date().toISOString(),
  };
}

// ======================== STORE ========================

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => ({
      blocks: [],
      pendingHighlight: null,

      // ======================== BLOCK ACTIONS ========================

      addBlock: (discipline, overrides) => {
        const block = createWorkoutBlock(
          MOCK_USER_ID,
          get().blocks.length,
          discipline,
          overrides,
        );
        const blockWithCover: WorkoutBlock = overrides?.cover
          ? { ...block, cover: overrides.cover }
          : block;

        set((state) => ({ blocks: [...state.blocks, blockWithCover] }));
        return blockWithCover.id;
      },

      updateBlock: (blockId, updates) => {
        set((state) => ({
          blocks: state.blocks.map((b) =>
            b.id === blockId
              ? { ...b, ...updates, updated_at: new Date().toISOString() }
              : b,
          ),
        }));
      },

      deleteBlock: (blockId) => {
        set((state) => ({
          blocks: state.blocks.filter((b) => b.id !== blockId),
          pendingHighlight:
            state.pendingHighlight === blockId ? null : state.pendingHighlight,
        }));
      },

      reorderBlocks: (blocks) => {
        set({ blocks });
      },

      replaceAllBlocks: (blocks) => {
        set({ blocks });
      },

      // ======================== EXERCISE ACTIONS ========================

      addExercise: (blockId, opts) => {
        set((state) => ({
          blocks: state.blocks.map((block) => {
            if (block.id !== blockId) return block;
            const disc = opts?.discipline ?? block.discipline;
            const ex = createExerciseCard(blockId, block.exercises.length, disc, {
              name: opts?.name,
              icon: opts?.icon,
              color: opts?.color,
            });
            return {
              ...block,
              exercises: [...block.exercises, ex],
              updated_at: new Date().toISOString(),
            };
          }),
        }));
      },

      updateExercise: (blockId, exerciseId, updates) => {
        set((state) => ({
          blocks: state.blocks.map((block) => {
            if (block.id !== blockId) return block;
            return {
              ...block,
              exercises: block.exercises.map((ex) =>
                ex.id === exerciseId
                  ? { ...ex, ...updates, updated_at: new Date().toISOString() }
                  : ex,
              ),
              updated_at: new Date().toISOString(),
            };
          }),
        }));
      },

      deleteExercise: (blockId, exerciseId) => {
        set((state) => ({
          blocks: state.blocks.map((block) => {
            if (block.id !== blockId) return block;
            return {
              ...block,
              exercises: block.exercises.filter((ex) => ex.id !== exerciseId),
              updated_at: new Date().toISOString(),
            };
          }),
        }));
      },

      deleteExerciseByName: (blockId, name) => {
        const needle = name.toLowerCase();
        set((state) => ({
          blocks: state.blocks.map((block) => {
            if (block.id !== blockId) return block;
            return {
              ...block,
              exercises: block.exercises.filter(
                (ex) => !ex.name.toLowerCase().includes(needle),
              ),
              updated_at: new Date().toISOString(),
            };
          }),
        }));
      },

      // ======================== SET ACTIONS ========================

      updateSetValue: (blockId, exerciseId, setIndex, fieldId, value) => {
        set((state) => ({
          blocks: state.blocks.map((block) => {
            if (block.id !== blockId) return block;
            return {
              ...block,
              exercises: block.exercises.map((ex) => {
                if (ex.id !== exerciseId) return ex;
                const newSets = ex.sets.map((s, i) =>
                  i === setIndex
                    ? { ...s, values: { ...s.values, [fieldId]: value } }
                    : s,
                );
                return {
                  ...ex,
                  sets: newSets,
                  updated_at: new Date().toISOString(),
                };
              }),
              updated_at: new Date().toISOString(),
            };
          }),
        }));
      },

      toggleSetComplete: (blockId, exerciseId, setIndex) => {
        let result:
          | { exercise: ExerciseCard; set: ExerciseSet; wasCompleted: boolean }
          | null = null;

        set((state) => ({
          blocks: state.blocks.map((block) => {
            if (block.id !== blockId) return block;
            return {
              ...block,
              exercises: block.exercises.map((ex) => {
                if (ex.id !== exerciseId) return ex;
                const target = ex.sets[setIndex];
                if (!target) return ex;
                const wasCompleted = !target.completed;
                const newSet: ExerciseSet = {
                  ...target,
                  completed: wasCompleted,
                  completed_at: wasCompleted ? new Date().toISOString() : null,
                };
                const newSets = ex.sets.map((s, i) => (i === setIndex ? newSet : s));
                const updatedEx: ExerciseCard = {
                  ...ex,
                  sets: newSets,
                  updated_at: new Date().toISOString(),
                };
                result = { exercise: updatedEx, set: newSet, wasCompleted };
                return updatedEx;
              }),
              updated_at: new Date().toISOString(),
            };
          }),
        }));

        return result;
      },

      addSet: (blockId, exerciseId) => {
        set((state) => ({
          blocks: state.blocks.map((block) => {
            if (block.id !== blockId) return block;
            return {
              ...block,
              exercises: block.exercises.map((ex) => {
                if (ex.id !== exerciseId) return ex;
                const newSet = createEmptySet(ex.id, ex.sets.length, ex.fields);
                return {
                  ...ex,
                  sets: [...ex.sets, newSet],
                  updated_at: new Date().toISOString(),
                };
              }),
              updated_at: new Date().toISOString(),
            };
          }),
        }));
      },

      removeSet: (blockId, exerciseId, setIndex) => {
        set((state) => ({
          blocks: state.blocks.map((block) => {
            if (block.id !== blockId) return block;
            return {
              ...block,
              exercises: block.exercises.map((ex) => {
                if (ex.id !== exerciseId) return ex;
                const filtered = ex.sets
                  .filter((_, i) => i !== setIndex)
                  .map((s, i) => ({ ...s, order: i }));
                return {
                  ...ex,
                  sets: filtered,
                  updated_at: new Date().toISOString(),
                };
              }),
              updated_at: new Date().toISOString(),
            };
          }),
        }));
      },

      // ======================== AI DISPATCHER ========================

      dispatchAIActions: (actions) => {
        let createdBlockId: string | null = null;
        const store = get();

        for (const action of actions) {
          switch (action.type) {
            case 'create_block': {
              const { name, discipline, icon, color, cover, exercises } =
                action.payload;
              const id = store.addBlock(discipline, { name, icon, color, cover });
              createdBlockId = id;

              // Add any bundled exercises, then rebuild sets/rest from the template
              if (exercises && exercises.length > 0) {
                for (const tpl of exercises) {
                  store.addExercise(id, {
                    name: tpl.name,
                    icon: tpl.icon,
                    color: tpl.color,
                    discipline: tpl.discipline,
                  });

                  // Locate the freshly added exercise (last one in the block)
                  const fresh = get().blocks.find((b) => b.id === id);
                  const added = fresh?.exercises[fresh.exercises.length - 1];
                  if (added) {
                    const rebuilt = applyTemplateToExercise(added, tpl);
                    store.updateExercise(id, added.id, {
                      sets: rebuilt.sets,
                      default_sets_count: rebuilt.default_sets_count,
                      rest_seconds: rebuilt.rest_seconds,
                    });
                  }
                }
              }
              break;
            }

            case 'update_exercise': {
              const { exerciseId, updates } = action.payload;
              // Find which block owns this exercise
              const ownerBlock = get().blocks.find((b) =>
                b.exercises.some((ex) => ex.id === exerciseId),
              );
              if (ownerBlock) {
                store.updateExercise(ownerBlock.id, exerciseId, updates);
              }
              break;
            }

            case 'add_exercise': {
              const {
                blockId,
                name: exName,
                icon,
                color,
                discipline,
                sets_count,
                reps,
                rest_seconds,
              } = action.payload;
              const targetId = blockId || createdBlockId;
              if (targetId) {
                store.addExercise(targetId, {
                  name: exName,
                  icon,
                  color,
                  discipline,
                });

                if (
                  sets_count !== undefined ||
                  reps !== undefined ||
                  rest_seconds !== undefined
                ) {
                  const fresh = get().blocks.find((b) => b.id === targetId);
                  const added = fresh?.exercises[fresh.exercises.length - 1];
                  if (added) {
                    const rebuilt = applyTemplateToExercise(added, {
                      name: exName,
                      icon,
                      color,
                      discipline,
                      sets_count,
                      reps,
                      rest_seconds,
                    });
                    store.updateExercise(targetId, added.id, {
                      sets: rebuilt.sets,
                      default_sets_count: rebuilt.default_sets_count,
                      rest_seconds: rebuilt.rest_seconds,
                    });
                  }
                }
              }
              break;
            }

            case 'delete_exercise': {
              const { blockId, exerciseId } = action.payload;
              // Use exerciseId as a name for case-insensitive match
              const block = get().blocks.find((b) => b.id === blockId);
              if (block) {
                const ex = block.exercises.find((e) => e.id === exerciseId);
                if (ex) {
                  store.deleteExerciseByName(blockId, ex.name);
                }
              }
              break;
            }

            case 'update_block_meta': {
              const { blockId: metaBlockId, updates } = action.payload;
              store.updateBlock(metaBlockId, updates);
              break;
            }

            case 'delete_block': {
              store.deleteBlock(action.payload.blockId);
              break;
            }
          }
        }

        return createdBlockId;
      },

      // ======================== HIGHLIGHT ========================

      setHighlight: (blockId) => {
        set({ pendingHighlight: blockId });
      },
    }),
    {
      name: 'kairos_workout_store',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        // One-time migration from the legacy `kairos_blocks_v1` key used by
        // earlier builds of BlockLibraryScreen. Runs exactly once per device,
        // after the persisted zustand state has been restored, so we can
        // safely check whether migration is needed without race conditions.
        if (!state) return;
        AsyncStorage.getItem('kairos_blocks_v1')
          .then((raw) => {
            if (!raw) return;
            try {
              const parsed: WorkoutBlock[] = JSON.parse(raw);
              if (parsed.length > 0 && state.blocks.length === 0) {
                useWorkoutStore.setState({ blocks: parsed });
              }
            } catch (e) {
              console.warn('Kairos: legacy block parse failed', e);
            }
            AsyncStorage.removeItem('kairos_blocks_v1').catch(() => {});
          })
          .catch((e) => console.warn('Kairos: legacy read failed', e));
      },
    },
  ),
);
