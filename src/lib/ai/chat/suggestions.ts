// Suggestion chips shown above the input bar inside the block editor.
// Pure function over the block — no LLM call. Was src/services/blockAIService.ts.

import type { WorkoutBlock } from '../../../types/core';
import { calculateBlockStats, getBlockExercises } from '../../../types/core';

export interface BlockSuggestion {
  label: string;
  prompt: string;
}

export function getBlockSuggestions(block: WorkoutBlock): BlockSuggestion[] {
  const exercises = getBlockExercises(block);
  const stats = calculateBlockStats(block);

  if (exercises.length === 0) {
    return [
      {
        label: 'Generar rutina',
        prompt: `Genera una rutina completa de ${block.discipline} para este bloque, adaptada a mi nivel`,
      },
      { label: 'Rutina rápida', prompt: 'Crea una rutina corta de 15-20 minutos con 4 ejercicios' },
      {
        label: 'Calentamiento',
        prompt: 'Añade ejercicios de calentamiento y movilidad para empezar',
      },
    ];
  }

  const suggestions: BlockSuggestion[] = [];

  if (exercises.length < 3) {
    suggestions.push({
      label: 'Completar rutina',
      prompt: 'Sugiere ejercicios complementarios para completar esta rutina',
    });
  }

  suggestions.push({
    label: 'Añadir ejercicio',
    prompt: 'Recomienda un ejercicio que complemente los que ya tengo',
  });

  if (exercises.length >= 3) {
    suggestions.push({
      label: 'Analizar bloque',
      prompt: 'Analiza este bloque: equilibrio muscular, volumen, y qué puedo mejorar',
    });
  }

  if (stats.completion_percentage > 0) {
    suggestions.push({
      label: 'Progresión',
      prompt: 'Basándote en mi progreso, qué debería ajustar para la próxima sesión',
    });
  }

  suggestions.push({
    label: 'Ajustar volumen',
    prompt: 'Revisa las series y repeticiones, ajústalas si ves algo desbalanceado',
  });

  return suggestions.slice(0, 4);
}
