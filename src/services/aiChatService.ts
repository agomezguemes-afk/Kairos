// KAIROS — AI Chat Service (Mock)
// Context-aware mock responses for the Kai assistant.
// Will be replaced with a real LLM integration later.

import type { WorkoutBlock } from '../types/core';
import type { Streak, Badge, PRCard } from '../types/gamification';
import type { Mission } from '../types/mission';

// ======================== CONTEXT ========================

export interface AIChatContext {
  blocks: WorkoutBlock[];
  streak: Streak;
  badges: Badge[];
  prCards: PRCard[];
  activeMission: Mission | null;
}

// ======================== MESSAGE TYPE ========================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

// ======================== RESPONSE GENERATION ========================

/**
 * Generate a mock AI response based on user message and context.
 * Scans for keywords and returns personalized advice.
 */
export function getResponse(userMessage: string, ctx: AIChatContext): string {
  const msg = userMessage.toLowerCase().trim();

  // ---- Greeting ----
  if (matchesAny(msg, ['hola', 'hey', 'buenas', 'qué tal', 'hello', 'hi'])) {
    return getGreeting(ctx);
  }

  // ---- Streak questions ----
  if (matchesAny(msg, ['racha', 'streak', 'días seguidos', 'constancia'])) {
    return getStreakAdvice(ctx);
  }

  // ---- PR / record questions ----
  if (matchesAny(msg, ['récord', 'record', 'pr ', 'marca personal', 'mejor marca'])) {
    return getPRAdvice(ctx);
  }

  // ---- Mission questions ----
  if (matchesAny(msg, ['misión', 'mision', 'objetivo', 'reto', 'mission'])) {
    return getMissionInfo(ctx);
  }

  // ---- Exercise improvement ----
  if (matchesAny(msg, ['mejorar', 'improve', 'progresar', 'subir peso', 'más fuerte'])) {
    return getImprovementAdvice(msg, ctx);
  }

  // ---- Specific exercise queries ----
  if (matchesAny(msg, ['sentadilla', 'squat'])) {
    return getExerciseAdvice('sentadilla', 'weight', ctx);
  }
  if (matchesAny(msg, ['press banca', 'bench press', 'press de banca'])) {
    return getExerciseAdvice('press banca', 'weight', ctx);
  }
  if (matchesAny(msg, ['peso muerto', 'deadlift'])) {
    return getExerciseAdvice('peso muerto', 'weight', ctx);
  }
  if (matchesAny(msg, ['correr', 'running', 'carrera', 'kilómetros'])) {
    return getRunningAdvice(ctx);
  }

  // ---- Training plan ----
  if (matchesAny(msg, ['plan', 'rutina', 'programa', 'planificar'])) {
    return getPlanAdvice(ctx);
  }

  // ---- Badges ----
  if (matchesAny(msg, ['insignia', 'badge', 'logro', 'desbloquear'])) {
    return getBadgeAdvice(ctx);
  }

  // ---- Recovery / rest ----
  if (matchesAny(msg, ['descanso', 'recuperar', 'recovery', 'rest', 'dolor'])) {
    return getRecoveryAdvice(ctx);
  }

  // ---- Catch-all ----
  return getCatchAllResponse(ctx);
}

// ======================== RESPONSE BUILDERS ========================

function getGreeting(ctx: AIChatContext): string {
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';

  if (ctx.streak.current >= 7) {
    return `¡${timeGreeting}! 🔥 Llevas una racha increíble de ${ctx.streak.current} días. ¿En qué puedo ayudarte hoy?`;
  }
  if (ctx.blocks.length === 0) {
    return `¡${timeGreeting}! Veo que aún no has creado ningún bloque. ¿Quieres que te ayude a diseñar tu primer entrenamiento?`;
  }
  return `¡${timeGreeting}! Tienes ${ctx.blocks.length} ${ctx.blocks.length === 1 ? 'bloque' : 'bloques'} en tu biblioteca. ¿En qué te puedo ayudar?`;
}

function getStreakAdvice(ctx: AIChatContext): string {
  if (ctx.streak.current === 0) {
    return '¡Hoy es un buen día para empezar! Completa al menos una serie para iniciar tu racha. La constancia es lo que separa a los buenos de los grandes. 💪';
  }
  if (ctx.streak.current < 7) {
    return `Llevas ${ctx.streak.current} días de racha. ¡Sigue así! El objetivo es llegar a 7 días para desbloquear la insignia "Iniciado" 🔥. Un consejo: entrena aunque sea 15 minutos los días difíciles.`;
  }
  if (ctx.streak.current < 30) {
    return `¡${ctx.streak.current} días de racha! 🔥🔥 Estás en camino a la insignia de 30 días. Tu récord es de ${ctx.streak.longest} días. ¡Supéralo!`;
  }
  return `¡${ctx.streak.current} días! 🔥🔥🔥 Eres una máquina de constancia. Tu cuerpo ya se ha adaptado a entrenar a diario. ¡Sigue rompiendo límites!`;
}

function getPRAdvice(ctx: AIChatContext): string {
  if (ctx.prCards.length === 0) {
    return 'Aún no tienes récords personales registrados. Cada vez que superes tu mejor marca en un ejercicio, se creará una carta de récord automáticamente. ¡Empieza a registrar tus pesos!';
  }
  const latest = ctx.prCards[0];
  return `Tu último récord fue en ${latest.exerciseName}: ${latest.value}${latest.unit ? ` ${latest.unit}` : ''}. ${latest.message} Para seguir progresando, intenta incrementar un 2-5% cada semana.`;
}

function getMissionInfo(ctx: AIChatContext): string {
  if (!ctx.activeMission) {
    return 'No tienes una misión activa ahora mismo. Ve al AI Lab para generar una nueva misión semanal. ¡Las misiones te ayudan a mantener el foco!';
  }
  const m = ctx.activeMission;
  const pct = Math.round((m.currentValue / m.targetValue) * 100);
  return `${m.emoji} Tu misión actual: "${m.title}"\n\nProgreso: ${m.currentValue}/${m.targetValue} (${pct}%)\n\n${m.description}\n\n¡Tú puedes! 💪`;
}

function getImprovementAdvice(msg: string, ctx: AIChatContext): string {
  // Try to find a relevant exercise in user's blocks
  const allExercises = ctx.blocks.flatMap((b) => b.exercises);
  const withSets = allExercises.filter((ex) =>
    ex.sets.some((s) => s.completed),
  );

  if (withSets.length === 0) {
    return 'Para darte consejos personalizados, necesito que completes algunas series primero. Registra tus pesos y reps, y podré analizar tu progreso y sugerirte mejoras. 📊';
  }

  const ex = withSets[0];
  const primaryField = ex.fields.find((f) => f.isPrimary);
  if (primaryField) {
    const lastSet = ex.sets.filter((s) => s.completed).pop();
    const val = lastSet?.values[primaryField.id];
    if (typeof val === 'number') {
      const increment = primaryField.unit === 'kg' ? 2.5 : 1;
      return `He analizado tu "${ex.name}". Tu último registro fue ${val}${primaryField.unit ? ` ${primaryField.unit}` : ''}. Te sugiero intentar ${val + increment}${primaryField.unit ? ` ${primaryField.unit}` : ''} en tu próxima sesión. ¡Progresión gradual es la clave!`;
    }
  }

  return 'Para mejorar, te recomiendo: 1) Aumentar peso un 2-5% cada semana, 2) Mantener buena técnica, 3) Descansar adecuadamente entre sesiones, 4) Ser constante con tu racha. 📈';
}

function getExerciseAdvice(
  exerciseName: string,
  primaryFieldId: string,
  ctx: AIChatContext,
): string {
  const allExercises = ctx.blocks.flatMap((b) => b.exercises);
  const match = allExercises.find((ex) =>
    ex.name.toLowerCase().includes(exerciseName.toLowerCase()),
  );

  if (match) {
    const completedSets = match.sets.filter((s) => s.completed);
    if (completedSets.length > 0) {
      const lastSet = completedSets[completedSets.length - 1];
      const weight = lastSet.values[primaryFieldId];
      if (typeof weight === 'number') {
        return `He visto que tus últimas ${exerciseName}s son con ${weight}kg. Prueba a hacer 3×5 con ${weight + 2.5}kg la próxima vez. Si completas las 3 series, sube otros 2.5kg. Si fallas, repite el peso hasta dominarlo. 🎯`;
      }
    }
    return `Tienes "${match.name}" en tus bloques pero no hay series completadas. ¡Empieza a registrar para que pueda darte consejos más específicos!`;
  }

  return `No he encontrado ${exerciseName} en tus bloques. ¿Quieres crear un bloque nuevo con ese ejercicio? Mientras tanto, un buen punto de partida es encontrar tu peso para 5 repeticiones con técnica perfecta.`;
}

function getRunningAdvice(ctx: AIChatContext): string {
  const runBlocks = ctx.blocks.filter((b) => b.discipline === 'running');
  if (runBlocks.length === 0) {
    return 'No tienes bloques de running aún. Te sugiero crear uno y empezar con sesiones de 20-30 minutos a ritmo cómodo. La base aeróbica se construye con constancia. 🏃';
  }
  return 'Para mejorar tu running: 1) Alterna días de ritmo suave con intervalos, 2) Aumenta el volumen semanal un máximo del 10%, 3) Incluye un día largo a la semana. ¡La paciencia es clave en el running! 🏃';
}

function getPlanAdvice(ctx: AIChatContext): string {
  if (ctx.blocks.length === 0) {
    return 'Puedo ayudarte a diseñar un plan. ¿Cuál es tu objetivo principal? Puedes empezar creando bloques para los grupos musculares que quieras trabajar. Un buen comienzo es 3-4 días por semana con bloques de empuje, tirón y pierna. 📋';
  }
  return `Ya tienes ${ctx.blocks.length} bloques. Para un plan equilibrado, asegúrate de incluir: empuje (pecho, hombro, tríceps), tirón (espalda, bíceps), pierna, y al menos 1 día de movilidad. ¿Quieres que analice tu distribución actual? 🗓️`;
}

function getBadgeAdvice(ctx: AIChatContext): string {
  const total = 7; // 6 original + mission_complete
  const unlocked = ctx.badges.length;
  if (unlocked === 0) {
    return 'Aún no has desbloqueado ninguna insignia. ¡La primera es fácil! Completa una sola serie y ganarás "Primer paso" 🏁. ¡Vamos!';
  }
  const remaining = total - unlocked;
  return `Has desbloqueado ${unlocked}/${total} insignias. Te faltan ${remaining}. Sigue entrenando, mantén tu racha, y explora nuevos ejercicios para desbloquearlas todas. 🏅`;
}

function getRecoveryAdvice(ctx: AIChatContext): string {
  return 'El descanso es parte del entrenamiento. Recomendaciones: 1) Duerme 7-9 horas, 2) Come suficiente proteína (1.6-2.2g/kg), 3) Alterna grupos musculares, 4) Si algo duele más de 3 días, consulta a un profesional. ¡Tu cuerpo se construye descansando! 😴';
}

function getCatchAllResponse(ctx: AIChatContext): string {
  const responses = [
    '¡Buena pregunta! Estoy aprendiendo cada día más sobre entrenamiento. Por ahora, puedo ayudarte con tu racha, récords, misiones, y consejos sobre ejercicios específicos. ¿Qué te interesa? 🤔',
    `Hmm, no estoy seguro de cómo responder a eso todavía. Pero te cuento: tienes ${ctx.blocks.length} bloques y ${ctx.streak.current} días de racha. ¿Necesitas ayuda con algo de tu entrenamiento? 💬`,
    'Todavía estoy mejorando mis respuestas. Prueba a preguntarme sobre: cómo mejorar un ejercicio, tu racha, tus récords, o consejos de recuperación. ¡Estoy aquí para ayudarte! 🧠',
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

// ======================== UTILITIES ========================

function matchesAny(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => text.includes(kw));
}

/** Generate initial greeting from Kai. */
export function getInitialGreeting(ctx: AIChatContext): string {
  if (ctx.blocks.length === 0) {
    return '¡Hola! Soy Kai, tu asistente de entrenamiento 🤖. Estoy aquí para ayudarte a mejorar. Pregúntame lo que quieras sobre tu entrenamiento, récords, o cómo progresar.';
  }

  if (ctx.streak.current >= 3) {
    return `¡Hey! 🔥 ${ctx.streak.current} días de racha, ¡increíble! ¿En qué puedo ayudarte hoy? Pregúntame sobre tu progreso, ejercicios, o misiones.`;
  }

  return `¡Hola! Soy Kai 🤖. Tienes ${ctx.blocks.length} bloques en tu biblioteca. Pregúntame lo que necesites: consejos, análisis de tu progreso, o ideas para tu siguiente sesión.`;
}
