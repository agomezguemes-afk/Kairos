// SensorHub — merges readings from any number of sources into the live
// values a session screen renders, and the summary the adaptive engine
// consumes when the session ends.

import { hrZone } from '../adaptive/metrics';
import type { SensorSummary } from '../adaptive/types';
import type { SensorKind, SensorReading, SensorSource } from './types';

// A gap longer than this means the sensor dropped out; don't credit the
// whole gap to the last zone seen.
const MAX_GAP_MS = 5_000;

type Listener = (latest: Readonly<Partial<Record<SensorKind, SensorReading>>>) => void;

export class SensorHub {
  private latest: Partial<Record<SensorKind, SensorReading>> = {};
  private listeners = new Set<Listener>();
  private stops = new Map<string, () => void>();
  private zoneMs: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  private lastHr: SensorReading | null = null;
  private sums: Record<SensorKind, { total: number; n: number; max: number }> = {
    heart_rate: { total: 0, n: 0, max: 0 },
    cadence: { total: 0, n: 0, max: 0 },
    power: { total: 0, n: 0, max: 0 },
    speed: { total: 0, n: 0, max: 0 },
  };
  private sourceLabels = new Set<string>();

  constructor(private hrMax: number) {}

  get attached(): string[] {
    return [...this.stops.keys()];
  }

  async attach(source: SensorSource): Promise<void> {
    if (this.stops.has(source.id)) return;
    const stop = await source.start((r) => this.ingest(r));
    this.stops.set(source.id, stop);
    this.sourceLabels.add(source.label);
  }

  detach(sourceId: string): void {
    this.stops.get(sourceId)?.();
    this.stops.delete(sourceId);
  }

  stopAll(): void {
    for (const stop of this.stops.values()) stop();
    this.stops.clear();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  ingest(r: SensorReading): void {
    if (!Number.isFinite(r.value) || r.value < 0) return;
    if (r.kind === 'heart_rate') {
      // Straps report 0 when they lose skin contact; that's not a reading.
      if (r.value < 25 || r.value > 240) return;
      if (this.lastHr) {
        const dt = r.at - this.lastHr.at;
        if (dt > 0 && dt <= MAX_GAP_MS)
          this.zoneMs[hrZone(this.lastHr.value, this.hrMax) - 1] += dt;
      }
      this.lastHr = r;
    }
    const s = this.sums[r.kind];
    // Coasting (0 rpm / 0 W) is real but shouldn't drag the average of work done.
    if (r.value > 0 || r.kind === 'heart_rate') {
      s.total += r.value;
      s.n += 1;
      s.max = Math.max(s.max, r.value);
    }
    this.latest = { ...this.latest, [r.kind]: r };
    for (const l of this.listeners) l(this.latest);
  }

  summary(): SensorSummary {
    const avg = (k: SensorKind) =>
      this.sums[k].n ? Math.round(this.sums[k].total / this.sums[k].n) : undefined;
    const hasHr = this.sums.heart_rate.n > 0;
    return {
      hrAvg: avg('heart_rate'),
      hrMax: hasHr ? this.sums.heart_rate.max : undefined,
      zoneSeconds: hasHr
        ? (this.zoneMs.map((ms) => Math.round(ms / 1000)) as [
            number,
            number,
            number,
            number,
            number,
          ])
        : undefined,
      cadenceAvg: avg('cadence'),
      powerAvg: avg('power'),
      sources: [...this.sourceLabels],
    };
  }
}
