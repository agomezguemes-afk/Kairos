// KAIROS — Kai Memory (pure, durable user model).
//
// The connective tissue of the two-loop agent (docs/KAIROS_VISION §3): a model
// of *you* that both loops read so adaptation is to-you-specifically, not
// generic. Updated by pure reducers as you train and as you accept/dismiss Kai's
// proposals — so Kai learns which guidance lands. No store/network/RN here; the
// app wires these reducers to a persisted slice, and feeds `memoryToContext`
// into prompts.
//
// Key idea that competitors can't copy: because Kairos tracks *user-defined*
// metrics, memory accumulates *your* definition of progress (`trackedMetrics`),
// not a fixed schema.

export interface KaiMemory {
  /** Free-text intent the user gave Kai (onboarding/coach). The "why". */
  intent: string | null;
  goal: string | null;
  experience: string | null;
  daysPerWeekTarget: number | null;
  /** Domains the user actually trains, weighted by observed frequency. */
  domainAffinity: Readonly<Record<string, number>>;
  /** Custom metric keys the user tracks — Kai watches these specifically. */
  trackedMetrics: readonly string[];
  /** How often the user accepted vs dismissed each proposal kind. */
  acceptedKinds: Readonly<Record<string, number>>;
  dismissedKinds: Readonly<Record<string, number>>;
  updatedAt: number;
}

export const EMPTY_MEMORY: KaiMemory = {
  intent: null,
  goal: null,
  experience: null,
  daysPerWeekTarget: null,
  domainAffinity: {},
  trackedMetrics: [],
  acceptedKinds: {},
  dismissedKinds: {},
  updatedAt: 0,
};

export interface IntentSeed {
  intent?: string | null;
  goal?: string | null;
  experience?: string | null;
  daysPerWeekTarget?: number | null;
}

/** Seed memory from the onboarding draft (the first thing Kai learns). */
export function rememberIntent(m: KaiMemory, seed: IntentSeed, now: number): KaiMemory {
  const clean = (s: string | null | undefined) => {
    if (typeof s !== 'string') return null;
    const t = s.trim().replace(/\s+/g, ' ');
    return t.length ? t.slice(0, 500) : null;
  };
  return {
    ...m,
    intent: clean(seed.intent) ?? m.intent,
    goal: clean(seed.goal) ?? m.goal,
    experience: clean(seed.experience) ?? m.experience,
    daysPerWeekTarget:
      typeof seed.daysPerWeekTarget === 'number' && Number.isFinite(seed.daysPerWeekTarget)
        ? seed.daysPerWeekTarget
        : m.daysPerWeekTarget,
    updatedAt: now,
  };
}

export interface SessionEvent {
  /** Discipline of the block trained. */
  domain: string;
  /** Custom metric keys touched this session (e.g. ['weight','rpe','mood']). */
  metrics?: readonly string[];
}

const AFFINITY_DECAY = 0.9; // recent behavior weighs more than old

/** Learn from a completed session: domain affinity + tracked metrics. */
export function observeSession(m: KaiMemory, ev: SessionEvent, now: number): KaiMemory {
  const domain = typeof ev.domain === 'string' && ev.domain ? ev.domain : 'general';
  const decayed: Record<string, number> = {};
  for (const [k, v] of Object.entries(m.domainAffinity)) decayed[k] = v * AFFINITY_DECAY;
  decayed[domain] = (decayed[domain] ?? 0) + 1;

  const metrics = new Set(m.trackedMetrics);
  for (const key of ev.metrics ?? []) {
    if (typeof key === 'string' && key) metrics.add(key);
  }

  return {
    ...m,
    domainAffinity: decayed,
    trackedMetrics: [...metrics].slice(0, 40),
    updatedAt: now,
  };
}

/** Learn whether a kind of guidance lands (accepted) or annoys (dismissed). */
export function observeProposalDecision(
  m: KaiMemory,
  kind: string,
  accepted: boolean,
  now: number,
): KaiMemory {
  const bump = (rec: Readonly<Record<string, number>>) => ({
    ...rec,
    [kind]: (rec[kind] ?? 0) + 1,
  });
  return {
    ...m,
    acceptedKinds: accepted ? bump(m.acceptedKinds) : m.acceptedKinds,
    dismissedKinds: accepted ? m.dismissedKinds : bump(m.dismissedKinds),
    updatedAt: now,
  };
}

export interface GuidanceBias {
  /** Kinds the user tends to accept — favor these. */
  favored: string[];
  /** Kinds the user tends to dismiss — show sparingly. */
  avoided: string[];
}

/**
 * Learned preference for which proposal kinds to surface. A kind is avoided once
 * it's been dismissed clearly more than accepted (needs a small sample so we
 * don't over-fit one tap).
 */
export function guidanceBias(m: KaiMemory): GuidanceBias {
  const kinds = new Set([...Object.keys(m.acceptedKinds), ...Object.keys(m.dismissedKinds)]);
  const favored: string[] = [];
  const avoided: string[] = [];
  for (const k of kinds) {
    const a = m.acceptedKinds[k] ?? 0;
    const d = m.dismissedKinds[k] ?? 0;
    if (a + d < 2) continue; // not enough signal yet
    if (d >= a + 2) avoided.push(k);
    else if (a > d) favored.push(k);
  }
  return { favored, avoided };
}

/** Top N domains by affinity (the user's real focus). */
export function topDomains(m: KaiMemory, n = 3): string[] {
  return Object.entries(m.domainAffinity)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

/**
 * Compact, prompt-ready summary of who the user is — what gets injected so the
 * LLM adapts to this person, not the average. Kept short on purpose (token cost +
 * privacy: a minimized view, never the whole history).
 */
export function memoryToContext(m: KaiMemory): string {
  const parts: string[] = [];
  if (m.goal) parts.push(`Objetivo: ${m.goal}.`);
  if (m.experience) parts.push(`Nivel: ${m.experience}.`);
  if (m.daysPerWeekTarget) parts.push(`Quiere entrenar ${m.daysPerWeekTarget} días/semana.`);
  if (m.intent) parts.push(`En sus palabras: "${m.intent}".`);
  const domains = topDomains(m);
  if (domains.length) parts.push(`Entrena sobre todo: ${domains.join(', ')}.`);
  if (m.trackedMetrics.length)
    parts.push(`Métricas que le importan: ${m.trackedMetrics.join(', ')}.`);
  const bias = guidanceBias(m);
  if (bias.avoided.length) parts.push(`Evita sugerencias de tipo: ${bias.avoided.join(', ')}.`);
  return parts.join(' ');
}
