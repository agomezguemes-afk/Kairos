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
      const kind: Movement['kind'] = slot % 2 === 0 ? 'steady' : 'interval';
      movements = [
        ...pick(sport, 'endurance', 1, used, [kind]),
        ...pick(sport, 'strength', 1, used, ['strength']),
      ];
      rationale =
        kind === 'steady'
          ? 'Base aeróbica en zona 2: es lo que te permite aguantar el final del partido o de la ruta.'
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
  const sessions = focuses.map((focus, slot) => {
    const sport = goal.sports[slot % goal.sports.length];
    return buildSession(goal, sport, focus, slot, used, id);
  });
  return { id, goal, createdAt: now.toISOString(), sessions };
}
