import { describe, expect, it } from 'vitest';

import { assertGrounded, ungroundedNumbers } from './grounding';

describe('grounded numbers', () => {
  const data = ['Sentadilla: 4 semanas estancado en 102,5 kg. Volumen 1.200 kg.'];

  it('accepts numbers from the data, whatever the separator', () => {
    expect(ungroundedNumbers('Llevas 4 semanas en 102.5 kg', data)).toEqual([]);
    expect(ungroundedNumbers('Llevas 4 semanas en 102,5 kg', data)).toEqual([]);
    expect(ungroundedNumbers('Has movido 1200 kg', data)).toEqual([]);
  });

  it('flags a load the model made up', () => {
    expect(ungroundedNumbers('Sube 2,5 kg la semana que viene', data)).toEqual(['2,5']);
    expect(() => assertGrounded('Haz 3 series de 8', data)).toThrow('3, 8');
  });

  it('text without numbers is always grounded', () => {
    expect(assertGrounded('Cambia de variante para dar un estímulo nuevo.', data)).toBe(
      'Cambia de variante para dar un estímulo nuevo.',
    );
  });
});
