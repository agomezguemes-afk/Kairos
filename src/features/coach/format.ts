// Display formatting for coach screens.

import type { Movement, MovementTarget } from '../../lib/adaptive';

export function formatValue(value: number, unit: string): string {
  const v = Number.isInteger(value)
    ? String(value)
    : value.toFixed(value * 4 === Math.round(value * 4) ? 2 : 1).replace(/0$/, '');
  return unit ? `${v} ${unit}` : v;
}

export function stepFor(unit: string, value: number): number {
  switch (unit) {
    case 'kg':
      return value < 20 ? 1.25 : 2.5;
    case 'min':
      return 5;
    case 'km':
      return 0.5;
    default:
      return 1;
  }
}

export function describeTarget(m: Movement, t: MovementTarget): string {
  const parts: string[] = [];
  switch (m.kind) {
    case 'strength': {
      const reps = t.repsMin === t.repsMax ? `${t.repsMin}` : `${t.repsMin}–${t.repsMax}`;
      parts.push(`${t.sets ?? 3} × ${reps}`);
      if (t.loadKg) parts.push(`${formatValue(t.loadKg, 'kg')}`);
      else if (t.loadKg === 0) parts.push('peso corporal');
      if (t.rir !== undefined) parts.push(`RIR ${t.rir}`);
      break;
    }
    case 'interval': {
      const iv = t.intervals;
      if (iv)
        parts.push(
          `${t.sets && t.sets > 1 ? `${t.sets} × ` : ''}${iv.reps} × ${fmtSec(iv.workSec)}/${fmtSec(iv.restSec)}`,
        );
      if (t.zone) parts.push(`Z${t.zone}`);
      break;
    }
    case 'steady':
      if (t.durationMin) parts.push(`${t.durationMin} min`);
      if (t.distanceKm) parts.push(formatValue(t.distanceKm, 'km'));
      if (t.zone) parts.push(`Z${t.zone}`);
      if (t.cadenceRpm) parts.push(`${t.cadenceRpm} rpm`);
      if (t.loadKg) parts.push(`mochila ${t.loadKg} kg`);
      break;
    default:
      if (t.durationMin) parts.push(`${t.durationMin} min`);
  }
  return parts.join(' · ');
}

export function fmtSec(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}:${String(s).padStart(2, '0')}` : `${m}'`;
}

export function fmtClock(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  const mm = String(m).padStart(h ? 2 : 1, '0');
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}
