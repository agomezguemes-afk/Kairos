// Scores the goal interpreter on the Spanish eval set: rules alone, and
// rules + cloud model when EXPO_PUBLIC_GROQ_API_KEY is set. The on-device
// models are scored on the phone, in the AI lab, on the same cases.
//
//   npx tsx scripts/eval-goals.ts
//   EXPO_PUBLIC_GROQ_API_KEY=… npx tsx scripts/eval-goals.ts

import { parseGoal } from '../src/lib/adaptive/goalParser';
import {
  GOAL_CASES,
  GOAL_HOLDOUT,
  scoreGoal,
  summarise,
  type GoalCase,
} from '../src/lib/ai/eval/goalCases';
import { interpretGoal } from '../src/lib/ai/goalInterpreter';
import { isGroqAvailable } from '../src/lib/ai/client';

const pct = (x: number) => `${Math.round(x * 100)} %`;

async function run(name: string, cases: readonly GoalCase[]) {
  const rules = summarise(
    cases.map((c) => scoreGoal(c, { ...parseGoal(c.text), source: 'rules' })),
  );
  console.log(`\n${name} (${cases.length} casos)`);
  console.log(
    `  reglas  deporte ${pct(rules.sport)} · días ${pct(rules.days)} · semanas ${pct(rules.weeks)}`,
  );
  if (!isGroqAvailable()) return;
  const scores = [];
  for (const c of cases) scores.push(scoreGoal(c, await interpretGoal(c.text, 15_000)));
  const cloud = summarise(scores);
  console.log(
    `  nube    deporte ${pct(cloud.sport)} · días ${pct(cloud.days)} · semanas ${pct(cloud.weeks)}`,
  );
  for (const m of cloud.misses)
    console.log(
      `    ✗ «${m.case.text}» → ${m.got.sports.join(', ')} · ${m.got.daysPerWeek} días · ${m.got.horizonWeeks} sem`,
    );
}

async function main() {
  await run('Conjunto de ajuste', GOAL_CASES);
  await run('Conjunto de control', GOAL_HOLDOUT);
  if (!isGroqAvailable()) console.log('\nSin EXPO_PUBLIC_GROQ_API_KEY: solo reglas.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
