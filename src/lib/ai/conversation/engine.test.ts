import { describe, it, expect } from 'vitest';

import { createConversation, MAX_QUESTION_TURNS } from './engine';
import type { BuiltSession, ConversationDeps, IntakeDecision, SessionBrief } from './types';

const BRIEF: SessionBrief = {
  title: 'Piernas en casa',
  discipline: 'strength',
  focus: 'piernas',
  durationMin: 40,
  location: 'casa',
  intensity: 'normal',
  equipment: [],
  notes: null,
};

function builtFrom(brief: SessionBrief): BuiltSession {
  return {
    blockId: 'block_1',
    blockName: brief.title,
    discipline: brief.discipline,
    exercises: [{ name: 'Sentadilla', detail: '4 series' }],
    durationMin: brief.durationMin ?? 0,
    source: 'ai',
  };
}

function makeDeps(over: Partial<ConversationDeps> = {}): ConversationDeps {
  return {
    aiAvailable: () => true,
    intakeTurn: async (): Promise<IntakeDecision> => ({
      kind: 'build',
      brief: BRIEF,
      closing: null,
    }),
    buildBlock: async (brief) => builtFrom(brief),
    ...over,
  };
}

describe('conversation engine — clear input', () => {
  it('input claro → 0 preguntas → bloque en el primer turno', async () => {
    const convo = createConversation(
      makeDeps({
        intakeTurn: async () => ({ kind: 'build', brief: BRIEF, closing: 'Hecho. A darle.' }),
      }),
    );
    const s = await convo.send('hoy piernas 40 min en casa');

    expect(s.phase).toBe('done');
    expect(s.userTurns).toBe(1);
    expect(s.result?.blockId).toBe('block_1');
    expect(s.brief?.discipline).toBe('strength');
    const kai = s.messages.filter((m) => m.role === 'kai');
    expect(kai).toHaveLength(1); // only the confirmation, no question
    expect(kai[0].text).toBe('Hecho. A darle.');
  });
});

describe('conversation engine — vague input', () => {
  it('input vago → una pregunta → luego bloque', async () => {
    let call = 0;
    const convo = createConversation(
      makeDeps({
        intakeTurn: async (): Promise<IntakeDecision> => {
          call += 1;
          return call === 1
            ? { kind: 'ask', text: '¿Cuánto rato tienes?' }
            : { kind: 'build', brief: BRIEF, closing: null };
        },
      }),
    );

    const s1 = await convo.send('no sé, algo');
    expect(s1.phase).toBe('idle');
    expect(s1.result).toBeNull();
    expect(s1.messages.at(-1)).toMatchObject({ role: 'kai', text: '¿Cuánto rato tienes?' });

    const s2 = await convo.send('media hora');
    expect(s2.phase).toBe('done');
    expect(s2.result?.blockId).toBe('block_1');
    // Canned closing when the model gives none.
    expect(s2.messages.at(-1)?.text).toContain('Piernas en casa');
  });

  it('fuerza el build tras MAX_QUESTION_TURNS preguntas', async () => {
    const forceFlags: boolean[] = [];
    const convo = createConversation(
      makeDeps({
        intakeTurn: async (_h, _d, force): Promise<IntakeDecision> => {
          forceFlags.push(force);
          return { kind: 'ask', text: '¿…?' };
        },
      }),
    );

    await convo.send('a');
    await convo.send('b');
    await convo.send('c');

    // First MAX_QUESTION_TURNS turns are free; the next is pinned to build.
    expect(forceFlags).toEqual([false, false, true]);
    expect(MAX_QUESTION_TURNS).toBe(2);
  });
});

describe('conversation engine — streaming', () => {
  it('reenvía los deltas de texto al callback onDelta', async () => {
    const deltas: string[] = [];
    const convo = createConversation(
      makeDeps({
        intakeTurn: async (_h, onDelta): Promise<IntakeDecision> => {
          onDelta('¿Cuánto ');
          onDelta('rato?');
          return { kind: 'ask', text: '¿Cuánto rato?' };
        },
      }),
    );
    await convo.send('hola', { onDelta: (d) => deltas.push(d) });
    expect(deltas).toEqual(['¿Cuánto ', 'rato?']);
  });

  it('emite fases idle→thinking→building→done vía onPhase', async () => {
    const phases: string[] = [];
    const convo = createConversation(makeDeps());
    await convo.send('hoy piernas', { onPhase: (p) => phases.push(p) });
    expect(phases).toEqual(['thinking', 'building', 'done']);
  });
});

describe('conversation engine — fallbacks (LLM cae)', () => {
  it('sin IA disponible → build determinista sin llamar a intakeTurn', async () => {
    let intakeCalled = false;
    const convo = createConversation(
      makeDeps({
        aiAvailable: () => false,
        intakeTurn: async () => {
          intakeCalled = true;
          return { kind: 'ask', text: '' };
        },
        // deterministic build receives the inferred brief, not BRIEF
        buildBlock: async (brief) => builtFrom(brief),
      }),
    );
    const s = await convo.send('hoy pecho en casa');
    expect(intakeCalled).toBe(false);
    expect(s.phase).toBe('done');
    expect(s.brief?.discipline).toBe('strength'); // inferred from "pecho"
    expect(s.brief?.focus).toBe('pecho');
    expect(s.result).toBeTruthy();
  });

  it('intakeTurn lanza excepción → cae a build determinista, no rompe', async () => {
    const convo = createConversation(
      makeDeps({
        intakeTurn: async () => {
          throw new Error('groq 503');
        },
        buildBlock: async (brief) => builtFrom(brief),
      }),
    );
    const s = await convo.send('hoy piernas');
    expect(s.phase).toBe('done');
    expect(s.result).toBeTruthy();
    expect(s.brief?.discipline).toBe('strength');
  });

  it('build que falla → fase de error visible, con mensaje de reintento', async () => {
    const convo = createConversation(
      makeDeps({
        intakeTurn: async () => ({ kind: 'build', brief: BRIEF, closing: null }),
        buildBlock: async () => {
          throw new Error('boom');
        },
      }),
    );
    const s = await convo.send('hoy piernas');
    expect(s.phase).toBe('error');
    expect(s.error).toContain('boom');
    expect(s.messages.at(-1)?.text).toMatch(/intentamos|otra vez/i);
  });
});

describe('conversation engine — hygiene', () => {
  it('ignora mensajes vacíos', async () => {
    const convo = createConversation(makeDeps());
    const s = await convo.send('   ');
    expect(s.userTurns).toBe(0);
    expect(s.messages).toHaveLength(0);
  });

  it('reset() limpia el estado', async () => {
    const convo = createConversation(makeDeps());
    await convo.send('hoy piernas');
    convo.reset();
    expect(convo.getState().messages).toHaveLength(0);
    expect(convo.getState().phase).toBe('idle');
  });
});
