// KAIROS — User context summarizer
// Compacts profile + recent activity into a prompt-friendly snapshot for Kai.
// Caps history at MAX_DAYS / MAX_EXERCISES to keep tokens bounded as data grows.

import type { WorkoutBlock, ExerciseCard, ExerciseSet } from '../types/core';
import type { UserProfile } from '../types/profile';
import type { Streak, PRCard, Badge } from '../types/gamification';
import type { Mission } from '../types/mission';

const MAX_DAYS = 14;
const MAX_RECENT_EXERCISES = 20;
const MAX_RECENT_PRS = 5;

// ======================== PUBLIC TYPES ========================

export interface RecentExerciseSummary {
  name: string;
  blockName: string;
  discipline: string;
  lastPerformed: string | null;
  totalSets: number;
  completedSets: number;
  bestReps: number | null;
  bestWeight: number | null;
  bestDurationSec: number | null;
}

export interface BlockSummary {
  id: string;
  name: string;
  discipline: string;
  exerciseCount: number;
  exerciseNames: string[];
}

export interface UserContextSnapshot {
  profile: {
    level: string;
    goal: string;
    frequency: number | null;
    age: number | null;
    weightKg: number | null;
    heightCm: number | null;
    disciplines: string[];
  };
  streak: { current: number; longest: number };
  activeMission: {
    title: string;
    description: string;
    progress: number;
    target: number;
  } | null;
  blocks: BlockSummary[];
  recentExercises: RecentExerciseSummary[];
  recentPRs: Array<{
    exerciseName: string;
    field: string;
    value: number;
    unit: string | null;
    date: string;
  }>;
  badgeCount: number;
}

// ======================== COLLECTOR ========================

export interface RawUserContext {
  profile: UserProfile;
  blocks: WorkoutBlock[];
  streak: Streak;
  prCards: PRCard[];
  badges: Badge[];
  activeMission: Mission | null;
}

/**
 * Build a compact, prompt-ready snapshot from the raw Zustand + context state.
 * The caller is responsible for passing fresh values — see AIChatScreen.buildCtx.
 */
export function buildUserContextSnapshot(
  raw: RawUserContext,
): UserContextSnapshot {
  const cutoff = Date.now() - MAX_DAYS * 24 * 60 * 60 * 1000;

  const blocks: BlockSummary[] = raw.blocks.map((b) => ({
    id: b.id,
    name: b.name,
    discipline: b.discipline,
    exerciseCount: b.exercises.length,
    exerciseNames: b.exercises.map((ex) => ex.name),
  }));

  const recentExercises = collectRecentExercises(raw.blocks, cutoff).slice(
    0,
    MAX_RECENT_EXERCISES,
  );

  const recentPRs = [...raw.prCards]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, MAX_RECENT_PRS)
    .map((pr) => ({
      exerciseName: pr.exerciseName,
      field: pr.fieldName,
      value: pr.value,
      unit: pr.unit,
      date: pr.date,
    }));

  return {
    profile: {
      level: raw.profile.fitnessLevel ?? 'unspecified',
      goal: raw.profile.primaryGoal ?? 'unspecified',
      frequency: raw.profile.weeklyFrequency,
      age: raw.profile.age,
      weightKg: raw.profile.weight,
      heightCm: raw.profile.height,
      disciplines: raw.profile.disciplines,
    },
    streak: { current: raw.streak.current, longest: raw.streak.longest },
    activeMission: raw.activeMission
      ? {
          title: raw.activeMission.title,
          description: raw.activeMission.description,
          progress: raw.activeMission.currentValue,
          target: raw.activeMission.targetValue,
        }
      : null,
    blocks,
    recentExercises,
    recentPRs,
    badgeCount: raw.badges.length,
  };
}

// ======================== RENDERING ========================

/**
 * Format the snapshot as a plain-text block to splice into the system prompt.
 * Deterministic and token-efficient — no narration, just facts.
 */
export function renderContextForPrompt(snap: UserContextSnapshot): string {
  const lines: string[] = [];

  lines.push('PERFIL DEL USUARIO:');
  lines.push(`- Nivel: ${snap.profile.level}`);
  lines.push(`- Objetivo principal: ${snap.profile.goal}`);
  if (snap.profile.frequency !== null) {
    lines.push(`- Frecuencia: ${snap.profile.frequency} días/semana`);
  }
  if (snap.profile.age !== null) lines.push(`- Edad: ${snap.profile.age}`);
  if (snap.profile.weightKg !== null) {
    lines.push(`- Peso: ${snap.profile.weightKg} kg`);
  }
  if (snap.profile.disciplines.length > 0) {
    lines.push(`- Disciplinas: ${snap.profile.disciplines.join(', ')}`);
  }

  lines.push('');
  lines.push(`RACHA: ${snap.streak.current} días (máx ${snap.streak.longest})`);
  lines.push(`INSIGNIAS DESBLOQUEADAS: ${snap.badgeCount}`);

  if (snap.activeMission) {
    lines.push('');
    lines.push('MISIÓN ACTIVA:');
    lines.push(`- ${snap.activeMission.title}: ${snap.activeMission.progress}/${snap.activeMission.target}`);
  }

  if (snap.blocks.length > 0) {
    lines.push('');
    lines.push('BLOQUES ACTUALES (usa estos IDs al actualizar o eliminar):');
    for (const b of snap.blocks) {
      const list = b.exerciseNames.length > 0 ? ` → ${b.exerciseNames.join(', ')}` : '';
      lines.push(`- [${b.id}] "${b.name}" (${b.discipline}, ${b.exerciseCount} ej.)${list}`);
    }
  } else {
    lines.push('');
    lines.push('BLOQUES ACTUALES: ninguno. El usuario todavía no ha creado bloques.');
  }

  if (snap.recentExercises.length > 0) {
    lines.push('');
    lines.push(`ACTIVIDAD RECIENTE (últimos ${MAX_DAYS} días):`);
    for (const ex of snap.recentExercises) {
      const parts: string[] = [];
      if (ex.bestWeight !== null) parts.push(`${ex.bestWeight}kg`);
      if (ex.bestReps !== null) parts.push(`${ex.bestReps} reps`);
      if (ex.bestDurationSec !== null) parts.push(`${ex.bestDurationSec}s`);
      const detail = parts.length > 0 ? ` — mejor: ${parts.join(' × ')}` : '';
      lines.push(
        `- ${ex.name} (${ex.blockName}): ${ex.completedSets}/${ex.totalSets} series${detail}`,
      );
    }
  }

  if (snap.recentPRs.length > 0) {
    lines.push('');
    lines.push('PRs RECIENTES:');
    for (const pr of snap.recentPRs) {
      const unit = pr.unit ?? '';
      lines.push(`- ${pr.exerciseName}: ${pr.value}${unit} (${pr.field})`);
    }
  }

  return lines.join('\n');
}

// ======================== INTERNALS ========================

function collectRecentExercises(
  blocks: WorkoutBlock[],
  cutoffMs: number,
): RecentExerciseSummary[] {
  const out: RecentExerciseSummary[] = [];

  for (const block of blocks) {
    for (const ex of block.exercises) {
      const summary = summarizeExercise(ex, block, cutoffMs);
      if (summary) out.push(summary);
    }
  }

  return out.sort((a, b) => {
    const ta = a.lastPerformed ? Date.parse(a.lastPerformed) : 0;
    const tb = b.lastPerformed ? Date.parse(b.lastPerformed) : 0;
    return tb - ta;
  });
}

function summarizeExercise(
  ex: ExerciseCard,
  block: WorkoutBlock,
  cutoffMs: number,
): RecentExerciseSummary | null {
  const completed = ex.sets.filter((s) => s.completed);
  if (completed.length === 0) return null;

  const lastCompletedAt = completed
    .map((s) => s.completed_at)
    .filter((t): t is string => !!t)
    .sort()
    .pop() ?? null;

  if (lastCompletedAt && Date.parse(lastCompletedAt) < cutoffMs) {
    return null;
  }

  const repsField = ex.fields.find((f) => f.id === 'reps');
  const weightField = ex.fields.find(
    (f) => f.id === 'weight' || f.name.toLowerCase().includes('peso'),
  );
  const durationField = ex.fields.find(
    (f) =>
      f.id === 'duration' ||
      f.name.toLowerCase().includes('duration') ||
      f.name.toLowerCase().includes('hold'),
  );

  return {
    name: ex.name,
    blockName: block.name,
    discipline: ex.discipline,
    lastPerformed: lastCompletedAt,
    totalSets: ex.sets.length,
    completedSets: completed.length,
    bestReps: repsField ? maxNumeric(completed, repsField.id) : null,
    bestWeight: weightField ? maxNumeric(completed, weightField.id) : null,
    bestDurationSec: durationField ? maxNumeric(completed, durationField.id) : null,
  };
}

function maxNumeric(sets: ExerciseSet[], fieldId: string): number | null {
  let best: number | null = null;
  for (const s of sets) {
    const v = s.values[fieldId];
    if (typeof v === 'number' && (best === null || v > best)) best = v;
  }
  return best;
}
