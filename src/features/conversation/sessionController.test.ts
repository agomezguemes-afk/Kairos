import { describe, it, expect, beforeEach } from 'vitest';

import {
  createConversationSession,
  hybridClosingLine,
  type SessionDeps,
} from './sessionController';
import { deterministicConversationDeps } from '../../lib/ai/conversation';
import type {
  BuiltSession,
  ConversationDeps,
  IntakeDecision,
  SessionBrief,
} from '../../lib/ai/conversation';
import { useWorkoutStore } from '../../store/workoutStore';

// AsyncStorage's web fallback assumes `window` (same stub as the store suite).
(globalThis as { window?: unknown }).window = {
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
};

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

const HYBRID_BUILT: BuiltSession = {
  blockId: 'block_hybrid',
  blockName: 'Carrera híbrida',
  discipline: 'general',
  exercises: [{ name: 'SkiErg', detail: '1 serie' }],
  durationMin: 45,
  source: 'template',
};

function engineDeps(over: Partial<ConversationDeps> = {}): ConversationDeps {
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

function sessionDeps(over: Partial<SessionDeps> = {}): SessionDeps {
  return {
    engine: engineDeps(),
    buildHybrid: async () => HYBRID_BUILT,
    isHybridAsk: (t) => t.toLowerCase().includes('hyrox'),
    ...over,
  };
}

describe('sessionController — camino feliz (input claro)', () => {
  it('una frase clara → done, bloque, y solo la confirmación de Kai', async () => {
    const session = createConversationSession(sessionDeps());
    await session.send('hoy piernas 40 min en casa');

    const s = session.getSnapshot();
    expect(s.phase).toBe('done');
    expect(s.result?.blockId).toBe('block_1');
    expect(s.canSend).toBe(false);
    expect(s.messages.map((m) => m.role)).toEqual(['user', 'kai']);
    expect(s.streamingText).toBeNull();
  });

  it('emite las fases thinking → building → done por suscripción', async () => {
    const session = createConversationSession(sessionDeps());
    const phases: string[] = [];
    session.subscribe(() => phases.push(session.getSnapshot().phase));
    await session.send('hoy piernas');
    expect(phases).toContain('thinking');
    expect(phases).toContain('building');
    expect(phases.at(-1)).toBe('done');
  });

  it('tras done no acepta más mensajes', async () => {
    const session = createConversationSession(sessionDeps());
    await session.send('hoy piernas');
    const before = session.getSnapshot().messages.length;
    await session.send('otra cosa');
    expect(session.getSnapshot().messages).toHaveLength(before);
  });
});

describe('sessionController — input vago (turno de pregunta)', () => {
  function askThenBuild(): ConversationDeps {
    let call = 0;
    return engineDeps({
      intakeTurn: async (_h, onDelta): Promise<IntakeDecision> => {
        call += 1;
        if (call === 1) {
          onDelta('¿Cuánto ');
          onDelta('rato tienes?');
          return { kind: 'ask', text: '¿Cuánto rato tienes?' };
        }
        return { kind: 'build', brief: BRIEF, closing: 'Hecho. A darle.' };
      },
    });
  }

  it('pregunta → idle con canSend, luego construye', async () => {
    const session = createConversationSession(sessionDeps({ engine: askThenBuild() }));

    await session.send('no sé, algo');
    let s = session.getSnapshot();
    expect(s.phase).toBe('idle');
    expect(s.canSend).toBe(true);
    expect(s.result).toBeNull();
    expect(s.messages.at(-1)?.text).toBe('¿Cuánto rato tienes?');

    await session.send('media hora');
    s = session.getSnapshot();
    expect(s.phase).toBe('done');
    expect(s.messages.at(-1)?.text).toBe('Hecho. A darle.');
  });

  it('acumula streamingText con los deltas y lo limpia al resolver', async () => {
    const session = createConversationSession(sessionDeps({ engine: askThenBuild() }));
    const streams: (string | null)[] = [];
    session.subscribe(() => streams.push(session.getSnapshot().streamingText));

    await session.send('no sé, algo');
    expect(streams).toContain('¿Cuánto ');
    expect(streams).toContain('¿Cuánto rato tienes?');
    expect(session.getSnapshot().streamingText).toBeNull();
  });
});

describe('sessionController — resiliencia', () => {
  it('intakeTurn revienta → build determinista inferido del texto, sin romper', async () => {
    const briefs: SessionBrief[] = [];
    const session = createConversationSession(
      sessionDeps({
        engine: engineDeps({
          intakeTurn: async () => {
            throw new Error('groq 503');
          },
          buildBlock: async (brief) => {
            briefs.push(brief);
            return builtFrom(brief);
          },
        }),
      }),
    );
    await session.send('hoy pecho en casa');
    const s = session.getSnapshot();
    expect(s.phase).toBe('done');
    expect(briefs[0]?.focus).toBe('pecho'); // inferido, no BRIEF
    expect(s.result).toBeTruthy();
  });

  it('build falla → fase error visible con canSend, y retry() lo saca adelante', async () => {
    let attempt = 0;
    const session = createConversationSession(
      sessionDeps({
        engine: engineDeps({
          buildBlock: async (brief) => {
            attempt += 1;
            if (attempt === 1) throw new Error('boom');
            return builtFrom(brief);
          },
        }),
      }),
    );

    await session.send('hoy piernas');
    let s = session.getSnapshot();
    expect(s.phase).toBe('error');
    expect(s.error).toContain('boom');
    expect(s.canSend).toBe(true); // nunca se queda tirado

    await session.retry();
    s = session.getSnapshot();
    expect(s.phase).toBe('done');
    expect(s.result?.blockId).toBe('block_1');
  });

  it('ignora mensajes vacíos y envíos mientras hay un turno en vuelo', async () => {
    let resolveIntake: (d: IntakeDecision) => void = () => {};
    const session = createConversationSession(
      sessionDeps({
        engine: engineDeps({
          intakeTurn: () =>
            new Promise<IntakeDecision>((resolve) => {
              resolveIntake = resolve;
            }),
        }),
      }),
    );

    await session.send('   ');
    expect(session.getSnapshot().messages).toHaveLength(0);

    const inflight = session.send('hoy piernas');
    await session.send('mensaje colado'); // busy → ignorado
    resolveIntake({ kind: 'build', brief: BRIEF, closing: null });
    await inflight;

    const users = session.getSnapshot().messages.filter((m) => m.role === 'user');
    expect(users).toHaveLength(1);
  });

  it('reset() deja la sesión como nueva', async () => {
    const session = createConversationSession(sessionDeps());
    await session.send('hoy piernas');
    session.reset();
    const s = session.getSnapshot();
    expect(s.messages).toHaveLength(0);
    expect(s.phase).toBe('idle');
    expect(s.result).toBeNull();
    expect(s.canSend).toBe(true);
  });
});

describe('sessionController — fast-path híbrido', () => {
  it('"algo tipo hyrox" → preset sembrado sin tocar el LLM', async () => {
    let intakeCalled = false;
    const session = createConversationSession(
      sessionDeps({
        engine: engineDeps({
          intakeTurn: async () => {
            intakeCalled = true;
            return { kind: 'ask', text: '' };
          },
        }),
      }),
    );

    await session.send('algo tipo hyrox');
    const s = session.getSnapshot();
    expect(intakeCalled).toBe(false);
    expect(s.phase).toBe('done');
    expect(s.result).toBe(HYBRID_BUILT);
    expect(s.messages.map((m) => m.role)).toEqual(['user', 'kai']);
    expect(s.messages.at(-1)?.text).toBe(hybridClosingLine('Carrera híbrida'));
  });

  it('emite la fase building durante la siembra', async () => {
    const session = createConversationSession(sessionDeps());
    const phases: string[] = [];
    session.subscribe(() => phases.push(session.getSnapshot().phase));
    await session.send('algo tipo hyrox');
    expect(phases).toContain('building');
    expect(phases.at(-1)).toBe('done');
  });

  it('también dispara a mitad de conversación, con el orden de burbujas correcto', async () => {
    const session = createConversationSession(
      sessionDeps({
        engine: engineDeps({
          intakeTurn: async (): Promise<IntakeDecision> => ({
            kind: 'ask',
            text: '¿Qué te apetece?',
          }),
        }),
      }),
    );

    await session.send('no sé');
    await session.send('mejor algo tipo hyrox');

    const s = session.getSnapshot();
    expect(s.phase).toBe('done');
    expect(s.messages.map((m) => m.role)).toEqual(['user', 'kai', 'user', 'kai']);
    expect(s.messages[2].text).toBe('mejor algo tipo hyrox');
  });

  it('si el preset falla, cae al motor con el mismo texto (nunca tirado)', async () => {
    const intakeTexts: string[] = [];
    const session = createConversationSession(
      sessionDeps({
        buildHybrid: () => {
          throw new Error('preset roto');
        },
        engine: engineDeps({
          intakeTurn: async (history): Promise<IntakeDecision> => {
            const last = history.at(-1);
            if (last && typeof last.content === 'string') intakeTexts.push(last.content);
            return { kind: 'build', brief: BRIEF, closing: null };
          },
        }),
      }),
    );

    await session.send('algo tipo hyrox');
    const s = session.getSnapshot();
    expect(s.phase).toBe('done');
    expect(s.result?.blockId).toBe('block_1');
    expect(intakeTexts).toContain('algo tipo hyrox');
    // La burbuja optimista del fast-path no se duplica: solo un turno de usuario.
    expect(s.messages.filter((m) => m.role === 'user')).toHaveLength(1);
  });
});

describe('sessionController — integración con el store real', () => {
  beforeEach(() => {
    useWorkoutStore.setState({ blocks: [] });
  });

  it('deps deterministas → el bloque queda insertado en el workoutStore', async () => {
    const session = createConversationSession(
      sessionDeps({
        engine: deterministicConversationDeps(),
        isHybridAsk: () => false,
      }),
    );

    await session.send('hoy piernas 40 min en casa');
    const s = session.getSnapshot();
    expect(s.phase).toBe('done');

    const blocks = useWorkoutStore.getState().blocks;
    expect(blocks).toHaveLength(1);
    expect(blocks[0].id).toBe(s.result?.blockId);
    expect(blocks[0].is_favorite).toBe(true);
  });
});
