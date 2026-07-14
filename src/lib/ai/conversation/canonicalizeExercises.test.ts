// KAIROS — Canonicalization: the LLM must speak the memory's vocabulary.
//
// Includes the REAL observed on-device failure (2026-07): a "piernas en casa"
// request produced "Press banca mancuernas" and "Press militar" — names the
// progression engine could never correlate with history, so the "Con tus
// números de la última vez" cue never fired on LLM blocks.

import { describe, it, expect } from 'vitest';

import {
  canonicalizeExerciseName,
  canonicalizeBlock,
  selectVocabularyForBrief,
} from './canonicalizeExercises';
import { buildVocabularyInstruction } from './prompts';
import { applyProgression } from '../../progression';
import { entry, exSummary, pset } from '../../progression/_fixtures';
import type { Discipline, WorkoutBlock } from '../../../types/core';
import { createExerciseCard, createWorkoutBlock } from '../../../types/core';
import { createDividerNode, createExerciseNode } from '../../../types/content';

// ─── helpers ────────────────────────────────────────────────────────────────

function blockWith(names: string[], discipline: Discipline = 'strength'): WorkoutBlock {
  const block = createWorkoutBlock('user_test', 0, discipline, { name: 'Test' });
  const content = names.map((name, i) =>
    createExerciseNode(i, createExerciseCard(block.id, i, discipline, { name })),
  );
  return { ...block, content };
}

// ─── observed on-device cases ───────────────────────────────────────────────

describe('canonicalizeExerciseName — observed LLM outputs', () => {
  it('"Press militar" adopts the library entry + libraryId (tier-1 unlock)', () => {
    expect(canonicalizeExerciseName('Press militar')).toEqual({
      name: 'Press militar',
      libraryId: 'lib-overhead-press',
    });
  });

  it('"Press banca mancuernas" matches the starter-template spelling exactly', () => {
    // Must NOT collapse into barbell "Press banca" — dumbbell kilos are not
    // barbell kilos. The starter option carries no libraryId; name is the key.
    expect(canonicalizeExerciseName('Press banca mancuernas')).toEqual({
      name: 'Press banca mancuernas',
    });
  });

  it('"press de banca con mancuernas" (connector-word variant) → same starter row', () => {
    expect(canonicalizeExerciseName('press de banca con mancuernas').name).toBe(
      'Press banca mancuernas',
    );
  });

  it('"Press banca" (barbell) keeps its library identity', () => {
    expect(canonicalizeExerciseName('Press banca')).toEqual({
      name: 'Press banca',
      libraryId: 'lib-bench-press',
    });
  });
});

// ─── matching robustness ────────────────────────────────────────────────────

describe('canonicalizeExerciseName — robustness', () => {
  it('accents + case: "JALON al pecho" → "Jalón al pecho"', () => {
    expect(canonicalizeExerciseName('JALON al pecho')).toEqual({
      name: 'Jalón al pecho',
      libraryId: 'lib-lat-pulldown',
    });
  });

  it('singular/plural: "flexión" and "flexiones" → "Flexiones"', () => {
    expect(canonicalizeExerciseName('flexión').name).toBe('Flexiones');
    expect(canonicalizeExerciseName('flexiones').name).toBe('Flexiones');
    expect(canonicalizeExerciseName('dominada').name).toBe('Dominadas');
  });

  it('reordered words: "mancuernas press banca" → "Press banca mancuernas"', () => {
    expect(canonicalizeExerciseName('mancuernas press banca').name).toBe('Press banca mancuernas');
  });

  it('"con barra" variants: dropped connector and explicit barbell both match', () => {
    expect(canonicalizeExerciseName('remo barra').name).toBe('Remo con barra');
    // Barbell-by-default convention: explicit "con barra" matches the unmarked
    // canonical ("Press militar" IS the barbell press).
    expect(canonicalizeExerciseName('press militar con barra')).toEqual({
      name: 'Press militar',
      libraryId: 'lib-overhead-press',
    });
    expect(canonicalizeExerciseName('sentadilla con barra').name).toBe('Sentadilla con barra');
  });

  it('"peso muerto" is a movement, not the implement word "peso"', () => {
    expect(canonicalizeExerciseName('peso muerto')).toEqual({
      name: 'Peso muerto',
      libraryId: 'lib-deadlift',
    });
    expect(canonicalizeExerciseName('peso muerto rumano')).toEqual({
      name: 'Peso muerto rumano',
      libraryId: 'lib-romanian-deadlift',
    });
    // The dumbbell RDL is its own row (template spelling), never the barbell's.
    expect(canonicalizeExerciseName('peso muerto rumano con mancuernas').name).toBe(
      'Peso muerto rumano con mancuernas',
    );
  });

  it('superset cycle suffix "· 2/3" is stripped before matching', () => {
    expect(canonicalizeExerciseName('Press banca · 2/3')).toEqual({
      name: 'Press banca',
      libraryId: 'lib-bench-press',
    });
  });

  it('"peso corporal" and "bodyweight" are the same implement', () => {
    const a = canonicalizeExerciseName('sentadillas peso corporal');
    const b = canonicalizeExerciseName('sentadilla bodyweight');
    expect(a.name).toBe(b.name);
    expect(a.libraryId).toBe('lib-bw-squat');
  });
});

describe('canonicalizeExerciseName — honest non-matches', () => {
  it('a different movement never collapses: "Sentadilla búlgara" stays novel', () => {
    expect(canonicalizeExerciseName('Sentadilla búlgara')).toEqual({
      name: 'Sentadilla búlgara',
    });
  });

  it('an implement the vocabulary lacks stays novel: "sentadilla con mancuernas"', () => {
    // Mapping it onto barbell "Sentadilla" would pollute history with
    // non-comparable loads.
    expect(canonicalizeExerciseName('sentadilla con mancuernas')).toEqual({
      name: 'sentadilla con mancuernas',
    });
  });

  it('a fully novel exercise passes through untouched', () => {
    expect(canonicalizeExerciseName('Turkish get-up con pausa')).toEqual({
      name: 'Turkish get-up con pausa',
    });
  });
});

// ─── block-level post-processing ────────────────────────────────────────────

describe('canonicalizeBlock', () => {
  it('rewrites matching exercises, attaches libraryIds, keeps novel names', () => {
    const block = blockWith(['press militar', 'Zancadas', 'Turkish get-up con pausa']);
    const out = canonicalizeBlock(block);

    expect(out).not.toBe(block);
    const cards = out.content.flatMap((n) => (n.type === 'exercise' ? [n.data.exercise] : []));
    expect(cards[0].name).toBe('Press militar');
    expect(cards[0].libraryId).toBe('lib-overhead-press');
    expect(cards[1].name).toBe('Zancadas');
    expect(cards[1].libraryId).toBe('lib-lunges');
    expect(cards[2].name).toBe('Turkish get-up con pausa');
    expect(cards[2].libraryId).toBeUndefined();
  });

  it('is a reference-preserving no-op when nothing matches', () => {
    const block = blockWith(['Turkish get-up con pausa', 'Cossack squat lastrada']);
    expect(canonicalizeBlock(block)).toBe(block);
  });

  it('leaves non-exercise nodes untouched by reference', () => {
    const block = blockWith(['press militar']);
    const divider = createDividerNode(1);
    const withDivider = { ...block, content: [...block.content, divider] };
    const out = canonicalizeBlock(withDivider);
    expect(out.content[1]).toBe(divider);
  });

  it('never drops an already-attached libraryId', () => {
    const block = blockWith(['Press banca mancuernas']);
    const node = block.content[0];
    if (node.type !== 'exercise') throw new Error('fixture broke');
    node.data.exercise.libraryId = 'lib-dumbbell-press';
    // Canonical name matches and carries no libraryId of its own → id survives.
    const out = canonicalizeBlock(block);
    const card = out.content[0].type === 'exercise' ? out.content[0].data.exercise : null;
    expect(card?.libraryId).toBe('lib-dumbbell-press');
  });
});

// ─── the payoff: enrichment fires on LLM blocks ─────────────────────────────

describe('canonicalizeBlock + applyProgression — the cue fires', () => {
  it('LLM-spelled "press militar" is enriched from history recorded as "Press militar"', () => {
    const history = [entry([exSummary('Press militar', [pset({ weight: 40, reps: 8 })])])];
    const block = blockWith(['press militar', 'Turkish get-up con pausa']);

    // Without canonicalization the LLM spelling matches nothing…
    // (lowercase "press militar" DOES name-match here since normalization
    // lowercases both — the observed failures were variant spellings:)
    const variant = blockWith(['press militar con barra']);
    expect(applyProgression(variant, history)).toBe(variant);

    // …with canonicalization, enrichment pre-fills the last session's numbers.
    const enriched = applyProgression(canonicalizeBlock(variant), history);
    expect(enriched).not.toBe(variant);
    const card = enriched.content[0].type === 'exercise' ? enriched.content[0].data.exercise : null;
    expect(card?.sets[0]?.values['weight']).toBe(40);
    expect(card?.sets[0]?.values['reps']).toBe(8);

    // And the straightforward spelling keeps working end to end.
    const enriched2 = applyProgression(canonicalizeBlock(block), history);
    expect(enriched2).not.toBe(block);
  });

  it('tier-1: canonicalized card matches history by libraryId even if history was renamed', () => {
    const history = [
      entry([
        exSummary('Militar de pie', [pset({ weight: 42.5, reps: 6 })], {
          libraryId: 'lib-overhead-press',
        }),
      ]),
    ];
    const block = blockWith(['press militar']);
    const enriched = applyProgression(canonicalizeBlock(block), history);
    const card = enriched.content[0].type === 'exercise' ? enriched.content[0].data.exercise : null;
    expect(card?.sets[0]?.values['weight']).toBe(42.5);
  });
});

// ─── vocabulary bias for generation ─────────────────────────────────────────

describe('selectVocabularyForBrief', () => {
  it('a leg-focused brief contains leg moves and NO upper-body presses', () => {
    const names = selectVocabularyForBrief({ discipline: 'strength', focus: 'piernas' });
    expect(names.length).toBeGreaterThanOrEqual(8);
    expect(names).toContain('Sentadilla');
    expect(names).toContain('Zancadas');
    expect(names).not.toContain('Press banca');
    expect(names).not.toContain('Press banca mancuernas');
    expect(names).not.toContain('Press militar');
    expect(names).not.toContain('Dominadas');
  });

  it('an unfocused strength brief includes the big lifts', () => {
    const names = selectVocabularyForBrief({ discipline: 'strength', focus: null });
    expect(names).toContain('Press banca');
    expect(names).toContain('Sentadilla');
    expect(names).toContain('Peso muerto');
  });

  it('respects the cap', () => {
    expect(selectVocabularyForBrief({ discipline: 'strength', focus: null }, 10)).toHaveLength(10);
    expect(
      selectVocabularyForBrief({ discipline: 'strength', focus: null }).length,
    ).toBeLessThanOrEqual(60);
  });

  it('running brief leads with running work, not barbell lifts', () => {
    const names = selectVocabularyForBrief({ discipline: 'running', focus: null }, 10);
    expect(names).toContain('Carrera continua');
    expect(names).not.toContain('Press banca');
  });
});

describe('buildVocabularyInstruction', () => {
  it('empty list → empty string (no prompt noise)', () => {
    expect(buildVocabularyInstruction([])).toBe('');
  });

  it('lists every name and explains the reuse contract', () => {
    const s = buildVocabularyInstruction(['Sentadilla', 'Zancadas']);
    expect(s).toContain('- Sentadilla');
    expect(s).toContain('- Zancadas');
    expect(s).toContain('EXACTAMENTE');
  });
});
