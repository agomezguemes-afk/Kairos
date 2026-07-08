// src/lib/routines/hybridPreset.ts
//
// L-A · Preset "Atleta Híbrido / Hybrid Race".
//
// A single session that mixes the four measurement kinds a hybrid-race athlete
// juggles today across Notes + spreadsheets, using ONLY the existing dynamic
// fields (BaseFieldId) — no field is authored by hand:
//   · erg      → distance (m) + duration (time)
//   · sled     → weight (kg) + distance (m)
//   · carrera  → distance (m) + pace (min/km)
//   · estación → reps (+ weight)
//
// Trademark note: we never say "HYROX". The user-facing name is
// "Carrera híbrida" / "entrenamiento híbrido".
//
// The generator is pure (no store, no IO) so it is trivially testable and can
// be rendered in the onboarding reveal before anything is persisted.
// `seedHybridPreset` is the thin side-effectful path DEV-U calls to persist.

import type { BaseFieldId, Discipline, FieldDefinition, WorkoutBlock } from '../../types/core';
import { createEmptySet, createExerciseCard, createWorkoutBlock } from '../../types/core';
import type { ContentNode, ExerciseContentNode } from '../../types/content';
import {
  createColumnSectionNode,
  createDividerNode,
  createExerciseNode,
  createTextNode,
} from '../../types/content';

// ======================== ANSWER CONTRACT ========================

/**
 * The slice of onboarding answers the preset reads. Structurally satisfied by
 * `UserProfile` (src/types/profile.ts) — DEV-U can pass the profile directly.
 */
export interface StarterAnswers {
  disciplines: Discipline[];
  /** Sessions/week the user committed to. Drives the seeded week. */
  weeklyFrequency?: number | null;
  displayName?: string | null;
}

/** One seeded day of the week. `weekday` is 0=Mon … 6=Sun. */
export interface WeekAssignment {
  blockId: string;
  weekday: number;
  label: string;
}

/** What the onboarding reveal renders and what seeding persists. */
export interface OnboardingSpaceResult {
  blocks: WorkoutBlock[];
  weekAssignments: WeekAssignment[];
}

// ======================== HYBRID DETECTION ========================

// A hybrid athlete trains a "load" domain and an "engine" domain in the same
// life — the sled + the erg, the barbell + the run. Detecting that overlap is
// what triggers the preset.
const LOAD_DISCIPLINES: ReadonlySet<Discipline> = new Set(['strength', 'calisthenics']);
const ENGINE_DISCIPLINES: ReadonlySet<Discipline> = new Set(['running', 'cycling', 'swimming']);

/**
 * True when the answers describe a hybrid / multi-discipline athlete: either an
 * explicit load+engine combo, or ≥3 distinct disciplines (a generalist who is
 * de-facto hybrid). Single-discipline profiles return false.
 */
export function isHybridProfile(answers: StarterAnswers): boolean {
  const distinct = Array.from(new Set(answers.disciplines));
  if (distinct.length < 2) return false;
  const hasLoad = distinct.some((d) => LOAD_DISCIPLINES.has(d));
  const hasEngine = distinct.some((d) => ENGINE_DISCIPLINES.has(d));
  if (hasLoad && hasEngine) return true;
  // Three or more disciplines is multi-discipline regardless of the exact mix.
  return distinct.length >= 3;
}

// ======================== FIELD HELPERS ========================

interface FieldSpec {
  id: BaseFieldId;
  name: string;
  unit: string | null;
  step?: number;
  min?: number;
  max?: number;
}

// Canonical hybrid metrics, all drawn from the existing BaseFieldId set.
const F = {
  distance: (unit: 'm' | 'km', step: number): FieldSpec => ({
    id: 'distance',
    name: 'Distancia',
    unit,
    step,
    min: 0,
  }),
  duration: (unit: 'sec' | 'min', step: number): FieldSpec => ({
    id: 'duration',
    name: 'Tiempo',
    unit,
    step,
    min: 0,
  }),
  weight: (): FieldSpec => ({ id: 'weight', name: 'Peso', unit: 'kg', step: 2.5, min: 0 }),
  pace: (): FieldSpec => ({ id: 'pace', name: 'Ritmo', unit: 'min/km', step: 0.05, min: 0 }),
  reps: (): FieldSpec => ({ id: 'reps', name: 'Reps', unit: null, step: 1, min: 0 }),
  effort: (): FieldSpec => ({
    id: 'perceivedEffort',
    name: 'Esfuerzo',
    unit: '/10',
    step: 1,
    min: 1,
    max: 10,
  }),
} as const;

function toFields(specs: FieldSpec[]): FieldDefinition[] {
  return specs.map(
    (s, i): FieldDefinition => ({
      id: s.id,
      name: s.name,
      type: 'number',
      unit: s.unit,
      isBase: true,
      isPrimary: i === 0,
      order: i,
      step: s.step,
      min: s.min,
      max: s.max,
    }),
  );
}

// ======================== STATION MODEL ========================

interface StationSpec {
  name: string;
  discipline: Discipline;
  fields: FieldSpec[];
}

// The full race, station by station. Field mix is intentional so the session
// spans distance + time + weight + pace + reps.
const RACE_STATIONS: StationSpec[] = [
  {
    name: 'Carrera · 1 km',
    discipline: 'running',
    fields: [F.distance('m', 100), F.pace(), F.duration('sec', 5)],
  },
  { name: 'SkiErg', discipline: 'general', fields: [F.distance('m', 50), F.duration('sec', 5)] },
  {
    name: 'Trineo · empuje (sled push)',
    discipline: 'strength',
    fields: [F.weight(), F.distance('m', 5)],
  },
  {
    name: 'Trineo · arrastre (sled pull)',
    discipline: 'strength',
    fields: [F.weight(), F.distance('m', 5)],
  },
  {
    name: 'Burpee broad jumps',
    discipline: 'calisthenics',
    fields: [F.reps(), F.distance('m', 5)],
  },
  {
    name: 'Remo (row erg)',
    discipline: 'general',
    fields: [F.distance('m', 50), F.duration('sec', 5)],
  },
  {
    name: 'Zancadas cargadas (carry)',
    discipline: 'strength',
    fields: [F.weight(), F.distance('m', 5)],
  },
  { name: 'Wall balls (lanzamientos)', discipline: 'calisthenics', fields: [F.reps(), F.weight()] },
];

// The two sled movements are complementary — they render side by side to model
// the "compra/empuja" pairing and to show off the 2-column layout primitive.
const SLED_PAIR_INDEXES: readonly [number, number] = [2, 3];

// ======================== BLOCK BUILDER (pure) ========================

function stationCard(blockId: string, order: number, s: StationSpec) {
  const card = createExerciseCard(blockId, order, s.discipline, {
    name: s.name,
    fields: toFields(s.fields),
  });
  // Hybrid stations are for-time single efforts, not 4×sets of hypertrophy.
  return { ...card, sets: [createEmptySet(card.id, 0, card.fields)], default_sets_count: 1 };
}

/**
 * Build the hybrid-race block off-store. Deterministic in structure (ids are
 * fresh each call). Uses text headers + a divider-delimited circuit + one
 * 2-column section for the sled pair.
 */
export function buildHybridRaceBlock(answers?: StarterAnswers): WorkoutBlock {
  const block = createWorkoutBlock('user_001', 0, 'general', {
    name: 'Carrera híbrida',
    description: 'Sesión mixta: erg, trineo, carrera y estaciones en un solo bloque.',
  });

  const content: ContentNode[] = [];
  let order = 0;
  const push = (node: ContentNode) => {
    content.push({ ...node, order: order++ } as ContentNode);
  };

  const name = answers?.displayName?.trim();
  push(createTextNode(0, 'h2', 'Carrera híbrida'));
  push(
    createTextNode(
      0,
      'paragraph',
      name
        ? `${name}, esta sesión mezcla metros de erg, kilos de trineo, ritmo de carrera y reps de estación — todo en un bloque.`
        : 'Una sesión que mezcla metros de erg, kilos de trineo, ritmo de carrera y reps de estación — todo en un bloque.',
    ),
  );
  push(createDividerNode(0));
  push(createTextNode(0, 'h3', 'Calentamiento'));
  push(
    createExerciseNode(
      0,
      stationCard(block.id, 0, {
        name: 'Movilidad + trote suave',
        discipline: 'mobility',
        fields: [F.duration('min', 1), F.effort()],
      }),
    ),
  );
  push(createDividerNode(0));
  push(createTextNode(0, 'h3', 'Circuito de carrera'));

  // Stations — the sled pair is wrapped in a 2-column section.
  const section = createColumnSectionNode(0, 2);
  const [pairA, pairB] = SLED_PAIR_INDEXES;
  RACE_STATIONS.forEach((s, i) => {
    if (i === pairA) {
      push(section);
      const a = createExerciseNode(0, stationCard(block.id, 0, s)) as ExerciseContentNode;
      push({ ...a, section: section.id, column: 0 });
      const bSpec = RACE_STATIONS[pairB];
      const b = createExerciseNode(0, stationCard(block.id, 0, bSpec)) as ExerciseContentNode;
      push({ ...b, section: section.id, column: 1 });
      return;
    }
    if (i === pairB) return; // already emitted inside the section
    push(createExerciseNode(0, stationCard(block.id, 0, s)));
  });

  push(createDividerNode(0));
  push(createTextNode(0, 'h3', 'Vuelta a la calma'));
  push(
    createExerciseNode(
      0,
      stationCard(block.id, 0, {
        name: 'Estiramientos',
        discipline: 'mobility',
        fields: [F.duration('min', 1), F.effort()],
      }),
    ),
  );

  return { ...block, content, is_favorite: true, status: 'draft' };
}

// ======================== WEEK DISTRIBUTION ========================

const WEEKDAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/**
 * Spread N sessions across the week as evenly as possible, starting Monday.
 * Returns strictly increasing weekday indices (0=Mon). Frequency is clamped to
 * [1, 7]; a missing/invalid frequency defaults to 3.
 */
export function distributeAcrossWeek(frequency?: number | null): number[] {
  const n = Math.max(1, Math.min(7, Math.round(frequency ?? 3) || 3));
  const days: number[] = [];
  for (let i = 0; i < n; i++) days.push(Math.floor((i * 7) / n));
  return days;
}

// ======================== PUBLIC API ========================

/**
 * Pure generator — the contract DEV-U consumes. Returns the hybrid block plus
 * the seeded week (one recurring session per declared training day). No IO.
 */
export function generateHybridPreset(answers: StarterAnswers): OnboardingSpaceResult {
  const block = buildHybridRaceBlock(answers);
  const weekAssignments: WeekAssignment[] = distributeAcrossWeek(answers.weeklyFrequency).map(
    (weekday) => ({ blockId: block.id, weekday, label: WEEKDAY_LABELS[weekday] }),
  );
  return { blocks: [block], weekAssignments };
}
