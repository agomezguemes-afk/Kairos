import { describe, expect, it } from 'vitest';
import { reflect, type ReflectionInputs } from './reflection';

const BASE: ReflectionInputs = {
  weeksTraining: 8,
  sessionsTotal: 24,
  gains: [{ name: 'Press banca', from: 80, to: 92 }],
  domainsCount: 2,
};

describe('reflect', () => {
  it('stays silent for a never-trained user', () => {
    expect(reflect({ weeksTraining: 0, sessionsTotal: 0, gains: [], domainsCount: 0 })).toBeNull();
  });

  it('acknowledges the cold start (first sessions) — where churn is highest', () => {
    const first = reflect({ weeksTraining: 1, sessionsTotal: 1, gains: [], domainsCount: 1 });
    expect(first).not.toBeNull();
    expect(first!.headline).toBe('Primera sesión hecha.');
    expect(first!.lines[0]).toMatch(/empezar/);

    const third = reflect({ weeksTraining: 1, sessionsTotal: 3, gains: [], domainsCount: 1 });
    expect(third!.headline).toBe('3 sesiones ya.');
  });

  it('shows the biggest real gain in plain, specific words', () => {
    const r = reflect(BASE);
    expect(r).not.toBeNull();
    expect(r!.headline).toBe('8 semanas. 24 sesiones.');
    expect(r!.lines[0]).toBe('Tu Press banca pasó de 80 a 92.');
  });

  it('picks the largest improvement across metrics', () => {
    const r = reflect({
      ...BASE,
      gains: [
        { name: 'Press banca', from: 80, to: 85 }, // +5
        { name: 'Sentadilla', from: 100, to: 120 }, // +20 → wins
      ],
    });
    expect(r!.lines[0]).toMatch(/Sentadilla/);
  });

  it('respects lower-is-better metrics (a faster time is progress)', () => {
    const r = reflect({
      ...BASE,
      gains: [{ name: '5k', from: 1500, to: 1410, lowerIsBetter: true }],
    });
    expect(r!.lines[0]).toBe('Tu 5k bajó de 1500 a 1410.');
  });

  it('ignores non-improvements and non-finite gains', () => {
    const r = reflect({
      ...BASE,
      domainsCount: 1,
      sessionsTotal: 24,
      gains: [
        { name: 'Press', from: 90, to: 85 }, // got worse
        { name: 'Curl', from: NaN, to: 20 }, // garbage
      ],
    });
    // no real gain, but plenty of sessions → it reflects on consistency instead
    expect(r).not.toBeNull();
    expect(r!.lines.some((l) => l.includes('apareces'))).toBe(true);
  });

  it('does not manufacture a moment with no gains and thin history', () => {
    expect(reflect({ weeksTraining: 2, sessionsTotal: 4, gains: [], domainsCount: 1 })).toBeNull();
  });

  it('mentions multi-domain training (the hybrid unifier)', () => {
    const r = reflect({ ...BASE, domainsCount: 3 });
    expect(r!.lines.some((l) => l.includes('3 disciplinas'))).toBe(true);
  });

  it('caps to two lines', () => {
    const r = reflect({ ...BASE, domainsCount: 4 });
    expect(r!.lines.length).toBeLessThanOrEqual(2);
  });
});
