import type { WorkoutHistoryEntry, ExerciseHistorySummary } from '../../../store/workoutStore';
import { compareToPrevious, nextActionSuggestion } from './summaryCompare';

let failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (!cond) {
    console.error('FAIL', name, extra ?? '');
    failed++;
  } else console.log('OK', name);
}

function ex(id: string, opts: Partial<ExerciseHistorySummary> = {}): ExerciseHistorySummary {
  return {
    exerciseId: id,
    name: id,
    maxWeight: opts.maxWeight ?? 0,
    totalVolume: opts.totalVolume ?? 0,
    setsCompleted: opts.setsCompleted ?? 0,
    plannedSetsCount: opts.plannedSetsCount,
  };
}

function entry(id: string, opts: Partial<WorkoutHistoryEntry> = {}): WorkoutHistoryEntry {
  return {
    id,
    blockId: opts.blockId ?? 'block-a',
    blockName: opts.blockName ?? 'Block A',
    startedAt: opts.startedAt ?? 0,
    endedAt: opts.endedAt ?? 0,
    exerciseCount: opts.exerciseCount ?? 1,
    setCount: opts.setCount ?? 0,
    totalVolume: opts.totalVolume ?? 0,
    durationSec: opts.durationSec ?? 0,
    exercises: opts.exercises ?? [ex('press')],
  };
}

const cur = entry('cur', {
  setCount: 9,
  totalVolume: 540,
  endedAt: 200,
  exercises: [
    ex('press', { maxWeight: 60, totalVolume: 540, setsCompleted: 9, plannedSetsCount: 9 }),
  ],
});
const prevSame = entry('prev1', {
  setCount: 9,
  totalVolume: 540,
  endedAt: 100,
  exercises: [
    ex('press', { maxWeight: 60, totalVolume: 540, setsCompleted: 9, plannedSetsCount: 9 }),
  ],
});
const prevLower = entry('prev2', {
  setCount: 8,
  totalVolume: 480,
  endedAt: 100,
  exercises: [
    ex('press', { maxWeight: 55, totalVolume: 480, setsCompleted: 8, plannedSetsCount: 9 }),
  ],
});
const prevHigher = entry('prev3', {
  setCount: 10,
  totalVolume: 600,
  endedAt: 100,
  exercises: [
    ex('press', { maxWeight: 62.5, totalVolume: 600, setsCompleted: 10, plannedSetsCount: 9 }),
  ],
});

// 1. No previous → first
const c1 = compareToPrevious(cur, []);
check('no prev → first', nextActionSuggestion(c1).tone === 'first');
check('adherence computed when no prev', c1.adherence === 1);

// 2. Previous identical → maintain
const c2 = compareToPrevious(cur, [prevSame]);
check('identical → maintain', nextActionSuggestion(c2).tone === 'maintain');
check('delta volume 0', c2.delta?.volume === 0);

// 3. Previous lower → progress
const c3 = compareToPrevious(cur, [prevLower]);
check('lower prev → progress', nextActionSuggestion(c3).tone === 'progress');
check('delta volume positive', (c3.delta?.volume ?? 0) > 0);

// 4. Previous higher → maintain (regression copy)
const c4 = compareToPrevious(cur, [prevHigher]);
check('higher prev → maintain copy', nextActionSuggestion(c4).tone === 'maintain');

// 5. Low adherence → regress
const lowAdherence = entry('low', {
  setCount: 5,
  totalVolume: 300,
  endedAt: 200,
  exercises: [
    ex('press', { maxWeight: 60, totalVolume: 300, setsCompleted: 5, plannedSetsCount: 9 }),
  ],
});
const c5 = compareToPrevious(lowAdherence, [prevSame]);
check('low adherence → regress', nextActionSuggestion(c5).tone === 'regress');

// 6. compareToPrevious skips current entry id
const c6 = compareToPrevious(cur, [cur, prevSame]);
check('skip self in history', c6.previous?.id === 'prev1');

if (failed > 0) {
  console.error(failed, 'failures');
  process.exit(1);
}
console.log('all summaryCompare checks pass');
