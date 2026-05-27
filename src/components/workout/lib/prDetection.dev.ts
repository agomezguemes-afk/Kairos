// Run: npx tsx src/components/workout/lib/prDetection.dev.ts

import { detectPR, formatPRDelta, PR_LABEL } from './prDetection';
import type { WorkoutHistoryEntry } from '../../../store/workoutStore';

let failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (!cond) {
    console.error('FAIL', name, extra ?? '');
    failed++;
  } else console.log('OK', name);
}

function hist(
  performed: { weight: number; reps: number; completed: boolean }[],
): WorkoutHistoryEntry[] {
  return [
    {
      id: 'h',
      blockId: 'b',
      blockName: 'B',
      startedAt: 0,
      endedAt: 1000,
      exerciseCount: 1,
      setCount: performed.length,
      totalVolume: 0,
      durationSec: 0,
      exercises: [
        {
          exerciseId: 'press',
          name: 'Press',
          maxWeight: 0,
          totalVolume: 0,
          setsCompleted: 0,
          performedSets: performed,
        },
      ],
    },
  ];
}

// 1. Pure max-weight PR
const r1 = detectPR({
  exerciseId: 'press',
  set: { weight: 65, reps: 5 },
  history: hist([{ weight: 60, reps: 8, completed: true }]),
});
check('max-weight PR detected', r1?.kind === 'max-weight' && r1.delta === 5);

// 2. Reps at same max weight
const r2 = detectPR({
  exerciseId: 'press',
  set: { weight: 60, reps: 9 },
  history: hist([{ weight: 60, reps: 8, completed: true }]),
});
check('reps at weight PR', r2?.kind === 'max-reps-at-weight' && r2.delta === 1);

// 3. Same weight same reps → no PR
const r3 = detectPR({
  exerciseId: 'press',
  set: { weight: 60, reps: 8 },
  history: hist([{ weight: 60, reps: 8, completed: true }]),
});
check('no PR when equal', r3 === null);

// 4. Volume PR (lighter weight, more reps)
const r4 = detectPR({
  exerciseId: 'press',
  set: { weight: 50, reps: 12 },
  history: hist([{ weight: 60, reps: 8, completed: true }]),
}); // 600 vs 480
check('volume PR', r4?.kind === 'max-volume-set' && r4.delta === 120);

// 5. No previous data → not a PR (first set has nothing to beat)
const r5 = detectPR({ exerciseId: 'press', set: { weight: 60, reps: 8 }, history: [] });
check('first ever set NOT a PR', r5 === null);

// 6. Skip uncompleted prior sets
const r6 = detectPR({
  exerciseId: 'press',
  set: { weight: 62.5, reps: 5 },
  history: hist([{ weight: 70, reps: 5, completed: false }]),
});
check('uncompleted prior ignored → max-weight PR', r6?.kind === 'max-weight' && r6.delta === 62.5);

// 7. format
check('format kg', formatPRDelta({ kind: 'max-weight', delta: 2.5, unit: 'kg' }) === '+2.5 kg');
check(
  'format reps singular',
  formatPRDelta({ kind: 'max-reps-at-weight', delta: 1, unit: 'rep' }) === '+1 rep',
);
check(
  'format reps plural',
  formatPRDelta({ kind: 'max-reps-at-weight', delta: 3, unit: 'rep' }) === '+3 reps',
);
check(
  'format volume',
  formatPRDelta({ kind: 'max-volume-set', delta: 25, unit: 'kg·rep' }) === 'Volumen +25',
);
check('labels exist', PR_LABEL['max-weight'] === 'Nuevo máximo');

// 8. Excluded entry id
const r8 = detectPR({
  exerciseId: 'press',
  set: { weight: 65, reps: 5 },
  history: hist([{ weight: 60, reps: 8, completed: true }]),
  excludeEntryId: 'h',
});
check('excludeEntryId skips its entry', r8 === null);

if (failed > 0) {
  console.error(`${failed} failures`);
  process.exit(1);
}
console.log('all prDetection checks pass');
