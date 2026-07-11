import { describe, it, expect } from 'vitest';

import { inferBriefFromText, briefToStarterAnswers, parseBriefArgs } from './brief';

describe('inferBriefFromText — clear input', () => {
  it('"hoy piernas 40 min en casa" → fuerza, foco piernas, 40 min, casa', () => {
    const b = inferBriefFromText('hoy piernas 40 min en casa');
    expect(b.discipline).toBe('strength');
    expect(b.focus).toBe('piernas');
    expect(b.durationMin).toBe(40);
    expect(b.location).toBe('casa');
    expect(b.intensity).toBe('normal');
    expect(b.title).toBe('Piernas en casa');
  });

  it('"quiero correr 5 km suave" → running + intensidad suave', () => {
    const b = inferBriefFromText('quiero correr 5 km suave');
    expect(b.discipline).toBe('running');
    expect(b.intensity).toBe('suave');
  });

  it('"media hora de gym, pecho, a tope" → fuerza, 30 min, gym, fuerte', () => {
    const b = inferBriefFromText('media hora de gym, pecho, a tope');
    expect(b.discipline).toBe('strength');
    expect(b.focus).toBe('pecho');
    expect(b.durationMin).toBe(30);
    expect(b.location).toBe('gym');
    expect(b.intensity).toBe('fuerte');
  });

  it('detecta material mencionado', () => {
    const b = inferBriefFromText('rutina con mancuernas y una barra');
    expect(b.equipment).toContain('mancuernas');
    expect(b.equipment).toContain('barra');
  });
});

describe('inferBriefFromText — vague input', () => {
  it('"no sé, algo suave" → movilidad suave (nunca vacío)', () => {
    const b = inferBriefFromText('no sé, algo suave');
    expect(b.discipline).toBe('mobility');
    expect(b.intensity).toBe('suave');
    expect(b.focus).toBeNull();
    expect(b.title.length).toBeGreaterThan(0);
  });

  it('"lo que sea" → general, sesión válida por defecto', () => {
    const b = inferBriefFromText('lo que sea');
    expect(b.discipline).toBe('general');
    expect(b.title.length).toBeGreaterThan(0);
  });
});

describe('briefToStarterAnswers', () => {
  it('casa sin material → bodyweight, nivel intermedio en normal', () => {
    const answers = briefToStarterAnswers(inferBriefFromText('hoy piernas en casa'));
    expect(answers.discipline).toBe('strength');
    expect(answers.equipment).toEqual(['bodyweight']);
    expect(answers.level).toBe('intermediate');
    expect(answers.frequency).toBe(1);
  });

  it('gym → desbloquea máquinas + barra + mancuernas', () => {
    const answers = briefToStarterAnswers(inferBriefFromText('pierna en el gimnasio'));
    expect(answers.equipment).toContain('machines_full_gym');
    expect(answers.equipment).toContain('barbell_plates');
    expect(answers.equipment).toContain('dumbbells');
  });

  it('intensidad ajusta el nivel: suave → beginner, fuerte → advanced', () => {
    expect(briefToStarterAnswers(inferBriefFromText('algo suave')).level).toBe('beginner');
    expect(briefToStarterAnswers(inferBriefFromText('fuerza a tope')).level).toBe('advanced');
  });
});

describe('parseBriefArgs — boundary validation', () => {
  it('argumentos válidos: respeta discipline/title/duration del modelo', () => {
    const raw = JSON.stringify({
      title: 'Piernas brutales',
      discipline: 'strength',
      duration_min: 45,
      intensity: 'fuerte',
      closing: 'Hecho, a darle.',
    });
    const { brief, closing } = parseBriefArgs(raw, 'hoy piernas');
    expect(brief.discipline).toBe('strength');
    expect(brief.title).toBe('Piernas brutales');
    expect(brief.durationMin).toBe(45);
    expect(brief.intensity).toBe('fuerte');
    expect(closing).toBe('Hecho, a darle.');
  });

  it('JSON malformado → infiere del texto del usuario (no rompe)', () => {
    const { brief, closing } = parseBriefArgs('{ not json', 'quiero correr un rato');
    expect(brief.discipline).toBe('running');
    expect(closing).toBeNull();
  });

  it('campos ausentes se rellenan por inferencia', () => {
    // discipline is present (schema requires it for the model) but the rest is
    // missing — the fallback text fills focus/location.
    const { brief } = parseBriefArgs(JSON.stringify({ discipline: 'strength' }), 'pecho en casa');
    expect(brief.discipline).toBe('strength');
    expect(brief.focus).toBe('pecho');
    expect(brief.location).toBe('casa');
    expect(brief.title.length).toBeGreaterThan(0);
  });

  it('objeto con claves desconocidas no revienta el parser', () => {
    const { brief } = parseBriefArgs(JSON.stringify({ foo: 'bar' }), 'hoy espalda');
    expect(brief.discipline).toBe('strength');
    expect(brief.focus).toBe('espalda');
  });
});
