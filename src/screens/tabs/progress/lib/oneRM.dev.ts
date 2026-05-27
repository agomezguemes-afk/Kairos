// Run: npx tsx src/screens/tabs/progress/lib/oneRM.dev.ts

import { epley1RM, brzycki1RM, sessionBest1RM, oneRMSeries, summarize1RM } from './oneRM';
import type { WorkoutHistoryEntry } from '../../../../store/workoutStore';

let failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (!cond) {
    console.error('FAIL', name, extra ?? '');
    failed++;
  } else console.log('OK', name);
}

// Epley basics
check('epley 1 rep = weight', epley1RM(100, 1) === 100);
check('epley 60kg×8 ≈ 76', Math.abs(epley1RM(60, 8) - 76) < 0.001);
check('epley 100kg×5 ≈ 116.67', Math.abs(epley1RM(100, 5) - 116.666) < 0.01);
check('epley out of range (13 reps) → 0', epley1RM(60, 13) === 0);
check('epley zero weight → 0', epley1RM(0, 8) === 0);

// Brzycki
check('brzycki 100kg×5 ≈ 112.5', Math.abs(brzycki1RM(100, 5) - 112.5) < 0.01);
check('brzycki 1 rep = weight', brzycki1RM(100, 1) === 100);

// sessionBest1RM picks best
const best = sessionBest1RM([
  { weight: 60, reps: 8, completed: true }, // ~76
  { weight: 80, reps: 3, completed: true }, // ~88
  { weight: 100, reps: 1, completed: true }, // 100
  { weight: 120, reps: 15, completed: true }, // 0 (out of range)
]);
check('session best picks heavier estimate', Math.abs(best - 100) < 0.5);

check(
  'session best ignores uncompleted',
  sessionBest1RM([{ weight: 200, reps: 5, completed: false }]) === 0,
);

// oneRMSeries
const NOW = new Date('2026-05-22T12:00:00Z').getTime();
const DAY = 24 * 3600 * 1000;
const hist: WorkoutHistoryEntry[] = [
  {
    id: 'h1',
    blockId: 'b',
    blockName: 'B',
    startedAt: NOW - DAY,
    endedAt: NOW - DAY + 1000,
    exerciseCount: 1,
    setCount: 0,
    totalVolume: 0,
    durationSec: 0,
    exercises: [
      {
        exerciseId: 'press',
        name: 'Press',
        maxWeight: 80,
        totalVolume: 0,
        setsCompleted: 1,
        performedSets: [{ weight: 80, reps: 3, completed: true }],
      },
    ],
  },
  {
    id: 'h2',
    blockId: 'b',
    blockName: 'B',
    startedAt: NOW - 7 * DAY,
    endedAt: NOW - 7 * DAY + 1000,
    exerciseCount: 1,
    setCount: 0,
    totalVolume: 0,
    durationSec: 0,
    exercises: [
      {
        exerciseId: 'press',
        name: 'Press',
        maxWeight: 75,
        totalVolume: 0,
        setsCompleted: 1,
        performedSets: [{ weight: 75, reps: 3, completed: true }],
      },
    ],
  },
];
const series = oneRMSeries(hist, 'press');
check('series chronological asc', series[0].date < series[1].date);
check('series uses Epley', series[0].oneRM > 75 && series[1].oneRM > 80);

// summarize1RM
const sum = summarize1RM(series);
check('summary current is last', Math.abs(sum.current - series[1].oneRM) < 0.01);
check('summary peak is max', sum.peak === Math.max(series[0].oneRM, series[1].oneRM));
check('summary trendPct positive', sum.trendPct !== null && sum.trendPct > 0);

check('summary empty', summarize1RM([]).trendPct === null);

if (failed > 0) {
  console.error(`${failed} failures`);
  process.exit(1);
}
console.log('all oneRM checks pass');
