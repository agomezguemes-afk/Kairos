// Run with: npx tsx src/lib/stats/weekStats.dev.ts

import { computeWeekStats, formatVolume } from './weekStats';
import type { WorkoutHistoryEntry } from '../../store/workoutStore';

let failed = 0;
function check(name: string, cond: boolean) {
  if (!cond) { console.error('FAIL', name); failed++; }
  else console.log('OK', name);
}

const nowMs = new Date('2026-05-26T18:00:00Z').getTime();
const day = 86400_000;

// `daysAgo` describes when the session ENDED (the value computeWeekStats
// buckets on). startedAt is back-dated by durationSec so the entry is
// internally consistent.
const entry = (
  id: string,
  daysAgo: number,
  volume: number,
  durationSec = 3600,
): WorkoutHistoryEntry => ({
  id, blockId: 'b1', blockName: 'Test',
  startedAt: nowMs - daysAgo * day - durationSec * 1000,
  endedAt:   nowMs - daysAgo * day,
  exerciseCount: 1, setCount: 3,
  totalVolume: volume, durationSec,
  exercises: [],
});

// ── Empty history ──────────────────────────────────────────────────────────
const empty = computeWeekStats([], nowMs);
check('empty: sessionsThisWeek=0',  empty.sessionsThisWeek === 0);
check('empty: volumeThisWeek=0',    empty.volumeThisWeek === 0);
check('empty: sessionsDelta=0',     empty.sessionsDelta === 0);
check('empty: minutesThisWeek=0',   empty.minutesThisWeek === 0);

// ── This week: 3 sessions, last week: 1 session ───────────────────────────
const mixed = computeWeekStats([
  entry('a', 1, 2000),    // this week
  entry('b', 3, 1500),    // this week
  entry('c', 6, 1800),    // this week
  entry('d', 9, 1200),    // last week
  entry('e', 20, 1000),   // outside both windows
], nowMs);
check('mixed: sessionsThisWeek=3',  mixed.sessionsThisWeek === 3);
check('mixed: sessionsLastWeek=1',  mixed.sessionsLastWeek === 1);
check('mixed: volumeThisWeek=5300', mixed.volumeThisWeek === 5300);
check('mixed: volumeLastWeek=1200', mixed.volumeLastWeek === 1200);
check('mixed: sessionsDelta=+2',    mixed.sessionsDelta === 2);
check('mixed: volumeDelta=+4100',   mixed.volumeDelta === 4100);

// ── Boundary: exactly 7 days ago is still inside this week ────────────────
const boundary = computeWeekStats([entry('a', 7, 1000)], nowMs);
check('boundary 7d ago is this week',
  boundary.sessionsThisWeek === 1 && boundary.sessionsLastWeek === 0);

// ── Boundary: exactly 14 days ago is last day of last week (inclusive) ───
const at14 = computeWeekStats([entry('a', 14, 1000)], nowMs);
check('boundary 14d ago is last week (inclusive)',
  at14.sessionsLastWeek === 1 && at14.sessionsThisWeek === 0);

// ── Boundary: 14.01 days ago drops out of both windows ────────────────────
const beyond = computeWeekStats([entry('a', 14.01, 1000)], nowMs);
check('14.01d ago drops out', beyond.sessionsThisWeek + beyond.sessionsLastWeek === 0);

// ── Minutes accumulate from durationSec ───────────────────────────────────
const dur = computeWeekStats([
  entry('a', 2, 0, 1800),   // 30min
  entry('b', 4, 0, 3600),   // 60min
], nowMs);
check('minutesThisWeek = 90', dur.minutesThisWeek === 90);

// ── formatVolume ──────────────────────────────────────────────────────────
check('formatVolume 940 → 940',     formatVolume(940) === '940');
check('formatVolume 1500 → 1.5k',   formatVolume(1500) === '1.5k');
check('formatVolume 12340 → 12.3k', formatVolume(12340) === '12.3k');
check('formatVolume 5000 → 5k',     formatVolume(5000) === '5k');

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll weekStats tests passed.');
