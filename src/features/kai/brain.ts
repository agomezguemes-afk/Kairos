// KAIROS — Kai's passive loop, composed (pure).
//
// "Kai thinks while you're away" as ONE pure function: a state snapshot in,
// proposals out — grounded in memory (knows you), metric trends (any metric you
// track), and learned guidance bias (what lands vs annoys). This is the brain of
// assisted autonomy with the LLM and the store deliberately left OUT: it proves
// the architecture works end-to-end and ships real value deterministically. An
// LLM pass later only enriches wording; the store wires the snapshot + persists
// the chosen proposal. Pure → unit-tested.

import { generateProposals, type Proposal, type ProposalInputs } from './proposal';
import { guidanceBias, type KaiMemory } from './memory';
import { analyzeMetric, type MetricPoint } from './metricTrend';

export interface ActivitySnapshot {
  daysSinceLastWorkout: number | null;
  sessionsLast7Days: number;
  /** Sessions per domain over the recent window. */
  domainCounts: Readonly<Record<string, number>>;
  streak: number;
  blocksCount: number;
  /** Per-metric time series (any user-tracked metric → generic plateau/PR). */
  metricSeries?: Readonly<Record<string, readonly MetricPoint[]>>;
  /** Metric keys where lower is better (times, HR…). */
  lowerIsBetter?: readonly string[];
}

/**
 * Derive the discrete signals (a stalled metric, a recent PR) from raw series,
 * generically — this is where "adapt over ANY metric" feeds the rule engine.
 */
function deriveMetricSignals(
  snapshot: ActivitySnapshot,
  now: number,
): Pick<ProposalInputs, 'stalledLift' | 'recentPr'> {
  let stalledLift: ProposalInputs['stalledLift'] = null;
  let recentPr: ProposalInputs['recentPr'] = null;
  const lowerSet = new Set(snapshot.lowerIsBetter ?? []);

  for (const [name, series] of Object.entries(snapshot.metricSeries ?? {})) {
    const tr = analyzeMetric(series, { now, lowerIsBetter: lowerSet.has(name) });
    if (tr.recentBest && !recentPr) recentPr = { name };
    const weeks = Math.round(tr.weeksSinceBest ?? 0);
    if (tr.plateaued && (!stalledLift || weeks > stalledLift.weeks)) {
      stalledLift = { name, weeks };
    }
  }
  return { stalledLift, recentPr };
}

/**
 * The passive loop. Returns at most `max` proposals (default 1 — Home shows one),
 * already filtered by what this user keeps dismissing. [] when Kai should stay
 * silent (the common, correct case).
 */
export function think(
  memory: KaiMemory,
  snapshot: ActivitySnapshot,
  now: number,
  max = 1,
): Proposal[] {
  const { stalledLift, recentPr } = deriveMetricSignals(snapshot, now);

  const inputs: ProposalInputs = {
    now,
    daysSinceLastWorkout: snapshot.daysSinceLastWorkout,
    sessionsLast7Days: snapshot.sessionsLast7Days,
    domainCounts: snapshot.domainCounts,
    stalledLift,
    recentPr,
    streak: snapshot.streak,
    blocksCount: snapshot.blocksCount,
  };

  // Over-generate, then drop kinds this user reliably dismisses, then cap.
  const candidates = generateProposals(inputs, max + 3);
  const { avoided } = guidanceBias(memory);
  const kept = candidates.filter((p) => !avoided.includes(p.kind));
  return kept.slice(0, max);
}
