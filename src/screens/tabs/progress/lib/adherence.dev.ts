// Run: npx tsx src/screens/tabs/progress/lib/adherence.dev.ts

import { buildMonthAdherence } from './adherence';
import type { ResolvedAssignment, ISODate } from '../../../../types/schedule';
import type { WorkoutHistoryEntry } from '../../../../store/workoutStore';

let failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (!cond) {
    console.error('FAIL', name, extra ?? '');
    failed++;
  } else console.log('OK', name);
}

const TODAY = '2026-05-15';

function ra(date: ISODate, status: ResolvedAssignment['status'], id = 'a'): ResolvedAssignment {
  return { assignmentId: id, blockId: 'b', date, status, isRecurring: false };
}

function fakeResolve(
  plans: Record<string, ResolvedAssignment[]>,
): (s: ISODate, e: ISODate) => Map<ISODate, ResolvedAssignment[]> {
  return (start, end) => {
    const m = new Map<ISODate, ResolvedAssignment[]>();
    for (const [d, list] of Object.entries(plans)) {
      if (d >= start && d <= end) m.set(d, list);
    }
    return m;
  };
}

function entry(startedAtIso: string): WorkoutHistoryEntry {
  const start = new Date(`${startedAtIso}T10:00:00Z`).getTime();
  return {
    id: 'e' + startedAtIso,
    blockId: 'b',
    blockName: 'B',
    startedAt: start,
    endedAt: start + 3600000,
    exerciseCount: 0,
    setCount: 0,
    totalVolume: 0,
    durationSec: 0,
    exercises: [],
  };
}

// Plans: 2026-05-12 done, 2026-05-13 missed (past), 2026-05-14 skipped, 2026-05-17 future planned
const plans = {
  '2026-05-12': [ra('2026-05-12', 'completed')],
  '2026-05-13': [ra('2026-05-13', 'planned')],
  '2026-05-14': [ra('2026-05-14', 'skipped')],
  '2026-05-17': [ra('2026-05-17', 'planned')],
};

// History: 2026-05-12 done, 2026-05-11 unplanned-done
const history = [entry('2026-05-12'), entry('2026-05-11')];

const ma = buildMonthAdherence({
  anchor: '2026-05-15',
  resolveRange: fakeResolve(plans),
  history,
  todayIso: TODAY,
});

// Should produce 42 cells (6×7)
check('42 cells', ma.cells.length === 42);

// 12 must be planned-done, 13 must be planned-missed, 14 must be planned-skipped, 11 must be unplanned-done
const byDate = new Map(ma.cells.map((c) => [c.date, c]));
check('12 → planned-done', byDate.get('2026-05-12')?.status === 'planned-done');
check('13 → planned-missed', byDate.get('2026-05-13')?.status === 'planned-missed');
check('14 → planned-skipped', byDate.get('2026-05-14')?.status === 'planned-skipped');
check('11 → unplanned-done', byDate.get('2026-05-11')?.status === 'unplanned-done');
check('17 → planned (future)', byDate.get('2026-05-17')?.status === 'planned');
check('today flag', byDate.get(TODAY)?.isToday === true);

// Rollups
check('done = 1', ma.done === 1);
check('planned = 4', ma.planned === 4); // 12 done + 13 missed + 14 skipped + 17 planned
check('unplanned = 1', ma.unplanned === 1);
// Denominator = done(1) + skipped(1) + missed(1) = 3. Pct = 1/3 = 33.
check('adherence ≈ 33', ma.adherencePct === 33);

if (failed > 0) {
  console.error(`${failed} failures`);
  process.exit(1);
}
console.log('all adherence checks pass');
