import { describe, expect, it } from 'vitest';

import {
  applySuggestion,
  draftPlan,
  generateSuggestions,
  isDueForReview,
  needsWeeklyCheckIn,
  objectiveCheck,
  parseGoal,
  readiness,
  resolveExperiment,
  responseProfile,
  revertPatch,
  startExperiment,
  weeklySuggestions,
  type CheckIn,
  type Experiment,
  type MovementLog,
  type SessionLog,
  type Suggestion,
} from './index';

const NOW = new Date('2026-11-08T12:00:00Z');
const DAY = 86_400_000;
const at = (d: number) => new Date(NOW.getTime() + d * DAY);
const iso = (d: number) => at(d).toISOString();

function session(
  movements: MovementLog[],
  day: number,
  over: Partial<SessionLog> = {},
): SessionLog {
  return {
    id: `s${day}-${Math.random().toString(36).slice(2, 6)}`,
    title: 'Fuerza',
    sport: 'climbing',
    startedAt: iso(day),
    endedAt: iso(day),
    durationMin: 60,
    rpe: 6,
    movements,
    ...over,
  };
}

function squat(reps: number[], load: number, rir = 2): MovementLog {
  return {
    movementId: 'back_squat',
    target: { sets: 3, repsMin: 6, repsMax: 8, rir: 2, loadKg: load },
    sets: reps.map((r) => ({ reps: r, loadKg: load, rir, completed: true })),
  };
}

function loadSuggestion(from = 60, to = 62.5): Suggestion {
  return {
    id: 'sx:increase_load:back_squat',
    kind: 'increase_load',
    movementId: 'back_squat',
    sessionId: 'sx',
    title: 'Sube sentadilla',
    from: { label: 'Carga', value: from, unit: 'kg' },
    to: { label: 'Carga', value: to, unit: 'kg' },
    patch: { loadKg: to },
    rationale: '',
    evidence: [],
    confidence: 'emerging',
    rarity: 'common',
    createdAt: iso(0),
    status: 'accepted',
  };
}

function closed(kind: Experiment['kind'], success: boolean, i: number): Experiment {
  return {
    ...startExperiment({ ...loadSuggestion(), id: `old${i}`, kind }, at(-60 + i)),
    status: success ? 'kept' : 'reverted',
    success,
  };
}

describe('experiments', () => {
  it('starts with a review date and the adjusted target', () => {
    const e = startExperiment(loadSuggestion(), NOW, 65);
    expect(e.status).toBe('running');
    expect(e.target?.value).toBe(65);
    expect(new Date(e.reviewAfter).getTime() - NOW.getTime()).toBe(14 * DAY);
  });

  it('is due after two exposures, or after the review date', () => {
    const e = startExperiment(loadSuggestion(), NOW);
    const one = [session([squat([6, 6, 6], 62.5)], 2)];
    expect(isDueForReview(e, one, at(3))).toBe(false);
    expect(isDueForReview(e, [...one, session([squat([6, 6, 6], 62.5)], 5)], at(6))).toBe(true);
    expect(isDueForReview(e, [], at(15))).toBe(true);
  });

  it('reads the outcome from the logs at the new load', () => {
    const e = startExperiment(loadSuggestion(), NOW);
    const ok = objectiveCheck(e, [session([squat([6, 7, 6], 62.5)], 3)]);
    expect(ok.verdict).toBe('yes');
    const bad = objectiveCheck(e, [session([squat([6, 4, 3], 62.5)], 3)]);
    expect(bad.verdict).toBe('no');
    // Sets logged at the old load don't count as success at the new one.
    const old = objectiveCheck(e, [session([squat([8, 8, 8], 60)], 3)]);
    expect(old.verdict).toBe('no');
    expect(objectiveCheck(e, []).verdict).toBe('unknown');
  });

  it('pain always reverts; logs beat self-report when they exist', () => {
    const e = startExperiment(loadSuggestion(), NOW);
    const yes = { verdict: 'yes' as const, exposures: 2, evidence: [] };
    const no = { verdict: 'no' as const, exposures: 2, evidence: [] };
    const unknown = { verdict: 'unknown' as const, exposures: 0, evidence: [] };
    expect(resolveExperiment(e, { did: 'yes', achieved: 'yes', feel: 'pain' }, yes).status).toBe(
      'reverted',
    );
    expect(resolveExperiment(e, { did: 'yes', achieved: 'partly', feel: 'ok' }, yes).success).toBe(
      true,
    );
    expect(resolveExperiment(e, { did: 'yes', achieved: 'yes', feel: 'ok' }, no).success).toBe(
      false,
    );
    expect(resolveExperiment(e, { did: 'yes', achieved: 'yes', feel: 'ok' }, unknown).success).toBe(
      true,
    );
  });

  it('reverts a load change back to the baseline', () => {
    expect(revertPatch(startExperiment(loadSuggestion(60, 62.5), NOW))).toEqual({ loadKg: 60 });
  });
});

describe('response profile', () => {
  it('starts neutral and learns per kind', () => {
    const p = responseProfile([
      closed('increase_load', false, 1),
      closed('increase_load', false, 2),
      closed('increase_load', false, 3),
      closed('extend_duration', true, 4),
    ]);
    expect(p.increase_load).toEqual({ tried: 3, worked: 0, affinity: 2 / 7 });
    expect(p.extend_duration?.affinity).toBeCloseTo(0.6);
    expect(p.add_set).toBeUndefined();
  });

  it('swaps a load increase for an extra set when loads keep failing', () => {
    const history = [session([squat([8, 8, 8], 60)], -3)];
    const s = session([squat([8, 8, 8], 60)], 0);
    const failed = [1, 2, 3].map((i) => closed('increase_load', false, i));
    const out = generateSuggestions({ session: s, history, now: NOW, experiments: failed });
    const sq = out.find((x) => x.movementId === 'back_squat');
    expect(sq?.kind).toBe('add_set');
    expect(sq?.patch).toEqual({ sets: 4 });
    expect(sq?.rationale).toMatch(/0 de 3/);
  });

  it('cites the person’s record and keeps load when it has worked', () => {
    const s = session([squat([8, 8, 8], 60)], 0);
    const worked = [1, 2].map((i) => closed('increase_load', true, i));
    const out = generateSuggestions({ session: s, history: [], now: NOW, experiments: worked });
    const sq = out.find((x) => x.movementId === 'back_squat');
    expect(sq?.kind).toBe('increase_load');
    expect(sq?.evidence.at(-1)).toMatch(/2 de 2/);
  });

  it('does not stack a change on a movement mid-experiment', () => {
    const s = session([squat([8, 8, 8], 62.5)], 0);
    const running = [startExperiment(loadSuggestion(), at(-2))];
    const out = generateSuggestions({ session: s, history: [], now: NOW, experiments: running });
    expect(out.some((x) => x.movementId === 'back_squat')).toBe(false);
  });
});

describe('check-ins', () => {
  const pre = (sleep: number, soreness: number, hoursAgo = 2, pain = false): CheckIn => ({
    id: `c${sleep}${soreness}`,
    at: new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString(),
    kind: 'pre',
    sleep,
    soreness,
    pain,
  });

  it('turns sleep and soreness into a readiness band', () => {
    expect(readiness([pre(5, 1)], [], NOW).band).toBe('go');
    expect(readiness([pre(2, 2)], [], NOW).band).toBe('easy');
    expect(readiness([pre(1, 5)], [], NOW).band).toBe('rest');
    expect(readiness([pre(4, 1, 2, true)], [], NOW).band).toBe('rest');
  });

  it('ignores stale check-ins and says when it is guessing', () => {
    const r = readiness([pre(1, 5, 30)], [], NOW);
    expect(r.band).toBe('go');
    expect(r.informed).toBe(false);
  });

  it('asks for a weekly check-in once a week', () => {
    expect(needsWeeklyCheckIn([], NOW)).toBe(true);
    const w: CheckIn = { id: 'w', at: iso(-2), kind: 'weekly' };
    expect(needsWeeklyCheckIn([w], NOW)).toBe(false);
    expect(needsWeeklyCheckIn([w], at(5))).toBe(true);
  });

  describe('weekly suggestions', () => {
    const plan = (() => {
      const p = draftPlan(parseGoal('pádel resistencia y fuerza, 3 días'), NOW);
      return { ...p, sessions: p.sessions.map((s) => ({ ...s, status: 'accepted' as const })) };
    })();
    const weekly = (over: Partial<CheckIn>): CheckIn => ({
      id: 'w',
      at: NOW.toISOString(),
      kind: 'weekly',
      ...over,
    });

    it('pain → a recovery week, nothing else', () => {
      const out = weeklySuggestions({
        checkin: weekly({ pain: true, weekFeel: 'easy' }),
        plan,
        sessions: [],
        experiments: [],
        now: NOW,
      });
      expect(out.map((s) => s.kind)).toEqual(['hold']);
    });

    it('a missed, hard week → pause a session; applying it un-keeps one', () => {
      const out = weeklySuggestions({
        checkin: weekly({ weekFeel: 'hard', offAppSessions: 0 }),
        plan,
        sessions: [session([], -2)],
        experiments: [],
        now: NOW,
      });
      expect(out[0]?.kind).toBe('reduce_days');
      const next = applySuggestion(plan, out[0]);
      expect(next.sessions.filter((s) => s.status === 'accepted')).toHaveLength(2);
    });

    it('off-app sessions count toward the week', () => {
      const out = weeklySuggestions({
        checkin: weekly({ weekFeel: 'easy', offAppSessions: 3 }),
        plan,
        sessions: [],
        experiments: [],
        now: NOW,
      });
      expect(out[0]?.kind).toBe('extend_duration');
      expect(out[0]?.to?.value).toBeGreaterThan(out[0]?.from?.value ?? 0);
    });

    it('a normal week proposes nothing', () => {
      const out = weeklySuggestions({
        checkin: weekly({ weekFeel: 'normal', offAppSessions: 3 }),
        plan,
        sessions: [],
        experiments: [],
        now: NOW,
      });
      expect(out).toEqual([]);
    });
  });
});
