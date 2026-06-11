// Curated starter templates — the offline/no-API path of Kai's generative
// onboarding. Pure module: builds fully-formed WorkoutBlock[] from the
// onboarding answers without touching the store, so it is unit-testable in
// node and reusable as the fallback when the LLM path fails or times out.

import type {
  Discipline,
  ExerciseCard,
  ExerciseSet,
  FieldValue,
  WorkoutBlock,
} from '../../types/core';
import { createEmptySet, createExerciseCard, createWorkoutBlock } from '../../types/core';
import { createExerciseNode } from '../../types/content';
import type { EquipmentTag, FitnessLevel } from '../../types/profile';

// ======================== PUBLIC TYPES ========================

export type StarterDiscipline =
  | 'strength'
  | 'running'
  | 'calisthenics'
  | 'yoga_mobility'
  | 'team_sport'
  | 'hybrid';

export interface StarterAnswers {
  discipline: StarterDiscipline;
  level: FitnessLevel;
  /** Planned sessions per week (1–7). ≥4 unlocks the A/B split where the discipline supports it. */
  frequency: number;
  equipment: EquipmentTag[];
}

export const STARTER_DISCIPLINES: {
  id: StarterDiscipline;
  label: string;
  icon: string;
  coreDiscipline: Discipline;
}[] = [
  { id: 'strength', label: 'Fuerza', icon: 'barbell', coreDiscipline: 'strength' },
  { id: 'running', label: 'Running', icon: 'running', coreDiscipline: 'running' },
  { id: 'calisthenics', label: 'Calistenia', icon: 'calisthenics', coreDiscipline: 'calisthenics' },
  { id: 'yoga_mobility', label: 'Yoga / Movilidad', icon: 'mat', coreDiscipline: 'mobility' },
  {
    id: 'team_sport',
    label: 'Deporte de equipo',
    icon: 'team_sport',
    coreDiscipline: 'team_sport',
  },
  { id: 'hybrid', label: 'Híbrido', icon: 'zap', coreDiscipline: 'general' },
];

// ======================== INTERNAL TEMPLATE MODEL ========================

type PerLevel<T> = Record<FitnessLevel, T>;

interface ExerciseOption {
  name: string;
  /** Include this option only when the user has at least one of these tags. Omit = always available. */
  needsAny?: EquipmentTag[];
}

interface ExerciseSlot {
  /** Ordered by preference — first satisfiable option wins. Last option must be ungated. */
  options: ExerciseOption[];
  /** Card discipline drives the field set (weight/reps vs distance vs duration). */
  cardDiscipline: Discipline;
  sets: PerLevel<number>;
  rest: PerLevel<number>;
  /** Prefills for each set, applied to the card's matching field ids. */
  reps?: PerLevel<number>;
  /** Minutes for duration-primary cards (mobility/team_sport/general), seconds for calisthenics holds. */
  duration?: PerLevel<number>;
  distanceKm?: PerLevel<number>;
  notes?: string;
}

interface BlockTemplate {
  name: string;
  description: string;
  slots: ExerciseSlot[];
}

interface DisciplineTemplate {
  /** Single-session plan (always present). */
  dayA: BlockTemplate;
  /** Optional second session used at frequency ≥ 4. */
  dayB?: BlockTemplate;
}

const lv = <T>(beginner: T, intermediate: T, advanced: T): PerLevel<T> => ({
  beginner,
  intermediate,
  advanced,
});

// ======================== TEMPLATES ========================

const STRENGTH: DisciplineTemplate = {
  dayA: {
    name: 'Fuerza · Día A',
    description: 'Empuje + pierna. Básicos primero, accesorios después.',
    slots: [
      {
        options: [
          { name: 'Sentadilla con barra', needsAny: ['barbell_plates'] },
          { name: 'Sentadilla goblet', needsAny: ['dumbbells', 'kettlebell'] },
          { name: 'Prensa de pierna', needsAny: ['machines_full_gym'] },
          { name: 'Sentadilla peso corporal' },
        ],
        cardDiscipline: 'strength',
        sets: lv(3, 4, 5),
        reps: lv(8, 6, 5),
        rest: lv(120, 150, 180),
      },
      {
        options: [
          { name: 'Press banca', needsAny: ['barbell_plates'] },
          { name: 'Press banca mancuernas', needsAny: ['dumbbells'] },
          { name: 'Press en máquina', needsAny: ['machines_full_gym'] },
          { name: 'Flexiones' },
        ],
        cardDiscipline: 'strength',
        sets: lv(3, 4, 5),
        reps: lv(8, 6, 5),
        rest: lv(120, 150, 180),
      },
      {
        options: [
          { name: 'Remo con barra', needsAny: ['barbell_plates'] },
          { name: 'Remo con mancuerna', needsAny: ['dumbbells', 'kettlebell'] },
          { name: 'Remo en polea', needsAny: ['machines_full_gym'] },
          { name: 'Remo con banda', needsAny: ['resistance_bands'] },
          { name: 'Remo invertido' },
        ],
        cardDiscipline: 'strength',
        sets: lv(3, 3, 4),
        reps: lv(10, 8, 8),
        rest: lv(90, 120, 120),
      },
      {
        options: [
          { name: 'Press militar', needsAny: ['barbell_plates', 'dumbbells'] },
          { name: 'Press de hombro en máquina', needsAny: ['machines_full_gym'] },
          { name: 'Pike push-ups' },
        ],
        cardDiscipline: 'strength',
        sets: lv(3, 3, 4),
        reps: lv(10, 8, 8),
        rest: lv(90, 90, 120),
      },
    ],
  },
  dayB: {
    name: 'Fuerza · Día B',
    description: 'Cadena posterior + tracción.',
    slots: [
      {
        options: [
          { name: 'Peso muerto', needsAny: ['barbell_plates'] },
          { name: 'Peso muerto rumano con mancuernas', needsAny: ['dumbbells', 'kettlebell'] },
          { name: 'Puente de glúteo' },
        ],
        cardDiscipline: 'strength',
        sets: lv(3, 4, 5),
        reps: lv(8, 6, 5),
        rest: lv(150, 180, 180),
      },
      {
        options: [
          { name: 'Dominadas', needsAny: ['pull_up_bar'] },
          { name: 'Jalón al pecho', needsAny: ['machines_full_gym'] },
          { name: 'Pull-down con banda', needsAny: ['resistance_bands'] },
          { name: 'Superman + remo toalla' },
        ],
        cardDiscipline: 'strength',
        sets: lv(3, 4, 4),
        reps: lv(6, 8, 8),
        rest: lv(120, 120, 150),
      },
      {
        options: [
          { name: 'Zancadas con mancuernas', needsAny: ['dumbbells', 'kettlebell'] },
          { name: 'Zancadas' },
        ],
        cardDiscipline: 'strength',
        sets: lv(3, 3, 4),
        reps: lv(10, 10, 12),
        rest: lv(90, 90, 120),
      },
      {
        options: [
          { name: 'Curl de bíceps', needsAny: ['dumbbells', 'barbell_plates', 'resistance_bands'] },
          { name: 'Fondos de tríceps en banco' },
        ],
        cardDiscipline: 'strength',
        sets: lv(2, 3, 3),
        reps: lv(12, 10, 10),
        rest: lv(60, 60, 90),
      },
    ],
  },
};

const RUNNING: DisciplineTemplate = {
  dayA: {
    name: 'Running · Rodaje base',
    description: 'Volumen aeróbico cómodo: debes poder hablar mientras corres.',
    slots: [
      {
        options: [{ name: 'Calentamiento + movilidad' }],
        cardDiscipline: 'mobility',
        sets: lv(1, 1, 1),
        duration: lv(8, 10, 10),
        rest: lv(0, 0, 0),
      },
      {
        options: [{ name: 'Rodaje continuo' }],
        cardDiscipline: 'running',
        sets: lv(1, 1, 1),
        distanceKm: lv(3, 5, 8),
        rest: lv(0, 0, 0),
      },
      {
        options: [{ name: 'Estiramientos suaves' }],
        cardDiscipline: 'mobility',
        sets: lv(1, 1, 1),
        duration: lv(5, 8, 10),
        rest: lv(0, 0, 0),
      },
    ],
  },
  dayB: {
    name: 'Running · Series',
    description: 'Sesión de calidad: intervalos con recuperación al trote.',
    slots: [
      {
        options: [{ name: 'Calentamiento progresivo' }],
        cardDiscipline: 'running',
        sets: lv(1, 1, 1),
        distanceKm: lv(1.5, 2, 2),
        rest: lv(0, 0, 0),
      },
      {
        options: [{ name: 'Intervalos 400 m' }],
        cardDiscipline: 'running',
        sets: lv(4, 6, 8),
        distanceKm: lv(0.4, 0.4, 0.4),
        rest: lv(120, 90, 75),
      },
      {
        options: [{ name: 'Enfriamiento al trote' }],
        cardDiscipline: 'running',
        sets: lv(1, 1, 1),
        distanceKm: lv(1, 1.5, 2),
        rest: lv(0, 0, 0),
      },
    ],
  },
};

const CALISTHENICS: DisciplineTemplate = {
  dayA: {
    name: 'Calistenia · Día A',
    description: 'Empuje + core. Controla la bajada en cada repetición.',
    slots: [
      {
        options: [{ name: 'Flexiones' }],
        cardDiscipline: 'calisthenics',
        sets: lv(3, 4, 5),
        reps: lv(8, 12, 20),
        rest: lv(90, 90, 90),
      },
      {
        options: [{ name: 'Sentadilla peso corporal' }],
        cardDiscipline: 'calisthenics',
        sets: lv(3, 4, 4),
        reps: lv(12, 16, 20),
        rest: lv(60, 60, 90),
      },
      {
        options: [{ name: 'Fondos de tríceps en banco' }],
        cardDiscipline: 'calisthenics',
        sets: lv(3, 3, 4),
        reps: lv(8, 12, 15),
        rest: lv(60, 90, 90),
      },
      {
        options: [{ name: 'Plancha' }],
        cardDiscipline: 'calisthenics',
        sets: lv(3, 3, 4),
        duration: lv(30, 45, 75),
        rest: lv(60, 60, 60),
      },
    ],
  },
  dayB: {
    name: 'Calistenia · Día B',
    description: 'Tracción + pierna unilateral.',
    slots: [
      {
        options: [
          { name: 'Dominadas', needsAny: ['pull_up_bar'] },
          { name: 'Remo con banda', needsAny: ['resistance_bands'] },
          { name: 'Remo invertido (mesa)' },
        ],
        cardDiscipline: 'calisthenics',
        sets: lv(3, 4, 5),
        reps: lv(5, 8, 12),
        rest: lv(90, 120, 120),
      },
      {
        options: [{ name: 'Zancadas' }],
        cardDiscipline: 'calisthenics',
        sets: lv(3, 3, 4),
        reps: lv(10, 12, 16),
        rest: lv(60, 90, 90),
      },
      {
        options: [{ name: 'Pike push-ups' }],
        cardDiscipline: 'calisthenics',
        sets: lv(3, 3, 4),
        reps: lv(6, 10, 12),
        rest: lv(90, 90, 90),
      },
      {
        options: [{ name: 'Hollow hold' }],
        cardDiscipline: 'calisthenics',
        sets: lv(3, 3, 4),
        duration: lv(20, 30, 45),
        rest: lv(60, 60, 60),
      },
    ],
  },
};

const YOGA_MOBILITY: DisciplineTemplate = {
  dayA: {
    name: 'Movilidad · Sesión completa',
    description: 'Flujo de cuerpo completo. Respira lento por la nariz.',
    slots: [
      {
        options: [{ name: 'Saludo al sol' }],
        cardDiscipline: 'mobility',
        sets: lv(1, 1, 1),
        duration: lv(5, 8, 10),
        rest: lv(0, 0, 0),
      },
      {
        options: [{ name: 'Movilidad de cadera 90/90' }],
        cardDiscipline: 'mobility',
        sets: lv(2, 2, 3),
        duration: lv(3, 4, 5),
        rest: lv(30, 30, 30),
      },
      {
        options: [{ name: 'Apertura torácica' }],
        cardDiscipline: 'mobility',
        sets: lv(2, 2, 3),
        duration: lv(3, 4, 5),
        rest: lv(30, 30, 30),
      },
      {
        options: [{ name: 'Isquios + cadena posterior' }],
        cardDiscipline: 'mobility',
        sets: lv(2, 2, 3),
        duration: lv(3, 4, 5),
        rest: lv(30, 30, 30),
      },
      {
        options: [{ name: 'Respiración y relajación' }],
        cardDiscipline: 'mobility',
        sets: lv(1, 1, 1),
        duration: lv(5, 5, 8),
        rest: lv(0, 0, 0),
      },
    ],
  },
};

const TEAM_SPORT: DisciplineTemplate = {
  dayA: {
    name: 'Preparación física · Campo',
    description: 'Sesión de apoyo para tu deporte: potencia + acondicionamiento.',
    slots: [
      {
        options: [{ name: 'Activación dinámica' }],
        cardDiscipline: 'mobility',
        sets: lv(1, 1, 1),
        duration: lv(8, 10, 10),
        rest: lv(0, 0, 0),
      },
      {
        options: [{ name: 'Sprints cortos' }],
        cardDiscipline: 'team_sport',
        sets: lv(4, 6, 8),
        duration: lv(1, 1, 1),
        rest: lv(90, 75, 60),
      },
      {
        options: [{ name: 'Sentadilla con salto' }],
        cardDiscipline: 'calisthenics',
        sets: lv(3, 4, 4),
        reps: lv(6, 8, 10),
        rest: lv(90, 90, 90),
      },
      {
        options: [{ name: 'Core anti-rotación (plancha lateral)' }],
        cardDiscipline: 'calisthenics',
        sets: lv(2, 3, 3),
        duration: lv(20, 30, 40),
        rest: lv(45, 45, 60),
      },
      {
        options: [{ name: 'Juego / técnica con balón' }],
        cardDiscipline: 'team_sport',
        sets: lv(1, 1, 1),
        duration: lv(15, 20, 25),
        rest: lv(0, 0, 0),
      },
    ],
  },
};

const HYBRID: DisciplineTemplate = {
  dayA: {
    name: 'Híbrido · Fuerza + cardio',
    description: 'Lo mejor de ambos mundos en una sesión.',
    slots: [
      {
        options: [
          { name: 'Sentadilla goblet', needsAny: ['dumbbells', 'kettlebell'] },
          { name: 'Sentadilla peso corporal' },
        ],
        cardDiscipline: 'strength',
        sets: lv(3, 3, 4),
        reps: lv(10, 12, 12),
        rest: lv(90, 90, 90),
      },
      {
        options: [{ name: 'Flexiones' }],
        cardDiscipline: 'calisthenics',
        sets: lv(3, 3, 4),
        reps: lv(8, 12, 15),
        rest: lv(60, 90, 90),
      },
      {
        options: [{ name: 'Carrera continua' }],
        cardDiscipline: 'running',
        sets: lv(1, 1, 1),
        distanceKm: lv(2, 3, 5),
        rest: lv(0, 0, 0),
      },
      {
        options: [{ name: 'Plancha' }],
        cardDiscipline: 'calisthenics',
        sets: lv(3, 3, 3),
        duration: lv(30, 45, 60),
        rest: lv(45, 60, 60),
      },
    ],
  },
  dayB: {
    name: 'Híbrido · Potencia + intervalos',
    description: 'Día intenso: trabajo explosivo y series cortas.',
    slots: [
      {
        options: [
          { name: 'Swing con kettlebell', needsAny: ['kettlebell'] },
          { name: 'Peso muerto rumano con mancuernas', needsAny: ['dumbbells'] },
          { name: 'Puente de glúteo' },
        ],
        cardDiscipline: 'strength',
        sets: lv(3, 4, 4),
        reps: lv(10, 12, 15),
        rest: lv(90, 90, 90),
      },
      {
        options: [{ name: 'Burpees' }],
        cardDiscipline: 'calisthenics',
        sets: lv(3, 4, 5),
        reps: lv(8, 10, 12),
        rest: lv(75, 60, 60),
      },
      {
        options: [{ name: 'Intervalos 400 m' }],
        cardDiscipline: 'running',
        sets: lv(3, 4, 6),
        distanceKm: lv(0.4, 0.4, 0.4),
        rest: lv(120, 90, 90),
      },
      {
        options: [{ name: 'Hollow hold' }],
        cardDiscipline: 'calisthenics',
        sets: lv(2, 3, 3),
        duration: lv(20, 30, 40),
        rest: lv(45, 60, 60),
      },
    ],
  },
};

const TEMPLATES: Record<StarterDiscipline, DisciplineTemplate> = {
  strength: STRENGTH,
  running: RUNNING,
  calisthenics: CALISTHENICS,
  yoga_mobility: YOGA_MOBILITY,
  team_sport: TEAM_SPORT,
  hybrid: HYBRID,
};

// ======================== BUILDER ========================

function resolveOption(slot: ExerciseSlot, equipment: EquipmentTag[]): ExerciseOption {
  for (const opt of slot.options) {
    if (!opt.needsAny || opt.needsAny.some((tag) => equipment.includes(tag))) return opt;
  }
  // Templates guarantee an ungated last option; this is a type-level safety net.
  return slot.options[slot.options.length - 1];
}

function buildExercise(
  slot: ExerciseSlot,
  blockId: string,
  order: number,
  answers: StarterAnswers,
): ExerciseCard {
  const opt = resolveOption(slot, answers.equipment);
  const card = createExerciseCard(blockId, order, slot.cardDiscipline, { name: opt.name });

  const setCount = slot.sets[answers.level];
  const restSec = slot.rest[answers.level];
  const reps = slot.reps?.[answers.level];
  // NOTE: calisthenics cards hold seconds in `duration` (Hold time), the rest
  // use minutes — template values are authored in the card's native unit.
  const duration = slot.duration?.[answers.level];
  const distance = slot.distanceKm?.[answers.level];

  const prefills: Record<string, FieldValue> = {};
  if (reps != null && card.fields.some((f) => f.id === 'reps')) prefills['reps'] = reps;
  if (duration != null && card.fields.some((f) => f.id === 'duration'))
    prefills['duration'] = duration;
  if (distance != null && card.fields.some((f) => f.id === 'distance'))
    prefills['distance'] = distance;

  const sets: ExerciseSet[] = Array.from({ length: setCount }, (_, i) => {
    const s = createEmptySet(card.id, i, card.fields);
    return { ...s, values: { ...s.values, ...prefills } };
  });

  return {
    ...card,
    sets,
    default_sets_count: setCount,
    rest_seconds: restSec,
    notes: slot.notes ?? null,
    ...(reps != null ? { goalReps: reps } : {}),
  };
}

function buildBlock(
  template: BlockTemplate,
  answers: StarterAnswers,
  userId: string,
  sortOrder: number,
): WorkoutBlock {
  const coreDiscipline =
    STARTER_DISCIPLINES.find((d) => d.id === answers.discipline)?.coreDiscipline ?? 'general';
  const block = createWorkoutBlock(userId, sortOrder, coreDiscipline, {
    name: template.name,
    description: template.description,
  });
  const content = template.slots.map((slot, i) =>
    createExerciseNode(i, buildExercise(slot, block.id, i, answers)),
  );
  return { ...block, content, is_favorite: sortOrder === 0 ? true : block.is_favorite };
}

/**
 * Pure builder: answers → fully-formed blocks. One block at frequency ≤ 3,
 * the A/B split when the user plans 4+ sessions and the discipline defines
 * a day B. `baseSortOrder` lets the caller append after existing blocks.
 */
export function buildStarterBlocks(
  answers: StarterAnswers,
  userId: string,
  baseSortOrder = 0,
): WorkoutBlock[] {
  const tpl = TEMPLATES[answers.discipline];
  const blocks: WorkoutBlock[] = [buildBlock(tpl.dayA, answers, userId, baseSortOrder)];
  if (answers.frequency >= 4 && tpl.dayB) {
    blocks.push(buildBlock(tpl.dayB, answers, userId, baseSortOrder + 1));
  }
  // First block is the "start your first workout" target.
  blocks[0] = { ...blocks[0], is_favorite: true };
  return blocks;
}
