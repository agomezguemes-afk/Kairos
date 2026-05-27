// Run with: npx tsx src/lib/notifications/scheduler.dev.ts

import {
  buildNotifications,
  diffNotifications,
  isoDateAtHour,
  type ScheduledNotification,
} from './scheduler';
import type { ResolvedAssignment } from '../../types/schedule';

let failed = 0;
function check(name: string, cond: boolean) {
  if (!cond) {
    console.error('FAIL', name);
    failed++;
  } else console.log('OK', name);
}

const may12 = '2026-05-12';
const may13 = '2026-05-13';
const may14 = '2026-05-14';
const noonMay12 = new Date(2026, 4, 12, 12, 0, 0).getTime();

const blockNames = new Map([
  ['blk_a', 'Empuje fuerza'],
  ['blk_b', 'Tirón hipertrofia'],
]);

// ── basic reminder ──────────────────────────────────────────────────────
const out1 = buildNotifications({
  assignments: [
    { assignmentId: 'a1', blockId: 'blk_a', date: may13, status: 'planned', isRecurring: false },
  ],
  blockNames,
  lastCompletedAt: null,
  nowMs: noonMay12,
});
check('reminder for tomorrow produced', out1.length === 1);
check('reminder kind=reminder', out1[0].kind === 'reminder');
check('reminder title uses block name', out1[0].title === 'Empuje fuerza');
check('reminder fires at 8:00', new Date(out1[0].triggerAt).getHours() === 8);
check('reminder targets may13', out1[0].payload?.scheduledDate === may13);

// ── past hour skipped ───────────────────────────────────────────────────
const out2 = buildNotifications({
  assignments: [
    // today 8:00 already past at noon → must be skipped
    { assignmentId: 'a2', blockId: 'blk_a', date: may12, status: 'planned', isRecurring: false },
  ],
  blockNames,
  lastCompletedAt: null,
  nowMs: noonMay12,
});
check('reminder past hour today is skipped', out2.length === 0);

// ── beyond horizon skipped ──────────────────────────────────────────────
const farDate = '2026-05-30';
const out3 = buildNotifications({
  assignments: [
    { assignmentId: 'a3', blockId: 'blk_a', date: farDate, status: 'planned', isRecurring: false },
  ],
  blockNames,
  lastCompletedAt: null,
  nowMs: noonMay12,
  horizonDays: 7,
});
check('reminder beyond horizon skipped', out3.length === 0);

// ── completed/skipped statuses ignored ─────────────────────────────────
const out4 = buildNotifications({
  assignments: [
    { assignmentId: 'a4', blockId: 'blk_a', date: may13, status: 'completed', isRecurring: false },
    { assignmentId: 'a5', blockId: 'blk_a', date: may14, status: 'skipped', isRecurring: false },
  ],
  blockNames,
  lastCompletedAt: null,
  nowMs: noonMay12,
});
check('only planned status produces reminders', out4.length === 0);

// ── gap nudge fires when stale ──────────────────────────────────────────
const fortyHoursAgo = noonMay12 - 40 * 60 * 60 * 1000;
const out5 = buildNotifications({
  assignments: [], // nothing planned today
  blockNames,
  lastCompletedAt: fortyHoursAgo,
  nowMs: noonMay12,
});
const gap = out5.find((n) => n.kind === 'gap-nudge');
check('gap nudge fires when > 36h since last workout', !!gap);
check('gap nudge title set', gap?.title === 'Echo de menos verte');
check('gap body mentions hours since', !!gap?.body.includes('h'));

// ── gap nudge suppressed when something planned today ───────────────────
const out6 = buildNotifications({
  assignments: [
    { assignmentId: 'a6', blockId: 'blk_a', date: may12, status: 'planned', isRecurring: false },
  ],
  blockNames,
  lastCompletedAt: fortyHoursAgo,
  nowMs: noonMay12,
});
check(
  'gap nudge suppressed when today has a planned session',
  !out6.find((n) => n.kind === 'gap-nudge'),
);

// ── gap nudge suppressed when no history ───────────────────────────────
const out7 = buildNotifications({
  assignments: [],
  blockNames,
  lastCompletedAt: null,
  nowMs: noonMay12,
});
check('gap nudge suppressed when no history exists', out7.length === 0);

// ── idempotent ids ──────────────────────────────────────────────────────
const out8a = buildNotifications({
  assignments: [
    { assignmentId: 'a1', blockId: 'blk_a', date: may13, status: 'planned', isRecurring: false },
  ],
  blockNames,
  lastCompletedAt: null,
  nowMs: noonMay12,
});
const out8b = buildNotifications({
  assignments: [
    { assignmentId: 'a1', blockId: 'blk_a', date: may13, status: 'planned', isRecurring: false },
  ],
  blockNames,
  lastCompletedAt: null,
  nowMs: noonMay12,
});
check('same input → same id', out8a[0].id === out8b[0].id);

// ── diff cancels removed items ──────────────────────────────────────────
const prev: ScheduledNotification[] = [
  { id: 'reminder:a1:2026-05-13', kind: 'reminder', title: 'X', body: 'Y', triggerAt: 0 },
  { id: 'reminder:a2:2026-05-14', kind: 'reminder', title: 'X', body: 'Y', triggerAt: 0 },
];
const next: ScheduledNotification[] = [
  { id: 'reminder:a1:2026-05-13', kind: 'reminder', title: 'X', body: 'Y', triggerAt: 100 },
];
const d = diffNotifications(prev, next);
check('diff cancels removed id', d.toCancel.includes('reminder:a2:2026-05-14'));
check('diff keeps surviving id', d.toCancel.length === 1);
check('diff returns full next as toSchedule', d.toSchedule.length === 1);

// ── isoDateAtHour sanity ────────────────────────────────────────────────
const t = isoDateAtHour(may13, 9);
const back = new Date(t);
check('isoDateAtHour day', back.getDate() === 13);
check('isoDateAtHour hour', back.getHours() === 9);

if (failed > 0) {
  console.error(`${failed} failures`);
  process.exit(1);
}
console.log('all scheduler checks pass');
