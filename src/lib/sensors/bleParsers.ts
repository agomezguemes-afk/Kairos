// Parsers for the Bluetooth SIG standard GATT characteristics. Any strap,
// cadence pod or power meter that follows the spec works without vendor
// SDKs (Polar, Garmin, Wahoo, Stages, Favero… all expose these).

export const GATT = {
  heartRateService: '0000180d-0000-1000-8000-00805f9b34fb',
  heartRateMeasurement: '00002a37-0000-1000-8000-00805f9b34fb',
  cscService: '00001816-0000-1000-8000-00805f9b34fb',
  cscMeasurement: '00002a5b-0000-1000-8000-00805f9b34fb',
  cyclingPowerService: '00001818-0000-1000-8000-00805f9b34fb',
  cyclingPowerMeasurement: '00002a63-0000-1000-8000-00805f9b34fb',
} as const;

export interface HeartRateMeasurement {
  bpm: number;
  /** RR intervals in ms, when the strap sends them (needed for HRV). */
  rrMs: number[];
  contact: boolean | null;
}

/** Heart Rate Measurement 0x2A37. */
export function parseHeartRate(bytes: Uint8Array): HeartRateMeasurement {
  if (bytes.length < 2) throw new Error('HR measurement too short');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const flags = view.getUint8(0);
  const is16 = (flags & 0x01) !== 0;
  const contactSupported = (flags & 0x04) !== 0;
  const energyPresent = (flags & 0x08) !== 0;
  const rrPresent = (flags & 0x10) !== 0;
  let offset = 1;
  const bpm = is16 ? view.getUint16(offset, true) : view.getUint8(offset);
  offset += is16 ? 2 : 1;
  if (energyPresent) offset += 2;
  const rrMs: number[] = [];
  if (rrPresent) {
    while (offset + 1 < bytes.length) {
      // Spec unit is 1/1024 s.
      rrMs.push(Math.round((view.getUint16(offset, true) * 1000) / 1024));
      offset += 2;
    }
  }
  return { bpm, rrMs, contact: contactSupported ? (flags & 0x02) !== 0 : null };
}

export interface CrankSample {
  revolutions: number;
  /** Last crank event time, 1/1024 s, wraps at 65536. */
  eventTime: number;
}

export interface CscMeasurement {
  wheel?: { revolutions: number; eventTime: number };
  crank?: CrankSample;
}

/** CSC Measurement 0x2A5B (speed/cadence pods). */
export function parseCsc(bytes: Uint8Array): CscMeasurement {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const flags = view.getUint8(0);
  let offset = 1;
  const out: CscMeasurement = {};
  if (flags & 0x01) {
    out.wheel = {
      revolutions: view.getUint32(offset, true),
      eventTime: view.getUint16(offset + 4, true),
    };
    offset += 6;
  }
  if (flags & 0x02) {
    out.crank = {
      revolutions: view.getUint16(offset, true),
      eventTime: view.getUint16(offset + 2, true),
    };
  }
  return out;
}

export interface PowerMeasurement {
  watts: number;
  crank?: CrankSample;
}

/** Cycling Power Measurement 0x2A63. Optional fields shift the crank offset. */
export function parsePower(bytes: Uint8Array): PowerMeasurement {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const flags = view.getUint16(0, true);
  const watts = view.getInt16(2, true);
  let offset = 4;
  if (flags & 0x0001) offset += 1; // pedal power balance
  if (flags & 0x0004) offset += 2; // accumulated torque
  if (flags & 0x0010) offset += 6; // wheel revolution data
  const out: PowerMeasurement = { watts };
  if (flags & 0x0020 && offset + 4 <= bytes.length) {
    out.crank = {
      revolutions: view.getUint16(offset, true),
      eventTime: view.getUint16(offset + 2, true),
    };
  }
  return out;
}

/**
 * RPM from two crank samples, handling 16-bit wrap of both counters.
 * Returns null when the crank hasn't moved (no new event) so callers can
 * decide when to decay to zero instead of reporting a stale cadence.
 */
export function cadenceFromCrank(prev: CrankSample, next: CrankSample): number | null {
  const revs = (next.revolutions - prev.revolutions + 0x10000) % 0x10000;
  const ticks = (next.eventTime - prev.eventTime + 0x10000) % 0x10000;
  if (revs === 0 || ticks === 0) return null;
  return Math.round((revs * 60 * 1024) / ticks);
}

// ble-plx delivers characteristic values as base64; Hermes' atob isn't
// guaranteed on every RN version we target, so decode by hand.
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (B64.indexOf(clean[i]) << 18) |
      (B64.indexOf(clean[i + 1]) << 12) |
      ((B64.indexOf(clean[i + 2] ?? 'A') & 63) << 6) |
      (B64.indexOf(clean[i + 3] ?? 'A') & 63);
    out.push((n >> 16) & 255);
    if (clean[i + 2] !== undefined) out.push((n >> 8) & 255);
    if (clean[i + 3] !== undefined) out.push(n & 255);
  }
  return new Uint8Array(out);
}
