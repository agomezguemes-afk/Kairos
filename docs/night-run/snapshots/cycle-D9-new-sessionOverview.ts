// sessionOverview — pure model for SessionOverviewSheet (BRIEF-08). The sheet
// answers "¿cuánto queda?" at a glance: totals across the whole session plus,
// per exercise, enough to render an accordion (one expanded, the rest a
// one-line recap). All counting/formatting lives here so the component stays
// a thin render layer.

import type { ExerciseCard, ExerciseSet, FieldDefinition } from '../../../types/core';

export type ExerciseStatus = 'done' | 'current' | 'upcoming';

export interface OverviewSet {
  index: number; // 1-based — matches the "1 · 60 kg · 8" display idiom
  completed: boolean;
  summary: string; // '' when not completed
}

export interface OverviewExercise {
  id: string;
  name: string;
  done: number;
  total: number;
  status: ExerciseStatus;
  recap: string; // collapsed one-liner: "4 series" | "2/4 series" | "Pendiente"
  sets: OverviewSet[];
}

export interface SessionOverview {
  exercisesDone: number;
  exercisesTotal: number;
  setsDone: number;
  setsTotal: number;
  progressLabel: string; // "12 de 24 series"
  progress: number; // setsDone/setsTotal, 0 when setsTotal===0 — feeds the bar width
  exercises: OverviewExercise[];
}

/** "60 kg · 8" from a completed set's values — fields walked in `order`,
 * skipping empty/null. Pure; mirrors the scoreboard's own field walk. */
export function formatSetSummary(set: ExerciseSet, fields: FieldDefinition[]): string {
  const parts: string[] = [];
  const sorted = [...fields].sort((a, b) => a.order - b.order);
  for (const f of sorted) {
    const v = set.values[f.id];
    if (v == null || v === '') continue;
    parts.push(f.unit ? `${v} ${f.unit}` : String(v));
  }
  return parts.join(' · ');
}

function recapFor(done: number, total: number, complete: boolean): string {
  if (complete) return `${total} ${total === 1 ? 'serie' : 'series'}`;
  if (done > 0) return `${done}/${total} series`;
  return 'Pendiente';
}

export function buildSessionOverview(
  exercises: ExerciseCard[],
  currentIndex: number,
): SessionOverview {
  let setsDone = 0;
  let setsTotal = 0;
  let exercisesDone = 0;

  const overviewExercises: OverviewExercise[] = exercises.map((ex, i) => {
    const total = ex.sets.length;
    const done = ex.sets.filter((s) => s.completed).length;
    const complete = total > 0 && done === total;
    // Out-of-range currentIndex never matches any `i` here — nobody becomes
    // 'current', the rest fall through to done/upcoming. No crash, no guard needed.
    const status: ExerciseStatus = complete ? 'done' : i === currentIndex ? 'current' : 'upcoming';

    setsDone += done;
    setsTotal += total;
    if (status === 'done') exercisesDone += 1;

    const sets: OverviewSet[] = ex.sets.map((s, j) => ({
      index: j + 1,
      completed: s.completed,
      summary: s.completed ? formatSetSummary(s, ex.fields) : '',
    }));

    return {
      id: ex.id,
      name: ex.name,
      done,
      total,
      status,
      recap: recapFor(done, total, complete),
      sets,
    };
  });

  return {
    exercisesDone,
    exercisesTotal: exercises.length,
    setsDone,
    setsTotal,
    progressLabel: `${setsDone} de ${setsTotal} series`,
    progress: setsTotal > 0 ? setsDone / setsTotal : 0,
    exercises: overviewExercises,
  };
}
