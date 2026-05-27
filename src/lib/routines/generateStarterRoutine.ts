// Local rule-based starter routine. NO LLM call — this seeds the user's first
// block during onboarding so the experience is instant and offline-safe.

import { useWorkoutStore } from '../../store/workoutStore';
import type { Discipline, WorkoutBlock } from '../../types/core';

type Goal = 'strength' | 'endurance' | 'flexibility' | 'health';

interface StarterExercise {
  name: string;
  reps: number | string;
  rest_seconds: number;
}

const ROUTINES: Record<
  Goal,
  { name: string; discipline: Discipline; exercises: StarterExercise[] }
> = {
  strength: {
    name: 'Fuerza · Bienvenida',
    discipline: 'strength',
    exercises: [
      { name: 'Press banca', reps: 8, rest_seconds: 120 },
      { name: 'Sentadilla', reps: 10, rest_seconds: 120 },
      { name: 'Peso muerto', reps: 6, rest_seconds: 150 },
      { name: 'Dominadas', reps: 8, rest_seconds: 90 },
    ],
  },
  endurance: {
    name: 'Resistencia · Bienvenida',
    discipline: 'calisthenics',
    exercises: [
      { name: 'Saltos al cajón', reps: 15, rest_seconds: 60 },
      { name: 'Burpees', reps: 12, rest_seconds: 60 },
      { name: 'Mountain climbers', reps: 30, rest_seconds: 45 },
      { name: 'Carrera intervalos', reps: '60s', rest_seconds: 60 },
    ],
  },
  flexibility: {
    name: 'Flexibilidad · Bienvenida',
    discipline: 'mobility',
    exercises: [
      { name: 'Estiramiento isquios', reps: '45s', rest_seconds: 30 },
      { name: 'Yoga flow', reps: '120s', rest_seconds: 30 },
      { name: 'Movilidad cadera', reps: '60s', rest_seconds: 30 },
    ],
  },
  health: {
    name: 'Salud general · Bienvenida',
    discipline: 'general',
    exercises: [
      { name: 'Caminar enérgico', reps: '20m', rest_seconds: 0 },
      { name: 'Plancha', reps: '40s', rest_seconds: 45 },
      { name: 'Sentadilla peso corporal', reps: 12, rest_seconds: 60 },
      { name: 'Estiramientos finales', reps: '5m', rest_seconds: 0 },
    ],
  },
};

/**
 * Builds a starter block for a given goal and inserts it into the store.
 * Returns the new block (post-insert) or null if creation fails.
 */
export function generateStarterRoutine(goal: Goal): WorkoutBlock | null {
  const tpl = ROUTINES[goal];
  if (!tpl) return null;
  const store = useWorkoutStore.getState();
  const blockId = store.addBlock(tpl.discipline, { name: tpl.name });

  // Append each starter exercise. Pre-fill reps in every set so the user sees
  // a populated block right away.
  for (const ex of tpl.exercises) {
    store.addExercise(blockId, { name: ex.name, discipline: tpl.discipline });
    const fresh = useWorkoutStore.getState().blocks.find((b) => b.id === blockId);
    if (!fresh) continue;
    const exerciseNodes = fresh.content.filter((n) => n.type === 'exercise');
    const last = exerciseNodes[exerciseNodes.length - 1];
    if (!last || last.type !== 'exercise') continue;
    const card = last.data.exercise;
    store.updateExercise(blockId, card.id, { rest_seconds: ex.rest_seconds });
    for (const s of card.sets) {
      store.updateSetValue(blockId, card.id, s.id, 'reps', ex.reps);
    }
  }

  store.updateBlock(blockId, { is_favorite: true });
  return useWorkoutStore.getState().blocks.find((b) => b.id === blockId) ?? null;
}
