import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parseGoal } from '../adaptive/goalParser';
import { interpretGoal, mergeAiGoal } from './goalInterpreter';

const base = () => ({ ...parseGoal('quiero estar mejor'), source: 'rules' as const });

describe('mergeAiGoal', () => {
  it('overlays valid fields and marks the source', () => {
    const g = mergeAiGoal(base(), {
      sports: ['padel'],
      qualities: ['endurance', 'speed'],
      daysPerWeek: 2,
      horizonWeeks: 13,
      confidence: 0.85,
      summary: 'Aguantar tres sets de pádel sin bajar el ritmo',
      question: null,
    });
    expect(g.source).toBe('ai');
    expect(g.sports).toEqual(['padel']);
    expect(g.qualities).toEqual(['endurance', 'speed']);
    expect(g.daysPerWeek).toBe(2);
    expect(g.horizonWeeks).toBe(13);
    expect(g.confidence).toBe(0.85);
    expect(g.summary).toMatch(/pádel/);
    expect(g.question).toBeUndefined();
  });

  it('drops values outside the engine enums and dedupes', () => {
    const g = mergeAiGoal(base(), {
      sports: ['skiing', 'Climbing', 'climbing', 42],
      qualities: ['flexibility', 'strength', 'STRENGTH'],
    });
    expect(g.sports).toEqual(['climbing']);
    expect(g.qualities).toEqual(['strength']);
  });

  it('keeps rules values for missing or out-of-range numbers', () => {
    const b = base();
    const g = mergeAiGoal(b, { sports: ['running'], daysPerWeek: 12, horizonWeeks: null });
    expect(g.daysPerWeek).toBe(b.daysPerWeek);
    expect(g.horizonWeeks).toBe(b.horizonWeeks);
  });

  it('accepts numeric strings and rounds', () => {
    const g = mergeAiGoal(base(), { sports: ['cycling'], daysPerWeek: '3.6' });
    expect(g.daysPerWeek).toBe(4);
  });

  it('removes "general" when a real sport is present', () => {
    const g = mergeAiGoal(base(), { sports: ['general', 'hiking'] });
    expect(g.sports).toEqual(['hiking']);
  });

  it('clamps confidence and truncates long text', () => {
    const g = mergeAiGoal(base(), { sports: ['tennis'], confidence: 3, summary: 'x'.repeat(400) });
    expect(g.confidence).toBe(1);
    expect(g.summary!.length).toBeLessThanOrEqual(140);
  });

  it('returns the base untouched when nothing is usable', () => {
    const b = base();
    expect(mergeAiGoal(b, { foo: 1 })).toBe(b);
    expect(mergeAiGoal(b, null)).toBe(b);
    expect(mergeAiGoal(b, ['padel'])).toBe(b);
  });
});

describe('interpretGoal', () => {
  const realKey = process.env.EXPO_PUBLIC_GROQ_API_KEY;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_GROQ_API_KEY = 'test-key';
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    process.env.EXPO_PUBLIC_GROQ_API_KEY = realKey;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const reply = (content: string) =>
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { role: 'assistant', content } }] }),
    });

  it('uses the rules parse when no key is configured', async () => {
    process.env.EXPO_PUBLIC_GROQ_API_KEY = '';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const g = await interpretGoal('mejorar al pádel en resistencia');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(g.source).toBe('rules');
    expect(g.sports).toEqual(['padel']);
  });

  it('understands a goal the rules miss', async () => {
    vi.stubGlobal(
      'fetch',
      reply(
        JSON.stringify({
          sports: ['padel'],
          qualities: ['endurance'],
          daysPerWeek: null,
          horizonWeeks: null,
          confidence: 0.8,
          summary: 'Llegar entero al tercer set',
          question: null,
        }),
      ),
    );
    const text = 'me ahogo en el tercer set los domingos';
    expect(parseGoal(text).sports).toEqual(['general']);
    const g = await interpretGoal(text);
    expect(g.source).toBe('ai');
    expect(g.sports).toEqual(['padel']);
    expect(g.qualities).toEqual(['endurance']);
  });

  it('falls back on malformed JSON', async () => {
    vi.stubGlobal('fetch', reply('not json'));
    const g = await interpretGoal('ganar fuerza para escalada');
    expect(g.source).toBe('rules');
    expect(g.sports).toEqual(['climbing']);
  });

  it('falls back on HTTP errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => 'rate limited' }),
    );
    const g = await interpretGoal('correr un 10k');
    expect(g.source).toBe('rules');
    expect(g.sports).toEqual(['running']);
  });

  it('falls back when the model is slower than the timeout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    const g = await interpretGoal('aguantar rutas de montaña', 20);
    expect(g.source).toBe('rules');
    expect(g.sports).toEqual(['hiking']);
  });
});
