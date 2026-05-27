// src/features/planner/lib/rrule.dev.ts
// Run with: npx tsx src/features/planner/lib/rrule.dev.ts

import { expandRule, RRULE_PRESETS, buildWeeklyRule, summarizeRule, parseRRule } from './rrule';

let failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (!cond) { console.error('FAIL', name, extra ?? ''); failed++; }
  else console.log('OK', name);
}

// MWF for May 2026 — Mon=4,11,18,25; Wed=6,13,20,27; Fri=1,8,15,22,29
const mwf = buildWeeklyRule([0, 2, 4]);  // Mon, Wed, Fri
const occ = expandRule({
  rrule: mwf,
  startDate: '2026-05-01',
  endDate: null,
  rangeStart: '2026-05-01',
  rangeEnd: '2026-05-31',
});
check('MWF May has 13 occurrences', occ.length === 13, occ);
check('MWF May 1 is included', occ.includes('2026-05-01'));
check('MWF May 4 is included', occ.includes('2026-05-04'));
check('MWF May 5 NOT included', !occ.includes('2026-05-05'));

// Endpoint cap
const occCapped = expandRule({
  rrule: mwf,
  startDate: '2026-05-01',
  endDate: '2026-05-15',
  rangeStart: '2026-05-01',
  rangeEnd: '2026-05-31',
});
check('endDate cap works', occCapped.every((d) => d <= '2026-05-15'), occCapped);

// First Monday of month
const firstMon = RRULE_PRESETS.find((p) => p.id === 'first-monday')!.build('2026-05-01');
const fm = expandRule({
  rrule: firstMon,
  startDate: '2026-05-01',
  endDate: null,
  rangeStart: '2026-05-01',
  rangeEnd: '2026-12-31',
});
check('first-monday returns 8 (May–Dec)', fm.length === 8, fm);
check('first-monday May = 04', fm[0] === '2026-05-04');

// Parse error path
const bad = parseRRule('FREQ=NOPE');
check('invalid rrule returns error', bad.ok === false);

// Summary smoke
const sum = summarizeRule(buildWeeklyRule([0, 2, 4]));
check('summary contains Lun', sum.toLowerCase().includes('lun'));

if (failed > 0) { console.error(`${failed} failures`); process.exit(1); }
console.log('all rrule checks pass');
