// MET values per discipline. Source: Compendium of Physical Activities, simplified.
// Used to estimate kcal when HealthKit doesn't compute it for us.
//   kcal = MET × bodyWeightKg × hours

import type { Discipline } from '../../types/core';

const MET_TABLE: Record<Discipline, number> = {
  strength: 6.0, // vigorous weightlifting
  calisthenics: 5.0, // moderate
  running: 8.0, // ~8 km/h baseline
  cycling: 6.5, // moderate
  swimming: 7.0,
  mobility: 3.0, // yoga
  team_sport: 7.0,
  general: 5.0,
};

export function estimateKcal(input: {
  discipline: Discipline;
  durationMs: number;
  bodyWeightKg: number; // user weight; default to 75 kg if unknown
}): number {
  const hours = input.durationMs / 3_600_000;
  const met = MET_TABLE[input.discipline] ?? 5.0;
  const weight = input.bodyWeightKg > 0 ? input.bodyWeightKg : 75;
  return Math.round(met * weight * hours);
}
