// Run: npx tsx src/screens/tabs/progress/lib/aggregations.dev.ts

import {
  topExercisesByFrequency,
  maxWeightSeries,
  weeklyVolumeSeries,
  computeSummaryStats,
} from './aggregations';
import type { WorkoutHistoryEntry } from '../../../../store/workoutStore';

let failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (!cond) {
    console.error('FAIL', name, extra ?? '');
    failed++;
  } else console.log('OK', name);
}

function makeEntry(
  opts: Partial<WorkoutHistoryEntry> & { exercises: WorkoutHistoryEntry['exercises'] },
): WorkoutHistoryEntry {
  return {
    id: opts.id ?? 'e',
    blockId: opts.blockId ?? 'b',
    blockName: opts.blockName ?? 'B',
    startedAt: opts.startedAt ?? 0,
    endedAt: opts.endedAt ?? 1000,
    exerciseCount: opts.exercises.length,
    setCount: opts.setCount ?? 0,
    totalVolume: opts.totalVolume ?? 0,
    durationSec: opts.durationSec ?? 0,
    exercises: opts.exercises,
  };
}

// NOW chosen so 1-day and 3-day-ago entries both fall in the same Monday-start
// ISO week as NOW (Friday). The spec's original NOW was a Wednesday, which put
// the 3-day-ago entry in the prior week and broke the "this week 2 sessions"
// assertion. Implementation uses Monday-start per JSDoc; test data tracks that.
const NOW = new Date('2026-05-22T12:00:00Z').getTime();
const DAY = 24 * 3600 * 1000;

const hist: WorkoutHistoryEntry[] = [
  makeEntry({
    id: 'h1',
    startedAt: NOW - DAY,
    endedAt: NOW - DAY + 3600000,
    totalVolume: 1200,
    exercises: [
      {
        exerciseId: 'press',
        name: 'Press',
        maxWeight: 70,
        totalVolume: 600,
        setsCompleted: 3,
        performedSets: [
          { weight: 60, reps: 8, completed: true },
          { weight: 65, reps: 5, completed: true },
          { weight: 70, reps: 3, completed: true },
        ],
      },
      { exerciseId: 'squat', name: 'Squat', maxWeight: 100, totalVolume: 600, setsCompleted: 3 },
    ],
  }),
  makeEntry({
    id: 'h2',
    startedAt: NOW - 3 * DAY,
    endedAt: NOW - 3 * DAY + 3600000,
    totalVolume: 900,
    exercises: [
      {
        exerciseId: 'press',
        name: 'Press',
        maxWeight: 65,
        totalVolume: 500,
        setsCompleted: 3,
        performedSets: [
          { weight: 60, reps: 8, completed: true },
          { weight: 65, reps: 5, completed: true },
        ],
      },
      { exerciseId: 'row', name: 'Row', maxWeight: 60, totalVolume: 400, setsCompleted: 3 },
    ],
  }),
  makeEntry({
    id: 'h3',
    startedAt: NOW - 10 * DAY,
    endedAt: NOW - 10 * DAY + 3600000,
    totalVolume: 700,
    exercises: [
      {
        exerciseId: 'press',
        name: 'Press',
        maxWeight: 62.5,
        totalVolume: 400,
        setsCompleted: 3,
        performedSets: [{ weight: 62.5, reps: 6, completed: true }],
      },
    ],
  }),
];

const top = topExercisesByFrequency(hist, 5);
check('press is most frequent', top[0].exerciseId === 'press' && top[0].sessionCount === 3);
check('squat appears once', top.find((e) => e.exerciseId === 'squat')?.sessionCount === 1);

const series = maxWeightSeries(hist, 'press');
check('series chronological asc', series[0].date < series[series.length - 1].date);
check(
  'series weights ordered',
  series[0].weight === 62.5 && series[1].weight === 65 && series[2].weight === 70,
);

const weeks = weeklyVolumeSeries(hist, 12, NOW);
check('12 weeks returned', weeks.length === 12);
check('weeks ascending', weeks[0].weekStart < weeks[11].weekStart);
const thisWeek = weeks[weeks.length - 1];
check('this week volume 2100', thisWeek.volume === 2100);
check('this week sessions 2', thisWeek.sessions === 2);

const summary = computeSummaryStats(hist, NOW);
check('total sessions 3', summary.totalSessions === 3);
check('total volume 2800', summary.totalVolume === 2800);
check('this week 2', summary.thisWeekSessions === 2);

if (failed > 0) {
  console.error(`${failed} failures`);
  process.exit(1);
}
console.log('all aggregations checks pass');
