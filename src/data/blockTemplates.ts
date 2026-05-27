import type { Discipline } from '../types/core';

export interface BlockTemplateExercise {
  libraryId: string;
  setsCount?: number;
  goalWeight?: number;
  goalReps?: number;
}

export interface BlockTemplate {
  id: string;
  name: string;
  description: string;
  discipline: Discipline;
  recommendedFrequency: number;
  exercises: BlockTemplateExercise[];
}

export const BLOCK_TEMPLATES: BlockTemplate[] = [
  {
    id: 'tpl-full-body', name: 'Full Body 3×/semana',
    description: 'Compound focus. Ideal para empezar o mantener.',
    discipline: 'strength', recommendedFrequency: 3,
    exercises: [
      { libraryId: 'lib-back-squat',     setsCount: 4, goalReps: 6 },
      { libraryId: 'lib-bench-press',    setsCount: 4, goalReps: 8 },
      { libraryId: 'lib-barbell-row',    setsCount: 4, goalReps: 8 },
      { libraryId: 'lib-overhead-press', setsCount: 3, goalReps: 8 },
      { libraryId: 'lib-plank',          setsCount: 3 },
    ],
  },
  {
    id: 'tpl-push', name: 'Push · Pecho · Hombros · Tríceps',
    description: 'Empuje vertical y horizontal.',
    discipline: 'strength', recommendedFrequency: 2,
    exercises: [
      { libraryId: 'lib-bench-press',     setsCount: 4, goalReps: 8 },
      { libraryId: 'lib-overhead-press',  setsCount: 4, goalReps: 8 },
      { libraryId: 'lib-incline-bench',   setsCount: 3, goalReps: 10 },
      { libraryId: 'lib-lateral-raise',   setsCount: 3, goalReps: 12 },
      { libraryId: 'lib-tricep-pushdown', setsCount: 3, goalReps: 12 },
    ],
  },
  {
    id: 'tpl-pull', name: 'Pull · Espalda · Bíceps',
    description: 'Tracción vertical y horizontal.',
    discipline: 'strength', recommendedFrequency: 2,
    exercises: [
      { libraryId: 'lib-deadlift',     setsCount: 3, goalReps: 5 },
      { libraryId: 'lib-pull-up',      setsCount: 4, goalReps: 8 },
      { libraryId: 'lib-barbell-row',  setsCount: 4, goalReps: 8 },
      { libraryId: 'lib-face-pull',    setsCount: 3, goalReps: 15 },
      { libraryId: 'lib-barbell-curl', setsCount: 3, goalReps: 10 },
    ],
  },
  {
    id: 'tpl-legs', name: 'Legs · Tren inferior',
    description: 'Cuádriceps, isquios, glúteos y core.',
    discipline: 'strength', recommendedFrequency: 2,
    exercises: [
      { libraryId: 'lib-back-squat',           setsCount: 5, goalReps: 5 },
      { libraryId: 'lib-romanian-deadlift',    setsCount: 4, goalReps: 8 },
      { libraryId: 'lib-leg-press',            setsCount: 3, goalReps: 10 },
      { libraryId: 'lib-leg-curl',             setsCount: 3, goalReps: 12 },
      { libraryId: 'lib-calf-raise',           setsCount: 4, goalReps: 15 },
      { libraryId: 'lib-hanging-leg-raise',    setsCount: 3, goalReps: 10 },
    ],
  },
];

const TEMPLATE_BY_ID = new Map(BLOCK_TEMPLATES.map((t) => [t.id, t]));

export function getTemplate(id: string): BlockTemplate | null {
  return TEMPLATE_BY_ID.get(id) ?? null;
}
