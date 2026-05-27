// KAIROS — User context summarizer
// Compacts profile + recent activity into a prompt-friendly snapshot for Kai.
// Caps history at MAX_DAYS / MAX_EXERCISES to keep tokens bounded as data grows.

import type { WorkoutBlock, ExerciseCard, ExerciseSet } from '../types/core';
import { getBlockExercises } from '../types/core';
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

export interface WeeklyAggregates {
  /** Number of training sessions in the rolling 7-day window. */
  sessions: number;
  /** Sum of weight×reps in the window (only completed sets with both). */
  totalVolume: number;
  /** Total completed sets in the window. */
  totalSets: number;
  /** Set count by movement-pattern bucket inferred from exercise names. */
  setsByBucket: Record<string, number>;
  /** Top exercises by frequency (name → completed-set count). */
  topExercises: Array<{ name: string; sets: number }>;
  /** Crude compound vs isolation split based on a name keyword list. */
  compoundIsolationRatio: { compound: number; isolation: number };
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
    injuries: string | null;
    workoutPlace: string | null;
    equipment: string[];
    equipmentNotes: string | null;
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
  weeklyAggregates: WeeklyAggregates;
  badgeCount: number;
  /** Optional id of the block the user is currently editing. Surfaces in the prompt. */
  currentBlockId?: string;
}

// ======================== COLLECTOR ========================

export interface RawUserContext {
  profile: UserProfile;
  blocks: WorkoutBlock[];
  streak: Streak;
  prCards: PRCard[];
  badges: Badge[];
  activeMission: Mission | null;
  /** Optional: pass when the user is inside a specific block editor. */
  currentBlockId?: string;
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
    exerciseCount: getBlockExercises(b).length,
    exerciseNames: getBlockExercises(b).map((ex) => ex.name),
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

  const weeklyAggregates = computeWeeklyAggregates(raw.blocks);

  return {
    profile: {
      level: raw.profile.fitnessLevel ?? 'unspecified',
      goal: raw.profile.primaryGoal ?? 'unspecified',
      frequency: raw.profile.weeklyFrequency,
      age: raw.profile.age,
      weightKg: raw.profile.weight,
      heightCm: raw.profile.height,
      disciplines: raw.profile.disciplines,
      injuries: raw.profile.injuries,
      workoutPlace: raw.profile.workoutPlace,
      equipment: raw.profile.equipment ?? [],
      equipmentNotes: raw.profile.equipmentNotes ?? null,
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
    weeklyAggregates,
    badgeCount: raw.badges.length,
    currentBlockId: raw.currentBlockId,
  };
}

// ======================== WEEKLY AGGREGATES ========================
//
// Lightweight, name-keyword based bucketing. Good enough for prompt context;
// not a substitute for proper exercise tagging once we have it.

const COMPOUND_KEYWORDS = [
  'sentadilla',
  'squat',
  'press',
  'banca',
  'bench',
  'peso muerto',
  'deadlift',
  'remo',
  'row',
  'dominada',
  'pull-up',
  'pullup',
  'fondos',
  'dip',
  'clean',
  'snatch',
  'thruster',
  'jerk',
  'overhead',
  'zancada',
  'lunge',
  'hip thrust',
];

const PUSH_KEYWORDS = ['press', 'banca', 'bench', 'fondos', 'dip', 'push', 'flexion', 'flexión', 'overhead'];
const PULL_KEYWORDS = ['remo', 'row', 'dominada', 'pull-up', 'pullup', 'pull', 'curl', 'face pull'];
const LEG_KEYWORDS = ['sentadilla', 'squat', 'lunge', 'zancada', 'peso muerto', 'deadlift', 'leg', 'calf', 'gemelo', 'hip thrust', 'glute', 'glúteo'];
const CORE_KEYWORDS = ['plancha', 'plank', 'crunch', 'abs', 'abdominal', 'leg raise', 'hollow', 'sit-up', 'situp'];

function bucketForName(name: string): string {
  const n = name.toLowerCase();
  if (LEG_KEYWORDS.some((k) => n.includes(k))) return 'legs';
  if (PULL_KEYWORDS.some((k) => n.includes(k))) return 'pull';
  if (PUSH_KEYWORDS.some((k) => n.includes(k))) return 'push';
  if (CORE_KEYWORDS.some((k) => n.includes(k))) return 'core';
  return 'other';
}

function isCompound(name: string): boolean {
  const n = name.toLowerCase();
  return COMPOUND_KEYWORDS.some((k) => n.includes(k));
}

function computeWeeklyAggregates(blocks: WorkoutBlock[]): WeeklyAggregates {
  const cutoffMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const setsByBucket: Record<string, number> = {};
  const setsByExercise = new Map<string, number>();
  const sessionDates = new Set<string>();
  let totalVolume = 0;
  let totalSets = 0;
  let compound = 0;
  let isolation = 0;

  for (const block of blocks) {
    for (const ex of getBlockExercises(block)) {
      for (const s of ex.sets) {
        if (!s.completed || !s.completed_at) continue;
        if (Date.parse(s.completed_at) < cutoffMs) continue;
        totalSets += 1;
        sessionDates.add(s.completed_at.slice(0, 10));
        const bucket = bucketForName(ex.name);
        setsByBucket[bucket] = (setsByBucket[bucket] ?? 0) + 1;
        setsByExercise.set(ex.name, (setsByExercise.get(ex.name) ?? 0) + 1);
        if (isCompound(ex.name)) compound += 1;
        else isolation += 1;
        const w = typeof s.values['weight'] === 'number' ? (s.values['weight'] as number) : 0;
        const r = typeof s.values['reps'] === 'number' ? (s.values['reps'] as number) : 0;
        totalVolume += w * r;
      }
    }
  }

  const topExercises = Array.from(setsByExercise.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, sets]) => ({ name, sets }));

  return {
    sessions: sessionDates.size,
    totalVolume: Math.round(totalVolume),
    totalSets,
    setsByBucket,
    topExercises,
    compoundIsolationRatio: { compound, isolation },
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
  if (snap.profile.workoutPlace) {
    lines.push(`- Lugar: ${snap.profile.workoutPlace}`);
  }
  if (snap.profile.equipment.length > 0 || snap.profile.equipmentNotes) {
    const eq = [...snap.profile.equipment];
    if (snap.profile.equipmentNotes) eq.push(`(otros: ${snap.profile.equipmentNotes})`);
    lines.push(`- Material disponible: ${eq.join(', ') || 'ninguno indicado'}`);
  }
  if (snap.profile.injuries) {
    lines.push(`- Lesiones / limitaciones: ${snap.profile.injuries}`);
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
      const cur = b.id === snap.currentBlockId ? ' [BLOQUE ACTIVO]' : '';
      lines.push(`- [${b.id}] "${b.name}" (${b.discipline}, ${b.exerciseCount} ej.)${list}${cur}`);
    }
  } else {
    lines.push('');
    lines.push('BLOQUES ACTUALES: ninguno. El usuario todavía no ha creado bloques.');
  }

  // Weekly aggregates — concise so we don't blow the budget.
  const wa = snap.weeklyAggregates;
  if (wa.totalSets > 0) {
    lines.push('');
    lines.push('ÚLTIMOS 7 DÍAS:');
    lines.push(`- Sesiones: ${wa.sessions} · Series completadas: ${wa.totalSets} · Volumen: ${wa.totalVolume}kg`);
    const buckets = Object.entries(wa.setsByBucket)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}:${v}`);
    if (buckets.length > 0) lines.push(`- Distribución: ${buckets.join(' / ')}`);
    const ratio = wa.compoundIsolationRatio;
    if (ratio.compound + ratio.isolation > 0) {
      lines.push(`- Compuestos vs aislados: ${ratio.compound} / ${ratio.isolation}`);
    }
    if (wa.topExercises.length > 0) {
      const tops = wa.topExercises.map((e) => `${e.name}(${e.sets})`).join(', ');
      lines.push(`- Top ejercicios: ${tops}`);
    }
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
    for (const ex of getBlockExercises(block)) {
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
