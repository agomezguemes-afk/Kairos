import { describe, it, expect } from 'vitest';
import {
  applySuggestion,
  calibratePlan,
  draftPlan,
  edwardsTrimp,
  estimateOneRepMax,
  fatigueSignals,
  generateSuggestions,
  getMovement,
  hrZone,
  loadTrend,
  parseGoal,
  sessionLoad,
  theilSenSlope,
  type MovementLog,
  type SessionLog,
} from './index';

const NOW = new Date('2026-11-08T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

function session(over: Partial<SessionLog> & { movements: MovementLog[] }, ago = 0): SessionLog {
  return {
    id: `s-${ago}-${Math.random().toString(36).slice(2, 6)}`,
    title: 'Fuerza · Escalada',
    sport: 'climbing',
    startedAt: daysAgo(ago),
    endedAt: daysAgo(ago),
    durationMin: 60,
    rpe: 7,
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

describe('parseGoal', () => {
  it('understands sport + quality in Spanish with accents', () => {
    const g = parseGoal('Quiero mejorar al pádel en resistencia');
    expect(g.sports).toEqual(['padel']);
    expect(g.qualities).toEqual(['endurance']);
    expect(g.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('handles multiple sports and frequency words', () => {
    const g = parseGoal('quiero ganar fuerza para escalada o hiking, tres días a la semana');
    expect(g.sports).toEqual(['climbing', 'hiking']);
    expect(g.qualities).toContain('strength');
    expect(g.daysPerWeek).toBe(3);
  });

  it('parses digits, horizon in months and clamps days', () => {
    const g = parseGoal('Correr un 10k en 3 meses, 9 días por semana');
    expect(g.sports).toEqual(['running']);
    expect(g.horizonWeeks).toBe(13);
    expect(g.daysPerWeek).toBe(7);
  });

  it('falls back to sport defaults when no quality is given', () => {
    const g = parseGoal('quiero jugar mejor al fútbol');
    expect(g.sports).toEqual(['football']);
    expect(g.qualities).toEqual(['endurance', 'speed']);
    expect(g.confidence).toBeLessThan(0.7);
  });

  it('keeps confidence low on vague input', () => {
    const g = parseGoal('quiero estar mejor');
    expect(g.sports).toEqual(['general']);
    expect(g.confidence).toBeLessThan(0.4);
  });

  it('survives empty input', () => {
    const g = parseGoal('   ');
    expect(g.sports).toEqual(['general']);
    expect(g.qualities.length).toBeGreaterThan(0);
  });
});

describe('draftPlan', () => {
  it('creates one pending session per training day with real movements', () => {
    const plan = draftPlan(parseGoal('fuerza para escalada 4 días'), NOW);
    expect(plan.sessions).toHaveLength(4);
    for (const s of plan.sessions) {
      expect(s.status).toBe('pending');
      expect(s.movements.length).toBeGreaterThan(0);
      expect(s.durationMin).toBeGreaterThan(8);
      for (const pm of s.movements) expect(getMovement(pm.movementId)).toBeDefined();
    }
  });

  it('prefers sport-specific movements', () => {
    const plan = draftPlan(parseGoal('fuerza para escalada'), NOW);
    const ids = plan.sessions.flatMap((s) => s.movements.map((m) => m.movementId));
    expect(ids.some((id) => ['max_hang', 'pull_up'].includes(id))).toBe(true);
  });

  it('alternates sports for multi-sport goals', () => {
    const plan = draftPlan(parseGoal('resistencia para padel y running 4 dias'), NOW);
    expect(plan.sessions.map((s) => s.sport)).toEqual(['padel', 'running', 'padel', 'running']);
  });
});

describe('metrics', () => {
  it('computes session-RPE and clamps effort', () => {
    expect(sessionLoad({ rpe: 7, durationMin: 60 })).toBe(420);
    expect(sessionLoad({ rpe: 14, durationMin: 10 })).toBe(100);
  });

  it('maps HR to zones and TRIMP', () => {
    expect(hrZone(100, 190)).toBe(1);
    expect(hrZone(130, 190)).toBe(2);
    expect(hrZone(180, 190)).toBe(5);
    expect(edwardsTrimp([600, 600, 0, 0, 0])).toBe(30);
  });

  it('refuses e1RM above 10 reps', () => {
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(116.7, 1);
    expect(estimateOneRepMax(100, 1)).toBe(100);
    expect(estimateOneRepMax(60, 15)).toBeNull();
  });

  it('Theil–Sen ignores a single outlier', () => {
    expect(theilSenSlope([100, 101, 102, 40, 104])).toBeCloseTo(1, 0);
    expect(theilSenSlope([5])).toBe(0);
  });

  it('reports baseline until two weeks of history exist', () => {
    const logs = [session({ movements: [] }, 1), session({ movements: [] }, 5)];
    expect(loadTrend(logs, NOW).band).toBe('baseline');
  });

  it('flags a spike against the personal norm', () => {
    const logs: SessionLog[] = [];
    for (let d = 27; d >= 8; d -= 3)
      logs.push(session({ movements: [], rpe: 5, durationMin: 40 }, d));
    for (let d = 6; d >= 0; d--) logs.push(session({ movements: [], rpe: 9, durationMin: 90 }, d));
    expect(loadTrend(logs, NOW).band).toBe('spike');
  });
});

describe('generateSuggestions — strength', () => {
  it('suggests more load when every set hit the top with margin (double progression)', () => {
    const s = session({ movements: [squat([8, 8, 8], 60)] });
    const out = generateSuggestions({ session: s, history: [], now: NOW });
    expect(out[0].kind).toBe('increase_load');
    expect(out[0].from?.value).toBe(60);
    expect(out[0].to?.value).toBe(62.5);
    expect(out[0].status).toBe('locked');
    expect(out[0].confidence).toBe('early');
  });

  it('does not progress when reps fell short or RIR was gone', () => {
    const short = session({ movements: [squat([8, 7, 6], 60)] });
    expect(generateSuggestions({ session: short, history: [], now: NOW })).toHaveLength(0);
    const grinding = session({ movements: [squat([8, 8, 8], 60, 0)] });
    expect(generateSuggestions({ session: grinding, history: [], now: NOW })).toHaveLength(0);
  });

  it('marks a progression that beats the best e1RM as rare', () => {
    const history = [session({ movements: [squat([7, 7, 6], 60)] }, 4)];
    const s = session({ movements: [squat([8, 8, 8], 60)] });
    const out = generateSuggestions({ session: s, history, now: NOW });
    expect(out[0].kind).toBe('increase_load');
    expect(out[0].rarity).toBe('rare');
  });

  it('deloads after two sessions under the rep floor', () => {
    const history = [session({ movements: [squat([6, 5, 5], 80)] }, 3)];
    const s = session({ movements: [squat([6, 5, 4], 80)] });
    const out = generateSuggestions({ session: s, history, now: NOW });
    expect(out[0].kind).toBe('deload');
    expect(out[0].to?.value).toBe(72.5);
  });

  it('proposes a variation on a flat e1RM plateau', () => {
    const history = [9, 6, 3].map((d) => session({ movements: [squat([7, 7, 7], 70)] }, d));
    const s = session({ movements: [squat([7, 7, 7], 70)] });
    const out = generateSuggestions({ session: s, history, now: NOW });
    const swap = out.find((x) => x.kind === 'new_movement');
    expect(swap?.replacementMovementId).toBeDefined();
    expect(swap?.rarity).toBe('epic');
    expect(swap?.confidence).toBe('solid');
  });
});

describe('generateSuggestions — endurance', () => {
  const easyRun = (minutes: number): MovementLog => ({
    movementId: 'easy_run',
    target: { durationMin: minutes, zone: 2 },
    sets: [{ durationSec: minutes * 60, completed: true }],
  });

  it('needs two comfortable sessions before extending', () => {
    const one = session({ sport: 'running', title: 'Z2', rpe: 5, movements: [easyRun(30)] });
    expect(generateSuggestions({ session: one, history: [], now: NOW })).toHaveLength(0);
    const history = [
      session({ sport: 'running', title: 'Z2', rpe: 5, movements: [easyRun(30)] }, 3),
    ];
    const out = generateSuggestions({ session: one, history, now: NOW });
    expect(out[0].kind).toBe('extend_duration');
    expect(out[0].to?.value).toBe(35);
  });

  it('adds one interval when all were completed under control', () => {
    const iv: MovementLog = {
      movementId: 'court_intervals',
      target: { intervals: { reps: 10, workSec: 30, restSec: 30 } },
      sets: Array.from({ length: 10 }, () => ({ durationSec: 30, completed: true })),
    };
    const history = [session({ sport: 'padel', title: 'P', rpe: 7, movements: [iv] }, 2)];
    const s = session({ sport: 'padel', title: 'P', rpe: 6, movements: [iv] });
    const out = generateSuggestions({ session: s, history, now: NOW });
    expect(out[0].kind).toBe('add_interval');
    expect(out[0].patch?.intervals?.reps).toBe(11);
  });
});

describe('recovery guard', () => {
  it('ignores a single fatigue signal', () => {
    const history = [3, 6].map((d) => session({ rpe: 5, movements: [] }, d));
    const s = session({ rpe: 8, movements: [squat([8, 8, 8], 60)] });
    const sig = fatigueSignals(s, history, NOW);
    expect(sig.count).toBe(1);
    expect(generateSuggestions({ session: s, history, now: NOW })[0].kind).toBe('increase_load');
  });

  it('holds progression when RPE and HR drift agree', () => {
    const history = [3, 6].map((d) =>
      session({ rpe: 5, movements: [], sensors: { hrAvg: 130, sources: ['sim'] } }, d),
    );
    const s = session({
      rpe: 8,
      movements: [squat([8, 8, 8], 60)],
      sensors: { hrAvg: 150, sources: ['sim'] },
    });
    const out = generateSuggestions({ session: s, history, now: NOW });
    expect(out[0].kind).toBe('hold');
    expect(out.some((x) => x.kind === 'increase_load')).toBe(false);
  });
});

describe('quality gap', () => {
  it('unlocks a movement for a goal quality not trained in 14 days', () => {
    const goal = parseGoal('pádel: resistencia y potencia');
    const intervals: MovementLog = {
      movementId: 'court_intervals',
      target: { intervals: { reps: 10, workSec: 30, restSec: 30 } },
      sets: [{ completed: false }],
    };
    const history = [6, 3].map((d) =>
      session({ sport: 'padel', title: 'P', movements: [intervals] }, d),
    );
    const s = session({ sport: 'padel', title: 'P', movements: [intervals] });
    const out = generateSuggestions({ session: s, history, goal, now: NOW });
    const gap = out.find((x) => x.kind === 'new_movement');
    expect(gap).toBeDefined();
    expect(getMovement(gap!.movementId)?.qualities).toContain('power');
  });
});

describe('plan mutation', () => {
  it('calibrates unknown loads and applies accepted suggestions immutably', () => {
    const plan = draftPlan(parseGoal('fuerza para montaña'), NOW);
    const ds = plan.sessions.find((x) => x.movements.some((m) => m.movementId === 'back_squat'))!;
    expect(ds).toBeDefined();
    const s = session({ draftSessionId: ds.id, movements: [squat([8, 8, 8], 60)] });

    const calibrated = calibratePlan(plan, s);
    const target = () =>
      calibrated.sessions
        .find((x) => x.id === ds.id)!
        .movements.find((m) => m.movementId === 'back_squat')!.target;
    expect(target().loadKg).toBe(60);
    expect(plan.sessions.find((x) => x.id === ds.id)!.movements[0].target.loadKg).toBeNull();

    const [sug] = generateSuggestions({ session: s, history: [], now: NOW });
    const next = applySuggestion(calibrated, sug);
    const applied = next.sessions
      .find((x) => x.id === ds.id)!
      .movements.find((m) => m.movementId === 'back_squat')!;
    expect(applied.target.loadKg).toBe(62.5);

    const overridden = applySuggestion(calibrated, sug, { loadKg: 61 });
    expect(
      overridden.sessions
        .find((x) => x.id === ds.id)!
        .movements.find((m) => m.movementId === 'back_squat')!.target.loadKg,
    ).toBe(61);
  });
});
