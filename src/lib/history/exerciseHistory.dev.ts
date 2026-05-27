// Run with: npx tsx src/lib/history/exerciseHistory.dev.ts

import {
  normalizeExerciseName,
  isSameExercise,
  getExerciseHistoryFor,
  computeExerciseStats,
  estimateOneRepMax,
  detectPr,
  getLastCompletedReference,
  buildExerciseHistoryIndex,
  lookupExerciseHistory,
  lookupLastCompletedReference,
  type ExerciseSessionPoint,
} from './exerciseHistory';
import type { WorkoutHistoryEntry } from '../../store/workoutStore';

let failed = 0;
function check(name: string, cond: boolean) {
  if (!cond) {
    console.error('FAIL', name);
    failed++;
  } else console.log('OK', name);
}

// ── normalizeExerciseName ──────────────────────────────────────────────────
check('normalize lowercases', normalizeExerciseName('Bench Press') === 'bench press');
check('normalize trims', normalizeExerciseName('  Squat  ') === 'squat');
check(
  'normalize strips diacritics',
  normalizeExerciseName('Sentadilla búlgara') === 'sentadilla bulgara',
);

// ── isSameExercise ─────────────────────────────────────────────────────────
check(
  'same libraryId matches',
  isSameExercise(
    { libraryId: 'bench_press', name: 'Bench' },
    { libraryId: 'bench_press', name: 'Press' },
  ),
);
check(
  'different libraryId does not match',
  !isSameExercise({ libraryId: 'a', name: 'X' }, { libraryId: 'b', name: 'X' }),
);
check(
  'same normalized name matches (no libraryId)',
  isSameExercise({ name: 'Bench Press' }, { name: 'bench press' }),
);
check(
  'libraryId beats name match',
  !isSameExercise({ libraryId: 'a', name: 'Bench' }, { libraryId: 'b', name: 'Bench' }),
);

// ── estimateOneRepMax (Epley) ─────────────────────────────────────────────
check('1rm null when weight missing', estimateOneRepMax(null, 5) === null);
check('1rm null when reps missing', estimateOneRepMax(100, null) === null);
check('1rm null when reps zero', estimateOneRepMax(100, 0) === null);
check('1rm 100x1 = 103.3', estimateOneRepMax(100, 1) === 103.3);
check('1rm 80x8 ~= 101.3', Math.abs((estimateOneRepMax(80, 8) ?? 0) - 101.3) < 0.1);
check('1rm caps reps at 12', estimateOneRepMax(50, 12) === estimateOneRepMax(50, 20));

// ── Fixture: 3 sessions of Bench, 1 session of Squat ──────────────────────
const tBase = new Date('2026-05-01T10:00:00Z').getTime();
const day = 24 * 3600 * 1000;

const history: WorkoutHistoryEntry[] = [
  {
    id: 's1',
    blockId: 'b1',
    blockName: 'Push A',
    startedAt: tBase,
    endedAt: tBase + 3600_000,
    exerciseCount: 1,
    setCount: 3,
    totalVolume: 1800,
    durationSec: 3600,
    exercises: [
      {
        exerciseId: 'ex_bench_1',
        libraryId: 'bench_press',
        name: 'Bench Press',
        maxWeight: 80,
        totalVolume: 80 * 24,
        setsCompleted: 3,
        performedSets: [
          { weight: 70, reps: 10, completed: true },
          { weight: 75, reps: 8, completed: true },
          { weight: 80, reps: 6, completed: true },
        ],
      },
    ],
  },
  {
    id: 's2',
    blockId: 'b1',
    blockName: 'Push A',
    startedAt: tBase + 3 * day,
    endedAt: tBase + 3 * day + 3600_000,
    exerciseCount: 2,
    setCount: 5,
    totalVolume: 3200,
    durationSec: 3600,
    exercises: [
      {
        exerciseId: 'ex_bench_2',
        libraryId: 'bench_press',
        name: 'Bench Press',
        maxWeight: 82.5,
        totalVolume: 82.5 * 24,
        setsCompleted: 3,
        performedSets: [
          { weight: 72.5, reps: 10, completed: true },
          { weight: 77.5, reps: 8, completed: true },
          { weight: 82.5, reps: 6, completed: true },
        ],
      },
      {
        exerciseId: 'ex_squat_1',
        libraryId: 'squat',
        name: 'Back Squat',
        maxWeight: 100,
        totalVolume: 100 * 20,
        setsCompleted: 2,
        performedSets: [
          { weight: 90, reps: 10, completed: true },
          { weight: 100, reps: 10, completed: true },
        ],
      },
    ],
  },
  {
    id: 's3',
    blockId: 'b1',
    blockName: 'Push A',
    startedAt: tBase + 7 * day,
    endedAt: tBase + 7 * day + 3600_000,
    exerciseCount: 1,
    setCount: 3,
    totalVolume: 2000,
    durationSec: 3600,
    exercises: [
      {
        // Same exercise but logged from a custom (no-library) card — name fallback.
        exerciseId: 'ex_bench_3',
        name: 'Bench Press',
        maxWeight: 85,
        totalVolume: 85 * 24,
        setsCompleted: 3,
        performedSets: [
          { weight: 75, reps: 10, completed: true },
          { weight: 80, reps: 8, completed: true },
          { weight: 85, reps: 6, completed: true },
        ],
      },
    ],
  },
];

// ── getExerciseHistoryFor ──────────────────────────────────────────────────
const benchHistory = getExerciseHistoryFor(
  { libraryId: 'bench_press', name: 'Bench Press' },
  history,
);
check('bench history has 3 sessions', benchHistory.length === 3);
check(
  'bench history asc-sorted',
  benchHistory[0].at < benchHistory[1].at && benchHistory[1].at < benchHistory[2].at,
);
check('bench S1 topWeight=80', benchHistory[0].topWeight === 80);
check('bench S1 topReps=6', benchHistory[0].topReps === 6);
check('bench S3 (no libraryId) matched by name', benchHistory[2].topWeight === 85);
check(
  'bench history limit=2',
  getExerciseHistoryFor({ name: 'Bench Press' }, history, 2).length === 2,
);

const squatHistory = getExerciseHistoryFor({ libraryId: 'squat', name: 'Back Squat' }, history);
check('squat history has 1 session', squatHistory.length === 1);
check('squat topWeight=100', squatHistory[0].topWeight === 100);

const unknown = getExerciseHistoryFor({ libraryId: 'never', name: 'Atlas Stone' }, history);
check('unknown exercise returns []', unknown.length === 0);

// ── computeExerciseStats ───────────────────────────────────────────────────
const benchStats = computeExerciseStats(benchHistory);
check('stats.last is S3', benchStats.last?.topWeight === 85);
check('stats.previous is S2', benchStats.previous?.topWeight === 82.5);
check('stats.allTimeMaxWeight = 85', benchStats.allTimeMaxWeight === 85);
check('stats.allTimeMaxOneRm ≥ 85', (benchStats.allTimeMaxOneRm ?? 0) >= 85);
check('stats.sparkline length 3', benchStats.sparkline.length === 3);
check('stats.sparkline is topWeight', benchStats.sparklineMetric === 'topWeight');
check('stats.sparkline first = 80', benchStats.sparkline[0] === 80);
check('stats.sparkline last = 85', benchStats.sparkline[2] === 85);

const emptyStats = computeExerciseStats([]);
check('empty stats.last is null', emptyStats.last === null);
check('empty stats.sparkline = []', emptyStats.sparkline.length === 0);
check('empty stats metric = empty', emptyStats.sparklineMetric === 'empty');

// Sparkline cap at sparklineSize
const longHistory: ExerciseSessionPoint[] = Array.from({ length: 12 }, (_, i) => ({
  at: tBase + i * day,
  date: '2026-05-01',
  topWeight: 70 + i,
  topReps: 5,
  volume: 100,
  setsCompleted: 1,
  estimatedOneRm: 80 + i,
}));
const sparkStats = computeExerciseStats(longHistory, { sparklineSize: 5 });
check('sparkline capped to 5', sparkStats.sparkline.length === 5);
check('sparkline keeps newest', sparkStats.sparkline[4] === 70 + 11);

// ── detectPr ───────────────────────────────────────────────────────────────
const candidateWeightPr: ExerciseSessionPoint = {
  at: tBase + 10 * day,
  date: '2026-05-11',
  topWeight: 90,
  topReps: 6,
  volume: 90 * 24,
  setsCompleted: 3,
  estimatedOneRm: estimateOneRepMax(90, 6),
};
const prResult = detectPr(candidateWeightPr, benchHistory);
check('detects weight PR', prResult.isPr && prResult.kind === 'weight');
check('weight PR delta = 5', prResult.delta === 5);

const noChange: ExerciseSessionPoint = {
  at: tBase + 11 * day,
  date: '2026-05-12',
  topWeight: 80,
  topReps: 5,
  volume: 1000,
  setsCompleted: 3,
  estimatedOneRm: estimateOneRepMax(80, 5),
};
const noPr = detectPr(noChange, benchHistory);
check('no PR when worse than history', !noPr.isPr);

const firstEver: ExerciseSessionPoint = {
  at: tBase,
  date: '2026-05-01',
  topWeight: 60,
  topReps: 8,
  volume: 60 * 24,
  setsCompleted: 3,
  estimatedOneRm: estimateOneRepMax(60, 8),
};
const firstPr = detectPr(firstEver, []);
check('first-ever logged set is PR', firstPr.isPr && firstPr.kind === 'weight');

// Weight-with-lower-reps must NOT count as weight PR — guard rail.
const cheatPr: ExerciseSessionPoint = {
  at: tBase + 12 * day,
  date: '2026-05-13',
  topWeight: 100,
  topReps: 1,
  volume: 100,
  setsCompleted: 1,
  estimatedOneRm: estimateOneRepMax(100, 1),
};
const cheatResult = detectPr(cheatPr, benchHistory);
check('100×1 vs 85×6 is not a weight PR', cheatResult.kind !== 'weight');

// ── getLastCompletedReference ──────────────────────────────────────────────
const lastRef = getLastCompletedReference(
  { libraryId: 'bench_press', name: 'Bench Press' },
  history,
);
check('last ref weight is from S3', lastRef?.weight === 85);
check('last ref reps is 6', lastRef?.reps === 6);

const lastSquat = getLastCompletedReference({ name: 'Back Squat' }, history);
check('last squat ref weight = 100', lastSquat?.weight === 100);

const noRef = getLastCompletedReference({ name: 'Unknown' }, history);
check('no ref returns null', noRef === null);

// ── buildExerciseHistoryIndex + lookup ─────────────────────────────────────
const idx = buildExerciseHistoryIndex(history);
check('index has bench by libraryId', idx.byLibraryId.get('bench_press')?.length === 2);
check('index has bench by name (3 incl no-lib entry)', idx.byName.get('bench press')?.length === 3);
check('index has squat by libraryId', idx.byLibraryId.get('squat')?.length === 1);
check('index has squat by name', idx.byName.get('back squat')?.length === 1);
check('index empty array is reused', idx.empty.length === 0);

const benchByLookup = lookupExerciseHistory({ libraryId: 'bench_press', name: 'Bench Press' }, idx);
check('lookup bench by libraryId merges name-only entry = 3', benchByLookup.length === 3);
check('lookup is chronological', benchByLookup[0].at < benchByLookup[2].at);
check('lookup includes newest 85', benchByLookup[2].topWeight === 85);

const benchByName = lookupExerciseHistory({ name: 'Bench Press' }, idx);
check('lookup bench by name only = 3 entries', benchByName.length === 3);

const lookupLimit = lookupExerciseHistory({ name: 'Bench Press' }, idx, 1);
check('lookup with limit=1 returns newest only', lookupLimit.length === 1);
check('lookup newest is from S3', lookupLimit[0].topWeight === 85);

const noHit = lookupExerciseHistory({ libraryId: 'nope', name: 'Unknown' }, idx);
check('lookup unknown returns empty (same ref)', noHit === idx.empty);

const indexedLastRef = lookupLastCompletedReference(
  { libraryId: 'bench_press', name: 'Bench Press' },
  history,
  idx,
);
check('indexed lastRef weight = 85', indexedLastRef?.weight === 85);
check(
  'indexed lastRef matches slow path',
  indexedLastRef?.weight ===
    getLastCompletedReference({ libraryId: 'bench_press', name: 'Bench Press' }, history)?.weight,
);

// ── summary ────────────────────────────────────────────────────────────────
if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll exerciseHistory tests passed.');
