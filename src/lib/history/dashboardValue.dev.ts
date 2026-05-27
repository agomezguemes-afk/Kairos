// Run with: npx tsx src/lib/history/dashboardValue.dev.ts

import { computeDashboardValue } from './dashboardValue';
import type { DashboardNodeData } from '../../types/content';
import type { WorkoutBlock } from '../../types/core';
import type { WorkoutHistoryEntry } from '../../store/workoutStore';

let failed = 0;
function check(name: string, cond: boolean) {
  if (!cond) {
    console.error('FAIL', name);
    failed++;
  } else console.log('OK', name);
}

// ── Fixtures ───────────────────────────────────────────────────────────────
const nowMs = new Date('2026-05-25T10:00:00Z').getTime();
const day = 86400_000;

const emptyBlock: WorkoutBlock = {
  id: 'b1',
  user_id: 'u',
  name: 'Test',
  icon: '',
  color: '#000',
  description: null,
  tags: [],
  discipline: 'strength',
  content: [],
  layout: { columns: 1 },
  status: 'draft',
  is_favorite: false,
  is_archived: false,
  last_performed_at: null,
  times_performed: 0,
  sort_order: 0,
  size: 'medium',
  cover: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

const benchHistory: WorkoutHistoryEntry[] = [
  // 5 weeks ago — outside the 4w window
  {
    id: 'old',
    blockId: 'b1',
    blockName: 'Push',
    startedAt: nowMs - 35 * day,
    endedAt: nowMs - 35 * day + 3600_000,
    exerciseCount: 1,
    setCount: 3,
    totalVolume: 1200,
    durationSec: 3600,
    exercises: [
      {
        exerciseId: 'ex_old',
        libraryId: 'bench_press',
        name: 'Bench Press',
        maxWeight: 70,
        totalVolume: 70 * 24,
        setsCompleted: 3,
        performedSets: [
          { weight: 60, reps: 10, completed: true },
          { weight: 65, reps: 8, completed: true },
          { weight: 70, reps: 6, completed: true },
        ],
      },
    ],
  },
  // 3 weeks ago — inside 4w window
  {
    id: 's1',
    blockId: 'b1',
    blockName: 'Push',
    startedAt: nowMs - 21 * day,
    endedAt: nowMs - 21 * day + 3600_000,
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
  // 1 week ago — inside 4w window
  {
    id: 's2',
    blockId: 'b1',
    blockName: 'Push',
    startedAt: nowMs - 7 * day,
    endedAt: nowMs - 7 * day + 3600_000,
    exerciseCount: 1,
    setCount: 3,
    totalVolume: 2000,
    durationSec: 3600,
    exercises: [
      {
        exerciseId: 'ex_bench_2',
        libraryId: 'bench_press',
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

// ── Block-scope (legacy behavior preserved) ────────────────────────────────
const totalVol = computeDashboardValue(
  { metric: 'total_volume', viz: 'counter', label: 'Volumen', color: '#000' },
  emptyBlock,
  [],
  nowMs,
);
check('block total_volume of empty block is empty', totalVol.isEmpty);
check('block total_volume formatted is —', totalVol.formatted === '—');

const completion = computeDashboardValue(
  { metric: 'completion_pct', viz: 'progress', label: '%', color: '#000' },
  emptyBlock,
  [],
  nowMs,
);
check('block completion_pct returns 0 for empty', completion.value === 0);
check('block completion progressPct=0', completion.progressPct === 0);

// ── Exercise-scope: no binding ─────────────────────────────────────────────
const unbound = computeDashboardValue(
  { metric: 'exercise_max_weight', viz: 'counter', label: '', color: '#000' },
  emptyBlock,
  benchHistory,
  nowMs,
);
check('unbound exercise dashboard is empty', unbound.isEmpty);
check('unbound caption prompts selection', unbound.caption === 'Selecciona un ejercicio');

// ── Exercise-scope: exercise_max_weight, lookback 4w ───────────────────────
const baseData: DashboardNodeData = {
  metric: 'exercise_max_weight',
  viz: 'counter',
  label: 'Peso máximo',
  color: '#C9A96E',
  libraryId: 'bench_press',
  exerciseName: 'Bench Press',
  lookback: '4w',
};
const maxW = computeDashboardValue(baseData, emptyBlock, benchHistory, nowMs);
check('max_weight in 4w window is 85', maxW.value === 85);
check('max_weight formatted = 85', maxW.formatted === '85');
check('max_weight unit = kg', maxW.unit === 'kg');
check(
  'max_weight 4w shows all-time-record caption (85 is best in window AND ever)',
  maxW.caption?.includes('Récord absoluto') ?? false,
);

// Same exercise, lookback 'all' — old 70 included, but max still 85.
const maxAll = computeDashboardValue(
  { ...baseData, lookback: 'all' },
  emptyBlock,
  benchHistory,
  nowMs,
);
check('max_weight all-time = 85', maxAll.value === 85);
check('max_weight all sparkline length 3', maxAll.sparkline.length === 3);

// Lookback session — only the latest entry counts.
const maxSession = computeDashboardValue(
  { ...baseData, lookback: 'session' },
  emptyBlock,
  benchHistory,
  nowMs,
);
check('max_weight session = 85', maxSession.value === 85);
check('max_weight session sparkline length 1', maxSession.sparkline.length === 1);

// ── Exercise-scope: volume sums correctly within window ────────────────────
const vol4w = computeDashboardValue(
  { ...baseData, metric: 'exercise_volume' },
  emptyBlock,
  benchHistory,
  nowMs,
);
// performedSets sums (Σ weight × reps), not summary.totalVolume.
// s1: 70·10 + 75·8 + 80·6 = 1780  |  s2: 75·10 + 80·8 + 85·6 = 1900
const expectedVol = 1780 + 1900;
check('volume 4w sums in-window sessions only', vol4w.value === expectedVol);
check('volume caption mentions session count', vol4w.caption?.includes('2 sesiones') ?? false);

// ── Exercise-scope: estimated_1rm picks best in window ─────────────────────
const rm4w = computeDashboardValue(
  { ...baseData, metric: 'exercise_estimated_1rm' },
  emptyBlock,
  benchHistory,
  nowMs,
);
// Best 1RM in 4w window is 85×6 = 85*(1+6/30) = 102.
check('estimated_1rm 4w = 102', rm4w.value === 102);
check('estimated_1rm unit = kg', rm4w.unit === 'kg');

// ── Exercise-scope: frequency reports per-week ─────────────────────────────
const freq4w = computeDashboardValue(
  { ...baseData, metric: 'exercise_freq' },
  emptyBlock,
  benchHistory,
  nowMs,
);
check('freq 4w counts 2 sessions', freq4w.value === 2);
check('freq 4w caption has per/week', freq4w.caption?.includes('/semana') ?? false);

// ── Exercise-scope: last_top with relative time ────────────────────────────
const lastTop = computeDashboardValue(
  { ...baseData, metric: 'exercise_last_top' },
  emptyBlock,
  benchHistory,
  nowMs,
);
check('last_top weight = 85', lastTop.value === 85);
check('last_top caption "× 6"', lastTop.caption?.includes('× 6') ?? false);
check('last_top caption is relative', lastTop.caption?.includes('hace') ?? false);

// ── Exercise-scope: no sessions in window → caption fallback ───────────────
const emptyExHistory: WorkoutHistoryEntry[] = [];
const noHist = computeDashboardValue(baseData, emptyBlock, emptyExHistory, nowMs);
check(
  'no history caption is "Sin sesiones registradas"',
  noHist.caption === 'Sin sesiones registradas',
);
check('no history is empty', noHist.isEmpty);

// ── Exercise-scope: name fallback when no libraryId ────────────────────────
const customHist: WorkoutHistoryEntry[] = [
  {
    id: 'c1',
    blockId: 'b1',
    blockName: 'Custom',
    startedAt: nowMs - 3 * day,
    endedAt: nowMs - 3 * day + 3600_000,
    exerciseCount: 1,
    setCount: 1,
    totalVolume: 100,
    durationSec: 3600,
    exercises: [
      {
        exerciseId: 'custom',
        name: 'My Weird Pull',
        maxWeight: 50,
        totalVolume: 50 * 6,
        setsCompleted: 1,
        performedSets: [{ weight: 50, reps: 6, completed: true }],
      },
    ],
  },
];
const byName = computeDashboardValue(
  {
    metric: 'exercise_max_weight',
    viz: 'counter',
    label: '',
    color: '#000',
    exerciseName: 'My Weird Pull',
    lookback: '4w',
  },
  emptyBlock,
  customHist,
  nowMs,
);
check('matches by name when libraryId absent', byName.value === 50);

// ── summary ────────────────────────────────────────────────────────────────
if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll dashboardValue tests passed.');
