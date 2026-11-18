// The expert panel. A good coach with a biotech, physio and S&C background
// doesn't run one model: they look at the same day from several angles and
// then decide in a fixed order: tissue first, then the body's state, then
// the habit, then progress. Each lens here is one of those angles, built
// on the engine's models, with its own forecast and its own track record
// (calibration.ts), so it is trusted exactly as much as it has earned.
// Spec: ENGINE-v2.md §Panel de perspectivas.

import { getMovement } from '../adaptive/catalog';
import { bestSetE1rm, loadTrend } from '../adaptive/metrics';
import type { SessionLog } from '../adaptive/types';
import type { CalibrationSet } from './backtest';
import { recalibrate, type CalibrationReport } from './calibration';
import { increments, isPlateau, progressionState } from './changepoint';
import { DAY_MS } from './fitnessFatigue';
import type { ReadinessV2 } from './readiness';
import { MOVEMENT_REGIONS, REGION_LABEL, sessionRegions, type Region } from './recovery';
import type { Adherence, PainRecurrence } from './survival';

export type LensId = 'clinical' | 'physiology' | 'behaviour' | 'training';

/** Ordered by how much they hold the session back. */
export type Stance = 'push' | 'steady' | 'ease' | 'rest';

export interface Finding {
  text: string;
  source: string;
}

export interface TrackRecord {
  n: number;
  verdict: CalibrationReport['verdict'];
  /** Brier skill after correction: > 0 beats knowing nothing. */
  skill: number;
  /** One line: "Cuando digo 70 %, pasa el 68 % · 24 comprobaciones". */
  headline: string;
}

export interface Lens {
  id: LensId;
  title: string;
  stance: Stance;
  /** One plain line: what this angle says about today. */
  reason: string;
  findings: Finding[];
  /** The calibrated forecast the lens rests on, when it has one. */
  forecast?: { label: string; p: number; raw: number };
  track: TrackRecord | null;
}

export interface PanelVerdict {
  band: 'go' | 'easy' | 'rest';
  stance: Stance;
  lead: LensId;
  /** The line shown with the session; empty on an ordinary good day. */
  note?: string;
  /** A lens that sees the day very differently, said once and plainly. */
  dissent?: { lens: LensId; text: string };
}

export interface Panel {
  lenses: Lens[];
  verdict: PanelVerdict;
}

export interface PanelInput {
  readiness: ReadinessV2;
  sessions: SessionLog[];
  /** Movement ids of the session about to be done. */
  nextMovements: string[];
  adherence: Adherence | null;
  pain: PainRecurrence | null;
  /** Pain marked in the last 3 days (check-in or experiment). */
  painNow: boolean;
  calibration?: CalibrationSet | null;
  now: Date;
}

export const LENS_TITLE: Record<LensId, string> = {
  clinical: 'Fisioterapia',
  physiology: 'Fisiología',
  behaviour: 'Hábito',
  training: 'Preparación física',
};

const SEVERITY: Record<Stance, number> = { push: 0, steady: 1, ease: 2, rest: 3 };
/** Tissue, then state, then habit, then progress: the order a clinician decides in. */
const PRIORITY: LensId[] = ['clinical', 'physiology', 'behaviour', 'training'];

const pct = (p: number) => `${Math.round(p * 100)} %`;
const fmt = (v: number, d = 1) => v.toFixed(d).replace('.', ',');

export function trackRecord(r: CalibrationReport | undefined): TrackRecord | null {
  if (!r || r.n === 0) return null;
  if (r.verdict === 'learning')
    return {
      n: r.n,
      verdict: r.verdict,
      skill: r.correctedSkill,
      headline: `Aprendiendo: ${r.n} de 15 comprobaciones`,
    };
  const bin = [...r.bins].sort((a, b) => b.n - a.n)[0];
  return {
    n: r.n,
    verdict: r.verdict,
    skill: r.correctedSkill,
    headline: `Cuando digo ${pct(bin.forecast)}, pasa el ${pct(bin.observed)} · ${r.n} comprobaciones`,
  };
}

/** What a verdict means for how the engine treats its own numbers. */
function selfCorrection(r: CalibrationReport | undefined, what: string): Finding | null {
  if (!r) return null;
  const source = 'Calibración prequencial (Dawid 1984) · recalibración logística';
  switch (r.verdict) {
    case 'overconfident':
      return { text: `Mis ${what} eran demasiado tajantes: ahora las modero.`, source };
    case 'underconfident':
      return { text: `Mis ${what} eran demasiado tímidas: ahora las afino.`, source };
    case 'optimistic':
      return { text: `Mis ${what} salían optimistas: ahora las corrijo a la baja.`, source };
    case 'pessimistic':
      return { text: `Mis ${what} salían pesimistas: ahora las corrijo al alza.`, source };
    default:
      return null;
  }
}

// ── Physiology: the body's state today ──────────────────────────────

function physiologyLens(i: PanelInput): Lens {
  const r = i.readiness;
  const rep = i.calibration?.readiness;
  const p = recalibrate(r.predictive, rep?.fit);
  const findings: Finding[] = [...r.evidence]
    .filter((e) => e.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3)
    .map((e) => ({ text: e.label, source: e.source }));
  findings.unshift({ text: r.evidence[0].label, source: r.evidence[0].source });
  const fix = selfCorrection(rep, 'previsiones de disposición');
  if (fix) findings.push(fix);
  const perf = i.calibration?.performance;
  if (perf && perf.n >= 15 && perf.varianceFactor > 1.5)
    findings.push({
      text: `Tu rendimiento varía más de lo que el modelo esperaba (solo el ${pct(perf.coverage80)} cayó en mi rango del 80 %).`,
      source: 'Cobertura de intervalos predictivos',
    });
  const stance: Stance = p >= 0.65 ? 'push' : p >= 0.4 ? 'ease' : 'rest';
  const reason =
    stance === 'push'
      ? `Disposición estimada ${pct(p)}: tu cuerpo está para entrenar.`
      : stance === 'ease'
        ? 'Versión ligera: una serie menos por ejercicio.'
        : 'Mejor descansar hoy. Si entrenas, versión ligera.';
  return {
    id: 'physiology',
    title: LENS_TITLE.physiology,
    stance,
    reason,
    findings,
    forecast: { label: 'Rendir a tu nivel hoy', p, raw: r.predictive },
    track: trackRecord(rep),
  };
}

// ── Clinical: tissues, pain and load spikes ─────────────────────────

function clinicalLens(i: PanelInput): Lens {
  const rep = i.calibration?.pain;
  const findings: Finding[] = [];
  const risk = i.pain ? recalibrate(i.pain.risk14, rep?.fit) : null;
  const load = sessionRegions(i.nextMovements);
  const regions = i.readiness.recovery.regions
    .filter((r) => (load[r.region] ?? 0) >= 0.5)
    .sort((a, b) => a.recovered - b.recovered);
  const worst = regions[0];
  const trend = loadTrend(i.sessions, i.now);

  if (risk !== null)
    findings.push({
      text: `Riesgo de que vuelva el dolor en 14 días: ${pct(risk)}.`,
      source: 'Weibull bayesiano de recurrencia (da Silva 2019)',
    });
  if (worst && worst.recovered < 0.9)
    findings.push({
      text: `${worst.label} al ${pct(worst.recovered)} de recuperación${worst.hoursToReady ? `, lista en ~${worst.hoursToReady} h` : ''}.`,
      source: 'Bishop 2008; McLester 2003 · ritmo personal',
    });
  if (trend.ratio !== null && trend.band !== 'steady' && trend.band !== 'baseline')
    findings.push({
      text: `Esta semana llevas ${fmt(trend.ratio)}× tu carga semanal habitual.`,
      source: 'Carga aguda:crónica (Gabbett 2016) · señal, no predictor (Impellizzeri 2020)',
    });
  const fix = selfCorrection(rep, 'previsiones de dolor');
  if (fix) findings.push(fix);

  let stance: Stance = 'push';
  let reason = 'Sin señales en tejidos ni articulaciones: vía libre.';
  if (i.painNow) {
    stance = 'rest';
    reason = 'Has marcado dolor hace poco: hoy, solo movilidad o descanso.';
  } else if (worst && worst.recovered < 0.5) {
    stance = 'ease';
    reason = `Versión ligera: ${worst.label.toLowerCase()} aún se está recuperando.`;
  } else if (trend.band === 'spike') {
    stance = 'ease';
    reason = 'Versión ligera: llevas una semana más cargada de lo habitual.';
  } else if (risk !== null && risk >= 0.25) {
    stance = 'steady';
    reason = 'Entrena, pero sin subir carga.';
  }
  return {
    id: 'clinical',
    title: LENS_TITLE.clinical,
    stance,
    reason,
    findings,
    forecast:
      risk !== null && i.pain
        ? { label: 'Dolor de nuevo en 14 días', p: risk, raw: i.pain.risk14 }
        : undefined,
    track: trackRecord(rep),
  };
}

// ── Behaviour: the habit that makes everything else possible ────────

function behaviourLens(i: PanelInput): Lens {
  const a = i.adherence;
  const rep = i.calibration?.adherence;
  if (!a)
    return {
      id: 'behaviour',
      title: LENS_TITLE.behaviour,
      stance: 'push',
      reason: 'Aún no hay ritmo que leer: la primera sesión lo marca.',
      findings: [],
      track: trackRecord(rep),
    };
  const within7 = recalibrate(a.within7, rep?.fit);
  const findings: Finding[] = [
    {
      text: `Probabilidad de que entrenes en los próximos 7 días: ${pct(within7)}.`,
      source: 'Supervivencia Weibull bayesiana · tu historial de huecos',
    },
  ];
  if (a.informed && a.hardHazardRatio.hi < 1)
    findings.push({
      text: `Después de una sesión muy dura tardas más en volver (×${fmt(1 / a.hardHazardRatio.mean)}).`,
      source: 'Riesgos proporcionales (Cox 1972)',
    });
  const fix = selfCorrection(rep, 'previsiones de constancia');
  if (fix) findings.push(fix);
  const lapsing = a.lapseRisk >= 0.4 && a.gapDays >= 3;
  return {
    id: 'behaviour',
    title: LENS_TITLE.behaviour,
    stance: lapsing ? 'ease' : 'push',
    reason: lapsing
      ? 'Hoy vale más una sesión corta que ninguna.'
      : 'Ritmo constante: el hábito está de tu lado.',
    findings,
    forecast: { label: 'Entrenar en 7 días', p: within7, raw: a.within7 },
    track: trackRecord(rep),
  };
}

// ── Training: is the stimulus still working? ────────────────────────

/** Weekly hard sets per region; secondary regions count by their weight. */
export function weeklySets(sessions: SessionLog[], now: Date): Partial<Record<Region, number>> {
  const out: Partial<Record<Region, number>> = {};
  const since = now.getTime() - 7 * DAY_MS;
  for (const s of sessions) {
    const t = new Date(s.endedAt).getTime();
    if (t < since || t > now.getTime()) continue;
    for (const m of s.movements) {
      if (getMovement(m.movementId)?.kind !== 'strength') continue;
      const n = m.sets.filter((x) => x.completed).length;
      for (const [r, w] of Object.entries(MOVEMENT_REGIONS[m.movementId] ?? {}) as [
        Region,
        number,
      ][])
        out[r] = (out[r] ?? 0) + n * w;
    }
  }
  return out;
}

/** Share of the last 28 days' heart-rate time spent in Z1–Z2. */
export function lowIntensityShare(
  sessions: SessionLog[],
  now: Date,
): { share: number; hours: number } | null {
  const since = now.getTime() - 28 * DAY_MS;
  let low = 0;
  let total = 0;
  for (const s of sessions) {
    const z = s.sensors?.zoneSeconds;
    if (!z || new Date(s.endedAt).getTime() < since) continue;
    low += z[0] + z[1];
    total += z.reduce((a, b) => a + b, 0);
  }
  return total > 0 ? { share: low / total, hours: total / 3600 } : null;
}

/** Below / above this many weekly sets a region is under- or over-dosed. */
const DOSE_LOW = 6;
const DOSE_HIGH = 25;
/** Grip and core get their work from the big lifts; dosing them is noise. */
const UNDOSED: Region[] = ['grip', 'core'];

function trainingLens(i: PanelInput): Lens {
  const rep = i.calibration?.load;
  const findings: Finding[] = [];
  let plateaus = 0;
  let strength = 0;
  for (const id of i.nextMovements) {
    const mv = getMovement(id);
    if (mv?.kind !== 'strength') continue;
    const series = [...i.sessions]
      .sort((a, b) => new Date(a.endedAt).getTime() - new Date(b.endedAt).getTime())
      .map((s) => s.movements.find((m) => m.movementId === id))
      .map((m) => (m ? bestSetE1rm(m.sets) : null))
      .filter((v): v is number => v !== null && v > 0);
    if (series.length < 3) continue;
    strength++;
    const st = progressionState(increments(series));
    if (isPlateau(st)) {
      plateaus++;
      findings.push({
        text: `${mv.name}: estancado (${pct(st.plateauProbability)} seguro). Toca cambiar el estímulo: rango de repeticiones o variante.`,
        source: 'Detección de cambios BOCPD (Adams y MacKay 2007)',
      });
    } else if (st.rate > 0.3) {
      findings.push({
        text: `${mv.name}: progresas ~${fmt(st.rate)} % por sesión.`,
        source: 'Tendencia del 1RM estimado',
      });
    }
  }

  const dose = weeklySets(i.sessions, i.now);
  const loaded = sessionRegions(i.nextMovements);
  for (const [r, w] of Object.entries(loaded) as [Region, number][]) {
    if (w < 0.5 || UNDOSED.includes(r)) continue;
    const sets = dose[r] ?? 0;
    if (strength && sets < DOSE_LOW)
      findings.push({
        text: `${REGION_LABEL[r]}: ${fmt(sets, 0)} series esta semana; el rango útil suele estar entre 10 y 20.`,
        source: 'Dosis-respuesta (Schoenfeld, Ogborn y Krieger 2017)',
      });
    else if (sets > DOSE_HIGH)
      findings.push({
        text: `${REGION_LABEL[r]}: ${fmt(sets, 0)} series esta semana, por encima de lo que suele rendir más.`,
        source: 'Dosis-respuesta (Schoenfeld, Ogborn y Krieger 2017)',
      });
  }

  const intensity = lowIntensityShare(i.sessions, i.now);
  if (intensity && intensity.hours >= 2 && intensity.share < 0.65)
    findings.push({
      text: `Solo el ${pct(intensity.share)} de tu tiempo de cardio es suave; los resistentes que más mejoran rondan el 80 %.`,
      source: 'Distribución de intensidad (Seiler 2010)',
    });

  const fix = selfCorrection(rep, 'previsiones de carga');
  if (fix) findings.push(fix);

  const stuck = strength > 0 && plateaus * 2 >= strength;
  return {
    id: 'training',
    title: LENS_TITLE.training,
    stance: stuck ? 'steady' : 'push',
    reason: stuck
      ? 'Hoy sin subir carga: el estímulo actual ya no te hace progresar.'
      : strength
        ? 'El estímulo funciona: sigue la progresión.'
        : 'Plan en marcha: cada sesión afina tus objetivos.',
    findings,
    track: trackRecord(rep),
  };
}

// ── The decision ────────────────────────────────────────────────────

export function expertPanel(input: PanelInput): Panel {
  const lenses = [
    clinicalLens(input),
    physiologyLens(input),
    behaviourLens(input),
    trainingLens(input),
  ];
  const byId = (id: LensId) => lenses.find((l) => l.id === id)!;
  // The most cautious lens decides; ties go to the earlier one in PRIORITY.
  const lead = PRIORITY.map(byId).reduce((a, b) =>
    SEVERITY[b.stance] > SEVERITY[a.stance] ? b : a,
  );
  const stance = lead.stance;
  const band = stance === 'rest' ? 'rest' : stance === 'ease' ? 'easy' : 'go';
  const note = stance === 'push' ? undefined : lead.reason;
  // Disagreement worth saying: a lens two steps more optimistic than the verdict.
  const optimist = lenses
    .filter((l) => SEVERITY[stance] - SEVERITY[l.stance] >= 2)
    .sort((a, b) => SEVERITY[a.stance] - SEVERITY[b.stance])[0];
  const dissent = optimist
    ? {
        lens: optimist.id,
        text: `${optimist.title} te ve bien${optimist.forecast ? ` (${pct(optimist.forecast.p)})` : ''}, pero manda ${lead.title.toLowerCase()}.`,
      }
    : undefined;
  return { lenses, verdict: { band, stance, lead: lead.id, note, dissent } };
}
