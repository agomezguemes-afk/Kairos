// dev-suites.test.ts — bridge between Vitest CI and the existing
// per-domain `.dev.ts` smoke suites.
//
// Each `.dev.ts` file is a self-contained tsx script that prints `OK`
// lines for passing checks and exits non-zero on failure. We spawn each
// one as a subprocess and assert exit code 0 — fine-grained per-assert
// reporting is preserved through the script's own stdout (visible when
// a test fails).
//
// Migration plan: as logic stabilises, each `.dev.ts` is rewritten as
// idiomatic Vitest (`describe` / `it` / `expect`) and removed from this
// runner. The map of files lives below — drop an entry once it's
// migrated to a proper `.test.ts`.

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = resolve(__dirname, '..', '..');

const DEV_SUITES: { name: string; path: string }[] = [
  { name: 'libraryHelpers', path: 'src/data/libraryHelpers.dev.ts' },
  { name: 'scheduleStore', path: 'src/store/scheduleStore.dev.ts' },
  { name: 'workoutStore', path: 'src/store/workoutStore.dev.ts' },
  { name: 'met', path: 'src/lib/health/met.dev.ts' },
  { name: 'dashboardValue', path: 'src/lib/history/dashboardValue.dev.ts' },
  { name: 'exerciseHistory', path: 'src/lib/history/exerciseHistory.dev.ts' },
  { name: 'scheduler', path: 'src/lib/notifications/scheduler.dev.ts' },
  { name: 'weekStats', path: 'src/lib/stats/weekStats.dev.ts' },
  { name: 'summaryCompare', path: 'src/components/workout/lib/summaryCompare.dev.ts' },
  { name: 'previousReference', path: 'src/components/workout/lib/previousReference.dev.ts' },
  { name: 'plates', path: 'src/components/workout/lib/plates.dev.ts' },
  { name: 'prDetection', path: 'src/components/workout/lib/prDetection.dev.ts' },
  { name: 'adherence', path: 'src/screens/tabs/progress/lib/adherence.dev.ts' },
  { name: 'oneRM', path: 'src/screens/tabs/progress/lib/oneRM.dev.ts' },
  { name: 'aggregations', path: 'src/screens/tabs/progress/lib/aggregations.dev.ts' },
  { name: 'spineLayout', path: 'src/features/blocks/lib/spineLayout.dev.ts' },
  { name: 'rrule', path: 'src/features/planner/lib/rrule.dev.ts' },
  { name: 'kaiSignal', path: 'src/features/planner/lib/kaiSignal.dev.ts' },
  { name: 'dates', path: 'src/features/planner/lib/dates.dev.ts' },
];

describe('dev-suites — legacy .dev.ts smoke runner', () => {
  for (const suite of DEV_SUITES) {
    it(`${suite.name} passes`, () => {
      const abs = resolve(ROOT, suite.path);
      expect(existsSync(abs), `missing dev suite: ${suite.path}`).toBe(true);
      // Surface child stdout on failure; swallow on success.
      try {
        execSync(`npx tsx "${abs}"`, {
          cwd: ROOT,
          stdio: 'pipe',
          encoding: 'utf-8',
        });
      } catch (err) {
        const e = err as { stdout?: string; stderr?: string; status?: number };
        throw new Error(
          `dev suite '${suite.name}' failed (exit ${e.status ?? '?'})\n` +
            `--- stdout ---\n${e.stdout ?? ''}\n` +
            `--- stderr ---\n${e.stderr ?? ''}`,
        );
      }
    });
  }
});
