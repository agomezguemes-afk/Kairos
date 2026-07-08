// KAIROS — Adaptador de integración del onboarding (DEV-U ↔ DEV-L)
// Conecta el generador real (src/lib/ai/onboardingSpace.ts — IA con fallback
// de plantilla, nunca rechaza) con la forma que el Reveal pinta. Las piezas
// que DEV-L aún no ha aterrizado (L1 semana sembrada, L2 completeOnboarding,
// L4 analytics) quedan marcadas TODO(integración).

import { useWorkoutStore } from '../../store/workoutStore';
import { generateOnboardingSpace as generateSpace } from '../../lib/ai/onboardingSpace';
import type { StarterAnswers } from '../../lib/routines/starterTemplates';
import { assignWeekdays, type OnboardingSpaceResult } from './onboardingFlow';

/**
 * Genera el espacio con la API real y lo adapta al contrato del Reveal
 * ({ blocks, weekAssignments, source, durationMs }).
 */
export async function generateSpaceForReveal(
  answers: StarterAnswers,
  userName: string,
): Promise<OnboardingSpaceResult> {
  const startedAt = Date.now();
  // Nunca rechaza: en cualquier fallo devuelve la plantilla curada.
  const result = await generateSpace(answers, { userName });
  const all = useWorkoutStore.getState().blocks;
  const blocks = result.blockIds
    .map((id) => all.find((b) => b.id === id))
    .filter((b): b is NonNullable<typeof b> => b !== undefined);
  return {
    blocks,
    // TODO(integración): sustituir por los weekAssignments reales cuando
    // generateOnboardingSpace los devuelva (DEV-L, L1).
    weekAssignments: assignWeekdays(
      blocks.map((b) => b.id),
      answers.frequency,
    ),
    source: result.source,
    durationMs: Date.now() - startedAt,
  };
}

// TODO(integración): sustituir por la acción real del store de DEV-L (L2):
// siembra la semana, persiste `onboardingCompletedAt` y emite
// `onboarding_completed`. Stub no-op: los bloques ya están en el store y el
// gate de navegación de esta base sigue siendo `userName`.
export function completeOnboarding(_result: OnboardingSpaceResult): void {
  // no-op hasta el merge con DEV-L
}

/** Limpia los bloques de un resultado descartado (acción «Regenerar»). */
export function discardGeneratedBlocks(result: OnboardingSpaceResult): void {
  const { deleteBlock } = useWorkoutStore.getState();
  for (const block of result.blocks) {
    deleteBlock(block.id);
  }
}
