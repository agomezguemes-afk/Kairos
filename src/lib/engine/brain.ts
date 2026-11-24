// "Tu cerebro" — a snapshot of everything the engine believes about one
// person, as nodes with value, credible interval, certainty and origin.
// Pure: built from the same models the proposals use, nothing invented.

import type { CheckIn } from '../adaptive/checkins';
import type { Experiment } from '../adaptive/experiments';
import { responseProfile } from '../adaptive/experiments';
import { getMovement } from '../adaptive/catalog';
import { bestSetE1rm } from '../adaptive/metrics';
import type { SessionLog, SuggestionKind } from '../adaptive/types';
import { increments, progressionState, isPlateau } from './changepoint';
import { armPosterior, type Arm, type ArmContext, type ArmOutcome } from './decision';
import { readinessV2 } from './readiness';
import { SENSITIVITY_PRIOR } from './personal';

export type BrainGroup = 'now' | 'response' | 'works' | 'trends' | 'recovery';
/** literature = still the prior; data = learned from you; experiment = tested on you. */
export type BrainOrigin = 'literature' | 'data' | 'experiment';

export interface BrainNode {
  id: string;
  group: BrainGroup;
  label: string;
  value: number;
  unit: string;
  /** ~90 % credible interval when the model has one. */
  interval?: [number, number];
  /** 0 (pure prior) – 1 (well established). Drives line weight in the graph. */
  certainty: number;
  origin: BrainOrigin;
  evidence: number;
  /** One plain-language line: what it means for you. */
  meaning: string;
  source: string;
}

export interface BrainSnapshot {
  nodes: BrainNode[];
  totals: {
    sessions: number;
    checkins: number;
    experiments: number;
    beliefs: number;
    hypotheses: number;
  };
}

const Z90 = 1.645;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const fmt = (v: number, d = 1) => v.toFixed(d).replace('.', ',');
/** Certainty from how much the posterior SD shrank against the prior SD. */
const shrink = (sd: number, priorSd: number) => clamp01(1 - sd / priorSd);
const originOf = (n: number, min = 3): BrainOrigin => (n >= min ? 'data' : 'literature');

const ARM_LABEL: Record<Arm, string> = { increase_load: 'Subir carga', add_set: 'Sumar series' };
const KIND_LABEL: Partial<Record<SuggestionKind, string>> = {
  extend_duration: 'Alargar sesiones',
  extend_distance: 'Sumar distancia',
  add_interval: 'Añadir intervalos',
  new_movement: 'Cambiar de ejercicio',
};

export function brainSnapshot(
  sessions: SessionLog[],
  checkins: CheckIn[],
  experiments: Experiment[],
  now: Date = new Date(),
): BrainSnapshot {
  const r = readinessV2(sessions, checkins, now);
  const nodes: BrainNode[] = [];

  // ── Now ──
  nodes.push({
    id: 'readiness',
    group: 'now',
    label: 'Disposición hoy',
    value: Math.round(r.probability * 100),
    unit: '%',
    certainty: clamp01(r.observations / 12),
    origin: originOf(r.observations),
    evidence: r.observations,
    meaning: `Probabilidad de rendir a tu nivel reciente: ${Math.round(r.probability * 100)} %.`,
    source: 'Banister 1975 + check-ins',
  });
  nodes.push({
    id: 'form',
    group: 'now',
    label: 'Forma neta',
    value: r.form.mean,
    unit: '%',
    interval: [r.form.mean - Z90 * r.form.sd, r.form.mean + Z90 * r.form.sd],
    certainty: clamp01(r.observations / 12),
    origin: originOf(r.observations),
    evidence: r.observations,
    meaning:
      r.form.mean >= 0
        ? 'Lo que has construido supera la fatiga que arrastras.'
        : 'Arrastras más fatiga de la forma que has construido.',
    source: 'Banister 1975',
  });
  if (r.sleep.nights > 0) {
    nodes.push({
      id: 'sleep-debt',
      group: 'now',
      label: 'Deuda de sueño',
      value: r.sleep.hours,
      unit: 'h',
      interval: [Math.max(0, r.sleep.hours - Z90 * r.sleep.sd), r.sleep.hours + Z90 * r.sleep.sd],
      certainty: clamp01(r.sleep.nights / 7),
      origin: 'data',
      evidence: r.sleep.nights,
      meaning: r.sleep.hours >= 2 ? 'Te pesa: baja lo que puedes rendir.' : 'Bajo control.',
      source: 'Borbély 1982; Belenky 2003',
    });
  }

  // ── How you respond ──
  nodes.push({
    id: 'tau-fitness',
    group: 'response',
    label: 'Cuánto te dura la forma',
    value: r.taus.tau1,
    unit: 'días',
    certainty: clamp01(r.observations / 30),
    origin: originOf(r.observations, 10),
    evidence: r.observations,
    meaning: `Lo que entrenas hoy pierde la mitad de su efecto en ~${Math.round(r.taus.tau1 * Math.LN2)} días.`,
    source: 'Banister 1975; Clarke & Skiba 2013',
  });
  nodes.push({
    id: 'tau-fatigue',
    group: 'response',
    label: 'Cuánto te dura la fatiga',
    value: r.taus.tau2,
    unit: 'días',
    certainty: clamp01(r.observations / 30),
    origin: originOf(r.observations, 10),
    evidence: r.observations,
    meaning: `La fatiga de una semana dura se reduce a la mitad en ~${Math.round(r.taus.tau2 * Math.LN2)} días.`,
    source: 'Busso 2003',
  });
  const sens = r.sensitivity;
  const sdSleep = Math.sqrt(sens.cov[0][0]);
  const sdSore = Math.sqrt(sens.cov[1][1]);
  const priorSd = Math.sqrt(SENSITIVITY_PRIOR.cov[0][0]);
  nodes.push({
    id: 'beta-sleep',
    group: 'response',
    label: 'Te afecta dormir mal',
    value: sens.mean[0],
    unit: '%',
    interval: [Math.max(0, sens.mean[0] - Z90 * sdSleep), sens.mean[0] + Z90 * sdSleep],
    certainty: shrink(sdSleep, priorSd),
    origin: originOf(sens.samples),
    evidence: sens.samples,
    meaning: `Una noche pésima te quita ~${fmt(sens.mean[0])} % de rendimiento.`,
    source: 'Fullagar 2015; Craven 2022',
  });
  nodes.push({
    id: 'beta-soreness',
    group: 'response',
    label: 'Te afectan las agujetas',
    value: sens.mean[1],
    unit: '%',
    interval: [Math.max(0, sens.mean[1] - Z90 * sdSore), sens.mean[1] + Z90 * sdSore],
    certainty: shrink(sdSore, priorSd),
    origin: originOf(sens.samples),
    evidence: sens.samples,
    meaning: `Con agujetas fuertes rindes ~${fmt(sens.mean[1])} % menos.`,
    source: 'Cheung 2003',
  });
  const rate = r.recovery.rate;
  nodes.push({
    id: 'recovery-rate',
    group: 'response',
    label: 'Ritmo de recuperación',
    value: rate.mean,
    unit: '×',
    interval: [rate.mean - Z90 * rate.sd, rate.mean + Z90 * rate.sd],
    certainty: shrink(rate.sd, 0.3),
    origin: originOf(rate.reports),
    evidence: rate.reports,
    meaning:
      rate.mean > 1.05
        ? 'Recuperas algo más lento que la media.'
        : rate.mean < 0.95
          ? 'Recuperas algo más rápido que la media.'
          : 'Recuperas como la media.',
    source: 'Bishop 2008; McLester 2003',
  });

  // ── What works for you (tested on you) ──
  const context: ArmContext = { band: r.band, debtHigh: r.sleep.hours >= 2 };
  const outcomes: ArmOutcome[] = experiments
    .filter(
      (e) =>
        (e.status === 'kept' || e.status === 'reverted') &&
        (e.kind === 'increase_load' || e.kind === 'add_set'),
    )
    .map((e) => ({ arm: e.kind as Arm, context: e.context, success: !!e.success }));
  for (const arm of ['increase_load', 'add_set'] as Arm[]) {
    const p = armPosterior(arm, outcomes, context);
    if (!p.n) continue;
    const mean = p.a / (p.a + p.b);
    const sd = Math.sqrt((p.a * p.b) / ((p.a + p.b) ** 2 * (p.a + p.b + 1)));
    nodes.push({
      id: `arm-${arm}`,
      group: 'works',
      label: ARM_LABEL[arm],
      value: Math.round(mean * 100),
      unit: '%',
      interval: [
        Math.round(clamp01(mean - Z90 * sd) * 100),
        Math.round(clamp01(mean + Z90 * sd) * 100),
      ],
      certainty: shrink(sd, Math.sqrt(1 / 12)),
      origin: 'experiment',
      evidence: p.n,
      meaning: `En días como hoy te funciona ~${Math.round(mean * 100)} % de las veces (${p.ln} pruebas en este contexto, ${p.n} en total).`,
      source: 'Tus experimentos · Thompson contextual',
    });
  }
  const profile = responseProfile(experiments);
  for (const [kind, k] of Object.entries(profile)) {
    const label = KIND_LABEL[kind as SuggestionKind];
    if (!label || !k) continue;
    nodes.push({
      id: `kind-${kind}`,
      group: 'works',
      label,
      value: Math.round(k.affinity * 100),
      unit: '%',
      certainty: clamp01(k.tried / 6),
      origin: 'experiment',
      evidence: k.tried,
      meaning: `Te ha funcionado ${k.worked} de ${k.tried} ${k.tried === 1 ? 'vez' : 'veces'}.`,
      source: 'Tus experimentos',
    });
  }

  // ── Trends per exercise ──
  const byMovement = new Map<string, number[]>();
  for (const s of [...sessions].sort((a, b) => +new Date(a.endedAt) - +new Date(b.endedAt))) {
    for (const m of s.movements) {
      const e = bestSetE1rm(m.sets.filter((x) => (x.reps ?? 99) <= 10));
      if (!e) continue;
      const series = byMovement.get(m.movementId);
      if (series) series.push(e);
      else byMovement.set(m.movementId, [e]);
    }
  }
  for (const [id, series] of byMovement) {
    if (series.length < 3) continue;
    const st = progressionState(increments(series));
    const name = getMovement(id)?.name ?? id;
    const plateau = isPlateau(st);
    nodes.push({
      id: `trend-${id}`,
      group: 'trends',
      label: name,
      value: st.rate,
      unit: '%/sesión',
      certainty: clamp01(st.increments / 8),
      origin: 'data',
      evidence: series.length,
      meaning: plateau
        ? `Estancado (P = ${Math.round(st.plateauProbability * 100)} %).`
        : st.changeProbability > 0.5
          ? 'Tu progresión acaba de cambiar de ritmo.'
          : `Progresas ~${fmt(st.rate, 2)} % por sesión.`,
      source: 'Adams & MacKay 2007 (BOCPD)',
    });
  }

  // ── Recovery by region ──
  for (const reg of r.recovery.regions) {
    if (reg.recovered >= 0.995) continue;
    nodes.push({
      id: `region-${reg.region}`,
      group: 'recovery',
      label: reg.label,
      value: Math.round(reg.recovered * 100),
      unit: '%',
      certainty: shrink(rate.sd, 0.3),
      origin: originOf(rate.reports),
      evidence: rate.reports,
      meaning: reg.hoursToReady ? `Lista en ~${reg.hoursToReady} h.` : 'Recuperada.',
      source: 'Bishop 2008',
    });
  }

  const beliefs = nodes.filter((n) => n.origin !== 'literature').length;
  return {
    nodes,
    totals: {
      sessions: sessions.length,
      checkins: checkins.length,
      experiments: experiments.filter((e) => e.status === 'kept' || e.status === 'reverted').length,
      beliefs,
      hypotheses: nodes.length - beliefs,
    },
  };
}
