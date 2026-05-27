// Run: npx tsx src/lib/health/met.dev.ts

import { estimateKcal } from './met';

let failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (!cond) {
    console.error('FAIL', name, extra ?? '');
    failed++;
  } else console.log('OK', name);
}

// 1h strength @ 75kg = 6.0 × 75 × 1 = 450
check(
  'strength 1h 75kg = 450',
  estimateKcal({ discipline: 'strength', durationMs: 3_600_000, bodyWeightKg: 75 }) === 450,
);

// 30m running @ 80kg = 8 × 80 × 0.5 = 320
check(
  'running 30m 80kg = 320',
  estimateKcal({ discipline: 'running', durationMs: 1_800_000, bodyWeightKg: 80 }) === 320,
);

// Unknown body weight → defaults to 75kg
check(
  'weight 0 → defaults 75',
  estimateKcal({ discipline: 'mobility', durationMs: 3_600_000, bodyWeightKg: 0 }) === 225,
);

// 0 duration → 0 kcal
check(
  'zero duration → 0',
  estimateKcal({ discipline: 'strength', durationMs: 0, bodyWeightKg: 80 }) === 0,
);

if (failed > 0) {
  console.error(`${failed} failures`);
  process.exit(1);
}
console.log('all met checks pass');
