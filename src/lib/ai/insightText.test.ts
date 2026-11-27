import { afterEach, describe, expect, it } from 'vitest';

import { plateauInsight, ruleInsight } from './insightText';
import { registerProvider, unregisterProvider } from './providers';
import type { LlmProvider } from './providers/types';

const facts = { exerciseName: 'Sentadilla', weeksStalled: 4, lastMax: 102.5 };

function localSaying(text: string, tasks: string[] = ['coach']): LlmProvider {
  return {
    id: 'test-local',
    kind: 'local',
    capabilities: { json: true, tools: true, contextTokens: 2048 },
    status: () => ({ available: true }),
    suits: (t) => tasks.includes(t),
    complete: async () => ({ content: text }),
  };
}

afterEach(() => unregisterProvider('test-local'));

describe('plateau insight', () => {
  it('uses the model when its numbers come from the data', async () => {
    const said = 'Llevas 4 semanas en 102,5 kg: prueba una variante con pausa abajo.';
    registerProvider(localSaying(said));
    expect(await plateauInsight(facts)).toBe(said);
  });

  it('rejects a load the model invented and falls back to the engine', async () => {
    registerProvider(localSaying('Sube 5 kg la semana que viene.'));
    expect(await plateauInsight(facts)).toBe(ruleInsight(facts));
  });

  it('skips a model not trusted with coach text', async () => {
    registerProvider(localSaying('Llevas 4 semanas así.', ['goal']));
    expect(await plateauInsight(facts)).toBe(ruleInsight(facts));
  });

  it('without any model the engine text stands', async () => {
    expect(await plateauInsight(facts)).toBe(ruleInsight(facts));
  });
});
