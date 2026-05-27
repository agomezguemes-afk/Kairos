// Run: npx tsx src/components/workout/lib/plates.dev.ts

import { solvePlates, formatPlateList, DEFAULT_KG_PLATES } from './plates';

let failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (!cond) {
    console.error('FAIL', name, extra ?? '');
    failed++;
  } else console.log('OK', name);
}

// 1. Exact 100 kg on 20 kg bar → perSide 40 = 1x25 + 1x15. exact.
const r1 = solvePlates({ target: 100, bar: 20 });
check(
  '100 kg → 25+15 per side',
  r1.plates.length === 2 && r1.totalKg === 100 && r1.warning === null,
);

// 2. Just bar (20 kg)
const r2 = solvePlates({ target: 20, bar: 20 });
check('20 kg = just bar', r2.plates.length === 0 && r2.totalKg === 20 && r2.warning === null);

// 3. Below bar
const r3 = solvePlates({ target: 15, bar: 20 });
check('below bar warning', r3.warning === 'below-bar' && r3.totalKg === 20);

// 4. Odd target (1 kg over bar — impossible with default plates as 0.5 plates exist; per side = 0.5, so 1x 0.5)
const r4 = solvePlates({ target: 21, bar: 20 });
check(
  '21 kg exact with 0.5 plates',
  r4.totalKg === 21 && r4.plates[0].size === 0.5 && r4.warning === null,
);

// 5. Truly odd target (e.g., 1.4 over bar — per side = 0.7; needs 0.5 + 0.2? No 0.2 plate → short 0.2 per side = 0.4 total)
const r5 = solvePlates({ target: 21.4, bar: 20 });
check('21.4 kg short', r5.warning === 'odd-target' && r5.shortBy > 0);

// 6. Max-per-side cap respected
const r6 = solvePlates({
  target: 200,
  bar: 20,
  inventory: { sizes: [25, 20, 15, 10, 5, 2.5], maxPerSide: { 25: 2 } },
});
// perSide = 90. greedy: 2x25 = 50, rem 40. 2x20 = 40, exact. → 4 plates
check('cap respected', r6.plates.find((p) => p.size === 25)?.count === 2);

// 7. format
check(
  'format',
  formatPlateList([
    { size: 25, count: 2 },
    { size: 10, count: 1 },
  ]) === '2×25 · 1×10',
);
check('format empty', formatPlateList([]) === 'Sin discos');

// 8. 60 kg total on 20 kg bar → perSide 20 → 1×20
const r8 = solvePlates({ target: 60, bar: 20 });
check(
  '60 kg → 1×20',
  r8.plates.length === 1 && r8.plates[0].size === 20 && r8.plates[0].count === 1,
);

// 9. Default inventory has 0.5 plate (so 0.5 increments work)
check('default has 0.5 plate', DEFAULT_KG_PLATES.sizes.includes(0.5));

if (failed > 0) {
  console.error(`${failed} failures`);
  process.exit(1);
}
console.log('all plates checks pass');
