// Run: npx tsx src/components/workout/lib/previousReference.dev.ts

import { findPreviousReference, formatReference, normalizeExerciseName } from './previousReference';
import type {
  WorkoutHistoryEntry,
  ActiveWorkout,
  ExerciseHistorySummary,
} from '../../../store/workoutStore';
import type { ExerciseCard, ExerciseSet } from '../../../types/core';

let failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (!cond) {
    console.error('FAIL', name, extra ?? '');
    failed++;
  } else console.log('OK', name);
}

function set(
  opts: Partial<ExerciseSet> & {
    weight?: number | null;
    reps?: number | null;
    completed?: boolean;
  },
): ExerciseSet {
  const values: ExerciseSet['values'] = {};
  if (opts.weight !== undefined) values['weight'] = opts.weight;
  if (opts.reps !== undefined) values['reps'] = opts.reps;
  return {
    id: opts.id ?? 's',
    exercise_card_id: opts.exercise_card_id ?? 'ex',
    order: opts.order ?? 0,
    values,
    completed: opts.completed ?? false,
    completed_at: null,
    notes: null,
  };
}

function exHistory(opts: Partial<ExerciseHistorySummary>): ExerciseHistorySummary {
  return {
    exerciseId: opts.exerciseId ?? 'press',
    libraryId: opts.libraryId,
    name: opts.name ?? 'Press banca',
    maxWeight: opts.maxWeight ?? 0,
    totalVolume: opts.totalVolume ?? 0,
    setsCompleted: opts.setsCompleted ?? 0,
    performedSets: opts.performedSets,
  };
}

function entry(opts: Partial<WorkoutHistoryEntry>): WorkoutHistoryEntry {
  return {
    id: opts.id ?? 'h',
    blockId: opts.blockId ?? 'b',
    blockName: opts.blockName ?? 'Block',
    startedAt: opts.startedAt ?? 0,
    endedAt: opts.endedAt ?? 0,
    exerciseCount: opts.exerciseCount ?? 1,
    setCount: opts.setCount ?? 0,
    totalVolume: opts.totalVolume ?? 0,
    durationSec: opts.durationSec ?? 0,
    exercises: opts.exercises ?? [],
  };
}

// 1. No previous at all → null
check(
  'no history no session → null',
  findPreviousReference({ exerciseId: 'press', active: null, history: [] }) === null,
);

// 2. Current session preferred over history
const active: ActiveWorkout = {
  blockId: 'b',
  startTime: 0,
  currentExerciseIndex: 0,
  currentSetIndex: 1,
  restTimer: { duration: 0, startTime: 0, active: false },
  exercises: [
    {
      id: 'press',
      workout_block_id: 'b',
      order: 0,
      name: 'Press banca',
      icon: 'barbell',
      color: '#000',
      notes: null,
      discipline: 'strength',
      fields: [],
      default_sets_count: 3,
      rest_seconds: 60,
      sets: [
        set({ id: 's1', weight: 60, reps: 8, completed: true }),
        set({ id: 's2', weight: 62.5, reps: 0, completed: false }),
      ],
      created_at: '',
      updated_at: '',
    } as ExerciseCard,
  ],
};
const oldHistory = [
  entry({
    id: 'h1',
    endedAt: 1000,
    exercises: [
      exHistory({ exerciseId: 'press', performedSets: [{ weight: 50, reps: 8, completed: true }] }),
    ],
  }),
];
const refSession = findPreviousReference({ exerciseId: 'press', active, history: oldHistory });
check(
  'session > history',
  refSession?.source === 'current-session' && refSession?.weight === 60 && refSession?.reps === 8,
);

// 3. Skip uncompleted current session sets, fall back to history
const activeNoComplete: ActiveWorkout = {
  ...active,
  exercises: [
    { ...active.exercises[0], sets: [set({ id: 's1', weight: 99, reps: 1, completed: false })] },
  ],
};
const ref2 = findPreviousReference({
  exerciseId: 'press',
  active: activeNoComplete,
  history: oldHistory,
});
check('skip uncompleted → history', ref2?.source === 'history' && ref2?.weight === 50);

// 4. Find most recent history when multiple entries
const histMulti = [
  entry({
    id: 'h-new',
    endedAt: 2000,
    exercises: [
      exHistory({ exerciseId: 'press', performedSets: [{ weight: 70, reps: 5, completed: true }] }),
    ],
  }),
  entry({
    id: 'h-old',
    endedAt: 1000,
    exercises: [
      exHistory({ exerciseId: 'press', performedSets: [{ weight: 50, reps: 8, completed: true }] }),
    ],
  }),
];
const ref3 = findPreviousReference({ exerciseId: 'press', active: null, history: histMulti });
check('most recent history wins', ref3?.weight === 70);

// 5. excludeEntryId skips the just-finished entry
const ref4 = findPreviousReference({
  exerciseId: 'press',
  active: null,
  history: histMulti,
  excludeEntryId: 'h-new',
});
check('excludeEntryId skips it', ref4?.weight === 50);

// 6. format
check(
  'format weight + reps',
  formatReference({ source: 'history', weight: 60, reps: 8 }) === '60 kg × 8',
);
check(
  'format weight only',
  formatReference({ source: 'history', weight: 60, reps: null }) === '60 kg',
);
check(
  'format reps only',
  formatReference({ source: 'history', weight: null, reps: 12 }) === '× 12',
);
check(
  'format strips trailing zero',
  formatReference({ source: 'history', weight: 62.5, reps: 8 }) === '62.5 kg × 8',
);
check('format null', formatReference(null) === null);
check('format empty', formatReference({ source: 'history', weight: null, reps: null }) === null);

// 7. Cross-block fallback via libraryId
const crossBlock = [
  entry({
    id: 'h-other-block',
    blockId: 'other',
    blockName: 'Otro bloque',
    endedAt: 3000,
    exercises: [
      exHistory({
        exerciseId: 'press-clone-2',
        libraryId: 'lib_bench',
        performedSets: [{ weight: 80, reps: 5, completed: true }],
      }),
    ],
  }),
];
const refLib = findPreviousReference({
  exerciseId: 'press-clone-9',
  libraryId: 'lib_bench',
  active: null,
  history: crossBlock,
});
check(
  'libraryId matches across blocks',
  refLib?.weight === 80 && refLib?.blockName === 'Otro bloque',
);
check(
  'no libraryId → no cross match',
  findPreviousReference({ exerciseId: 'press-clone-9', active: null, history: crossBlock }) ===
    null,
);

// 8. Cross-block fallback via normalized name (custom exercises)
const refName = findPreviousReference({
  exerciseId: 'nope',
  exerciseName: '  press BANCA ',
  active: null,
  history: crossBlock.map((e) => ({
    ...e,
    exercises: [
      exHistory({
        exerciseId: 'x',
        name: 'Press banca',
        performedSets: [{ weight: 70, reps: 6, completed: true }],
      }),
    ],
  })),
});
check('normalized name matches', refName?.weight === 70);

// 9. Exact id wins over libraryId within the same entry
const tiered = [
  entry({
    id: 'h-tier',
    endedAt: 5000,
    exercises: [
      exHistory({
        exerciseId: 'other-ex',
        libraryId: 'lib_bench',
        performedSets: [{ weight: 100, reps: 3, completed: true }],
      }),
      exHistory({
        exerciseId: 'press',
        performedSets: [{ weight: 55, reps: 10, completed: true }],
      }),
    ],
  }),
];
const refTier = findPreviousReference({
  exerciseId: 'press',
  libraryId: 'lib_bench',
  active: null,
  history: tiered,
});
check('exact id beats libraryId in same entry', refTier?.weight === 55);

// 10. Superset cycle suffix is stripped for name matching
check(
  'normalize strips cycle suffix',
  normalizeExerciseName('Press banca · 2/3') === 'press banca',
);
check('normalize collapses spaces', normalizeExerciseName('  Press   Banca ') === 'press banca');

if (failed > 0) {
  console.error(`${failed} failures`);
  process.exit(1);
}
console.log('all previousReference checks pass');
