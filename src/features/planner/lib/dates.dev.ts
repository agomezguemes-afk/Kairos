// src/features/planner/lib/dates.dev.ts
// Run with: npx tsx src/features/planner/lib/dates.dev.ts
// Exits non-zero on any assertion failure.

import {
  toISODate, fromISODate, todayISO, weekDays, monthGridDays,
  addDaysISO, daysBetween, formatWeekdayNarrow, formatLongDate,
} from './dates';

let failed = 0;
function check(name: string, cond: boolean) {
  if (!cond) { console.error('FAIL', name); failed++; }
  else console.log('OK', name);
}

const may12 = '2026-05-12';

check('toISODate roundtrip', toISODate(fromISODate(may12)) === may12);
check('addDaysISO +1', addDaysISO(may12, 1) === '2026-05-13');
check('addDaysISO -7', addDaysISO(may12, -7) === '2026-05-05');
check('daysBetween', daysBetween('2026-05-15', may12) === 3);

const wd = weekDays(may12);
check('weekDays length 7', wd.length === 7);
check('weekDays starts Mon', wd[0] === '2026-05-11');  // 12 may 2026 is a Tuesday
check('weekDays ends Sun', wd[6] === '2026-05-17');

const mg = monthGridDays(may12);
check('monthGrid 42 cells', mg.length === 42);
check('monthGrid contains may12', mg.includes(may12));

check('formatWeekdayNarrow', /^[LMXJVSD]$/.test(formatWeekdayNarrow(may12)));
check('formatLongDate spanish', formatLongDate(may12).includes('mayo'));
check('todayISO format', /^\d{4}-\d{2}-\d{2}$/.test(todayISO()));

if (failed > 0) { console.error(`${failed} failures`); process.exit(1); }
console.log('all dates checks pass');
