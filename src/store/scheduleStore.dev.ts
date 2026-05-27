// src/store/scheduleStore.dev.ts
// Run with: npx tsx src/store/scheduleStore.dev.ts

// AsyncStorage's web fallback assumes `window`. Stub it before any import that
// would touch it (zustand persist runs writes asynchronously after mutations).
(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  },
};

import { useScheduleStore } from './scheduleStore';
import { buildWeeklyRule } from '../features/planner/lib/rrule';

let failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (!cond) { console.error('FAIL', name, extra ?? ''); failed++; }
  else console.log('OK', name);
}

const s = useScheduleStore.getState();

// Reset state for the test (the dev runner doesn't have AsyncStorage)
useScheduleStore.setState({ assignments: [], recentlyDeleted: [] });

// 1. one-time
const id1 = s.assignOnce('2026-05-12', 'block-a');
check('one-time stored', useScheduleStore.getState().assignments.length === 1);
check('hasAssignment true', useScheduleStore.getState().hasAssignment('2026-05-12'));
check('hasAssignment false', !useScheduleStore.getState().hasAssignment('2026-05-13'));

// 2. recurring MWF
const mwf = buildWeeklyRule([0, 2, 4]);
const id2 = s.assignRecurring({
  blockId: 'block-b',
  rrule: mwf,
  startDate: '2026-05-01',
  endDate: '2026-05-31',
});
const may = useScheduleStore.getState().resolveRange('2026-05-01', '2026-05-31');
check('MWF + one-time produce dates', may.size >= 13);
check('block-a present on may 12', (may.get('2026-05-12') ?? []).some((r) => r.blockId === 'block-a'));

// 3. skip
useScheduleStore.getState().skipOccurrence(id2, '2026-05-04');
const may4 = useScheduleStore.getState().resolveDate('2026-05-04');
check('skip removes occurrence', may4.every((r) => r.assignmentId !== id2));

// 4. move
useScheduleStore.getState().moveOccurrence(id2, '2026-05-06', '2026-05-07');
const may6 = useScheduleStore.getState().resolveDate('2026-05-06');
const may7 = useScheduleStore.getState().resolveDate('2026-05-07');
check('move clears origin', may6.every((r) => r.assignmentId !== id2));
check('move populates target', may7.some((r) => r.assignmentId === id2 && r.movedFrom === '2026-05-06'));

// 5. complete
useScheduleStore.getState().completeOccurrence(id1, '2026-05-12');
const completed = useScheduleStore.getState().resolveDate('2026-05-12');
check('completed status', completed.some((r) => r.assignmentId === id1 && r.status === 'completed'));

// 6. truncate series
useScheduleStore.getState().truncateSeries(id2, '2026-05-15');
const lateMay = useScheduleStore.getState().resolveRange('2026-05-16', '2026-05-31');
const stillRecurring = Array.from(lateMay.values()).flat().filter((r) => r.assignmentId === id2);
check('truncate stops series', stillRecurring.length === 0);

// 7. delete + undo
useScheduleStore.getState().removeAssignment(id1);
check('removed', !useScheduleStore.getState().hasAssignment('2026-05-12'));
useScheduleStore.getState().undoLastDelete();
check('undo restores', useScheduleStore.getState().hasAssignment('2026-05-12'));

if (failed > 0) { console.error(`${failed} failures`); process.exit(1); }
console.log('all schedule store checks pass');
