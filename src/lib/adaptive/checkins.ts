// Check-ins: 10-second questions that let the engine reason without a
// sensor and even without a logged workout. Two kinds:
//   pre    — before training: sleep and soreness → today's readiness.
//   weekly — once a week: sessions done outside the app, how the week
//            felt, any pain → proposals that don't need a new session.

import { getMovement } from './catalog';
import { loadTrend, roundTo } from './metrics';
import type { Experiment } from './experiments';
import type { PlanDraft, SessionLog, Suggestion } from './types';

export type WeekFeel = 'easy' | 'normal' | 'hard';

export interface CheckIn {
  id: string;
  at: string;
  kind: 'pre' | 'weekly';
  /** 1 (awful) – 5 (great). */
  sleep?: number;
  /** 1 (none) – 5 (very sore). */
  soreness?: number;
  pain?: boolean;
  /** Weekly: sessions trained this week that were not logged in Kairos. */
  offAppSessions?: number;
  weekFeel?: WeekFeel;
}

const DAY_MS = 86_400_000;
const PRE_VALID_MS = 18 * 3_600_000;

export type ReadinessBand = 'go' | 'easy' | 'rest';

export interface Readiness {
  /** 0–100; only meaningful relative to the bands. */
  score: number;
  band: ReadinessBand;
  reasons: string[];
  /** False when nothing recent backs the score: show it as a guess. */
  informed: boolean;
}

export function readiness(
  checkins: CheckIn[],
  sessions: SessionLog[],
  now: Date = new Date(),
): Readiness {
  let score = 80;
  const reasons: string[] = [];
  const pre = [...checkins]
    .filter((c) => c.kind === 'pre' && now.getTime() - new Date(c.at).getTime() <= PRE_VALID_MS)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0];
  const recentPain = checkins.some(
    (c) => c.pain && now.getTime() - new Date(c.at).getTime() <= 3 * DAY_MS,
  );

  if (pre?.sleep !== undefined && pre.sleep <= 2) {
    score -= 25;
    reasons.push('has dormido mal');
  }
  if (pre?.soreness !== undefined && pre.soreness >= 4) {
    score -= 25;
    reasons.push('llegas con agujetas fuertes');
  }
  const trend = loadTrend(sessions, now);
  if (trend.band === 'spike') {
    score -= 20;
    reasons.push('tu carga de 7 días está muy por encima de tu media');
  }
  if (recentPain) {
    score = Math.min(score, 30);
    reasons.push('marcaste dolor hace poco');
  }
  if (pre?.sleep !== undefined && pre.sleep >= 4 && (pre.soreness ?? 1) <= 2 && !recentPain) {
    score += 10;
  }
  score = Math.max(0, Math.min(100, score));
  return {
    score,
    band: score >= 70 ? 'go' : score >= 45 ? 'easy' : 'rest',
    reasons,
    informed: !!pre || trend.band !== 'baseline' || recentPain,
  };
}

export function needsWeeklyCheckIn(checkins: CheckIn[], now: Date = new Date()): boolean {
  const last = checkins
    .filter((c) => c.kind === 'weekly')
    .reduce((t, c) => Math.max(t, new Date(c.at).getTime()), 0);
  return now.getTime() - last >= 6 * DAY_MS;
}

export interface WeeklyInput {
  checkin: CheckIn;
  plan: PlanDraft | null;
  sessions: SessionLog[];
  experiments: Experiment[];
  now?: Date;
}

/**
 * Proposals from the weekly check-in alone. Deliberately conservative:
 * at most one, and never stacked on a movement that is mid-experiment.
 */
export function weeklySuggestions(input: WeeklyInput): Suggestion[] {
  const { checkin, plan, sessions, experiments } = input;
  const now = input.now ?? new Date();
  if (!plan) return [];
  const id = `weekly-${now.toISOString().slice(0, 10)}`;
  const base = { sessionId: id, createdAt: now.toISOString(), status: 'locked' as const };
  const kept = plan.sessions.filter((s) => s.status === 'accepted');
  const logged = sessions.filter(
    (s) => now.getTime() - new Date(s.endedAt).getTime() <= 7 * DAY_MS,
  ).length;
  const done = logged + (checkin.offAppSessions ?? 0);
  const evidence = [
    `${logged} sesiones registradas + ${checkin.offAppSessions ?? 0} fuera de la app esta semana`,
    `${kept.length} sesiones en tu plan`,
  ];

  if (checkin.pain) {
    return [
      {
        ...base,
        id: `${id}:hold`,
        kind: 'hold',
        movementId: '',
        title: 'Semana de recuperación',
        rationale:
          'Marcaste dolor. Esta semana repetimos cargas sin subir nada y priorizamos movilidad. Si el dolor sigue, consulta a un profesional.',
        evidence: ['Revisión semanal: dolor', ...evidence],
        confidence: 'emerging',
        rarity: 'common',
      },
    ];
  }

  // Missing most of the plan for a hard week: the plan is too big, not the
  // person too weak. Offer to pause the last kept session.
  if (kept.length >= 2 && done < kept.length * 0.6 && checkin.weekFeel !== 'easy') {
    const last = [...kept].sort((a, b) => b.slot - a.slot)[0];
    return [
      {
        ...base,
        id: `${id}:reduce_days`,
        kind: 'reduce_days',
        movementId: '',
        draftSessionId: last.id,
        title: `Pausa «${last.title}» unas semanas`,
        from: { label: 'Sesiones', value: kept.length, unit: '/sem' },
        to: { label: 'Sesiones', value: kept.length - 1, unit: '/sem' },
        rationale:
          'Esta semana hiciste menos de lo planeado y no fue fácil. Un plan que puedes cumplir progresa más que uno que no: quitamos una sesión y la recuperas cuando quieras.',
        evidence,
        confidence: 'emerging',
        rarity: 'common',
      },
    ];
  }

  // A full week that felt easy: progress the aerobic work even though no
  // single session triggered it.
  if (done >= kept.length && kept.length > 0 && checkin.weekFeel === 'easy') {
    const busy = new Set(
      experiments
        .filter((e) => e.status === 'running' || e.status === 'review')
        .map((e) => e.movementId),
    );
    for (const ds of kept) {
      for (const pm of ds.movements) {
        const m = getMovement(pm.movementId);
        if (!m || m.kind !== 'steady' || busy.has(m.id) || !pm.target.durationMin) continue;
        const from = pm.target.durationMin;
        const to = Math.max(from + 5, roundTo(from * 1.1, 5));
        return [
          {
            ...base,
            id: `${id}:extend_duration:${m.id}`,
            kind: 'extend_duration',
            movementId: m.id,
            draftSessionId: ds.id,
            title: `Alarga ${m.name.toLowerCase()}`,
            from: { label: 'Duración', value: from, unit: 'min' },
            to: { label: 'Duración', value: to, unit: 'min' },
            patch: { durationMin: to },
            rationale:
              'Cumpliste toda la semana y te pareció fácil. Es el momento de sumar volumen aeróbico, poco a poco.',
            evidence,
            confidence: 'emerging',
            rarity: 'rare',
          },
        ];
      }
    }
  }
  return [];
}
