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
  createColumnSectionNode,
  getNextOrder,
  reorderNodes,
} from '../types/content';

const MOCK_USER_ID = 'user_001';

export type ThemePreference = 'light' | 'dark' | 'system';

export interface ActiveWorkoutRestTimer {
  duration: number;
  startTime: number;
  active: boolean;
}

export interface ActiveWorkout {
  blockId: string;
  /** Schedule assignment this session belongs to. Absent for free starts. */
  assignmentId?: string;
  /** ISO date YYYY-MM-DD this session is scheduled for. */
  scheduledDate?: string;
  /** Where the user came from. Drives history attribution + Kai signal context. */
  source?: 'today' | 'calendar' | 'free' | 'history';
  startTime: number;
  currentExerciseIndex: number;
  currentSetIndex: number;
  restTimer: ActiveWorkoutRestTimer;
  exercises: ExerciseCard[];
}

export interface ExerciseHistorySummary {
  exerciseId: string;
  name: string;
  maxWeight: number;
  totalVolume: number;
  setsCompleted: number;
  // Planned-vs-performed snapshot. Optional for backwards compatibility with
  // history entries written before this field existed.
  plannedWeight?: number;
  plannedReps?: number;
  plannedSetsCount?: number;
  performedSets?: Array<{ weight: number | null; reps: number | null; completed: boolean }>;
}

export interface WorkoutHistoryEntry {
  id: string;
  blockId: string;
  blockName: string;
  /** Schedule context — present when the session was started from a planned occurrence. */
  assignmentId?: string;
  scheduledDate?: string;
  source?: 'today' | 'calendar' | 'free' | 'history';
  startedAt: number;
  endedAt: number;
  exerciseCount: number;
  setCount: number;
  totalVolume: number;
  durationSec: number;
  exercises: ExerciseHistorySummary[];
}

interface WorkoutState {
  blocks: WorkoutBlock[];
  pendingHighlight: string | null;
  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => void;
  userName: string;
  userGoal: 'strength' | 'endurance' | 'flexibility' | 'health' | null;
  setUserName: (name: string) => void;
  setUserGoal: (goal: 'strength' | 'endurance' | 'flexibility' | 'health') => void;
  activeWorkout: ActiveWorkout | null;
  workoutHistory: WorkoutHistoryEntry[];

  startWorkout: (
    blockId: string,
    ctx?: {
      assignmentId?: string;
      scheduledDate?: string;
      source?: 'today' | 'calendar' | 'free' | 'history';
    },
  ) => void;
  completeSet: (
    exerciseId: string,
    setId: string,
    values: Record<string, FieldValue>,
  ) => void;
  skipRest: () => void;
  nextExercise: () => void;
  previousExercise: () => void;
  goToSet: (setIndex: number) => void;
  appendActiveExercise: (exercise: ExerciseCard) => void;
  reorderActiveExercises: (orderedIds: string[]) => void;
  removeActiveExercise: (exerciseId: string) => void;
  setExerciseGoal: (
    blockId: string,
    exerciseId: string,
    goal: { goalWeight?: number; goalReps?: number },
  ) => void;
  finishWorkout: () => WorkoutHistoryEntry | null;
  cancelWorkout: () => void;

  activeInsights: string[];
  addInsight: (text: string) => void;
  clearInsight: (index: number) => void;
  clearAllInsights: () => void;

  addBlock: (
    discipline?: Discipline,
    overrides?: { name?: string; icon?: string; color?: string; cover?: BlockCover },
  ) => string;
  updateBlock: (blockId: string, updates: Partial<WorkoutBlock>) => void;
  deleteBlock: (blockId: string) => void;
  reorderBlocks: (blocks: WorkoutBlock[]) => void;
  replaceAllBlocks: (blocks: WorkoutBlock[]) => void;

  addContentNode: (blockId: string, node: ContentNode) => void;
  insertContentNode: (blockId: string, node: ContentNode, position?: number) => void;
  updateContentNode: (blockId: string, nodeId: string, updates: Partial<ContentNode>) => void;
  deleteContentNode: (blockId: string, nodeId: string) => void;
  reorderContentNodes: (blockId: string, nodeIds: string[]) => void;
  duplicateContentNode: (blockId: string, nodeId: string) => void;
  moveContentNode: (blockId: string, nodeId: string, direction: 'up' | 'down') => void;
  wrapNodesInColumns: (
    blockId: string,
    nodeIds: string[],
    columns: 2 | 3,
  ) => string | null;

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
      themePreference: 'system' as ThemePreference,
      setThemePreference: (pref) => set({ themePreference: pref }),
      userName: '',
      userGoal: null,
      setUserName: (name) => set({ userName: name.trim() }),
      setUserGoal: (goal) =>
        set({ userGoal: goal as 'strength' | 'endurance' | 'flexibility' | 'health' }),
      activeWorkout: null,
      workoutHistory: [],

      startWorkout: (blockId, ctx) => {
        const block = get().blocks.find((b) => b.id === blockId);
        if (!block) return;
        const exercises: ExerciseCard[] = block.content
          .filter((n): n is Extract<ContentNode, { type: 'exercise' }> => n.type === 'exercise')
          .sort((a, b) => a.order - b.order)
          .map((n) => JSON.parse(JSON.stringify(n.data.exercise)) as ExerciseCard);
        if (exercises.length === 0) return;

        // Preload set values from per-exercise goals so the user starts each
        // set with the planned target instead of an empty input. We only fill
        // empty slots — sets that already have an explicit value win.
        for (const ex of exercises) {
          for (const s of ex.sets) {
            if (ex.goalWeight != null && s.values['weight'] == null) {
              s.values['weight'] = ex.goalWeight;
            }
            if (ex.goalReps != null && s.values['reps'] == null) {
              s.values['reps'] = ex.goalReps;
            }
          }
        }

        set({
          activeWorkout: {
            blockId,
            assignmentId: ctx?.assignmentId,
            scheduledDate: ctx?.scheduledDate,
            source: ctx?.source ?? 'free',
            startTime: Date.now(),
            currentExerciseIndex: 0,
            currentSetIndex: 0,
            restTimer: { duration: 0, startTime: 0, active: false },
            exercises,
          },
        });
      },

      completeSet: (exerciseId, setId, values) => {
        set((state) => {
          if (!state.activeWorkout) return state;
          const aw = state.activeWorkout;
          const exercises = aw.exercises.map((ex) => {
            if (ex.id !== exerciseId) return ex;
            return {
              ...ex,
              sets: ex.sets.map((s) =>
                s.id === setId
                  ? {
                      ...s,
                      values: { ...s.values, ...values },
                      completed: true,
                      completed_at: new Date().toISOString(),
                    }
                  : s,
              ),
            };
          });

          const currentEx = exercises[aw.currentExerciseIndex];
          const isLastSet = aw.currentSetIndex >= currentEx.sets.length - 1;
          const isLastExercise = aw.currentExerciseIndex >= exercises.length - 1;

          let nextExIdx = aw.currentExerciseIndex;
          let nextSetIdx = aw.currentSetIndex + 1;
          if (isLastSet && !isLastExercise) {
            nextExIdx = aw.currentExerciseIndex + 1;
            nextSetIdx = 0;
          } else if (isLastSet && isLastExercise) {
            nextSetIdx = aw.currentSetIndex; // pin to last
          }

          const restDuration = currentEx.rest_seconds || 90;

          return {
            activeWorkout: {
              ...aw,
              exercises,
              currentExerciseIndex: nextExIdx,
              currentSetIndex: nextSetIdx,
              restTimer: { duration: restDuration, startTime: Date.now(), active: true },
            },
          };
        });
      },

      skipRest: () => {
        set((state) => {
          if (!state.activeWorkout) return state;
          return {
            activeWorkout: {
              ...state.activeWorkout,
              restTimer: { ...state.activeWorkout.restTimer, active: false },
            },
          };
        });
      },

      nextExercise: () => {
        set((state) => {
          if (!state.activeWorkout) return state;
          const aw = state.activeWorkout;
          if (aw.currentExerciseIndex >= aw.exercises.length - 1) return state;
          return {
            activeWorkout: {
              ...aw,
              currentExerciseIndex: aw.currentExerciseIndex + 1,
              currentSetIndex: 0,
            },
          };
        });
      },

      previousExercise: () => {
        set((state) => {
          if (!state.activeWorkout) return state;
          const aw = state.activeWorkout;
          if (aw.currentExerciseIndex <= 0) return state;
          return {
            activeWorkout: {
              ...aw,
              currentExerciseIndex: aw.currentExerciseIndex - 1,
              currentSetIndex: 0,
            },
          };
        });
      },

      goToSet: (setIndex) => {
        set((state) => {
          if (!state.activeWorkout) return state;
          const ex = state.activeWorkout.exercises[state.activeWorkout.currentExerciseIndex];
          if (!ex) return state;
          const clamped = Math.max(0, Math.min(ex.sets.length - 1, setIndex));
          return {
            activeWorkout: { ...state.activeWorkout, currentSetIndex: clamped },
          };
        });
      },

      appendActiveExercise: (exercise) => {
        set((state) => {
          if (!state.activeWorkout) return state;
          return {
            activeWorkout: {
              ...state.activeWorkout,
              exercises: [...state.activeWorkout.exercises, exercise],
            },
          };
        });
      },

      reorderActiveExercises: (orderedIds) => {
        set((state) => {
          if (!state.activeWorkout) return state;
          const map = new Map(state.activeWorkout.exercises.map((e) => [e.id, e]));
          const reordered: ExerciseCard[] = [];
          for (const id of orderedIds) {
            const ex = map.get(id);
            if (ex) reordered.push(ex);
          }
          for (const ex of state.activeWorkout.exercises) {
            if (!orderedIds.includes(ex.id)) reordered.push(ex);
          }
          const activeId = state.activeWorkout.exercises[state.activeWorkout.currentExerciseIndex]?.id;
          const newIdx = activeId ? reordered.findIndex((e) => e.id === activeId) : 0;
          return {
            activeWorkout: {
              ...state.activeWorkout,
              exercises: reordered,
              currentExerciseIndex: Math.max(0, newIdx),
            },
          };
        });
      },

      removeActiveExercise: (exerciseId) => {
        set((state) => {
          if (!state.activeWorkout) return state;
          const aw = state.activeWorkout;
          const idx = aw.exercises.findIndex((e) => e.id === exerciseId);
          if (idx === -1) return state;
          const exercises = aw.exercises.filter((e) => e.id !== exerciseId);
          if (exercises.length === 0) {
            return { activeWorkout: { ...aw, exercises, currentExerciseIndex: 0, currentSetIndex: 0 } };
          }
          let nextIdx = aw.currentExerciseIndex;
          if (idx < aw.currentExerciseIndex) nextIdx = aw.currentExerciseIndex - 1;
          else if (idx === aw.currentExerciseIndex) nextIdx = Math.min(idx, exercises.length - 1);
          return {
            activeWorkout: {
              ...aw,
              exercises,
              currentExerciseIndex: Math.max(0, nextIdx),
              currentSetIndex: 0,
            },
          };
        });
      },

      setExerciseGoal: (blockId, exerciseId, goal) => {
        get().updateExercise(blockId, exerciseId, {
          goalWeight: goal.goalWeight,
          goalReps: goal.goalReps,
        });
        set((state) => {
          if (!state.activeWorkout) return state;
          return {
            activeWorkout: {
              ...state.activeWorkout,
              exercises: state.activeWorkout.exercises.map((ex) =>
                ex.id === exerciseId
                  ? { ...ex, goalWeight: goal.goalWeight, goalReps: goal.goalReps }
                  : ex,
              ),
            },
          };
        });
      },

      finishWorkout: () => {
        let summary: WorkoutHistoryEntry | null = null;
        set((state) => {
          if (!state.activeWorkout) return state;
          const aw = state.activeWorkout;
          const block = state.blocks.find((b) => b.id === aw.blockId);
          let totalSets = 0;
          let totalVolume = 0;
          const perEx: ExerciseHistorySummary[] = [];
          for (const ex of aw.exercises) {
            let maxW = 0;
            let exVol = 0;
            let setsDone = 0;
            const performedSets: Array<{ weight: number | null; reps: number | null; completed: boolean }> = [];
            for (const s of ex.sets) {
              const w = typeof s.values['weight'] === 'number' ? (s.values['weight'] as number) : null;
              const r = typeof s.values['reps'] === 'number' ? (s.values['reps'] as number) : null;
              performedSets.push({ weight: w, reps: r, completed: s.completed });
              if (!s.completed) continue;
              setsDone += 1;
              totalSets += 1;
              const wNum = w ?? 0;
              const rNum = r ?? 0;
              if (wNum > maxW) maxW = wNum;
              exVol += wNum * rNum;
              totalVolume += wNum * rNum;
            }
            perEx.push({
              exerciseId: ex.id,
              name: ex.name,
              maxWeight: maxW,
              totalVolume: exVol,
              setsCompleted: setsDone,
              plannedWeight: ex.goalWeight,
              plannedReps: ex.goalReps,
              plannedSetsCount: ex.sets.length,
              performedSets,
            });
          }
          const endedAt = Date.now();
          summary = {
            id: generateId(),
            blockId: aw.blockId,
            blockName: block?.name ?? 'Workout',
            assignmentId: aw.assignmentId,
            scheduledDate: aw.scheduledDate,
            source: aw.source,
            startedAt: aw.startTime,
            endedAt,
            exerciseCount: aw.exercises.length,
            setCount: totalSets,
            totalVolume,
            durationSec: Math.round((endedAt - aw.startTime) / 1000),
            exercises: perEx,
          };
          return {
            activeWorkout: null,
            workoutHistory: [summary, ...state.workoutHistory].slice(0, 100),
          };
        });

        // Fire-and-forget insight detection (non-blocking, dynamic import to avoid cycles).
        if (summary) {
          setTimeout(() => {
            import('../lib/ai/insights')
              .then((m) => m.runPostWorkoutInsights())
              .catch(() => {});
          }, 0);
        }

        return summary;
      },

      cancelWorkout: () => set({ activeWorkout: null }),

      activeInsights: [],
      addInsight: (text) =>
        set((state) => ({ activeInsights: [...state.activeInsights, text].slice(-5) })),
      clearInsight: (index) =>
        set((state) => ({
          activeInsights: state.activeInsights.filter((_, i) => i !== index),
        })),
      clearAllInsights: () => set({ activeInsights: [] }),

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

      insertContentNode: (blockId, node, position) => {
        set((state) => ({
          blocks: state.blocks.map((block) => {
            if (block.id !== blockId) return block;
            const sorted = [...block.content].sort((a, b) => a.order - b.order);
            // Append when position is missing or out of range.
            const insertIdx =
              position === undefined || position < 0 || position > sorted.length
                ? sorted.length
                : position;
            const before = sorted.slice(0, insertIdx);
            const after = sorted.slice(insertIdx);
            const inserted: ContentNode = { ...node, order: insertIdx } as ContentNode;
            const reseq = [
              ...before,
              inserted,
              ...after.map((n, i) => ({ ...n, order: insertIdx + 1 + i }) as ContentNode),
            ];
            return { ...block, content: reseq, updated_at: new Date().toISOString() };
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

      wrapNodesInColumns: (blockId, nodeIds, columns) => {
        let sectionId: string | null = null;

        set((state) => ({
          blocks: state.blocks.map((block) => {
            if (block.id !== blockId) return block;
            const targetIds = new Set(nodeIds);
            const targets = block.content.filter((n) => targetIds.has(n.id));
            if (targets.length === 0) return block;

            // Insert the columnSection right before the first target node so
            // visual order is preserved. Children are reassigned `section` and
            // distributed round-robin across columns 0..N-1.
            const sortedAll = [...block.content].sort((a, b) => a.order - b.order);
            const firstTargetIdx = sortedAll.findIndex((n) => targetIds.has(n.id));
            const beforeAnchor = sortedAll.slice(0, firstTargetIdx);
            const afterAnchor = sortedAll.slice(firstTargetIdx);

            const section = createColumnSectionNode(0, columns);
            sectionId = section.id;

            // Re-sequence: keep non-target nodes in their original order, the
            // section sits where the first target was, targets become children.
            const nonTargetsBefore = beforeAnchor;
            const nonTargetsAfter = afterAnchor.filter((n) => !targetIds.has(n.id));
            const targetsOrdered = afterAnchor.filter((n) => targetIds.has(n.id));

            const reChildren = targetsOrdered.map((n, i) => ({
              ...n,
              section: section.id,
              column: i % columns,
            } as ContentNode));

            const merged = [
              ...nonTargetsBefore,
              { ...section, order: 0 } as ContentNode,
              ...reChildren,
              ...nonTargetsAfter,
            ].map((n, i) => ({ ...n, order: i }) as ContentNode);

            return { ...block, content: merged, updated_at: new Date().toISOString() };
          }),
        }));

        return sectionId;
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
