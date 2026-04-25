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
  WidgetData,
  CanvasSettings,
  CanvasData,
} from '../types/core';
import {
  createWorkoutBlock,
  createExerciseCard,
  createEmptySet,
  createWidget,
  DEFAULT_CANVAS_SETTINGS,
  generateId,
} from '../types/core';
import type { ContentNode } from '../types/content';
import {
  createExerciseNode,
  createTextNode,
  createDividerNode,
  createSubBlockNode,
  createImageNode,
  getNextOrder,
  reorderNodes,
} from '../types/content';
import type { AIAction, AIExerciseTemplate } from '../types/ai';

const MOCK_USER_ID = 'user_001';

interface WorkoutState {
  blocks: WorkoutBlock[];
  pendingHighlight: string | null;

  addBlock: (
    discipline?: Discipline,
    overrides?: { name?: string; icon?: string; color?: string; cover?: BlockCover },
  ) => string;
  updateBlock: (blockId: string, updates: Partial<WorkoutBlock>) => void;
  deleteBlock: (blockId: string) => void;
  reorderBlocks: (blocks: WorkoutBlock[]) => void;
  replaceAllBlocks: (blocks: WorkoutBlock[]) => void;

  addContentNode: (blockId: string, node: ContentNode) => void;
  updateContentNode: (blockId: string, nodeId: string, updates: Partial<ContentNode>) => void;
  deleteContentNode: (blockId: string, nodeId: string) => void;
  reorderContentNodes: (blockId: string, nodeIds: string[]) => void;
  duplicateContentNode: (blockId: string, nodeId: string) => void;
  moveContentNode: (blockId: string, nodeId: string, direction: 'up' | 'down') => void;

  addExercise: (
    blockId: string,
    opts?: { name?: string; icon?: string; color?: string; discipline?: Discipline; section?: string; column?: number; fields?: import('../types/core').FieldDefinition[] },
  ) => void;
  updateExercise: (
    blockId: string,
    exerciseId: string,
    updates: Partial<ExerciseCard>,
  ) => void;
  deleteExercise: (blockId: string, exerciseId: string) => void;
  deleteExerciseByName: (blockId: string, name: string) => void;

  updateSetValue: (
    blockId: string,
    exerciseId: string,
    setId: string,
    fieldId: string,
    value: FieldValue,
  ) => void;
  toggleSetComplete: (
    blockId: string,
    exerciseId: string,
    setId: string,
  ) => { exercise: ExerciseCard; set: ExerciseSet; wasCompleted: boolean } | null;
  addSet: (blockId: string, exerciseId: string) => void;
  removeSet: (blockId: string, exerciseId: string, setId: string) => void;

  dispatchAIActions: (actions: AIAction[]) => string | null;
  setHighlight: (blockId: string | null) => void;

  // ===== Canvas (widget mode) =====
  ensureCanvasData: (blockId: string) => void;
  addWidget: (
    blockId: string,
    contentNodeId: string,
    position: { x: number; y: number },
    size?: { w: number; h: number },
  ) => string | null;
  updateWidgetPosition: (blockId: string, widgetId: string, position: { x: number; y: number }) => void;
  updateWidgetSize: (blockId: string, widgetId: string, size: { w: number; h: number }) => void;
  toggleWidgetFreeze: (blockId: string, widgetId: string) => void;
  removeWidget: (blockId: string, widgetId: string) => void;
  updateCanvasSettings: (blockId: string, updates: Partial<CanvasSettings>) => void;
  hydrateCanvasFromContent: (blockId: string) => void;
}

function buildCascadeWidgets(
  content: import('../types/content').ContentNode[],
): Record<string, WidgetData> {
  const out: Record<string, WidgetData> = {};
  const sorted = [...content].sort((a, b) => a.order - b.order);
  let i = 0;
  for (const node of sorted) {
    if (node.type === 'columnSection') continue;
    const w = createWidget(node.id, { x: 24 + i * 32, y: 24 + i * 48 }, { w: 280, h: 160 }, i);
    out[w.id] = w;
    i += 1;
  }
  return out;
}

function updateExerciseInContent(
  content: ContentNode[],
  exerciseId: string,
  updater: (ex: ExerciseCard) => ExerciseCard,
): { content: ContentNode[]; exercise: ExerciseCard | null } {
  let found: ExerciseCard | null = null;
  const next = content.map((node) => {
    if (node.type !== 'exercise' || node.data.exercise.id !== exerciseId) return node;
    const updated = updater(node.data.exercise);
    found = updated;
    return { ...node, data: { exercise: updated } } as typeof node;
  });
  return { content: next, exercise: found };
}

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

function getExercisesFromBlock(block: WorkoutBlock): ExerciseCard[] {
  return block.content
    .filter((n): n is Extract<ContentNode, { type: 'exercise' }> => n.type === 'exercise')
    .map(n => n.data.exercise);
}

function migrateBlock(block: any): WorkoutBlock {
  if (block.content && Array.isArray(block.content)) return block;
  const content: ContentNode[] = [];
  if (block.exercises && Array.isArray(block.exercises)) {
    for (let i = 0; i < block.exercises.length; i++) {
      content.push(createExerciseNode(i, block.exercises[i]));
    }
  }
  const { exercises: _removed, ...rest } = block;
  return { ...rest, content, layout: { columns: 1 } };
}

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => ({
      blocks: [],
      pendingHighlight: null,

      addBlock: (discipline = 'general', overrides) => {
        const block = createWorkoutBlock(MOCK_USER_ID, get().blocks.length, discipline, overrides);
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
          pendingHighlight: state.pendingHighlight === blockId ? null : state.pendingHighlight,
        }));
      },

      reorderBlocks: (blocks) => { set({ blocks }); },
      replaceAllBlocks: (blocks) => { set({ blocks }); },

      // ======================== CONTENT NODE ACTIONS ========================

      addContentNode: (blockId, node) => {
        set((state) => ({
          blocks: state.blocks.map((block) => {
            if (block.id !== blockId) return block;
            return {
              ...block,
              content: [...block.content, node],
              updated_at: new Date().toISOString(),
            };
          }),
        }));
      },

      updateContentNode: (blockId, nodeId, updates) => {
        set((state) => ({
          blocks: state.blocks.map((block) => {
            if (block.id !== blockId) return block;
            return {
              ...block,
              content: block.content.map((n) =>
                n.id === nodeId ? { ...n, ...updates } as ContentNode : n,
              ),
              updated_at: new Date().toISOString(),
            };
          }),
        }));
      },

      deleteContentNode: (blockId, nodeId) => {
        set((state) => ({
          blocks: state.blocks.map((block) => {
            if (block.id !== blockId) return block;
            return {
              ...block,
              content: reorderNodes(block.content.filter((n) => n.id !== nodeId)),
              updated_at: new Date().toISOString(),
            };
          }),
        }));
      },

      reorderContentNodes: (blockId, nodeIds) => {
        set((state) => ({
          blocks: state.blocks.map((block) => {
            if (block.id !== blockId) return block;
            const nodeMap = new Map(block.content.map(n => [n.id, n]));
            const reorderedIds = new Set(nodeIds);
            const reordered = nodeIds
              .map((id, i) => {
                const node = nodeMap.get(id);
                return node ? { ...node, order: i } as ContentNode : null;
              })
              .filter((n): n is ContentNode => n !== null);
            const rest = block.content.filter(n => !reorderedIds.has(n.id));
            return { ...block, content: [...reordered, ...rest], updated_at: new Date().toISOString() };
          }),
        }));
      },

      duplicateContentNode: (blockId, nodeId) => {
        set((state) => ({
          blocks: state.blocks.map((block) => {
            if (block.id !== blockId) return block;
            const idx = block.content.findIndex(n => n.id === nodeId);
            if (idx === -1) return block;
            const original = block.content[idx];
            const clone = { ...JSON.parse(JSON.stringify(original)), id: generateId(), order: original.order + 0.5 };
            const updated = reorderNodes([...block.content, clone]);
            return { ...block, content: updated, updated_at: new Date().toISOString() };
          }),
        }));
      },

      moveContentNode: (blockId, nodeId, direction) => {
        set((state) => ({
          blocks: state.blocks.map((block) => {
            if (block.id !== blockId) return block;
            const sorted = [...block.content].sort((a, b) => a.order - b.order);
            const idx = sorted.findIndex(n => n.id === nodeId);
            if (idx === -1) return block;
            const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
            if (swapIdx < 0 || swapIdx >= sorted.length) return block;
            const tmpOrder = sorted[idx].order;
            sorted[idx] = { ...sorted[idx], order: sorted[swapIdx].order } as ContentNode;
            sorted[swapIdx] = { ...sorted[swapIdx], order: tmpOrder } as ContentNode;
            return { ...block, content: reorderNodes(sorted), updated_at: new Date().toISOString() };
          }),
        }));
      },

      // ======================== EXERCISE ACTIONS (via content nodes) ========================

      addExercise: (blockId, opts) => {
        set((state) => ({
          blocks: state.blocks.map((block) => {
            if (block.id !== blockId) return block;
            const disc = opts?.discipline ?? block.discipline;
            const exercises = getExercisesFromBlock(block);
            const ex = createExerciseCard(blockId, exercises.length, disc, {
              name: opts?.name,
              icon: opts?.icon,
              color: opts?.color,
              fields: opts?.fields,
            });
            const node = {
              ...createExerciseNode(getNextOrder(block.content), ex),
              ...(opts?.section ? { section: opts.section } : {}),
              ...(opts?.column !== undefined ? { column: opts.column } : {}),
            };
            return {
              ...block,
              content: [...block.content, node],
              updated_at: new Date().toISOString(),
            };
          }),
        }));
      },

      updateExercise: (blockId, exerciseId, updates) => {
        set((state) => ({
          blocks: state.blocks.map((block) => {
            if (block.id !== blockId) return block;
            const { content } = updateExerciseInContent(
              block.content,
              exerciseId,
              (ex) => ({ ...ex, ...updates, updated_at: new Date().toISOString() }),
            );
            return { ...block, content, updated_at: new Date().toISOString() };
          }),
        }));
      },

      deleteExercise: (blockId, exerciseId) => {
        set((state) => ({
          blocks: state.blocks.map((block) => {
            if (block.id !== blockId) return block;
            return {
              ...block,
              content: reorderNodes(
                block.content.filter(
                  (n) => !(n.type === 'exercise' && n.data.exercise.id === exerciseId),
                ),
              ),
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
              content: reorderNodes(
                block.content.filter(
                  (n) => !(n.type === 'exercise' && n.data.exercise.name.toLowerCase().includes(needle)),
                ),
              ),
              updated_at: new Date().toISOString(),
            };
          }),
        }));
      },

      // ======================== SET ACTIONS (via content nodes) ========================

      updateSetValue: (blockId, exerciseId, setId, fieldId, value) => {
        set((state) => ({
          blocks: state.blocks.map((block) => {
            if (block.id !== blockId) return block;
            const { content } = updateExerciseInContent(block.content, exerciseId, (ex) => ({
              ...ex,
              sets: ex.sets.map((s) =>
                s.id === setId ? { ...s, values: { ...s.values, [fieldId]: value } } : s,
              ),
              updated_at: new Date().toISOString(),
            }));
            return { ...block, content, updated_at: new Date().toISOString() };
          }),
        }));
      },

      toggleSetComplete: (blockId, exerciseId, setId) => {
        let result: { exercise: ExerciseCard; set: ExerciseSet; wasCompleted: boolean } | null = null;

        set((state) => ({
          blocks: state.blocks.map((block) => {
            if (block.id !== blockId) return block;
            const { content } = updateExerciseInContent(block.content, exerciseId, (ex) => {
              const target = ex.sets.find((s) => s.id === setId);
              if (!target) return ex;
              const wasCompleted = !target.completed;
              const newSet: ExerciseSet = {
                ...target,
                completed: wasCompleted,
                completed_at: wasCompleted ? new Date().toISOString() : null,
              };
              const newSets = ex.sets.map((s) => (s.id === setId ? newSet : s));
              const updatedEx: ExerciseCard = { ...ex, sets: newSets, updated_at: new Date().toISOString() };
              result = { exercise: updatedEx, set: newSet, wasCompleted };
              return updatedEx;
            });
            return { ...block, content, updated_at: new Date().toISOString() };
          }),
        }));

        return result;
      },

      addSet: (blockId, exerciseId) => {
        set((state) => ({
          blocks: state.blocks.map((block) => {
            if (block.id !== blockId) return block;
            const { content } = updateExerciseInContent(block.content, exerciseId, (ex) => {
              const newSet = createEmptySet(ex.id, ex.sets.length, ex.fields);
              return { ...ex, sets: [...ex.sets, newSet], updated_at: new Date().toISOString() };
            });
            return { ...block, content, updated_at: new Date().toISOString() };
          }),
        }));
      },

      removeSet: (blockId, exerciseId, setId) => {
        set((state) => ({
          blocks: state.blocks.map((block) => {
            if (block.id !== blockId) return block;
            const { content } = updateExerciseInContent(block.content, exerciseId, (ex) => {
              const filtered = ex.sets.filter((s) => s.id !== setId).map((s, i) => ({ ...s, order: i }));
              return { ...ex, sets: filtered, updated_at: new Date().toISOString() };
            });
            return { ...block, content, updated_at: new Date().toISOString() };
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
              const { name, discipline, icon, color, cover, exercises } = action.payload;
              const id = store.addBlock(discipline, { name, icon, color, cover });
              createdBlockId = id;

              if (exercises && exercises.length > 0) {
                for (const tpl of exercises) {
                  store.addExercise(id, {
                    name: tpl.name,
                    icon: tpl.icon,
                    color: tpl.color,
                    discipline: tpl.discipline,
                  });

                  const fresh = get().blocks.find((b) => b.id === id);
                  if (fresh) {
                    const exNodes = getExercisesFromBlock(fresh);
                    const added = exNodes[exNodes.length - 1];
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
              }
              break;
            }

            case 'update_exercise': {
              const { exerciseId, updates } = action.payload;
              const ownerBlock = get().blocks.find((b) =>
                getExercisesFromBlock(b).some((ex) => ex.id === exerciseId),
              );
              if (ownerBlock) store.updateExercise(ownerBlock.id, exerciseId, updates);
              break;
            }

            case 'add_exercise': {
              const { blockId, name: exName, icon, color, discipline, sets_count, reps, rest_seconds } = action.payload;
              const targetId = blockId || createdBlockId;
              if (targetId) {
                store.addExercise(targetId, { name: exName, icon, color, discipline });
                if (sets_count !== undefined || reps !== undefined || rest_seconds !== undefined) {
                  const fresh = get().blocks.find((b) => b.id === targetId);
                  if (fresh) {
                    const exNodes = getExercisesFromBlock(fresh);
                    const added = exNodes[exNodes.length - 1];
                    if (added) {
                      const rebuilt = applyTemplateToExercise(added, {
                        name: exName, icon, color, discipline, sets_count, reps, rest_seconds,
                      });
                      store.updateExercise(targetId, added.id, {
                        sets: rebuilt.sets,
                        default_sets_count: rebuilt.default_sets_count,
                        rest_seconds: rebuilt.rest_seconds,
                      });
                    }
                  }
                }
              }
              break;
            }

            case 'delete_exercise': {
              const { blockId, exerciseId } = action.payload;
              const block = get().blocks.find((b) => b.id === blockId);
              if (block) {
                const ex = getExercisesFromBlock(block).find((e) => e.id === exerciseId);
                if (ex) store.deleteExerciseByName(blockId, ex.name);
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

      setHighlight: (blockId) => { set({ pendingHighlight: blockId }); },

      // ======================== CANVAS ========================

      ensureCanvasData: (blockId) => {
        set((state) => ({
          blocks: state.blocks.map((block) => {
            if (block.id !== blockId) return block;
            if (block.canvasData) return block;
            const canvasData: CanvasData = {
              widgets: {},
              settings: { ...DEFAULT_CANVAS_SETTINGS },
            };
            return { ...block, canvasData, updated_at: new Date().toISOString() };
          }),
        }));
      },

      hydrateCanvasFromContent: (blockId) => {
        set((state) => ({
          blocks: state.blocks.map((block) => {
            if (block.id !== blockId) return block;
            const existing = block.canvasData;
            if (existing && Object.keys(existing.widgets).length > 0) return block;
            const widgets = buildCascadeWidgets(block.content);
            const canvasData: CanvasData = {
              widgets,
              settings: existing?.settings ?? { ...DEFAULT_CANVAS_SETTINGS },
            };
            return { ...block, canvasData, updated_at: new Date().toISOString() };
          }),
        }));
      },

      addWidget: (blockId, contentNodeId, position, size) => {
        let createdId: string | null = null;
        set((state) => ({
          blocks: state.blocks.map((block) => {
            if (block.id !== blockId) return block;
            const cd: CanvasData = block.canvasData ?? {
              widgets: {},
              settings: { ...DEFAULT_CANVAS_SETTINGS },
            };
            const maxZ = Object.values(cd.widgets).reduce((m, w) => Math.max(m, w.zIndex), 0);
            const widget = createWidget(contentNodeId, position, size, maxZ + 1);
            createdId = widget.id;
            return {
              ...block,
              canvasData: { ...cd, widgets: { ...cd.widgets, [widget.id]: widget } },
              updated_at: new Date().toISOString(),
            };
          }),
        }));
        return createdId;
      },

      updateWidgetPosition: (blockId, widgetId, position) => {
        set((state) => ({
          blocks: state.blocks.map((block) => {
            if (block.id !== blockId || !block.canvasData) return block;
            const w = block.canvasData.widgets[widgetId];
            if (!w || w.frozen) return block;
            return {
              ...block,
              canvasData: {
                ...block.canvasData,
                widgets: { ...block.canvasData.widgets, [widgetId]: { ...w, position } },
              },
            };
          }),
        }));
      },

      updateWidgetSize: (blockId, widgetId, size) => {
        set((state) => ({
          blocks: state.blocks.map((block) => {
            if (block.id !== blockId || !block.canvasData) return block;
            const w = block.canvasData.widgets[widgetId];
            if (!w || w.frozen) return block;
            return {
              ...block,
              canvasData: {
                ...block.canvasData,
                widgets: { ...block.canvasData.widgets, [widgetId]: { ...w, size } },
              },
            };
          }),
        }));
      },

      toggleWidgetFreeze: (blockId, widgetId) => {
        set((state) => ({
          blocks: state.blocks.map((block) => {
            if (block.id !== blockId || !block.canvasData) return block;
            const w = block.canvasData.widgets[widgetId];
            if (!w) return block;
            return {
              ...block,
              canvasData: {
                ...block.canvasData,
                widgets: {
                  ...block.canvasData.widgets,
                  [widgetId]: { ...w, frozen: !w.frozen },
                },
              },
            };
          }),
        }));
      },

      removeWidget: (blockId, widgetId) => {
        set((state) => ({
          blocks: state.blocks.map((block) => {
            if (block.id !== blockId || !block.canvasData) return block;
            const next = { ...block.canvasData.widgets };
            delete next[widgetId];
            return {
              ...block,
              canvasData: { ...block.canvasData, widgets: next },
              updated_at: new Date().toISOString(),
            };
          }),
        }));
      },

      updateCanvasSettings: (blockId, updates) => {
        set((state) => ({
          blocks: state.blocks.map((block) => {
            if (block.id !== blockId) return block;
            const cd: CanvasData = block.canvasData ?? {
              widgets: {},
              settings: { ...DEFAULT_CANVAS_SETTINGS },
            };
            return {
              ...block,
              canvasData: { ...cd, settings: { ...cd.settings, ...updates } },
            };
          }),
        }));
      },
    }),
    {
      name: 'kairos_workout_store',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (persisted: any, version: number) => {
        if (version < 2) {
          const state = persisted as any;
          if (state.blocks) {
            state.blocks = state.blocks.map(migrateBlock);
          }
        }
        return persisted as WorkoutState;
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        AsyncStorage.getItem('kairos_blocks_v1')
          .then((raw) => {
            if (!raw) return;
            try {
              const parsed = JSON.parse(raw);
              if (parsed.length > 0 && state.blocks.length === 0) {
                const migrated = parsed.map(migrateBlock);
                useWorkoutStore.setState({ blocks: migrated });
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
