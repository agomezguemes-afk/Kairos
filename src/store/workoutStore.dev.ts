// src/store/workoutStore.dev.ts
// Run with: npx tsx src/store/workoutStore.dev.ts
//
// Covers the workout session lifecycle (start → complete sets → rest →
// finish), content-node operations, and the CSV-import merge. Follows the
// scheduleStore.dev.ts pattern: AsyncStorage's web fallback needs a window
// stub before zustand persist flushes.

import { useWorkoutStore, type WorkoutHistoryEntry } from './workoutStore';
import { createExerciseCard, getBlockExercises } from '../types/core';
import { createSupersetNode, createDashboardNode } from '../types/content';

(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  },
};

let failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (!cond) {
    console.error('FAIL', name, extra ?? '');
    failed++;
  } else console.log('OK', name);
}

function resetStore() {
  useWorkoutStore.setState({
    blocks: [],
    activeWorkout: null,
    workoutHistory: [],
    pendingHighlight: null,
  });
}

const store = () => useWorkoutStore.getState();

// ════════════════ Block + exercise CRUD ════════════════

resetStore();
const blockId = store().addBlock('strength', { name: 'Test A' });
check('addBlock returns id', typeof blockId === 'string' && blockId.length > 0);
check('block stored', store().blocks.length === 1);

store().addExercise(blockId, { name: 'Press banca' });
let block = store().blocks[0];
check('addExercise creates node', block.content.length === 1);
const ex0 = getBlockExercises(block)[0];
check('exercise defaults: 4 sets', ex0.sets.length === 4);

// Dashboard name sync on rename
store().addContentNode(blockId, {
  ...createDashboardNode(1, 'exercise_max_weight', 'counter', 'PR', '#D4AF37'),
});
let dashNode = store().blocks[0].content.find((n) => n.type === 'dashboard');
store().updateContentNode(blockId, dashNode!.id, {
  data: { ...(dashNode as any).data, exerciseId: ex0.id, exerciseName: ex0.name },
} as any);
store().updateExercise(blockId, ex0.id, { name: 'Press inclinado' });
block = store().blocks[0];
dashNode = block.content.find((n) => n.type === 'dashboard');
check('rename syncs dashboard label', (dashNode as any).data.exerciseName === 'Press inclinado');
check('rename applied to card', getBlockExercises(block)[0].name === 'Press inclinado');

// deleteExercise unbinds dashboards but keeps them
store().deleteExercise(blockId, ex0.id);
block = store().blocks[0];
check('exercise deleted', getBlockExercises(block).length === 0);
dashNode = block.content.find((n) => n.type === 'dashboard');
check(
  'dashboard survives, unbound',
  dashNode != null && (dashNode as any).data.exerciseId === undefined,
);

// addSet / removeSet reindex
store().addExercise(blockId, { name: 'Sentadilla' });
block = store().blocks[0];
const ex1 = getBlockExercises(block)[0];
store().addSet(blockId, ex1.id);
check('addSet appends', getBlockExercises(store().blocks[0])[0].sets.length === 5);
const victim = getBlockExercises(store().blocks[0])[0].sets[1];
store().removeSet(blockId, ex1.id, victim.id);
const setsAfter = getBlockExercises(store().blocks[0])[0].sets;
check('removeSet drops one', setsAfter.length === 4);
check(
  'removeSet reindexes order',
  setsAfter.every((s, i) => s.order === i),
);

// toggleSetComplete returns the toggled set
const toggled = store().toggleSetComplete(blockId, ex1.id, setsAfter[0].id);
check('toggle reports wasCompleted', toggled?.wasCompleted === true);
check('toggle persists', getBlockExercises(store().blocks[0])[0].sets[0].completed === true);

// ════════════════ Content node ops ════════════════

resetStore();
const b2 = store().addBlock('general', { name: 'Nodes' });
store().addExercise(b2, { name: 'A' });
store().addExercise(b2, { name: 'B' });
store().addExercise(b2, { name: 'C' });

const ids = () => [...store().blocks[0].content].sort((a, b) => a.order - b.order).map((n) => n.id);

const [nA, nB, nC] = ids();
store().moveContentNode(b2, nC, 'up');
check('moveContentNode swaps order', ids()[1] === nC && ids()[2] === nB);

store().duplicateContentNode(b2, nA);
check('duplicate adds node after original', store().blocks[0].content.length === 4);
const orders = [...store().blocks[0].content].sort((a, b) => a.order - b.order).map((n) => n.order);
check(
  'duplicate resequences orders 0..n',
  orders.every((o, i) => o === i),
);

const sectionId = store().wrapNodesInColumns(b2, [nB, nC], 2);
check('wrap returns section id', typeof sectionId === 'string');
const wrapped = store().blocks[0].content.filter((n) => (n as any).section === sectionId);
check(
  'wrapped children assigned section + columns',
  wrapped.length === 2 && wrapped.every((n) => (n as any).column !== undefined),
);

// ════════════════ Session lifecycle ════════════════

resetStore();
const b3 = store().addBlock('strength', { name: 'Sesión' });
store().addExercise(b3, { name: 'Press' });
store().addExercise(b3, { name: 'Remo' });
let exs = getBlockExercises(store().blocks[0]);
// Two sets each, with goals on the first exercise
store().updateExercise(b3, exs[0].id, { goalWeight: 60, goalReps: 8, rest_seconds: 120 });
for (const e of exs) {
  const fresh = getBlockExercises(store().blocks[0]).find((x) => x.id === e.id)!;
  store().removeSet(b3, e.id, fresh.sets[3].id);
  store().removeSet(b3, e.id, fresh.sets[2].id);
}

store().startWorkout(b3, { source: 'today', scheduledDate: '2026-06-12' });
let aw = store().activeWorkout;
check('startWorkout builds queue', aw?.exercises.length === 2);
check('start at first set', aw?.currentExerciseIndex === 0 && aw?.currentSetIndex === 0);
check(
  'goal preloads empty set values',
  aw?.exercises[0].sets[0].values['weight'] === 60 && aw?.exercises[0].sets[0].values['reps'] === 8,
);
check('source carried', aw?.source === 'today' && aw?.scheduledDate === '2026-06-12');

// completeSet advances within exercise + arms rest timer
store().completeSet(aw!.exercises[0].id, aw!.exercises[0].sets[0].id, { weight: 62.5, reps: 8 });
aw = store().activeWorkout;
check('advance to set 2', aw?.currentSetIndex === 1 && aw?.currentExerciseIndex === 0);
check(
  'rest timer armed with exercise rest',
  aw?.restTimer.active === true && aw?.restTimer.duration === 120,
);
check(
  'set recorded with values',
  aw?.exercises[0].sets[0].completed === true && aw?.exercises[0].sets[0].values['weight'] === 62.5,
);

store().extendRest(30);
check('extendRest adds 30', store().activeWorkout?.restTimer.duration === 150);
store().skipRest();
check('skipRest deactivates', store().activeWorkout?.restTimer.active === false);

store().setExerciseRestForCurrent(45);
check(
  'in-session rest override (active copy only)',
  store().activeWorkout?.exercises[0].rest_seconds === 45 &&
    getBlockExercises(store().blocks[0])[0].rest_seconds === 120,
);

// Last set of exercise 1 → advances to exercise 2
store().completeSet(aw!.exercises[0].id, aw!.exercises[0].sets[1].id, { weight: 62.5, reps: 7 });
aw = store().activeWorkout;
check('advance to next exercise', aw?.currentExerciseIndex === 1 && aw?.currentSetIndex === 0);

// goToSet clamps
store().goToSet(99);
check('goToSet clamps high', store().activeWorkout?.currentSetIndex === 1);
store().goToSet(-5);
check('goToSet clamps low', store().activeWorkout?.currentSetIndex === 0);

// Complete remaining sets, then finish
aw = store().activeWorkout;
store().completeSet(aw!.exercises[1].id, aw!.exercises[1].sets[0].id, { weight: 40, reps: 10 });
store().completeSet(aw!.exercises[1].id, aw!.exercises[1].sets[1].id, { weight: 40, reps: 10 });

const summary = store().finishWorkout();
check('finish returns summary', summary != null);
check('activeWorkout cleared', store().activeWorkout === null);
check('history gets entry', store().workoutHistory.length === 1);
check('summary set count', summary?.setCount === 4);
// 62.5×8 + 62.5×7 + 40×10 + 40×10 = 500 + 437.5 + 400 + 400
check('summary volume math', summary?.totalVolume === 1737.5, summary?.totalVolume);
const pressHist = summary?.exercises.find((e) => e.name === 'Press');
check(
  'planned vs performed snapshot',
  pressHist?.plannedWeight === 60 &&
    pressHist?.plannedReps === 8 &&
    pressHist?.performedSets?.length === 2,
);

// ════════════════ Superset expansion ════════════════

resetStore();
const b4 = store().addBlock('strength', { name: 'Superset' });
const sA = createExerciseCard(b4, 0, 'strength', { name: 'Fondos' });
const sB = createExerciseCard(b4, 1, 'strength', { name: 'Dominadas' });
store().addContentNode(b4, createSupersetNode(0, [sA, sB], 2, 60, 'Par 1'));
store().startWorkout(b4);
aw = store().activeWorkout;
check('superset expands cycles × exercises', aw?.exercises.length === 4);
check(
  'superset interleaves A1 B1 A2 B2',
  aw?.exercises.map((e) => e.name).join(',') ===
    'Fondos · 1/2,Dominadas · 1/2,Fondos · 2/2,Dominadas · 2/2',
  aw?.exercises.map((e) => e.name),
);
check(
  'each expanded entry has single set',
  aw?.exercises.every((e) => e.sets.length === 1) === true,
);
store().cancelWorkout();
check('cancel clears session', store().activeWorkout === null);

// ════════════════ Active queue editing ════════════════

resetStore();
const b5 = store().addBlock('strength', { name: 'Queue' });
store().addExercise(b5, { name: 'E1' });
store().addExercise(b5, { name: 'E2' });
store().addExercise(b5, { name: 'E3' });
store().startWorkout(b5);
store().nextExercise();
aw = store().activeWorkout;
const currentId = aw!.exercises[1].id;
// Remove an exercise BEFORE the current one → index shifts down
store().removeActiveExercise(aw!.exercises[0].id);
aw = store().activeWorkout;
check(
  'removeActiveExercise keeps current focused',
  aw?.currentExerciseIndex === 0 && aw?.exercises[0].id === currentId,
);
store().reorderActiveExercises([aw!.exercises[1].id, aw!.exercises[0].id]);
aw = store().activeWorkout;
check(
  'reorder follows the active exercise',
  aw?.exercises[aw.currentExerciseIndex].id === currentId,
);

// ════════════════ Import merge ════════════════

resetStore();
function importEntry(startedAt: number, name: string): WorkoutHistoryEntry {
  return {
    id: `imp_${startedAt}`,
    blockId: 'imported',
    blockName: name,
    startedAt,
    endedAt: startedAt + 3_600_000,
    exerciseCount: 1,
    setCount: 2,
    totalVolume: 100,
    durationSec: 3600,
    exercises: [],
  };
}
const added1 = store().importWorkoutHistory([importEntry(1000, 'W1'), importEntry(2000, 'W2')]);
check('import adds fresh entries', added1 === 2 && store().workoutHistory.length === 2);
check('history sorted newest first', store().workoutHistory[0].blockName === 'W2');
const added2 = store().importWorkoutHistory([importEntry(1000, 'W1'), importEntry(3000, 'W3')]);
check('re-import dedupes', added2 === 1 && store().workoutHistory.length === 3);

// ════════════════ Result ════════════════

if (failed > 0) {
  console.error(`${failed} failures`);
  process.exit(1);
}
console.log('all workoutStore checks pass');
process.exit(0);
