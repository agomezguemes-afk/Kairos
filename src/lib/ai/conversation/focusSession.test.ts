// KAIROS — Focus-aware sessions: the headline product failure, as tests.
//
// Observed on-device (2026-07): "Entreno de espalda, 40 minutos, full máquinas"
// produced Sentadilla + Press banca + Remo + Press militar — one back movement
// out of four. "Piernas en casa" produced the same four-exercise skeleton. The
// brief's `focus` was dropped on the way to the template builder, so every
// strength request resolved to the same full-body day.
//
// These tests pin the fix at BOTH levels: the pure composer, and the
// deterministic builder that the offline path and the LLM-failure path both run
// through (i.e. what the user actually sees).

import { describe, it, expect, beforeEach } from 'vitest';

import { buildSessionBlockDeterministic } from './blockFromBrief';
import { inferBriefFromText, briefToStarterAnswers } from './brief';
import { buildFocusSessionTemplate } from './focusSession';
import { canonicalizeExerciseName } from './canonicalizeExercises';
import { useWorkoutStore } from '../../../store/workoutStore';
import { getBlockExercises } from '../../../types/core';
import type { ExerciseCard, WorkoutBlock } from '../../../types/core';

// AsyncStorage's web fallback assumes `window` (same stub as the store suite).
(globalThis as { window?: unknown }).window = {
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
};

beforeEach(() => {
  useWorkoutStore.setState({ blocks: [], workoutHistory: [] });
});

// ─── helpers ────────────────────────────────────────────────────────────────

/** Build from raw user text, exactly as the offline/LLM-down path does. */
function sessionFrom(text: string): { block: WorkoutBlock; names: string[] } {
  const result = buildSessionBlockDeterministic(inferBriefFromText(text));
  const block = useWorkoutStore.getState().blocks.find((b) => b.id === result.blockId);
  if (!block) throw new Error('block not committed');
  return { block, names: getBlockExercises(block).map((e) => e.name) };
}

const matches = (names: string[], re: RegExp): boolean => names.some((n) => re.test(n));

const PUSH_LEGS = /sentadilla|press banca|press militar|prensa/i;
const BACK_MOVES = /remo|jal[óo]n|dominad|pull-down|superman|face pull|peso muerto/i;
const LEG_MOVES = /sentadilla|zancada|puente|gl[úu]teo|hip thrust|gemelo|prensa|peso muerto/i;
const UPPER_PRESS = /press banca|press militar|press inclinado|press de hombro/i;

// ─── the two observed failures ──────────────────────────────────────────────

describe('regression — "entreno de espalda, 40 minutos, full máquinas" (gym)', () => {
  const TEXT = 'Entreno de espalda, 40 minutos, full maquinas en el gym';

  it('no longer ships the full-body skeleton (no squat / bench / OHP)', () => {
    const { names } = sessionFrom(TEXT);
    expect(names).not.toContain('Sentadilla con barra');
    expect(names).not.toContain('Press banca');
    expect(names).not.toContain('Press militar');
    expect(matches(names, PUSH_LEGS)).toBe(false);
  });

  it('every exercise trains the back', () => {
    const { names } = sessionFrom(TEXT);
    expect(names.length).toBeGreaterThanOrEqual(3);
    for (const n of names) expect(n).toMatch(BACK_MOVES);
  });

  it('leads with a row and includes a vertical pull', () => {
    const { names } = sessionFrom(TEXT);
    expect(names[0]).toMatch(/remo/i);
    expect(matches(names, /jal[óo]n|dominad|pull-down/i)).toBe(true);
  });

  it('honours the gym: machine/barbell options, no bodyweight fallbacks', () => {
    const { names } = sessionFrom(TEXT);
    expect(names).not.toContain('Remo invertido');
    expect(names).not.toContain('Superman + remo toalla');
  });
});

describe('regression — "piernas en casa"', () => {
  const TEXT = 'hoy piernas en casa';

  it('every exercise trains the legs — no bench, no OHP', () => {
    const { names } = sessionFrom(TEXT);
    expect(names.length).toBeGreaterThanOrEqual(3);
    expect(matches(names, UPPER_PRESS)).toBe(false);
    for (const n of names) expect(n).toMatch(LEG_MOVES);
  });

  it('honours "en casa": bodyweight options only', () => {
    const { names } = sessionFrom(TEXT);
    expect(names).not.toContain('Sentadilla con barra');
    expect(names).not.toContain('Prensa de pierna');
    expect(names).not.toContain('Curl femoral'); // machine-gated → dropped, not faked
    expect(names).toContain('Sentadilla peso corporal');
  });

  it('covers the leg groups instead of repeating one pattern', () => {
    const { names } = sessionFrom(TEXT);
    expect(matches(names, /sentadilla/i)).toBe(true); // knee-dominant
    expect(matches(names, /puente|peso muerto|hip thrust/i)).toBe(true); // hip-dominant
    expect(new Set(names).size).toBe(names.length); // no duplicated movement
  });
});

// ─── the unchanged default ──────────────────────────────────────────────────

describe('no focus / unrecognised focus → the curated template, untouched', () => {
  it('a focus-free strength ask still yields the full-body day A', () => {
    const { names } = sessionFrom('quiero entrenar fuerza en el gym');
    expect(names).toEqual([
      'Sentadilla con barra',
      'Press banca',
      'Remo con barra',
      'Press militar',
    ]);
  });

  it('"cuerpo completo" is not a muscle group → template (no focus composition)', () => {
    const brief = inferBriefFromText('cuerpo completo en el gym');
    expect(brief.focus).toBe('cuerpo completo');
    expect(buildFocusSessionTemplate(brief, briefToStarterAnswers(brief))).toBeNull();
  });

  it('a running brief is never re-composed by muscle group', () => {
    const brief = inferBriefFromText('rodaje suave de 40 min');
    expect(buildFocusSessionTemplate(brief, briefToStarterAnswers(brief))).toBeNull();
    const { names } = sessionFrom('rodaje suave de 40 min');
    expect(matches(names, /rodaje|estiramiento|calentamiento/i)).toBe(true);
  });

  it('a mobility brief keeps its template even when it names a body part', () => {
    const brief = inferBriefFromText('movilidad de espalda 20 min');
    expect(brief.discipline).toBe('mobility');
    expect(buildFocusSessionTemplate(brief, briefToStarterAnswers(brief))).toBeNull();
  });
});

// ─── the rest of the focus vocabulary ───────────────────────────────────────

describe('the focus vocabulary the user actually speaks', () => {
  it.each([
    ['pecho 45 min en el gym', /press|apertura|fondo|flexion/i],
    [
      'hombros en el gym',
      /press militar|press de hombro|elevaciones laterales|p[áa]jaros|face pull|pike/i,
    ],
    ['brazos, bíceps y tríceps, 30 min en el gym', /curl|tr[íi]ceps|press franc[ée]s|fondos/i],
    ['abdominales 20 min', /plancha|hollow|elevaciones de piernas|anti-rotaci[óo]n/i],
  ])('"%s" produces on-focus work only', (text, expected) => {
    const { names } = sessionFrom(text);
    expect(names.length).toBeGreaterThanOrEqual(2);
    for (const n of names) expect(n).toMatch(expected);
  });

  it('"día de empuje" pushes: presses, no rows and no curls', () => {
    const { names } = sessionFrom('día de empuje en el gym');
    expect(matches(names, /press/i)).toBe(true);
    expect(matches(names, /remo|jal[óo]n|dominad|curl de b|curl con|curl mancuernas/i)).toBe(false);
    expect(matches(names, /sentadilla|zancada|gemelo/i)).toBe(false);
  });

  it('"día de tirón" pulls: rows/pull-downs, no bench and no OHP', () => {
    const { names } = sessionFrom('día de tirón en el gym');
    expect(matches(names, /remo|jal[óo]n|dominad|pull-down/i)).toBe(true);
    expect(matches(names, UPPER_PRESS)).toBe(false);
    expect(matches(names, /sentadilla|zancada|gemelo/i)).toBe(false);
  });

  it('"tren superior" covers chest, back and shoulders', () => {
    const { names } = sessionFrom('tren superior en el gym, una hora');
    expect(matches(names, /press banca|press inclinado|apertura|fondo/i)).toBe(true);
    expect(matches(names, /remo|jal[óo]n|dominad/i)).toBe(true);
    expect(matches(names, /press militar|press de hombro|elevaciones laterales/i)).toBe(true);
    expect(matches(names, /sentadilla|zancada|gemelo/i)).toBe(false);
  });
});

// ─── the moat: canonical names + library ids + volume sanity ────────────────

describe('the composed block stays inside the app vocabulary', () => {
  it('every emitted exercise is canonical, with its libraryId attached', () => {
    for (const text of ['espalda en el gym', 'piernas en casa', 'pecho 40 min en el gym']) {
      useWorkoutStore.setState({ blocks: [], workoutHistory: [] });
      const { block } = sessionFrom(text);
      for (const ex of getBlockExercises(block)) {
        const canonical = canonicalizeExerciseName(ex.name);
        expect(ex.name).toBe(canonical.name); // no drift from the vocabulary
        expect(ex.libraryId).toBe(canonical.libraryId); // tier-1 match unlocked
      }
    }
  });

  it('every exercise is doable as-is: at least one set, sets prefilled', () => {
    const { block } = sessionFrom('espalda 40 min en el gym');
    for (const ex of getBlockExercises(block)) {
      expect(ex.sets.length).toBeGreaterThanOrEqual(1);
      expect(ex.rest_seconds).toBeGreaterThan(0);
    }
  });

  it('a calisthenics brief logs reps/holds, not kilos', () => {
    const { block } = sessionFrom('calistenia de espalda en casa con barra de dominadas');
    const cards: ExerciseCard[] = getBlockExercises(block);
    expect(cards.length).toBeGreaterThanOrEqual(2);
    for (const ex of cards) {
      expect(ex.discipline).toBe('calisthenics');
      expect(ex.fields.some((f) => f.id === 'weight')).toBe(false);
    }
    expect(cards.map((c) => c.name)).toContain('Dominadas');
  });
});

describe('duration sanity', () => {
  it('a 40-minute ask lands near 40 minutes, not 90', () => {
    const result = buildSessionBlockDeterministic(
      inferBriefFromText('espalda 40 minutos en el gym'),
    );
    expect(result.durationMin).toBeGreaterThanOrEqual(25);
    expect(result.durationMin).toBeLessThanOrEqual(46);
  });

  it('a 20-minute ask is shorter than a 60-minute one, same focus', () => {
    const short = buildSessionBlockDeterministic(inferBriefFromText('piernas 20 min en el gym'));
    useWorkoutStore.setState({ blocks: [], workoutHistory: [] });
    const long = buildSessionBlockDeterministic(inferBriefFromText('piernas 60 min en el gym'));
    expect(short.exercises.length).toBeLessThan(long.exercises.length);
    expect(short.durationMin).toBeLessThan(long.durationMin);
  });

  it('never exceeds 6 exercises, however long the ask', () => {
    const result = buildSessionBlockDeterministic(
      inferBriefFromText('piernas 3 horas en el gym a tope'),
    );
    expect(result.exercises.length).toBeLessThanOrEqual(6);
  });
});
