// Sensor layer — one interface for every way a metric can reach a live
// session: Apple Watch (HealthKit), any Bluetooth LE strap/pod/power meter
// using the standard GATT profiles, a simulator, or nothing at all.
// The live session only ever talks to SensorHub, never to a transport.

export type SensorKind = 'heart_rate' | 'cadence' | 'power' | 'speed';

export type SensorTransport = 'healthkit' | 'ble' | 'simulated';

export interface SensorReading {
  kind: SensorKind;
  value: number;
  /** Epoch ms. */
  at: number;
  sourceId: string;
}

export interface SensorAvailability {
  available: boolean;
  /** Human reason when unavailable, shown in the source picker. */
  reason?: string;
}

export interface SensorSource {
  id: string;
  label: string;
  transport: SensorTransport;
  kinds: SensorKind[];
  availability(): Promise<SensorAvailability>;
  /** Starts streaming; resolves to a stop function. */
  start(onReading: (r: SensorReading) => void): Promise<() => void>;
}
