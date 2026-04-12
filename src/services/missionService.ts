// KAIROS — Mission Service
// Mock AI logic for generating and evaluating weekly missions.
// Pure functions — no side effects.

import { generateId } from '../types/core';
import type { WorkoutBlock } from '../types/core';
import type { Streak, Badge } from '../types/gamification';
import type {
  Mission,
  MissionTemplate,
  MissionCategory,
  CompletedMission,
} from '../types/mission';

// ======================== HELPERS ========================

/** Get current ISO week id, e.g. "2026-W15" */
export function getCurrentWeekId(): string {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor(
    (now.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24),
  );
  const weekNum = Math.ceil((dayOfYear + jan1.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/** Get end of current week (Sunday 23:59:59). */
function getWeekEnd(): string {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  const end = new Date(now);
  end.setDate(end.getDate() + daysUntilSunday);
  end.setHours(23, 59, 59, 999);
  return end.toISOString();
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ======================== TEMPLATES ========================

const MISSION_TEMPLATES: MissionTemplate[] = [
  {
    category: 'volume',
    emoji: '📦',
    titleFn: (t) => `Completa ${t} ${t === 1 ? 'bloque' : 'bloques'} esta semana`,
    descriptionFn: (t) =>
      `Abre y entrena en ${t} ${t === 1 ? 'bloque diferente' : 'bloques diferentes'} antes del domingo.`,
    targetRange: [2, 5],
    checkKey: 'blocks_with_completed_sets',
  },
  {
    category: 'volume',
    emoji: '🔢',
    titleFn: (t) => `Completa ${t} series en total`,
    descriptionFn: (t) =>
      `Marca al menos ${t} series como completadas esta semana.`,
    targetRange: [10, 30],
    checkKey: 'total_completed_sets',
  },
  {
    category: 'pr',
    emoji: '🏆',
    titleFn: () => 'Consigue un nuevo récord personal',
    descriptionFn: () =>
      'Supera tu mejor marca en cualquier ejercicio. ¡Supera tus límites!',
    targetRange: [1, 1],
    checkKey: 'new_prs',
  },
  {
    category: 'streak',
    emoji: '🔥',
    titleFn: (t) => `Mantén tu racha ${t} días`,
    descriptionFn: (t) =>
      `Entrena al menos ${t} días seguidos. ¡La constancia es la clave!`,
    targetRange: [3, 7],
    checkKey: 'streak_days',
  },
  {
    category: 'exploration',
    emoji: '🧪',
    titleFn: () => 'Prueba un ejercicio nuevo',
    descriptionFn: () =>
      'Crea un ejercicio que nunca hayas hecho y completa al menos 1 serie.',
    targetRange: [1, 1],
    checkKey: 'new_exercises',
  },
  {
    category: 'exploration',
    emoji: '🌈',
    titleFn: (t) => `Entrena ${t} disciplinas diferentes`,
    descriptionFn: (t) =>
      `Realiza series en bloques de ${t} disciplinas distintas esta semana.`,
    targetRange: [2, 3],
    checkKey: 'unique_disciplines',
  },
  {
    category: 'consistency',
    emoji: '📅',
    titleFn: (t) => `Entrena ${t} días esta semana`,
    descriptionFn: (t) =>
      `Registra actividad en al menos ${t} días diferentes.`,
    targetRange: [3, 5],
    checkKey: 'active_days',
  },
  {
    category: 'volume',
    emoji: '💪',
    titleFn: (t) => `Acumula ${t}kg de volumen total`,
    descriptionFn: (t) =>
      `La suma de peso × reps de todas tus series debe llegar a ${t}kg.`,
    targetRange: [500, 3000],
    checkKey: 'total_volume_kg',
  },
];

// ======================== GENERATION ========================

export interface UserContext {
  streak: Streak;
  badges: Badge[];
  blocks: WorkoutBlock[];
  completedMissions: CompletedMission[];
  prCount: number;
}

/**
 * Generate a weekly mission based on user context.
 * Uses heuristics to pick a relevant template.
 */
export function generateWeeklyMission(
  ctx: UserContext,
  excludeIds: string[] = [],
): Mission {
  // Weight templates by relevance
  const weighted = MISSION_TEMPLATES.map((tmpl) => {
    let weight = 1;

    // Boost streak missions if user has an active streak
    if (tmpl.category === 'streak' && ctx.streak.current >= 3) weight += 2;

    // Boost exploration if user has few blocks
    if (tmpl.category === 'exploration' && ctx.blocks.length <= 2) weight += 2;

    // Boost volume if user has many blocks
    if (tmpl.category === 'volume' && ctx.blocks.length >= 3) weight += 1;

    // Boost PR if user has completed sets
    if (tmpl.category === 'pr' && ctx.prCount > 0) weight += 1;

    // Lower weight for recently completed categories
    const recentCategories = new Set(
      ctx.completedMissions.slice(0, 3).map((m) => m.category),
    );
    if (recentCategories.has(tmpl.category)) weight -= 1;

    return { tmpl, weight: Math.max(weight, 0.5) };
  });

  // Weighted random pick
  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * totalWeight;
  let selected = weighted[0].tmpl;
  for (const { tmpl, weight } of weighted) {
    roll -= weight;
    if (roll <= 0) {
      selected = tmpl;
      break;
    }
  }

  const target = randInt(selected.targetRange[0], selected.targetRange[1]);
  const id = generateId();

  // Avoid duplicate IDs
  if (excludeIds.includes(id)) {
    return generateWeeklyMission(ctx, excludeIds);
  }

  return {
    id,
    title: selected.titleFn(target),
    description: selected.descriptionFn(target),
    emoji: selected.emoji,
    category: selected.category,
    status: 'active',
    targetValue: target,
    currentValue: 0,
    createdAt: new Date().toISOString(),
    completedAt: null,
    expiresAt: getWeekEnd(),
    weekId: getCurrentWeekId(),
  };
}

// ======================== PROGRESS CHECK ========================

/**
 * Evaluate mission progress based on current app state.
 * Returns the updated currentValue.
 */
export function evaluateMissionProgress(
  mission: Mission,
  blocks: WorkoutBlock[],
  streak: Streak,
  newPRsThisWeek: number,
  previousExerciseIds: Set<string>,
): number {
  const template = MISSION_TEMPLATES.find(
    (t) => t.titleFn(mission.targetValue) === mission.title,
  );
  if (!template) return mission.currentValue;

  switch (template.checkKey) {
    case 'blocks_with_completed_sets': {
      let count = 0;
      for (const block of blocks) {
        const hasCompleted = block.exercises.some((ex) =>
          ex.sets.some((s) => s.completed),
        );
        if (hasCompleted) count++;
      }
      return count;
    }

    case 'total_completed_sets': {
      let total = 0;
      for (const block of blocks) {
        for (const ex of block.exercises) {
          total += ex.sets.filter((s) => s.completed).length;
        }
      }
      return total;
    }

    case 'new_prs':
      return newPRsThisWeek;

    case 'streak_days':
      return streak.current;

    case 'new_exercises': {
      let newCount = 0;
      for (const block of blocks) {
        for (const ex of block.exercises) {
          const hasCompleted = ex.sets.some((s) => s.completed);
          if (hasCompleted && !previousExerciseIds.has(ex.id)) {
            newCount++;
          }
        }
      }
      return newCount;
    }

    case 'unique_disciplines': {
      const disciplines = new Set<string>();
      for (const block of blocks) {
        const hasCompleted = block.exercises.some((ex) =>
          ex.sets.some((s) => s.completed),
        );
        if (hasCompleted) disciplines.add(block.discipline);
      }
      return disciplines.size;
    }

    case 'active_days': {
      const days = new Set<string>();
      for (const block of blocks) {
        for (const ex of block.exercises) {
          for (const s of ex.sets) {
            if (s.completed && s.completed_at) {
              days.add(s.completed_at.slice(0, 10));
            }
          }
        }
      }
      return days.size;
    }

    case 'total_volume_kg': {
      let vol = 0;
      for (const block of blocks) {
        for (const ex of block.exercises) {
          const hasWeight = ex.fields.some((f) => f.id === 'weight');
          const hasReps = ex.fields.some((f) => f.id === 'reps');
          if (hasWeight && hasReps) {
            for (const s of ex.sets) {
              if (s.completed) {
                const w = typeof s.values['weight'] === 'number' ? (s.values['weight'] as number) : 0;
                const r = typeof s.values['reps'] === 'number' ? (s.values['reps'] as number) : 0;
                vol += w * r;
              }
            }
          }
        }
      }
      return vol;
    }

    default:
      return mission.currentValue;
  }
}

/**
 * Check if a mission is completed (currentValue >= targetValue).
 */
export function isMissionCompleted(mission: Mission): boolean {
  return mission.currentValue >= mission.targetValue;
}
