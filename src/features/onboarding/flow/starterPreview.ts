// KAIROS — starter block preview (pure).
//
// A store-free, native-free view of the first block the onboarding will create,
// so the presentation screen can SHOW the user what Kai built before they enter.
// Mirrors the content of src/lib/routines/generateStarterRoutine.ts (which does
// the real store insert) but stays pure so it's testable and importable anywhere.

import type { OnboardingGoal } from './onboardingFlow';

export interface PreviewExercise {
  name: string;
  /** Human detail, e.g. "4 × 8" or "20 min". */
  detail: string;
}

export interface StarterBlockPreview {
  name: string;
  /** Discipline accent key (matches Colors.discipline.*). */
  discipline: 'strength' | 'calisthenics' | 'mobility' | 'general';
  exercises: PreviewExercise[];
}

const PREVIEWS: Record<OnboardingGoal, StarterBlockPreview> = {
  strength: {
    name: 'Fuerza · Bienvenida',
    discipline: 'strength',
    exercises: [
      { name: 'Press banca', detail: '4 × 8' },
      { name: 'Sentadilla', detail: '4 × 10' },
      { name: 'Peso muerto', detail: '3 × 6' },
      { name: 'Dominadas', detail: '3 × 8' },
    ],
  },
  endurance: {
    name: 'Resistencia · Bienvenida',
    discipline: 'calisthenics',
    exercises: [
      { name: 'Saltos al cajón', detail: '4 × 15' },
      { name: 'Burpees', detail: '4 × 12' },
      { name: 'Mountain climbers', detail: '3 × 30' },
      { name: 'Carrera intervalos', detail: '6 × 60 s' },
    ],
  },
  flexibility: {
    name: 'Flexibilidad · Bienvenida',
    discipline: 'mobility',
    exercises: [
      { name: 'Estiramiento isquios', detail: '3 × 45 s' },
      { name: 'Yoga flow', detail: '2 × 2 min' },
      { name: 'Movilidad cadera', detail: '3 × 60 s' },
    ],
  },
  health: {
    name: 'Salud general · Bienvenida',
    discipline: 'general',
    exercises: [
      { name: 'Caminar enérgico', detail: '20 min' },
      { name: 'Plancha', detail: '3 × 40 s' },
      { name: 'Sentadilla peso corporal', detail: '3 × 12' },
      { name: 'Estiramientos finales', detail: '5 min' },
    ],
  },
};

/** The first block for a goal. Falls back to the broad "health" block. */
export function previewStarterBlock(goal: OnboardingGoal | null): StarterBlockPreview {
  return PREVIEWS[goal ?? 'health'] ?? PREVIEWS.health;
}
