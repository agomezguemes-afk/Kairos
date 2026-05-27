// Run: npx tsx src/data/libraryHelpers.dev.ts
import { instantiateTemplate, cloneLibraryEntry } from './libraryHelpers';
import { getTemplate, BLOCK_TEMPLATES } from './blockTemplates';
import { EXERCISE_LIBRARY, getLibraryEntry, searchLibrary, libraryByDiscipline, libraryByMuscleGroup } from './exerciseLibrary';

let failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (!cond) { console.error('FAIL', name, extra ?? ''); failed++; }
  else console.log('OK', name);
}

check('library ≥40 entries', EXERCISE_LIBRARY.length >= 40);
check('unique ids', new Set(EXERCISE_LIBRARY.map((e) => e.id)).size === EXERCISE_LIBRARY.length);
check('all have muscleGroups', EXERCISE_LIBRARY.every((e) => e.muscleGroups.length >= 1));
check('getLibraryEntry hit', getLibraryEntry('lib-bench-press')?.name === 'Press banca');
check('getLibraryEntry miss', getLibraryEntry('lib-nope') === null);
check('searchLibrary press', searchLibrary('press').length >= 2);
check('libraryByDiscipline strength ≥20', libraryByDiscipline('strength').length >= 20);
check('libraryByMuscleGroup chest ≥3', libraryByMuscleGroup('chest').length >= 3);

check('4 templates', BLOCK_TEMPLATES.length === 4);
check('all templates ≥3 exercises', BLOCK_TEMPLATES.every((t) => t.exercises.length >= 3));
check('all template refs valid', BLOCK_TEMPLATES.every((t) =>
  t.exercises.every((te) => getLibraryEntry(te.libraryId) !== null)));

const fb = getTemplate('tpl-full-body')!;
const { block, exercises } = instantiateTemplate(fb, 'user_test', 0);
check('full body name', block.name === 'Full Body 3×/semana');
check('5 exercises', exercises.length === 5);
check('first is squat', exercises[0].name === 'Sentadilla');
check('exercises link block', exercises.every((e) => e.workout_block_id === block.id));
check('squat has 4 sets', exercises[0].sets.length === 4);
check('squat has muscleGroups quads', (exercises[0].muscle_groups ?? []).includes('quads'));

const press = getLibraryEntry('lib-bench-press')!;
const clone = cloneLibraryEntry(press, 'block-x', 0, { setsCount: 6, goalWeight: 80, goalReps: 5 });
check('clone setsCount', clone.sets.length === 6);
check('clone goalWeight', clone.goalWeight === 80);
check('clone goalReps', clone.goalReps === 5);

if (failed > 0) { console.error(failed, 'failures'); process.exit(1); }
console.log('all libraryHelpers checks pass');
