// Words for a plateau the engine detected. Free of store imports so the
// routing and the guard are testable; insights.ts feeds it.

import { assertGrounded } from './grounding';
import { availableProviders, currentRouteContext, routeChat } from './providers';
import { PLATEAU_COACH_SYSTEM } from './prompts/system';

export interface PlateauFacts {
  exerciseName: string;
  weeksStalled: number;
  lastMax: number;
}

const INSIGHT_TIMEOUT_MS = 12_000;
const MAX_CHARS = 420;

/** Deterministic text: the engine's own advice, used when no model answers. */
export function ruleInsight(p: PlateauFacts): string {
  return `${p.exerciseName}: llevas ${p.weeksStalled} semanas estancado en ${p.lastMax}kg. Prueba con un microciclo de descarga (50% volumen) y sube 2.5kg la siguiente semana.`;
}

export function insightPrompt(p: PlateauFacts): string {
  return `El usuario está estancado en "${p.exerciseName}" desde hace ${p.weeksStalled} semanas. Su mejor peso reciente es ${p.lastMax}kg. Dale una sugerencia concreta y amable en máximo 3 frases.`;
}

/**
 * A model's wording when one answers with a usable, grounded text (local
 * first when the person chose a model, then the cloud); the rules text
 * otherwise. Never throws.
 */
export async function plateauInsight(p: PlateauFacts): Promise<string> {
  const user = insightPrompt(p);
  const routed = await routeChat(
    'coach',
    {
      messages: [
        { role: 'system', content: PLATEAU_COACH_SYSTEM },
        { role: 'user', content: user },
      ],
      temperature: 0.6,
      maxTokens: 220,
    },
    availableProviders(),
    currentRouteContext(),
    {
      timeoutMs: INSIGHT_TIMEOUT_MS,
      accept: (r) => {
        const text = r.content?.trim() ?? '';
        if (!text) throw new Error('respuesta vacía');
        if (text.length > MAX_CHARS) throw new Error('respuesta demasiado larga');
        return assertGrounded(text, [user]);
      },
    },
  );
  return routed?.value ?? ruleInsight(p);
}
