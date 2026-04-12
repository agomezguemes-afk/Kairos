// KAIROS — Gamification Service
// Pure functions for streak, badge, and PR card logic.
// No side effects — persistence is handled by the context.

import { generateId } from '../types/core';
import type { ExerciseCard, ExerciseSet, FieldDefinition } from '../types/core';
import type {
  Streak,
  Badge,
  BadgeId,
  PRCard,
  ExerciseBestMap,
  GamificationStats,
} from '../types/gamification';

// ======================== DATE HELPERS ========================

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

// ======================== STREAK ========================

export function updateStreak(prev: Streak): Streak {
  const today = toDateKey(new Date());

  // Already recorded today — no change
  if (prev.lastActivityDate === today) return prev;

  let newCurrent: number;
  if (prev.lastActivityDate === null) {
    // First ever activity
    newCurrent = 1;
  } else {
    const gap = daysBetween(prev.lastActivityDate, today);
    if (gap === 1) {
      // Consecutive day
      newCurrent = prev.current + 1;
    } else {
      // Gap > 1 day — reset to 1 (today counts)
      newCurrent = 1;
    }
  }

  const newLongest = Math.max(prev.longest, newCurrent);
  return {
    current: newCurrent,
    longest: newLongest,
    lastActivityDate: today,
  };
}

// ======================== BADGES ========================

const PR_MESSAGES = [
  '¡Nuevo récord personal!',
  '¡Has superado tu mejor marca!',
  '¡Récord destrozado!',
  '¡Eres más fuerte que ayer!',
  '¡Marca personal superada!',
];

export function checkBadges(
  stats: GamificationStats,
  existing: Badge[],
): Badge[] {
  const unlockedIds = new Set(existing.map((b) => b.id));
  const newBadges: Badge[] = [];
  const now = new Date().toISOString();

  const tryUnlock = (id: BadgeId, condition: boolean) => {
    if (!unlockedIds.has(id) && condition) {
      newBadges.push({ id, unlockedAt: now });
    }
  };

  tryUnlock('first_step', stats.totalCompletedSets >= 1);
  tryUnlock('streak_7', stats.streak.current >= 7);
  tryUnlock('streak_30', stats.streak.current >= 30);
  tryUnlock('volume_100', stats.totalCompletedSets >= 100);
  tryUnlock('explorer_5', stats.uniqueExerciseIds.length >= 5);
  tryUnlock('block_creator', stats.userCreatedBlocks >= 1);
  tryUnlock('mission_complete', stats.completedMissions >= 1);

  return newBadges;
}

// ======================== PR CARDS ========================

/**
 * Check if completing a set creates a new PR.
 * Returns a PRCard if a record was broken, or null.
 * Also returns the updated best map entry.
 */
export function checkForPR(
  exercise: ExerciseCard,
  set: ExerciseSet,
  bestMap: ExerciseBestMap,
): { card: PRCard | null; updatedBests: Record<string, number> } {
  // Find the primary numeric field
  const primaryField = exercise.fields.find(
    (f: FieldDefinition) => f.isPrimary && f.type === 'number',
  );
  if (!primaryField) return { card: null, updatedBests: bestMap[exercise.id] ?? {} };

  const value = set.values[primaryField.id];
  if (typeof value !== 'number' || value <= 0) {
    return { card: null, updatedBests: bestMap[exercise.id] ?? {} };
  }

  const currentBests = bestMap[exercise.id] ?? {};
  const previousBest = currentBests[primaryField.id] ?? 0;
  const updatedBests = { ...currentBests };

  if (value > previousBest) {
    updatedBests[primaryField.id] = value;

    // Build secondary text (e.g. "x 8 reps")
    let secondaryText: string | null = null;
    const secondaryField = exercise.fields.find(
      (f) => f.id !== primaryField.id && f.type === 'number',
    );
    if (secondaryField) {
      const secVal = set.values[secondaryField.id];
      if (typeof secVal === 'number' && secVal > 0) {
        const u = secondaryField.unit ? ` ${secondaryField.unit}` : '';
        secondaryText = `x ${secVal}${u}`;
      }
    }

    const unit = primaryField.unit ? ` ${primaryField.unit}` : '';
    const message = PR_MESSAGES[Math.floor(Math.random() * PR_MESSAGES.length)];

    const card: PRCard = {
      id: generateId(),
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      exerciseIcon: exercise.icon,
      fieldId: primaryField.id,
      fieldName: primaryField.name,
      value,
      unit: primaryField.unit,
      secondaryText,
      date: new Date().toISOString(),
      message,
    };

    return { card, updatedBests };
  }

  // No PR — but still update bests if this is the first value
  if (previousBest === 0) {
    updatedBests[primaryField.id] = value;
  }

  return { card: null, updatedBests };
}

// ======================== STATS COMPUTATION ========================

/**
 * Compute gamification stats from the current block list.
 * Called after any mutation to re-check badges.
 */
export function computeStats(
  blocks: Array<{
    exercises: Array<{
      id: string;
      sets: Array<{ completed: boolean }>;
    }>;
  }>,
  userCreatedBlocks: number,
  streak: Streak,
): GamificationStats {
  let totalCompletedSets = 0;
  const uniqueExerciseIds = new Set<string>();

  for (const block of blocks) {
    for (const ex of block.exercises) {
      const completedCount = ex.sets.filter((s) => s.completed).length;
      if (completedCount > 0) {
        uniqueExerciseIds.add(ex.id);
        totalCompletedSets += completedCount;
      }
    }
  }

  return {
    totalCompletedSets,
    uniqueExerciseIds: Array.from(uniqueExerciseIds),
    userCreatedBlocks,
    streak,
    completedMissions: 0, // Updated externally when missions are completed
  };
}
