// Turns a ParsedGoal into a *draft*: proposed sessions the user accepts or
// rejects one by one. Nothing here is binding — it is a starting sketch.

import { findMovements, getMovement } from './catalog';
import { QUALITY_LABEL, SPORT_LABEL } from './goalParser';
import type {
  DraftSession,
  Movement,
  MovementTarget,
  ParsedGoal,
  PlanDraft,
  PlannedMovement,
  Quality,
  Sport,
} from './types';

const WARMUP_MIN = 8;

const ENDURANCE_WHY: Record<Sport, string> = {
  padel: 'es lo que te deja llegar entero al tercer set.',
  tennis: 'es lo que te deja llegar entero al tercer set.',
  climbing: 'acelera la recuperación entre vías y bloques.',
  hiking: 'es lo que te permite aguantar la última subida de la ruta.',
  running: 'es la base sobre la que se construye cualquier ritmo.',
  cycling: 'es la base sobre la que se construye cualquier ritmo.',
  football: 'es lo que te mantiene presente en los últimos minutos del partido.',
  basketball: 'es lo que te mantiene presente en los últimos minutos del partido.',
  swimming: 'mejora la eficiencia y te deja nadar más con menos esfuerzo.',
  strength: 'mejora la recuperación entre series y sesiones.',
  general: 'mejora tu capacidad de recuperarte de cualquier esfuerzo.',
};

export function estimateMovementMinutes(m: Movement, t: MovementTarget): number {
  switch (m.kind) {
    case 'strength':
      return (t.sets ?? 3) * 3;
    case 'interval': {
      const iv = t.intervals;
      if (!iv) return 15;
      const blocks = t.sets ?? 1;
      return Math.round((iv.reps * (iv.workSec + iv.restSec) * blocks) / 60) + (blocks > 1 ? 3 : 0);
    }
    case 'steady':
    case 'mobility':
    case 'skill':
      return t.durationMin ?? 20;
  }
}

/** Order the week so the same quality never lands on consecutive slots when avoidable. */
export function distributeFocus(qualities: Quality[], days: number): Quality[] {
  // Mobility rarely deserves a full session of its own unless asked alone.
  const main = qualities.filter((q) => q !== 'mobility');
  const pool = main.length ? main : qualities;
  const out: Quality[] = [];
  for (let i = 0; i < days; i++) out.push(pool[i % pool.length]);
  return out;
}

function pick(
  sport: Sport,
  quality: Quality,
  count: number,
  used: Set<string>,
  kinds?: Movement['kind'][],
): Movement[] {
  const candidates = findMovements(sport, quality).filter((m) => !kinds || kinds.includes(m.kind));
  const fresh = candidates.filter((m) => !used.has(m.id));
  // Fall back to repeats rather than return an empty session.
  const chosen = [...fresh, ...candidates.filter((m) => used.has(m.id))].slice(0, count);
  chosen.forEach((m) => used.add(m.id));
  return chosen;
}

function plan(m: Movement): PlannedMovement {
  return { movementId: m.id, target: { ...m.defaults } };
}

function buildSession(
  goal: ParsedGoal,
  sport: Sport,
  focus: Quality,
  slot: number,
  /** How many sessions with this same focus came before this one. */
  ordinal: number,
  used: Set<string>,
  idPrefix: string,
): DraftSession {
  let movements: Movement[] = [];
  let rationale = '';

  switch (focus) {
    case 'strength':
      movements = pick(sport, 'strength', 3, used, ['strength']);
      rationale = `Fuerza específica para ${SPORT_LABEL[sport].toLowerCase()}: pocas repeticiones, cerca del fallo pero sin llegar.`;
      break;
    case 'endurance': {
      // Alternate steady and interval days so aerobic base and tolerance both grow.
      // Alternate by endurance-session count, not weekday, so even a
      // 3-day week with two endurance days gets one of each.
      const kind: Movement['kind'] = ordinal % 2 === 0 ? 'steady' : 'interval';
      movements = [
        ...pick(sport, 'endurance', 1, used, [kind]),
        ...pick(sport, 'strength', 1, used, ['strength']),
      ];
      rationale =
        kind === 'steady'
          ? `Base aeróbica en zona 2: ${ENDURANCE_WHY[sport]}`
          : 'Intervalos para tolerar esfuerzos altos repetidos y recuperar más rápido entre ellos.';
      break;
    }
    case 'speed':
    case 'power':
      movements = [
        ...pick(sport, focus, 2, used),
        ...pick(sport, 'strength', 1, used, ['strength']),
      ];
      rationale = `${QUALITY_LABEL[focus]}: esfuerzos cortos y de calidad, con descanso completo.`;
      break;
    case 'mobility':
    case 'technique':
      movements = pick(sport, focus === 'technique' ? 'endurance' : 'mobility', 2, used);
      rationale = 'Sesión ligera para moverte mejor y llegar fresco a la siguiente.';
      break;
  }

  // Short mobility finisher when the user asked for mobility or it's a strength day.
  if (goal.qualities.includes('mobility') || focus === 'strength') {
    const mob = pick(sport, 'mobility', 1, used, ['mobility']);
    movements.push(...mob);
  }

  const planned = movements.map(plan);
  const durationMin =
    WARMUP_MIN +
    planned.reduce((sum, p) => {
      const m = getMovement(p.movementId);
      return m ? sum + estimateMovementMinutes(m, p.target) : sum;
    }, 0);

  return {
    id: `${idPrefix}-s${slot}`,
    title: `${QUALITY_LABEL[focus]} · ${SPORT_LABEL[sport]}`,
    focus,
    sport,
    slot,
    durationMin,
    movements: planned,
    rationale,
    status: 'pending',
  };
}

export function draftPlan(goal: ParsedGoal, now: Date = new Date()): PlanDraft {
  const id = `plan-${now.getTime().toString(36)}`;
  const focuses = distributeFocus(goal.qualities, goal.daysPerWeek);
  const used = new Set<string>();
  const seen: Partial<Record<Quality, number>> = {};
  const sessions = focuses.map((focus, slot) => {
    const sport = goal.sports[slot % goal.sports.length];
    const ordinal = seen[focus] ?? 0;
    seen[focus] = ordinal + 1;
    return buildSession(goal, sport, focus, slot, ordinal, used, id);
  });
  return { id, goal, createdAt: now.toISOString(), sessions };
}
