import type { Discipline, MuscleGroup, FieldDefinition } from '../types/core';
import type { KIconName } from '../components/icons/KIcon';

export interface ExerciseLibraryEntry {
  id: string;
  name: string;
  discipline: Discipline;
  muscleGroups: MuscleGroup[];
  icon: KIconName;
  fields?: FieldDefinition[];
  defaultSetsCount: number;
  defaultRestSeconds: number;
}

function timeBasedField(): FieldDefinition[] {
  return [
    { id: 'duration', name: 'Duración', type: 'time', unit: 's',
      isBase: true, isPrimary: true, order: 0, defaultValue: 30 },
  ];
}

function distanceTimeFields(): FieldDefinition[] {
  return [
    { id: 'distance', name: 'Distancia', type: 'number', unit: 'm',
      isBase: true, isPrimary: true, order: 0, defaultValue: null },
    { id: 'duration', name: 'Duración', type: 'time', unit: 's',
      isBase: true, isPrimary: false, order: 1, defaultValue: null },
  ];
}

// ───── Strength ──────────────────────────────────────────────────────
const STRENGTH: ExerciseLibraryEntry[] = [
  // Chest
  { id: 'lib-bench-press',       name: 'Press banca',                  discipline: 'strength', muscleGroups: ['chest','triceps','shoulders'], icon: 'barbell', defaultSetsCount: 4, defaultRestSeconds: 120 },
  { id: 'lib-incline-bench',     name: 'Press inclinado',              discipline: 'strength', muscleGroups: ['chest','shoulders'],           icon: 'barbell', defaultSetsCount: 4, defaultRestSeconds: 120 },
  { id: 'lib-dumbbell-press',    name: 'Press mancuernas',             discipline: 'strength', muscleGroups: ['chest','triceps'],             icon: 'barbell', defaultSetsCount: 3, defaultRestSeconds: 90  },
  { id: 'lib-dumbbell-fly',      name: 'Aperturas mancuernas',         discipline: 'strength', muscleGroups: ['chest'],                       icon: 'barbell', defaultSetsCount: 3, defaultRestSeconds: 60  },
  { id: 'lib-dips',              name: 'Fondos',                       discipline: 'strength', muscleGroups: ['chest','triceps'],             icon: 'zap',     defaultSetsCount: 3, defaultRestSeconds: 90  },
  // Back
  { id: 'lib-deadlift',          name: 'Peso muerto',                  discipline: 'strength', muscleGroups: ['back','hamstrings','glutes'],  icon: 'barbell', defaultSetsCount: 4, defaultRestSeconds: 180 },
  { id: 'lib-pull-up',           name: 'Dominadas',                    discipline: 'strength', muscleGroups: ['back','biceps'],               icon: 'zap',     defaultSetsCount: 4, defaultRestSeconds: 120 },
  { id: 'lib-barbell-row',       name: 'Remo con barra',               discipline: 'strength', muscleGroups: ['back','biceps'],               icon: 'barbell', defaultSetsCount: 4, defaultRestSeconds: 120 },
  { id: 'lib-dumbbell-row',      name: 'Remo mancuerna',               discipline: 'strength', muscleGroups: ['back','biceps'],               icon: 'barbell', defaultSetsCount: 3, defaultRestSeconds: 90  },
  { id: 'lib-lat-pulldown',      name: 'Jalón al pecho',               discipline: 'strength', muscleGroups: ['back','biceps'],               icon: 'barbell', defaultSetsCount: 3, defaultRestSeconds: 90  },
  { id: 'lib-face-pull',         name: 'Face pull',                    discipline: 'strength', muscleGroups: ['back','shoulders'],            icon: 'barbell', defaultSetsCount: 3, defaultRestSeconds: 60  },
  // Shoulders
  { id: 'lib-overhead-press',    name: 'Press militar',                discipline: 'strength', muscleGroups: ['shoulders','triceps'],         icon: 'barbell', defaultSetsCount: 4, defaultRestSeconds: 120 },
  { id: 'lib-lateral-raise',     name: 'Elevaciones laterales',        discipline: 'strength', muscleGroups: ['shoulders'],                   icon: 'barbell', defaultSetsCount: 3, defaultRestSeconds: 60  },
  { id: 'lib-rear-delt-fly',     name: 'Pájaros',                      discipline: 'strength', muscleGroups: ['shoulders','back'],            icon: 'barbell', defaultSetsCount: 3, defaultRestSeconds: 60  },
  // Arms
  { id: 'lib-barbell-curl',      name: 'Curl con barra',               discipline: 'strength', muscleGroups: ['biceps'],                      icon: 'barbell', defaultSetsCount: 3, defaultRestSeconds: 60  },
  { id: 'lib-dumbbell-curl',     name: 'Curl mancuernas',              discipline: 'strength', muscleGroups: ['biceps'],                      icon: 'barbell', defaultSetsCount: 3, defaultRestSeconds: 60  },
  { id: 'lib-hammer-curl',       name: 'Curl martillo',                discipline: 'strength', muscleGroups: ['biceps','forearms'],           icon: 'barbell', defaultSetsCount: 3, defaultRestSeconds: 60  },
  { id: 'lib-tricep-pushdown',   name: 'Extensiones tríceps polea',    discipline: 'strength', muscleGroups: ['triceps'],                     icon: 'barbell', defaultSetsCount: 3, defaultRestSeconds: 60  },
  { id: 'lib-skullcrusher',      name: 'Press francés',                discipline: 'strength', muscleGroups: ['triceps'],                     icon: 'barbell', defaultSetsCount: 3, defaultRestSeconds: 60  },
  // Legs
  { id: 'lib-back-squat',        name: 'Sentadilla',                   discipline: 'strength', muscleGroups: ['quads','glutes'],              icon: 'barbell', defaultSetsCount: 4, defaultRestSeconds: 180 },
  { id: 'lib-front-squat',       name: 'Sentadilla frontal',           discipline: 'strength', muscleGroups: ['quads','core'],                icon: 'barbell', defaultSetsCount: 4, defaultRestSeconds: 150 },
  { id: 'lib-romanian-deadlift', name: 'Peso muerto rumano',           discipline: 'strength', muscleGroups: ['hamstrings','glutes','back'],  icon: 'barbell', defaultSetsCount: 4, defaultRestSeconds: 120 },
  { id: 'lib-leg-press',         name: 'Prensa',                       discipline: 'strength', muscleGroups: ['quads','glutes'],              icon: 'barbell', defaultSetsCount: 3, defaultRestSeconds: 120 },
  { id: 'lib-lunges',            name: 'Zancadas',                     discipline: 'strength', muscleGroups: ['quads','glutes'],              icon: 'barbell', defaultSetsCount: 3, defaultRestSeconds: 90  },
  { id: 'lib-leg-curl',          name: 'Curl femoral',                 discipline: 'strength', muscleGroups: ['hamstrings'],                  icon: 'barbell', defaultSetsCount: 3, defaultRestSeconds: 60  },
  { id: 'lib-calf-raise',        name: 'Elevaciones gemelos',          discipline: 'strength', muscleGroups: ['calves'],                      icon: 'barbell', defaultSetsCount: 4, defaultRestSeconds: 45  },
  { id: 'lib-hip-thrust',        name: 'Hip thrust',                   discipline: 'strength', muscleGroups: ['glutes','hamstrings'],         icon: 'barbell', defaultSetsCount: 4, defaultRestSeconds: 90  },
  // Core
  { id: 'lib-plank',             name: 'Plancha',                      discipline: 'strength', muscleGroups: ['core'], icon: 'mat', defaultSetsCount: 3, defaultRestSeconds: 45, fields: timeBasedField() },
  { id: 'lib-hanging-leg-raise', name: 'Elevaciones piernas colgado',  discipline: 'strength', muscleGroups: ['core'], icon: 'zap', defaultSetsCount: 3, defaultRestSeconds: 60 },
  { id: 'lib-ab-rollout',        name: 'Rueda abdominal',              discipline: 'strength', muscleGroups: ['core'], icon: 'zap', defaultSetsCount: 3, defaultRestSeconds: 60 },
];

const CALISTHENICS: ExerciseLibraryEntry[] = [
  { id: 'lib-push-up',      name: 'Flexiones',              discipline: 'calisthenics', muscleGroups: ['chest','triceps','shoulders'], icon: 'zap', defaultSetsCount: 3, defaultRestSeconds: 60 },
  { id: 'lib-pike-push-up', name: 'Flexiones pica',         discipline: 'calisthenics', muscleGroups: ['shoulders','triceps'],         icon: 'zap', defaultSetsCount: 3, defaultRestSeconds: 75 },
  { id: 'lib-bw-squat',     name: 'Sentadillas bodyweight', discipline: 'calisthenics', muscleGroups: ['quads','glutes'],              icon: 'zap', defaultSetsCount: 3, defaultRestSeconds: 45 },
  { id: 'lib-bw-lunge',     name: 'Zancadas bodyweight',    discipline: 'calisthenics', muscleGroups: ['quads','glutes'],              icon: 'zap', defaultSetsCount: 3, defaultRestSeconds: 45 },
  { id: 'lib-glute-bridge', name: 'Puente glúteo',          discipline: 'calisthenics', muscleGroups: ['glutes','hamstrings'],         icon: 'mat', defaultSetsCount: 3, defaultRestSeconds: 45 },
];

const CARDIO: ExerciseLibraryEntry[] = [
  { id: 'lib-run-easy',      name: 'Carrera continua',  discipline: 'running',  muscleGroups: ['cardio_engine','quads','calves'],   icon: 'running', defaultSetsCount: 1, defaultRestSeconds: 0,  fields: distanceTimeFields() },
  { id: 'lib-run-intervals', name: 'Intervalos',        discipline: 'running',  muscleGroups: ['cardio_engine','quads'],            icon: 'running', defaultSetsCount: 8, defaultRestSeconds: 90, fields: distanceTimeFields() },
  { id: 'lib-bike-easy',     name: 'Bici suave',        discipline: 'cycling',  muscleGroups: ['cardio_engine','quads'],            icon: 'running', defaultSetsCount: 1, defaultRestSeconds: 0,  fields: distanceTimeFields() },
  { id: 'lib-swim-laps',     name: 'Largos piscina',    discipline: 'swimming', muscleGroups: ['cardio_engine','back','shoulders'], icon: 'running', defaultSetsCount: 1, defaultRestSeconds: 0,  fields: distanceTimeFields() },
  { id: 'lib-jump-rope',     name: 'Comba',             discipline: 'general',  muscleGroups: ['cardio_engine','calves'],           icon: 'zap',     defaultSetsCount: 3, defaultRestSeconds: 60, fields: timeBasedField() },
];

const MOBILITY: ExerciseLibraryEntry[] = [
  { id: 'lib-cat-cow',             name: 'Gato-vaca',             discipline: 'mobility', muscleGroups: ['mobility','core'],     icon: 'mat', defaultSetsCount: 2, defaultRestSeconds: 30, fields: timeBasedField() },
  { id: 'lib-childs-pose',         name: 'Postura del niño',      discipline: 'mobility', muscleGroups: ['mobility','back'],     icon: 'mat', defaultSetsCount: 2, defaultRestSeconds: 30, fields: timeBasedField() },
  { id: 'lib-hip-flexor-stretch',  name: 'Estiramiento psoas',    discipline: 'mobility', muscleGroups: ['mobility','quads'],    icon: 'mat', defaultSetsCount: 2, defaultRestSeconds: 30, fields: timeBasedField() },
  { id: 'lib-shoulder-dislocates', name: 'Dislocaciones hombro',  discipline: 'mobility', muscleGroups: ['mobility','shoulders'],icon: 'mat', defaultSetsCount: 2, defaultRestSeconds: 30 },
  { id: 'lib-thoracic-rotation',   name: 'Rotación torácica',     discipline: 'mobility', muscleGroups: ['mobility','back'],     icon: 'mat', defaultSetsCount: 2, defaultRestSeconds: 30 },
];

export const EXERCISE_LIBRARY: ExerciseLibraryEntry[] = [
  ...STRENGTH, ...CALISTHENICS, ...CARDIO, ...MOBILITY,
];

const LIBRARY_BY_ID = new Map(EXERCISE_LIBRARY.map((e) => [e.id, e]));

export function getLibraryEntry(id: string): ExerciseLibraryEntry | null {
  return LIBRARY_BY_ID.get(id) ?? null;
}

export function searchLibrary(query: string): ExerciseLibraryEntry[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return EXERCISE_LIBRARY;
  return EXERCISE_LIBRARY.filter((e) => e.name.toLowerCase().includes(q));
}

export function libraryByDiscipline(discipline: Discipline): ExerciseLibraryEntry[] {
  return EXERCISE_LIBRARY.filter((e) => e.discipline === discipline);
}

export function libraryByMuscleGroup(group: MuscleGroup): ExerciseLibraryEntry[] {
  return EXERCISE_LIBRARY.filter((e) => e.muscleGroups.includes(group));
}
