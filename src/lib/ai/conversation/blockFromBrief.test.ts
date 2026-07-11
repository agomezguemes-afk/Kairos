import { describe, it, expect, beforeEach } from 'vitest';

import { buildSessionBlockDeterministic } from './blockFromBrief';
import { inferBriefFromText } from './brief';
import { useWorkoutStore } from '../../../store/workoutStore';

// AsyncStorage's web fallback assumes `window` (same stub as the store suite).
(globalThis as { window?: unknown }).window = {
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
};

beforeEach(() => {
  useWorkoutStore.setState({ blocks: [] });
});

describe('buildSessionBlockDeterministic — commits a real session', () => {
  it('"hoy piernas 40 min en casa" → un bloque fuerza válido, favorito', () => {
    const brief = inferBriefFromText('hoy piernas 40 min en casa');
    const result = buildSessionBlockDeterministic(brief);

    const blocks = useWorkoutStore.getState().blocks;
    expect(blocks).toHaveLength(1);
    expect(blocks[0].id).toBe(result.blockId);
    expect(blocks[0].is_favorite).toBe(true);
    expect(blocks[0].name).toBe(brief.title); // conversational title wins
    expect(result.discipline).toBe('strength');
    expect(result.exercises.length).toBeGreaterThanOrEqual(2);

    // Every exercise carries at least one set — the block is doable as-is.
    for (const node of blocks[0].content) {
      if (node.type === 'exercise') {
        expect(node.data.exercise.sets.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('anexa sin borrar bloques existentes', () => {
    buildSessionBlockDeterministic(inferBriefFromText('hoy piernas'));
    buildSessionBlockDeterministic(inferBriefFromText('mañana correr'));
    expect(useWorkoutStore.getState().blocks).toHaveLength(2);
  });

  it('la descripción refleja el brief (foco/duración/sitio)', () => {
    const result = buildSessionBlockDeterministic(inferBriefFromText('pecho 30 min en el gym'));
    const block = useWorkoutStore.getState().blocks.find((b) => b.id === result.blockId);
    expect(block?.description).toContain('Foco');
    expect(block?.description).toContain('30 min');
  });

  it.each([
    ['algo suave', 'mobility'],
    ['quiero correr', 'running'],
    ['lo que sea', 'general'],
  ])('"%s" produce un bloque válido (disciplina %s)', (text, discipline) => {
    const result = buildSessionBlockDeterministic(inferBriefFromText(text));
    expect(result.discipline).toBe(discipline);
    expect(result.exercises.length).toBeGreaterThanOrEqual(1);
    expect(useWorkoutStore.getState().blocks).toHaveLength(1);
  });
});
