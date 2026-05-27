// Local rule-based greeting for the chat & home tab. No LLM call.
// Was src/services/aiChatService.ts → getInitialGreeting.

import type { WorkoutBlock } from '../../../types/core';
import type { Streak, Badge, PRCard } from '../../../types/gamification';
import type { Mission } from '../../../types/mission';

export interface AIChatContext {
  blocks: WorkoutBlock[];
  streak: Streak;
  badges: Badge[];
  prCards: PRCard[];
  activeMission: Mission | null;
}

export function getInitialGreeting(ctx: AIChatContext): string {
  if (ctx.blocks.length === 0) {
    return '¡Hola! Soy Kai, tu asistente de entrenamiento. Estoy aquí para ayudarte a mejorar. Pregúntame lo que quieras sobre tu entrenamiento, récords, o cómo progresar.';
  }
  if (ctx.streak.current >= 3) {
    return `¡Hey! ${ctx.streak.current} días de racha, increíble. ¿En qué puedo ayudarte hoy? Pregúntame sobre tu progreso, ejercicios, o misiones.`;
  }
  return `¡Hola! Soy Kai. Tienes ${ctx.blocks.length} bloques en tu biblioteca. Pregúntame lo que necesites: consejos, análisis de tu progreso, o ideas para tu siguiente sesión.`;
}
