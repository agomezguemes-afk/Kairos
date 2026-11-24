import { describe, it, expect } from 'vitest';
import {
  base64ToBytes,
  cadenceFromCrank,
  parseCsc,
  parseHeartRate,
  parsePower,
} from './bleParsers';
import { SensorHub } from './hub';

const bytes = (...b: number[]) => new Uint8Array(b);

describe('parseHeartRate (0x2A37)', () => {
  it('reads uint8 bpm without RR', () => {
    expect(parseHeartRate(bytes(0x00, 72))).toEqual({ bpm: 72, rrMs: [], contact: null });
  });

  it('reads uint16 bpm, skips energy, decodes RR in ms and contact', () => {
    // flags: 16-bit | contact supported+detected | energy | RR
    const m = parseHeartRate(bytes(0x1f, 0x2c, 0x01, 0x10, 0x00, 0x00, 0x04, 0x00, 0x02));
    expect(m.bpm).toBe(300);
    expect(m.contact).toBe(true);
    expect(m.rrMs).toEqual([1000, 500]);
  });

  it('rejects truncated packets', () => {
    expect(() => parseHeartRate(bytes(0x00))).toThrow();
  });
});

describe('CSC and cadence', () => {
  it('parses crank-only CSC packets', () => {
    expect(parseCsc(bytes(0x02, 0x0a, 0x00, 0x00, 0x04))).toEqual({
      crank: { revolutions: 10, eventTime: 1024 },
    });
  });

  it('parses wheel + crank', () => {
    const m = parseCsc(bytes(0x03, 1, 0, 0, 0, 0, 2, 5, 0, 0, 8));
    expect(m.wheel).toEqual({ revolutions: 1, eventTime: 512 });
    expect(m.crank).toEqual({ revolutions: 5, eventTime: 2048 });
  });

  it('computes RPM and survives 16-bit wraparound', () => {
    expect(
      cadenceFromCrank({ revolutions: 10, eventTime: 0 }, { revolutions: 12, eventTime: 1365 }),
    ).toBe(90);
    expect(
      cadenceFromCrank(
        { revolutions: 65535, eventTime: 65000 },
        { revolutions: 1, eventTime: 829 },
      ),
    ).toBe(90);
    expect(
      cadenceFromCrank({ revolutions: 3, eventTime: 10 }, { revolutions: 3, eventTime: 10 }),
    ).toBeNull();
  });
});

describe('parsePower (0x2A63)', () => {
  it('reads watts and crank data after optional fields', () => {
    // flags: balance(0x01) + crank(0x20); watts 250; balance byte; crank 7 revs @ 2048
    const m = parsePower(bytes(0x21, 0x00, 0xfa, 0x00, 0x32, 0x07, 0x00, 0x00, 0x08));
    expect(m.watts).toBe(250);
    expect(m.crank).toEqual({ revolutions: 7, eventTime: 2048 });
  });

  it('reads watts alone', () => {
    expect(parsePower(bytes(0x00, 0x00, 0x96, 0x00))).toEqual({ watts: 150 });
  });
});

describe('base64ToBytes', () => {
  it('decodes padded and unpadded input', () => {
    expect([...base64ToBytes('AEg=')]).toEqual([0x00, 0x48]);
    expect([...base64ToBytes('AQID')]).toEqual([1, 2, 3]);
    expect([...base64ToBytes('AQ==')]).toEqual([1]);
  });
});

describe('SensorHub', () => {
  it('accumulates zone time, averages and ignores contact-loss zeros', () => {
    const hub = new SensorHub(200);
    const t0 = 1_000_000;
    // 3 s in Z2 (130 bpm), then a dropout, then 2 s in Z5.
    [130, 130, 130, 130].forEach((v, i) =>
      hub.ingest({ kind: 'heart_rate', value: v, at: t0 + i * 1000, sourceId: 'x' }),
    );
    hub.ingest({ kind: 'heart_rate', value: 0, at: t0 + 4000, sourceId: 'x' });
    [190, 190, 190].forEach((v, i) =>
      hub.ingest({ kind: 'heart_rate', value: v, at: t0 + 20_000 + i * 1000, sourceId: 'x' }),
    );
    const s = hub.summary();
    expect(s.zoneSeconds).toEqual([0, 3, 0, 0, 2]);
    expect(s.hrMax).toBe(190);
    expect(s.hrAvg).toBe(Math.round((130 * 4 + 190 * 3) / 7));
  });

  it('excludes coasting from cadence averages and notifies listeners', () => {
    const hub = new SensorHub(190);
    const seen: number[] = [];
    hub.subscribe((l) => l.cadence && seen.push(l.cadence.value));
    [90, 0, 92].forEach((v, i) => hub.ingest({ kind: 'cadence', value: v, at: i, sourceId: 'x' }));
    expect(hub.summary().cadenceAvg).toBe(91);
    expect(seen).toEqual([90, 0, 92]);
    expect(hub.summary().zoneSeconds).toBeUndefined();
  });

  it('attaches sources once and stops them all', async () => {
    const hub = new SensorHub(190);
    let stopped = 0;
    const src = {
      id: 'fake',
      label: 'Fake',
      transport: 'simulated' as const,
      kinds: ['heart_rate' as const],
      availability: async () => ({ available: true }),
      start: async (
        on: (r: { kind: 'heart_rate'; value: number; at: number; sourceId: string }) => void,
      ) => {
        on({ kind: 'heart_rate', value: 100, at: 1, sourceId: 'fake' });
        return () => {
          stopped++;
        };
      },
    };
    await hub.attach(src);
    await hub.attach(src);
    expect(hub.attached).toEqual(['fake']);
    expect(hub.summary().sources).toEqual(['Fake']);
    hub.stopAll();
    expect(stopped).toBe(1);
  });
});
