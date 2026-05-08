// Suggestion chips for the global chat. Pure function over the live store
// snapshot — no LLM involved. Mirrors the per-block suggestions but at the
// library level (cross-block heuristics).

import type { WorkoutBlock } from '../../../types/core';

export interface GlobalSuggestion {
  label: string;
  prompt: string;
}

export function getGlobalSuggestions(blocks: WorkoutBlock[]): GlobalSuggestion[] {
  if (blocks.length === 0) {
    return [
      { label: 'Bloque de fuerza', prompt: 'Crea un bloque de fuerza para principiantes con 4 ejercicios y 3 series cada uno.' },
      { label: 'Plan 5K', prompt: 'Crea un plan de carrera para preparar un 5K en 6 semanas.' },
      { label: 'HIIT en casa', prompt: 'Crea un bloque HIIT de 20 minutos sin equipamiento, en formato Tabata.' },
      { label: 'Movilidad diaria', prompt: 'Diseña una rutina de movilidad de 10 minutos para hacer cada mañana.' },
    ];
  }

  const has = (kw: string) =>
    blocks.some((b) => b.name.toLowerCase().includes(kw) || b.description?.toLowerCase().includes(kw));

  const out: GlobalSuggestion[] = [];

  if (!has('calentamiento') && !has('warmup')) {
    out.push({ label: 'Añadir calentamiento', prompt: 'Crea un bloque de calentamiento de 8 minutos que pueda usar antes de cualquier sesión.' });
  }
  if (!has('cooldown') && !has('cool-down') && !has('estiramiento')) {
    out.push({ label: 'Cooldown corto', prompt: 'Crea un bloque corto de cooldown y estiramientos para después de entrenar.' });
  }

  out.push({ label: 'Analiza mi semana', prompt: 'Analiza mi entrenamiento de los últimos 7 días: equilibrio entre push/pull/piernas, volumen, y qué debería ajustar.' });
  out.push({ label: 'Añadir bloque', prompt: 'Sugiere un bloque que me venga bien añadir en función de lo que estoy entrenando.' });

  if (blocks.some((b) => b.discipline === 'strength')) {
    out.push({ label: 'Progresión de fuerza', prompt: 'Basándote en mis bloques de fuerza, propón el siguiente paso de progresión: peso, repeticiones o ejercicio nuevo.' });
  }

  return out.slice(0, 5);
}
