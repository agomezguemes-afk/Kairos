// KAIROS — Stubs de integración del onboarding (DEV-U ↔ DEV-L)
// Este módulo programa contra el contrato del sprint (docs/ai-board/BACKLOG.md).
// El orquestador lo conecta a las APIs reales de DEV-L al mergear.

import { useWorkoutStore } from '../../store/workoutStore';
import { generateStarterRoutine } from '../../lib/routines/generateStarterRoutine';
import { assignWeekdays, type OnboardingSpaceResult, type QuizAnswers } from './onboardingFlow';

// TODO(integración): sustituir por el `generateOnboardingSpace` real de DEV-L
// (camino IA con fallback de plantilla). Este stub usa la plantilla local para
// que el flujo completo funcione standalone antes del merge.
export async function generateOnboardingSpace(
  answers: QuizAnswers,
): Promise<OnboardingSpaceResult> {
  const startedAt = Date.now();
  const block = generateStarterRoutine(answers.goal);
  if (!block) {
    throw new Error('No se pudo crear tu primer bloque');
  }
  return {
    blocks: [block],
    weekAssignments: assignWeekdays([block.id], answers.frequency),
    source: 'template',
    durationMs: Date.now() - startedAt,
  };
}

// TODO(integración): sustituir por la acción real del store de DEV-L (L2):
// siembra la semana, persiste `onboardingCompletedAt` y emite
// `onboarding_completed`. El stub es no-op porque los bloques ya están en el
// store (los insertó el stub de generación) y el gate de navegación actual
// sigue siendo `userName`.
export function completeOnboarding(_result: OnboardingSpaceResult): void {
  // no-op hasta el merge
}

/** Limpia los bloques de un resultado descartado (acción «Regenerar»). */
export function discardGeneratedBlocks(result: OnboardingSpaceResult): void {
  const { deleteBlock } = useWorkoutStore.getState();
  for (const block of result.blocks) {
    deleteBlock(block.id);
  }
}
