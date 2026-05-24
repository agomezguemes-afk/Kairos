// Run with: npx tsx src/features/blocks/lib/spineLayout.dev.ts
// Exits non-zero on any assertion failure.

import {
  createTextNode,
  createDividerNode,
  createExerciseNode,
  createColumnSectionNode,
  createTimerNode,
  type ContentNode,
} from '../../../types/content';
import { createExerciseCard } from '../../../types/core';
import { buildSpineRows, stationKindFor } from './spineLayout';

let failed = 0;
function check(name: string, cond: boolean) {
  if (!cond) { console.error('FAIL', name); failed++; }
  else console.log('OK', name);
}

// ── empty ─────────────────────────────────────────────────────────────────
check('empty input → empty rows', buildSpineRows([]).length === 0);

// ── single exercise ──────────────────────────────────────────────────────
const ex1 = createExerciseNode(0, createExerciseCard('blk1', 0));
const r1 = buildSpineRows([ex1]);
check('single exercise → 1 row', r1.length === 1);
check('single exercise kind=exercise', r1[0].kind === 'exercise');
check('single exercise state=pending', r1[0].state === 'pending');
check('single exercise tile size=full', r1[0].tiles[0].size === 'full');
check('single exercise tile preserves node ref', r1[0].tiles[0].node === ex1);

// ── mixed nodes preserve order ───────────────────────────────────────────
const t = createTextNode(0, 'h1', 'Hello');
const ex = createExerciseNode(1, createExerciseCard('blk1', 1));
const d = createDividerNode(2);
const tm = createTimerNode(3, 'countdown', 90);
const mixed = buildSpineRows([t, ex, d, tm]);
check('mixed → 4 rows', mixed.length === 4);
check('mixed[0] kind=note',     mixed[0].kind === 'note');
check('mixed[1] kind=exercise', mixed[1].kind === 'exercise');
check('mixed[2] kind=divider',  mixed[2].kind === 'divider');
check('mixed[3] kind=tool',     mixed[3].kind === 'tool');

// ── order resorting ──────────────────────────────────────────────────────
const a = createTextNode(2, 'paragraph', 'last');
const b = createTextNode(0, 'paragraph', 'first');
const c = createTextNode(1, 'paragraph', 'middle');
const sorted = buildSpineRows([a, b, c]);
check('out-of-order input → sorted by order field',
  sorted[0].id === b.id && sorted[1].id === c.id && sorted[2].id === a.id);

// ── column section + children ────────────────────────────────────────────
const sec = createColumnSectionNode(0, 2);
const child1: ContentNode = { ...createTextNode(1, 'paragraph', 'left'),  section: sec.id, column: 0 };
const child2: ContentNode = { ...createTextNode(2, 'paragraph', 'right'), section: sec.id, column: 1 };
const trailing = createTextNode(3, 'paragraph', 'after section');
const withSec = buildSpineRows([sec, child1, child2, trailing]);
check('section → 4 rows (header + 2 children + trailing)', withSec.length === 4);
check('section[0] is section header', withSec[0].kind === 'section');
check('section[1] is child note',     withSec[1].kind === 'note');
check('section[1] carries sectionId', withSec[1].sectionId === sec.id);
check('section[2] carries sectionId', withSec[2].sectionId === sec.id);
check('section[3] is trailing (no sectionId)',
  withSec[3].kind === 'note' && withSec[3].sectionId === undefined);

// ── orphaned section reference is treated as free node ───────────────────
const orphan: ContentNode = { ...createTextNode(0, 'paragraph', 'lost'), section: 'nonexistent', column: 0 };
const orphanRows = buildSpineRows([orphan]);
check('orphan section ref → emitted as free row', orphanRows.length === 1);
check('orphan → no sectionId on resulting row', orphanRows[0].sectionId === undefined);

// ── stationKindFor table ────────────────────────────────────────────────
check('stationKindFor exercise', stationKindFor(ex1) === 'exercise');
check('stationKindFor text',     stationKindFor(t) === 'note');
check('stationKindFor divider',  stationKindFor(d) === 'divider');
check('stationKindFor timer',    stationKindFor(tm) === 'tool');
check('stationKindFor section',  stationKindFor(sec) === 'section');

if (failed > 0) { console.error(`${failed} failures`); process.exit(1); }
console.log('all spineLayout checks pass');
