// src/features/planner/lib/kaiSignal.dev.ts
// Run with: npx tsx src/features/planner/lib/kaiSignal.dev.ts

import { kaiSignal, type KaiInputs } from './kaiSignal';

let failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (!cond) { console.error('FAIL', name, extra ?? ''); failed++; }
  else console.log('OK', name);
}

const base: KaiInputs = {
  selectedDate: '2026-05-12',
  isToday: true,
  isPast: false,
  resolved: null,
  streak: 0,
  blocksCount: 5,
  hasActiveWorkout: false,
  lastSession: null,
};

check('no-blocks wins', kaiSignal({ ...base, blocksCount: 0 })?.id === 'no-blocks');
check('resume wins over no-plan', kaiSignal({ ...base, hasActiveWorkout: true })?.id === 'resume');
check('streak prompt', kaiSignal({ ...base, streak: 5 })?.id === 'streak');
check('no-plan default', kaiSignal({ ...base })?.id === 'no-plan');

const planned = { assignmentId: 'a1', blockId: 'b1', date: '2026-05-12', status: 'planned' as const, isRecurring: false };
const completed = { ...planned, status: 'completed' as const };

check('completed today', kaiSignal({ ...base, resolved: completed })?.id === 'done');
check('first-time', kaiSignal({ ...base, resolved: planned, lastSession: null })?.id === 'first-time');
check('progress up', kaiSignal({ ...base, resolved: planned, lastSession: { setCount: 9, targetSetCount: 9 } })?.id === 'progress-up');

const close = kaiSignal({ ...base, resolved: planned, lastSession: { setCount: 7, targetSetCount: 9 } });
check('close-block', close?.id === 'close-block');
check('close-block message includes 2 series', close?.message.includes('2 series') === true);
check('close-block message factual', close?.message === 'Última vez: faltaron 2 series.');

const close1 = kaiSignal({ ...base, resolved: planned, lastSession: { setCount: 8, targetSetCount: 9 } });
check('close-block singular', close1?.message === 'Última vez: faltó 1 serie.');

const noPlan = kaiSignal({ ...base });
check('no-plan has no action', noPlan?.action === undefined);

check('past completed silent', kaiSignal({ ...base, isToday: false, isPast: true, resolved: completed }) === null);
check('future no plan silent', kaiSignal({ ...base, isToday: false }) === null);

if (failed > 0) { console.error(`${failed} failures`); process.exit(1); }
console.log('all kaiSignal checks pass');
