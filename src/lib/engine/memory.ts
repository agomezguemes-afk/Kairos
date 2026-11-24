// Decision memory: the engine remembers each session as a case: how you
// arrived (context), what you actually did (action), what it had advised,
// and how it went (outcome). Faced with a new day it recalls the most
// similar past days and asks "the last times you came in like this and
// trained in full, how did it go?", the way an experienced coach reasons
// from their history with you, not only from formulas.
// Spec: ENGINE-v2.md §Memoria de decisiones.

import type { CheckIn } from '../adaptive/checkins';
import { loadTrend } from '../adaptive/metrics';
import type { SessionLog } from '../adaptive/types';
import type { CaseRecord } from './backtest';
import { decay } from './cache';
import { DAY_MS } from './fitnessFatigue';
import { READINESS_SWC, type ReadinessV2 } from './readiness';
import { sessionRegions } from './recovery';

/** How you arrived at a session, in units a coach would compare. */
export interface DecisionContext {
  /** Readiness forecast before the session (uncapped). */
  p: number;
  /** Accumulated sleep debt (h). */
  debt: number;
  /** Recovery of the least-recovered region the session loads (0–1). */
  recovered: number;
  /** Last 7 days vs the 4-week weekly average (1 when unknown). */
  ratio: number;
  /** Days since the previous session. */
  gap: number;
  /** Soreness from today's check-in, 1 (none) – 5. */
  soreness: number;
}

/** What the engine advised for a session, written when the session is saved. */
export interface Advice {
  sessionId: string;
  at: string;
  band: 'go' | 'easy' | 'rest';
  stance?: string;
  lead?: string;
  note?: string;
}

export interface Episode {
  sessionId: string;
  at: string;
  context: DecisionContext;
  /** Full = ≥ 90 % of the planned sets done. */
  action: 'full' | 'reduced';
  completion: number;
  /** Performance vs level (%), when the session produced an observation. */
  perf: number | null;
  /** Pain marked within 72 h after the session. */
  pain: boolean;
  /** Below level − SWC, or pain afterwards. */
  bad: boolean;
  advised?: Advice;
  /** Recency weight (1 = today); archive prototypes carry their summed weight. */
  weight?: number;
  /** Share of bad outcomes, for a prototype standing for many days. */
  badShare?: number;
}

export interface Recall {
  /** P(a bad outcome) for this action in contexts like this one. */
  pBad: number;
  /** Base rate of bad outcomes over all remembered sessions. */
  base: number;
  /** Effective number of similar cases (Kish). */
  nEff: number;
  /** The closest cases, most similar first. */
  similar: Episode[];
}

/**
 * Distance scales: one unit is a difference a coach would notice. Fixed
 * from domain knowledge rather than estimated, so a few sessions can't
 * stretch or shrink what counts as "similar".
 */
const SCALE: Record<keyof DecisionContext, number> = {
  p: 0.15,
  debt: 2,
  recovered: 0.2,
  ratio: 0.3,
  gap: 2,
  soreness: 1,
};
const FULL_COMPLETION = 0.9;
const PAIN_WINDOW_MS = 3 * DAY_MS;
const PRE_VALID_MS = 18 * 3_600_000;

const ms = (iso: string) => new Date(iso).getTime();

export function decisionContext(
  r: ReadinessV2,
  before: SessionLog[],
  checkins: CheckIn[],
  nextMovements: string[],
  when: Date,
): DecisionContext {
  const t = when.getTime();
  const load = sessionRegions(nextMovements);
  const loaded = r.recovery.regions.filter((x) => (load[x.region] ?? 0) >= 0.5);
  const last = before.reduce((a, s) => Math.max(a, ms(s.endedAt)), 0);
  const pre = checkins
    .filter((c) => c.kind === 'pre' && c.soreness !== undefined && ms(c.at) <= t)
    .sort((a, b) => ms(b.at) - ms(a.at))[0];
  return {
    p: r.predictive,
    debt: r.sleep.hours,
    recovered: loaded.length ? Math.min(...loaded.map((x) => x.recovered)) : 1,
    ratio: loadTrend(before, when).ratio ?? 1,
    gap: last ? Math.min(14, (t - last) / DAY_MS) : 7,
    soreness: pre && t - ms(pre.at) <= PRE_VALID_MS ? pre.soreness! : 1,
  };
}

/** Share of the planned sets that were completed (1 when nothing was planned). */
export function completionOf(s: SessionLog): number {
  let planned = 0;
  let done = 0;
  for (const m of s.movements) {
    planned += m.target.sets ?? m.sets.length;
    done += m.sets.filter((x) => x.completed).length;
  }
  return planned ? Math.min(1, done / planned) : 1;
}

/**
 * One case per replayed session whose outcome is known. A session with no
 * performance observation still counts when pain followed it; otherwise it
 * says nothing about how the day went and is left out.
 */
export function buildEpisodes(
  cases: CaseRecord[],
  sessions: SessionLog[],
  checkins: CheckIn[],
  advice: Advice[],
  now: Date,
): Episode[] {
  const byId = new Map(sessions.map((x) => [x.id, x]));
  const advisedBy = new Map(advice.map((a) => [a.sessionId, a]));
  const pains = checkins.filter((c) => c.pain).map((c) => ms(c.at));
  const out: Episode[] = [];
  for (const c of cases) {
    const s = byId.get(c.sessionId);
    if (!s) continue;
    const end = ms(s.endedAt);
    const pain = pains.some((t) => t > end && t <= end + PAIN_WINDOW_MS);
    // Until 72 h have passed, "no pain" isn't known yet.
    if (!pain && now.getTime() - end < PAIN_WINDOW_MS) continue;
    const perf = c.y === null ? null : c.y - c.level;
    if (perf === null && !pain) continue;
    const completion = completionOf(s);
    out.push({
      sessionId: s.id,
      at: s.startedAt,
      context: c.context,
      action: completion >= FULL_COMPLETION ? 'full' : 'reduced',
      completion,
      perf,
      pain,
      bad: pain || (perf !== null && perf < -READINESS_SWC),
      advised: advisedBy.get(s.id),
      weight: decay(now.getTime() - ms(s.startedAt)),
    });
  }
  return out;
}

export function similarity(a: DecisionContext, b: DecisionContext): number {
  let d2 = 0;
  for (const k of Object.keys(SCALE) as (keyof DecisionContext)[])
    d2 += ((a[k] - b[k]) / SCALE[k]) ** 2;
  return Math.exp(-0.5 * d2);
}

/**
 * Kernel-weighted recall (Nadaraya–Watson over cases): a Beta posterior on
 * P(bad) for this action, with a weak prior centred on the person's own
 * base rate, so a couple of near cases inform without dictating.
 */
export function recall(
  ctx: DecisionContext,
  episodes: Episode[],
  action: Episode['action'] = 'full',
): Recall | null {
  if (!episodes.length) return null;
  const wOf = (e: Episode) => e.weight ?? 1;
  const badOf = (e: Episode) => e.badShare ?? (e.bad ? 1 : 0);
  const total = episodes.reduce((a, e) => a + wOf(e), 0);
  const base = (1 + episodes.reduce((a, e) => a + wOf(e) * badOf(e), 0)) / (2 + total);
  // Similar and recent count most; old days and prototypes still count.
  const weighted = episodes
    .filter((e) => e.action === action)
    .map((e) => ({ e, w: similarity(ctx, e.context) * wOf(e) }))
    .filter((x) => x.w > 0.01);
  const sw = weighted.reduce((a, x) => a + x.w, 0);
  const sw2 = weighted.reduce((a, x) => a + x.w * x.w, 0);
  const bad = weighted.reduce((a, x) => a + badOf(x.e) * x.w, 0);
  const PRIOR = 2;
  return {
    pBad: (PRIOR * base + bad) / (PRIOR + sw),
    base,
    nEff: sw2 > 0 ? (sw * sw) / sw2 : 0,
    similar: weighted
      .filter((x) => !x.e.sessionId.startsWith('proto-'))
      .sort((a, b) => b.w - a.w)
      .slice(0, 3)
      .map((x) => x.e),
  };
}
