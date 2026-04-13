// KAIROS — AI Chat Service (Mock)
// Context-aware mock responses for the Kai assistant.
// Will be replaced with a real LLM integration later.

import type { WorkoutBlock, ExerciseCard, Discipline } from '../types/core';
import {
  generateId,
  createExerciseCard,
  createEmptySet,
  DISCIPLINE_CONFIGS,
} from '../types/core';
import type { Streak, Badge, PRCard } from '../types/gamification';
import type { Mission } from '../types/mission';
import type {
  AIAction,
  AIExerciseTemplate,
  AIMessage,
  SessionContext,
} from '../types/ai';

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

// ======================== SESSION STATE ========================

const session: SessionContext = {
  lastBlockId: null,
  conversationHistory: [],
};

// ======================== SESSION MANAGEMENT ========================

export function resetSession(): void {
  session.lastBlockId = null;
  session.conversationHistory = [];
}

export function patchSessionBlockId(realId: string): void {
  session.lastBlockId = realId;
}

// ======================== EXERCISE LIBRARIES ========================

interface ExerciseTemplate {
  name: string;
  sets: number;
  reps: number | string;
  rest: number;
  muscleGroup: string;
}

const HOME_STRENGTH_BEGINNER: ExerciseTemplate[] = [
  { name: 'Sentadilla', sets: 3, reps: 12, rest: 60, muscleGroup: 'Pierna' },
  { name: 'Flexión', sets: 3, reps: 10, rest: 60, muscleGroup: 'Pecho' },
  { name: 'Puente de glúteos', sets: 3, reps: 15, rest: 45, muscleGroup: 'Glúteo' },
  { name: 'Plancha', sets: 3, reps: '30s', rest: 45, muscleGroup: 'Core' },
  { name: 'Zancada inversa', sets: 3, reps: 10, rest: 60, muscleGroup: 'Pierna' },
];

const GYM_STRENGTH_BEGINNER: ExerciseTemplate[] = [
  { name: 'Sentadilla con barra', sets: 4, reps: 8, rest: 90, muscleGroup: 'Pierna' },
  { name: 'Press de banca', sets: 4, reps: 8, rest: 90, muscleGroup: 'Pecho' },
  { name: 'Jalón al pecho', sets: 3, reps: 10, rest: 75, muscleGroup: 'Espalda' },
  { name: 'Curl de bíceps', sets: 3, reps: 12, rest: 60, muscleGroup: 'Bíceps' },
  { name: 'Extensión de tríceps', sets: 3, reps: 12, rest: 60, muscleGroup: 'Tríceps' },
];

const HIIT_HOME: ExerciseTemplate[] = [
  { name: 'Burpee', sets: 4, reps: '40s', rest: 20, muscleGroup: 'Cuerpo completo' },
  { name: 'Rodillas altas', sets: 4, reps: '40s', rest: 20, muscleGroup: 'Cardio' },
  { name: 'Salto de tijera', sets: 4, reps: '40s', rest: 20, muscleGroup: 'Cardio' },
  { name: 'Flexión', sets: 4, reps: '40s', rest: 20, muscleGroup: 'Pecho' },
  { name: 'Plancha a montañero', sets: 4, reps: '40s', rest: 20, muscleGroup: 'Core' },
];

// ======================== INTENT CLASSIFICATION ========================

type Intent =
  | 'create_block'
  | 'update_exercise'
  | 'add_exercise'
  | 'delete_exercise'
  | 'query_info'
  | 'greeting'
  | 'unknown';

export function classifyIntent(text: string): Intent {
  const t = text.toLowerCase().trim();

  // Spanish + English creation phrases — ordered first so verbs like
  // "crea" don't leak into other branches.
  if (
    /\b(crea|crear|créame|créeme|diseña|diseñar|arma|ármame|prepara|preparar|hazme|haz\s+un|quiero\s+(?:un|una|crear)|nuevo\s+bloque|create|build|make|new\s+block)\b/i.test(
      t,
    )
  ) {
    return 'create_block';
  }
  if (/cambia|aumenta|modifica|sube|baja|pon\s|update|increase|set\s.+\sto/i.test(t)) return 'update_exercise';
  if (/añade|agrega|incluye|add|append/i.test(t)) return 'add_exercise';
  if (/elimina|borra|quita|remove|delete/i.test(t)) return 'delete_exercise';
  if (/cuántos|qué\s|muéstrame|show|how many|what/i.test(t)) return 'query_info';
  if (/^(hola|hey|buenas|hi|hello)/i.test(t)) return 'greeting';
  return 'unknown';
}

// ======================== EXERCISE SELECTION ========================

function selectExercises(
  category: string,
  _level: string,
  location: string,
): ExerciseTemplate[] {
  if (category === 'hiit') return HIIT_HOME;
  if (location === 'gym') return GYM_STRENGTH_BEGINNER;
  return HOME_STRENGTH_BEGINNER;
}

// ======================== BLOCK BUILDER ========================

type PartialBlock = Omit<WorkoutBlock, 'id' | 'created_at' | 'updated_at'>;

export function buildBlockFromText(text: string): PartialBlock {
  const t = text.toLowerCase();

  // Parse level
  let level = 'intermediate';
  if (/principiante|beginner/.test(t)) level = 'beginner';
  else if (/avanzado|advanced/.test(t)) level = 'advanced';

  // Parse location
  let location = 'home';
  if (/gimnasio|gym/.test(t)) location = 'gym';
  else if (/casa|home/.test(t)) location = 'home';

  // Parse category
  let category = 'strength';
  if (/hiit/.test(t)) category = 'hiit';
  else if (/cardio/.test(t)) category = 'cardio';

  // Parse days per week
  // Determine discipline
  const discipline: Discipline = category === 'cardio' ? 'running' : category === 'hiit' ? 'calisthenics' : 'strength';
  const config = DISCIPLINE_CONFIGS[discipline];

  // Level labels for title
  const levelLabels: Record<string, string> = {
    beginner: 'Principiante',
    intermediate: 'Intermedio',
    advanced: 'Avanzado',
  };
  const categoryLabels: Record<string, string> = {
    strength: 'Fuerza',
    hiit: 'HIIT',
    cardio: 'Cardio',
  };

  const blockName = `Bloque ${categoryLabels[category] ?? category} ${levelLabels[level] ?? level}`;

  // Select and build exercises
  const templates = selectExercises(category, level, location);
  const tempBlockId = generateId();

  const exercises: WorkoutBlock['exercises'] = templates.map((tmpl, i) => {
    const ex = createExerciseCard(tempBlockId, i, discipline, {
      name: tmpl.name,
      icon: config.icon,
      color: config.color,
    });

    // Adjust rest and set count from template
    const adjusted: typeof ex = {
      ...ex,
      rest_seconds: tmpl.rest,
      default_sets_count: tmpl.sets,
    };

    // Rebuild sets to match template count with proper field defaults
    const sets = Array.from({ length: tmpl.sets }, (_, si) =>
      createEmptySet(ex.id, si, ex.fields),
    );

    // Pre-fill reps/duration values from template
    const filledSets = sets.map((s) => {
      const newValues = { ...s.values };
      if (typeof tmpl.reps === 'number') {
        // Fill reps field if it exists
        const repsField = ex.fields.find((f) => f.id === 'reps');
        if (repsField) newValues[repsField.id] = tmpl.reps;
      } else {
        // Duration-based: parse seconds from string like '40s'
        const seconds = parseInt(tmpl.reps, 10);
        const durationField = ex.fields.find(
          (f) => f.id === 'duration' || f.name.toLowerCase().includes('duration') || f.name.toLowerCase().includes('hold'),
        );
        if (durationField && !isNaN(seconds)) {
          newValues[durationField.id] = seconds;
        }
      }
      return { ...s, values: newValues };
    });

    return { ...adjusted, sets: filledSets };
  });

  return {
    user_id: 'user_001',
    name: blockName,
    icon: config.icon,
    color: config.color,
    description: null,
    tags: [],
    discipline,
    exercises,
    status: 'draft',
    is_favorite: false,
    is_archived: false,
    last_performed_at: null,
    times_performed: 0,
    sort_order: 0,
    size: 'medium',
    cover: null,
  };
}

// ======================== EXERCISE UPDATE PARSER ========================

const COMMON_EXERCISE_NAMES: string[] = [
  'sentadilla', 'squat', 'sentadilla con barra', 'back squat', 'front squat',
  'press de banca', 'bench press', 'press banca',
  'peso muerto', 'deadlift',
  'press militar', 'overhead press', 'press de hombro',
  'jalón al pecho', 'lat pulldown', 'jalón',
  'remo con barra', 'barbell row', 'remo',
  'curl de bíceps', 'bicep curl', 'curl',
  'extensión de tríceps', 'tricep extension', 'extensión',
  'flexión', 'push-up', 'flexiones',
  'plancha', 'plank',
  'zancada', 'lunge', 'zancada inversa',
  'puente de glúteos', 'hip thrust', 'glute bridge',
  'burpee', 'rodillas altas', 'salto de tijera', 'jumping jack',
  'plancha a montañero', 'mountain climber',
];

export function parseExerciseUpdate(
  text: string,
): { exerciseName: string; field: string; value: number | string } | null {
  const t = text.toLowerCase();

  // Detect field and value
  let field: string | null = null;
  let value: number | string | null = null;

  const repsMatch = t.match(/(\d+)\s*(?:reps?|repeticiones?)/);
  if (repsMatch) {
    field = 'reps';
    value = parseInt(repsMatch[1], 10);
  }

  const setsMatch = t.match(/(\d+)\s*(?:sets?|series?)/);
  if (setsMatch && !field) {
    field = 'sets';
    value = parseInt(setsMatch[1], 10);
  }

  const restMatch = t.match(/(\d+)\s*(?:s(?:eg)?|segundos?|seconds?)\s*(?:descanso|rest)?/);
  if (restMatch && !field) {
    field = 'rest';
    value = parseInt(restMatch[1], 10);
  }

  const weightMatch = t.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?|pounds?|lbs?)/);
  if (weightMatch && !field) {
    field = 'weight';
    value = parseFloat(weightMatch[1]);
  }

  if (!field || value === null) return null;

  // Find exercise name in text
  const exerciseName = resolveExerciseName(t);
  if (!exerciseName) return null;

  return { exerciseName, field, value };
}

export function resolveExerciseName(text: string): string | null {
  const t = text.toLowerCase();
  // Sort by length descending so longer names match first
  const sorted = [...COMMON_EXERCISE_NAMES].sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    if (t.includes(name)) return name;
  }
  return null;
}

// ======================== EXERCISE → TEMPLATE SERIALIZER ========================

/**
 * Extract a transport-safe template from a fully built ExerciseCard.
 * Carries sets count, first-set reps/duration, and rest, so the store
 * can rebuild a structurally identical exercise on the other side of
 * the action dispatch boundary.
 */
function exerciseToTemplate(ex: ExerciseCard): AIExerciseTemplate {
  const firstSet = ex.sets[0];
  let reps: number | string | undefined;

  if (firstSet) {
    const repsField = ex.fields.find((f) => f.id === 'reps');
    if (repsField) {
      const val = firstSet.values[repsField.id];
      if (typeof val === 'number') reps = val;
    }
    if (reps === undefined) {
      const durationField = ex.fields.find(
        (f) =>
          f.id === 'duration' ||
          f.name.toLowerCase().includes('duration') ||
          f.name.toLowerCase().includes('hold'),
      );
      if (durationField) {
        const val = firstSet.values[durationField.id];
        if (typeof val === 'number') reps = `${val}s`;
      }
    }
  }

  return {
    name: ex.name,
    icon: ex.icon,
    color: ex.color,
    discipline: ex.discipline,
    sets_count: ex.sets.length,
    reps,
    rest_seconds: ex.rest_seconds,
  };
}

// ======================== PROCESS MESSAGE (main AI entry) ========================

export async function processMessage(
  userText: string,
  ctx: AIChatContext,
): Promise<AIMessage> {
  const intent = classifyIntent(userText);
  session.conversationHistory.push({ role: 'user', content: userText });

  let responseText = '';
  const actions: AIAction[] = [];
  let affectedBlockId: string | undefined;

  switch (intent) {
    case 'create_block': {
      const blockData = buildBlockFromText(userText);
      const tempId = generateId();
      session.lastBlockId = tempId;
      affectedBlockId = tempId;

      actions.push({
        type: 'create_block',
        payload: {
          name: blockData.name,
          discipline: blockData.discipline,
          icon: blockData.icon,
          color: blockData.color,
          cover: blockData.cover ?? undefined,
          exercises: blockData.exercises.map(exerciseToTemplate),
        },
      });

      const preview = blockData.exercises
        .slice(0, 3)
        .map((ex) => {
          const setsCount = ex.sets.length;
          const repsField = ex.fields.find((f) => f.id === 'reps');
          const durField = ex.fields.find(
            (f) => f.id === 'duration' || f.name.toLowerCase().includes('hold'),
          );
          const firstSet = ex.sets[0];
          let detail = '';
          if (repsField && firstSet && typeof firstSet.values[repsField.id] === 'number') {
            detail = `${setsCount}×${firstSet.values[repsField.id]} reps`;
          } else if (durField && firstSet && typeof firstSet.values[durField.id] === 'number') {
            detail = `${setsCount}×${firstSet.values[durField.id]}s`;
          } else {
            detail = `${setsCount} series`;
          }
          return `  • ${ex.name} — ${detail}`;
        })
        .join('\n');

      const moreCount = blockData.exercises.length - 3;
      const moreText = moreCount > 0 ? `\n  ...y ${moreCount} más` : '';

      responseText =
        `¡Listo! He creado "${blockData.name}" con ${blockData.exercises.length} ejercicios:\n\n` +
        preview +
        moreText +
        '\n\n¿Quieres que modifique algo?';
      break;
    }

    case 'update_exercise': {
      const blockId = session.lastBlockId ?? ctx.blocks[0]?.id ?? null;
      const parsed = parseExerciseUpdate(userText);

      if (!blockId) {
        responseText = 'No tengo un bloque activo. Crea uno primero o abre uno existente para que pueda modificar ejercicios.';
        break;
      }
      if (!parsed) {
        responseText = 'No pude entender qué quieres cambiar. Prueba algo como: "Pon 12 reps en sentadilla" o "Cambia press banca a 80kg".';
        break;
      }

      const block = ctx.blocks.find((b) => b.id === blockId);
      if (!block) {
        responseText = 'No encontré el bloque. ¿Seguro que existe?';
        break;
      }

      const targetEx = block.exercises.find((ex) =>
        ex.name.toLowerCase().includes(parsed.exerciseName),
      );
      if (!targetEx) {
        responseText = `No encontré "${parsed.exerciseName}" en el bloque "${block.name}". Los ejercicios disponibles son: ${block.exercises.map((e) => e.name).join(', ')}.`;
        break;
      }

      const updates: Record<string, unknown> = {};
      if (parsed.field === 'rest' && typeof parsed.value === 'number') {
        updates.rest_seconds = parsed.value;
      } else if (parsed.field === 'sets' && typeof parsed.value === 'number') {
        updates.default_sets_count = parsed.value;
      }

      actions.push({
        type: 'update_exercise',
        payload: {
          exerciseId: targetEx.id,
          updates,
        },
      });
      affectedBlockId = blockId;

      responseText = `[checkmark] Actualizado: ${targetEx.name} → ${parsed.field} = ${parsed.value}${parsed.field === 'rest' ? 's' : parsed.field === 'weight' ? 'kg' : ''}`;
      break;
    }

    case 'add_exercise': {
      const blockId = session.lastBlockId ?? ctx.blocks[0]?.id ?? null;
      if (!blockId) {
        responseText = 'No tengo un bloque activo. Crea uno primero.';
        break;
      }

      const exName = resolveExerciseName(userText);
      const displayName = exName
        ? exName.charAt(0).toUpperCase() + exName.slice(1)
        : 'Nuevo ejercicio';

      actions.push({
        type: 'add_exercise',
        payload: {
          blockId,
          name: displayName,
        },
      });
      affectedBlockId = blockId;

      responseText = `[add] He añadido "${displayName}" al bloque con 3×10 y 60s de descanso. ¿Quieres ajustar algo?`;
      break;
    }

    case 'delete_exercise': {
      const blockId = session.lastBlockId ?? ctx.blocks[0]?.id ?? null;
      if (!blockId) {
        responseText = 'No tengo un bloque activo. Crea uno primero.';
        break;
      }

      const exName = resolveExerciseName(userText);
      if (!exName) {
        responseText = 'No identifiqué qué ejercicio quieres eliminar. Nombra el ejercicio, por ejemplo: "Elimina sentadilla".';
        break;
      }

      const block = ctx.blocks.find((b) => b.id === blockId);
      const targetEx = block?.exercises.find((ex) =>
        ex.name.toLowerCase().includes(exName),
      );

      if (!targetEx) {
        responseText = `No encontré "${exName}" en el bloque actual.`;
        break;
      }

      actions.push({
        type: 'delete_exercise',
        payload: {
          blockId,
          exerciseId: targetEx.id,
        },
      });
      affectedBlockId = blockId;

      responseText = `[trash] Eliminado: "${targetEx.name}" del bloque.`;
      break;
    }

    case 'greeting':
    case 'query_info':
    case 'unknown':
    default: {
      // Delegate to existing mock responder — preserving all current behaviour
      responseText = getResponse(userText, ctx);
      break;
    }
  }

  session.conversationHistory.push({ role: 'assistant', content: responseText });

  return {
    id: generateId(),
    role: 'assistant',
    content: responseText,
    actions,
    timestamp: Date.now(),
    affectedBlockId,
  };
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
    return `¡${timeGreeting}! [streak] Llevas una racha increíble de ${ctx.streak.current} días. ¿En qué puedo ayudarte hoy?`;
  }
  if (ctx.blocks.length === 0) {
    return `¡${timeGreeting}! Veo que aún no has creado ningún bloque. ¿Quieres que te ayude a diseñar tu primer entrenamiento?`;
  }
  return `¡${timeGreeting}! Tienes ${ctx.blocks.length} ${ctx.blocks.length === 1 ? 'bloque' : 'bloques'} en tu biblioteca. ¿En qué te puedo ayudar?`;
}

function getStreakAdvice(ctx: AIChatContext): string {
  if (ctx.streak.current === 0) {
    return '¡Hoy es un buen día para empezar! Completa al menos una serie para iniciar tu racha. La constancia es lo que separa a los buenos de los grandes. [strength]';
  }
  if (ctx.streak.current < 7) {
    return `Llevas ${ctx.streak.current} días de racha. ¡Sigue así! El objetivo es llegar a 7 días para desbloquear la insignia "Iniciado" [streak]. Un consejo: entrena aunque sea 15 minutos los días difíciles.`;
  }
  if (ctx.streak.current < 30) {
    return `¡${ctx.streak.current} días de racha! [streak][streak] Estás en camino a la insignia de 30 días. Tu récord es de ${ctx.streak.longest} días. ¡Supéralo!`;
  }
  return `¡${ctx.streak.current} días! [streak][streak][streak] Eres una máquina de constancia. Tu cuerpo ya se ha adaptado a entrenar a diario. ¡Sigue rompiendo límites!`;
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
  return `Tu misión actual: "${m.title}"\n\nProgreso: ${m.currentValue}/${m.targetValue} (${pct}%)\n\n${m.description}\n\n¡Tú puedes! [strength]`;
}

function getImprovementAdvice(_msg: string, ctx: AIChatContext): string {
  // Try to find a relevant exercise in user's blocks
  const allExercises = ctx.blocks.flatMap((b) => b.exercises);
  const withSets = allExercises.filter((ex) =>
    ex.sets.some((s) => s.completed),
  );

  if (withSets.length === 0) {
    return 'Para darte consejos personalizados, necesito que completes algunas series primero. Registra tus pesos y reps, y podré analizar tu progreso y sugerirte mejoras. [stats]';
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

  return 'Para mejorar, te recomiendo: 1) Aumentar peso un 2-5% cada semana, 2) Mantener buena técnica, 3) Descansar adecuadamente entre sesiones, 4) Ser constante con tu racha. [progress]';
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
        return `He visto que tus últimas ${exerciseName}s son con ${weight}kg. Prueba a hacer 3×5 con ${weight + 2.5}kg la próxima vez. Si completas las 3 series, sube otros 2.5kg. Si fallas, repite el peso hasta dominarlo. [target]`;
      }
    }
    return `Tienes "${match.name}" en tus bloques pero no hay series completadas. ¡Empieza a registrar para que pueda darte consejos más específicos!`;
  }

  return `No he encontrado ${exerciseName} en tus bloques. ¿Quieres crear un bloque nuevo con ese ejercicio? Mientras tanto, un buen punto de partida es encontrar tu peso para 5 repeticiones con técnica perfecta.`;
}

function getRunningAdvice(ctx: AIChatContext): string {
  const runBlocks = ctx.blocks.filter((b) => b.discipline === 'running');
  if (runBlocks.length === 0) {
    return 'No tienes bloques de running aún. Te sugiero crear uno y empezar con sesiones de 20-30 minutos a ritmo cómodo. La base aeróbica se construye con constancia. [running]';
  }
  return 'Para mejorar tu running: 1) Alterna días de ritmo suave con intervalos, 2) Aumenta el volumen semanal un máximo del 10%, 3) Incluye un día largo a la semana. ¡La paciencia es clave en el running! [running]';
}

function getPlanAdvice(ctx: AIChatContext): string {
  if (ctx.blocks.length === 0) {
    return 'Puedo ayudarte a diseñar un plan. ¿Cuál es tu objetivo principal? Puedes empezar creando bloques para los grupos musculares que quieras trabajar. Un buen comienzo es 3-4 días por semana con bloques de empuje, tirón y pierna. [plan]';
  }
  return `Ya tienes ${ctx.blocks.length} bloques. Para un plan equilibrado, asegúrate de incluir: empuje (pecho, hombro, tríceps), tirón (espalda, bíceps), pierna, y al menos 1 día de movilidad. ¿Quieres que analice tu distribución actual? [calendar]`;
}

function getBadgeAdvice(ctx: AIChatContext): string {
  const total = 7; // 6 original + mission_complete
  const unlocked = ctx.badges.length;
  if (unlocked === 0) {
    return 'Aún no has desbloqueado ninguna insignia. ¡La primera es fácil! Completa una sola serie y ganarás "Primer paso" [first_step]. ¡Vamos!';
  }
  const remaining = total - unlocked;
  return `Has desbloqueado ${unlocked}/${total} insignias. Te faltan ${remaining}. Sigue entrenando, mantén tu racha, y explora nuevos ejercicios para desbloquearlas todas. [badge]`;
}

function getRecoveryAdvice(_ctx: AIChatContext): string {
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

// ═══════════════════════════════════════════════════════
// LLM SWAP POINT — replace processMessage() with this
// when Supabase Edge Function / Llama 3 is ready.
// ═══════════════════════════════════════════════════════
//
// export async function processMessage(
//   userText: string,
//   ctx: AIChatContext
// ): Promise<AIMessage> {
//
//   const response = await supabase.functions.invoke('kai-chat', {
//     body: {
//       message: userText,
//       history: session.conversationHistory,
//       context: {
//         blockCount: ctx.blocks.length,
//         streak: ctx.streak.current,
//         activeMission: ctx.activeMission?.title ?? null,
//       },
//       tools: [
//         {
//           name: 'create_block',
//           description: 'Creates a new workout block',
//           input_schema: { /* CreateBlockAction payload schema */ },
//         },
//         {
//           name: 'update_exercise',
//           description: 'Updates reps, sets or rest of an exercise',
//           input_schema: { /* UpdateExerciseAction payload schema */ },
//         },
//         {
//           name: 'add_exercise',
//           description: 'Adds an exercise to an existing block',
//           input_schema: { /* AddExerciseAction payload schema */ },
//         },
//         {
//           name: 'delete_exercise',
//           description: 'Removes an exercise from a block',
//           input_schema: { /* DeleteExerciseAction payload schema */ },
//         },
//         {
//           name: 'update_block_meta',
//           description: 'Updates block metadata (name, icon, color)',
//           input_schema: { /* UpdateBlockMetaAction payload schema */ },
//         },
//         {
//           name: 'delete_block',
//           description: 'Deletes an entire block',
//           input_schema: { /* DeleteBlockAction payload schema */ },
//         },
//       ],
//     },
//   });
//
//   const { text, tool_calls } = response.data;
//   const actions: AIAction[] = tool_calls.map(mapToolCallToAction);
//   session.conversationHistory.push(
//     { role: 'user', content: userText },
//     { role: 'assistant', content: text },
//   );
//   return {
//     id: generateId(),
//     role: 'assistant',
//     content: text,
//     actions,
//     timestamp: Date.now(),
//     affectedBlockId: actions.find((a) =>
//       a.type === 'create_block')?.payload?.id,
//   };
// }
//
// function mapToolCallToAction(tc: any): AIAction {
//   return { type: tc.name, payload: tc.input } as AIAction;
// }
