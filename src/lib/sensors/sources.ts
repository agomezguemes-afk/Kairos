// Concrete sensor sources. Native transports are lazy-required so web,
// tests and builds without the module keep working and simply report
// "unavailable" with a reason the UI can show.

import { Platform } from 'react-native';
import {
  GATT,
  base64ToBytes,
  cadenceFromCrank,
  parseCsc,
  parseHeartRate,
  parsePower,
  type CrankSample,
} from './bleParsers';
import type { SensorAvailability, SensorKind, SensorReading, SensorSource } from './types';

// ── Simulator ───────────────────────────────────────────────────────

export interface SimulatorOptions {
  restHr?: number;
  maxHr?: number;
  withCadence?: boolean;
  tickMs?: number;
}

/**
 * Physiologically plausible stream for demos and web: HR follows effort
 * with a ~20 s lag, like a real heart, instead of jumping instantly.
 */
export class SimulatedSource implements SensorSource {
  readonly id = 'simulated';
  readonly label = 'Simulador';
  readonly transport = 'simulated' as const;
  readonly kinds: SensorKind[];
  private intensity = 0.25;
  private hr: number;

  constructor(private opts: SimulatorOptions = {}) {
    this.kinds = opts.withCadence ? ['heart_rate', 'cadence', 'power'] : ['heart_rate'];
    this.hr = opts.restHr ?? 68;
  }

  /** 0 = resting, 1 = all-out. The live screen drives this from the current block. */
  setIntensity(value: number): void {
    this.intensity = Math.min(1, Math.max(0, value));
  }

  async availability(): Promise<SensorAvailability> {
    return { available: true };
  }

  async start(onReading: (r: SensorReading) => void): Promise<() => void> {
    const rest = this.opts.restHr ?? 68;
    const max = this.opts.maxHr ?? 188;
    const tick = this.opts.tickMs ?? 1000;
    const tau = 20_000;
    const timer = setInterval(() => {
      const now = Date.now();
      const target = rest + (max - rest) * this.intensity;
      this.hr += (target - this.hr) * (1 - Math.exp(-tick / tau));
      const jitter = (Math.random() - 0.5) * 3;
      onReading({
        kind: 'heart_rate',
        value: Math.round(this.hr + jitter),
        at: now,
        sourceId: this.id,
      });
      if (this.opts.withCadence) {
        const rpm =
          this.intensity < 0.05 ? 0 : 82 + this.intensity * 14 + (Math.random() - 0.5) * 4;
        onReading({ kind: 'cadence', value: Math.round(rpm), at: now, sourceId: this.id });
        const watts =
          this.intensity < 0.05 ? 0 : 90 + this.intensity * 210 + (Math.random() - 0.5) * 12;
        onReading({ kind: 'power', value: Math.round(watts), at: now, sourceId: this.id });
      }
    }, tick);
    return () => clearInterval(timer);
  }
}

// ── Bluetooth LE (standard GATT profiles) ───────────────────────────

let bleManager: any = null;
let bleProbed = false;

function getBleManager(): any {
  if (bleProbed) return bleManager;
  bleProbed = true;
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BleManager } = require('react-native-ble-plx');
    bleManager = new BleManager();
  } catch {
    // Not installed in this build — reported through availability().
    bleManager = null;
  }
  return bleManager;
}

type BleProfile = 'heart_rate' | 'csc' | 'power';

const PROFILE: Record<
  BleProfile,
  { service: string; characteristic: string; label: string; kinds: SensorKind[] }
> = {
  heart_rate: {
    service: GATT.heartRateService,
    characteristic: GATT.heartRateMeasurement,
    label: 'Banda de pulso BLE',
    kinds: ['heart_rate'],
  },
  csc: {
    service: GATT.cscService,
    characteristic: GATT.cscMeasurement,
    label: 'Sensor de cadencia (RPM)',
    kinds: ['cadence'],
  },
  power: {
    service: GATT.cyclingPowerService,
    characteristic: GATT.cyclingPowerMeasurement,
    label: 'Potenciómetro',
    kinds: ['power', 'cadence'],
  },
};

const SCAN_TIMEOUT_MS = 12_000;

export class BleSource implements SensorSource {
  readonly transport = 'ble' as const;
  readonly id: string;
  readonly label: string;
  readonly kinds: SensorKind[];

  constructor(private profile: BleProfile) {
    this.id = `ble-${profile}`;
    this.label = PROFILE[profile].label;
    this.kinds = PROFILE[profile].kinds;
  }

  async availability(): Promise<SensorAvailability> {
    const mgr = getBleManager();
    if (!mgr) return { available: false, reason: 'Necesita el build nativo con Bluetooth' };
    const state: string = await mgr.state();
    if (state !== 'PoweredOn') return { available: false, reason: 'Activa el Bluetooth' };
    return { available: true };
  }

  async start(onReading: (r: SensorReading) => void): Promise<() => void> {
    const mgr = getBleManager();
    if (!mgr) throw new Error('Bluetooth no disponible en este build');
    const { service, characteristic } = PROFILE[this.profile];

    const device: any = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        mgr.stopDeviceScan();
        reject(new Error('No se encontró ningún sensor cercano'));
      }, SCAN_TIMEOUT_MS);
      mgr.startDeviceScan([service], null, (err: Error | null, found: any) => {
        if (err) {
          clearTimeout(timeout);
          mgr.stopDeviceScan();
          reject(err);
          return;
        }
        if (found) {
          clearTimeout(timeout);
          mgr.stopDeviceScan();
          resolve(found);
        }
      });
    });

    const connected = await device.connect();
    await connected.discoverAllServicesAndCharacteristics();
    let prevCrank: CrankSample | null = null;

    const sub = connected.monitorCharacteristicForService(
      service,
      characteristic,
      (err: Error | null, c: { value: string | null } | null) => {
        if (err || !c?.value) return;
        const bytes = base64ToBytes(c.value);
        const at = Date.now();
        try {
          if (this.profile === 'heart_rate') {
            onReading({
              kind: 'heart_rate',
              value: parseHeartRate(bytes).bpm,
              at,
              sourceId: this.id,
            });
            return;
          }
          const parsed = this.profile === 'csc' ? parseCsc(bytes) : parsePower(bytes);
          if ('watts' in parsed)
            onReading({ kind: 'power', value: parsed.watts, at, sourceId: this.id });
          if (parsed.crank) {
            const rpm = prevCrank ? cadenceFromCrank(prevCrank, parsed.crank) : null;
            prevCrank = parsed.crank;
            if (rpm !== null && rpm < 250)
              onReading({ kind: 'cadence', value: rpm, at, sourceId: this.id });
          }
        } catch (e) {
          // A malformed packet from a flaky sensor shouldn't end the session.
          console.warn(`[sensors] dropped packet from ${this.id}:`, e);
        }
      },
    );

    return () => {
      sub.remove();
      connected
        .cancelConnection()
        .catch((e: unknown) => console.warn('[sensors] disconnect failed', e));
    };
  }
}

// ── Apple Watch (HealthKit) ─────────────────────────────────────────

/**
 * Live HR from the watch needs the native watchOS target streaming over
 * workout mirroring (see docs/reports). Until that target exists this
 * source exists so the picker is honest about what's coming.
 */
export class AppleWatchSource implements SensorSource {
  readonly id = 'apple-watch';
  readonly label = 'Apple Watch';
  readonly transport = 'healthkit' as const;
  readonly kinds: SensorKind[] = ['heart_rate'];

  async availability(): Promise<SensorAvailability> {
    if (Platform.OS !== 'ios') return { available: false, reason: 'Solo en iPhone' };
    return { available: false, reason: 'Llega con la app de watchOS' };
  }

  async start(): Promise<() => void> {
    throw new Error('Apple Watch live streaming not implemented yet');
  }
}

export function defaultSources(opts: { cycling: boolean }): SensorSource[] {
  return [
    new AppleWatchSource(),
    new BleSource('heart_rate'),
    ...(opts.cycling ? [new BleSource('csc'), new BleSource('power')] : []),
    new SimulatedSource({ withCadence: opts.cycling }),
  ];
}
