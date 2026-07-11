import { describe, it, expect } from 'vitest';

import { createSttUsageTracker, sttQuotaUnits, STT_QUOTA_COST } from './quota';
import type { KeyValueStorage } from '../../analytics/queue';

const KEY = 'test_stt_usage';
const HOUR = 3600 * 1000;

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & {
  data: Map<string, string>;
} {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => {
      data.set(k, v);
    },
    removeItem: async (k) => {
      data.delete(k);
    },
  };
}

describe('sttQuotaUnits — coste por llamada', () => {
  it('0 llamadas → 0 unidades', () => {
    expect(sttQuotaUnits(0)).toBe(0);
    expect(sttQuotaUnits(-3)).toBe(0);
  });

  it('redondea hacia arriba: 1 llamada nunca es invisible', () => {
    expect(sttQuotaUnits(1)).toBe(1);
    expect(sttQuotaUnits(5)).toBe(1); // 5 × 0.2 = 1.0
    expect(sttQuotaUnits(6)).toBe(2); // 6 × 0.2 = 1.2 → 2
  });

  it('una sesión de gym (~15 utterances) cuesta ~3 unidades', () => {
    expect(sttQuotaUnits(15)).toBe(3);
    expect(STT_QUOTA_COST).toBe(0.2);
  });
});

describe('SttUsageTracker — record + count', () => {
  it('cuenta las llamadas registradas dentro de la ventana', async () => {
    const t = createSttUsageTracker(memoryStorage(), KEY);
    await t.record(1000);
    await t.record(2000);
    expect(await t.count24h(3000)).toBe(2);
  });

  it('poda las llamadas de hace más de 24h', async () => {
    const t = createSttUsageTracker(memoryStorage(), KEY);
    await t.record(1000);
    await t.record(1000 + 25 * HOUR);
    expect(await t.count24h(1000 + 25 * HOUR)).toBe(1);
  });

  it('persiste entre instancias sobre el mismo storage', async () => {
    const storage = memoryStorage();
    const a = createSttUsageTracker(storage, KEY);
    await a.record(5000);

    const b = createSttUsageTracker(storage, KEY);
    expect(await b.count24h(6000)).toBe(1);
  });

  it('clear() vacía memoria y storage', async () => {
    const storage = memoryStorage();
    const t = createSttUsageTracker(storage, KEY);
    await t.record(1000);
    await t.clear();
    expect(await t.count24h(2000)).toBe(0);
    expect(storage.data.has(KEY)).toBe(false);
  });
});

describe('SttUsageTracker — storage hostil', () => {
  it('payload corrupto → empieza de cero sin romper', async () => {
    const t = createSttUsageTracker(memoryStorage({ [KEY]: '{not json' }), KEY);
    expect(await t.count24h(1000)).toBe(0);
    await t.record(1000);
    expect(await t.count24h(1000)).toBe(1);
  });

  it('filtra entradas malformadas de una lista persistida', async () => {
    const storage = memoryStorage({
      [KEY]: JSON.stringify({ timestamps: [500, 'x', null, 700, NaN] }),
    });
    const t = createSttUsageTracker(storage, KEY);
    // NaN serialises to null in JSON, but guard the filter anyway.
    expect(await t.count24h(1000)).toBe(2);
  });

  it('forma inesperada → 0, no excepción', async () => {
    const t = createSttUsageTracker(memoryStorage({ [KEY]: JSON.stringify({ nope: true }) }), KEY);
    expect(await t.count24h(1000)).toBe(0);
  });

  it('escritura que falla → record no lanza y la sesión sigue contando en memoria', async () => {
    const failing: KeyValueStorage = {
      getItem: async () => null,
      setItem: async () => {
        throw new Error('disk full');
      },
      removeItem: async () => {
        throw new Error('disk full');
      },
    };
    const t = createSttUsageTracker(failing, KEY);
    await expect(t.record(1000)).resolves.toBeUndefined();
    expect(await t.count24h(1000)).toBe(1);
    await expect(t.clear()).resolves.toBeUndefined();
    expect(await t.count24h(1000)).toBe(0);
  });

  it('acota la lista persistida al tope', async () => {
    const storage = memoryStorage();
    const t = createSttUsageTracker(storage, KEY);
    for (let i = 0; i < 1005; i++) await t.record(10_000 + i);
    expect(await t.count24h(11_005)).toBe(1000);

    const persisted = JSON.parse(storage.data.get(KEY)!) as { timestamps: number[] };
    expect(persisted.timestamps).toHaveLength(1000);
    // Oldest entries dropped, newest kept.
    expect(persisted.timestamps.at(-1)).toBe(10_000 + 1004);
  });
});
