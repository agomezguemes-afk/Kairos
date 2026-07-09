// src/lib/paywall/paywall.ts
//
// L-C · Paywall anti-dark-pattern (05 P0-3, 03 D4).
//
// The wedge's buyers are scalded: GymStreak bills ~$208k MRR at a 31.5/100
// safety score because of surprise charges and no refunds. Kairos turns
// honesty into conversion (Cal AI proves it doesn't kill the funnel):
//   · the X is always visible (close is a FREE feature, never gated)
//   · we warn 2 days before charging — the notice is computed here
//   · CSV/JSON export is free forever (never gated) — data is the user's
//
// Pure logic only (gating + trial + copy). The persisted flag lives in
// entitlementStore.ts; analytics emitters at the bottom.

import { ANALYTICS_EVENTS, track } from '../analytics';

const DAY_MS = 86_400_000;
export const TRIAL_DAYS = 7;
export const PRE_CHARGE_NOTICE_DAYS = 2;

// ======================== ENTITLEMENT MODEL ========================

export interface TrialState {
  /** Epoch millis when the trial began. */
  startedAt: number;
  /** Epoch millis when the trial converts to paid. */
  endsAt: number;
}

export interface Entitlement {
  isPro: boolean;
  trial: TrialState | null;
}

// Pro-only capabilities — the ONLY things gating may touch.
export type ProFeature =
  | 'ai_coach_unlimited'
  | 'advanced_insights'
  | 'unlimited_blocks'
  | 'custom_dashboards'
  | 'cloud_sync';

// Always-free capabilities. The anti-dark-pattern guarantees — never gated,
// no matter the entitlement. Exhaustively listed so a regression is a failing
// test, not a silent paywall.
export const FREE_ALWAYS = [
  'export_data',
  'close_paywall',
  'core_logging',
  'block_editing',
  'kai_next_step',
  'csv_import',
] as const;
export type FreeFeature = (typeof FREE_ALWAYS)[number];

export type Feature = ProFeature | FreeFeature;

function isFreeAlways(feature: Feature): feature is FreeFeature {
  return (FREE_ALWAYS as readonly string[]).includes(feature);
}

// ======================== TRIAL ========================

export function startTrialState(now: number): TrialState {
  return { startedAt: now, endsAt: now + TRIAL_DAYS * DAY_MS };
}

export function isTrialActive(trial: TrialState | null, now: number): boolean {
  return trial !== null && now >= trial.startedAt && now < trial.endsAt;
}

/** Whole days left in the trial (ceil), or 0 if none/expired. */
export function trialDaysLeft(trial: TrialState | null, now: number): number {
  if (!isTrialActive(trial, now)) return 0;
  return Math.ceil((trial!.endsAt - now) / DAY_MS);
}

export interface PreChargeNotice {
  chargeAt: number;
  daysLeft: number;
}

/**
 * The pre-charge warning. Returns a notice only inside the final
 * PRE_CHARGE_NOTICE_DAYS window of an active trial — that's when the app must
 * tell the user "te avisamos 2 días antes de cobrar". Null otherwise.
 */
export function preChargeNotice(trial: TrialState | null, now: number): PreChargeNotice | null {
  if (!isTrialActive(trial, now)) return null;
  const noticeFrom = trial!.endsAt - PRE_CHARGE_NOTICE_DAYS * DAY_MS;
  if (now < noticeFrom) return null;
  return { chargeAt: trial!.endsAt, daysLeft: trialDaysLeft(trial, now) };
}

// ======================== GATING ========================

/**
 * Whether a feature is currently gated. Free-always features are never gated;
 * Pro features unlock while `isPro` or during an active trial.
 */
export function isFeatureGated(feature: Feature, ent: Entitlement, now: number): boolean {
  if (isFreeAlways(feature)) return false;
  if (ent.isPro) return false;
  if (isTrialActive(ent.trial, now)) return false;
  return true;
}

/** Convenience: does the user have Pro access right now (paid or in trial)? */
export function hasProAccess(ent: Entitlement, now: number): boolean {
  return ent.isPro || isTrialActive(ent.trial, now);
}

// ======================== COPY (ES) ========================

export interface PaywallPlan {
  id: 'yearly' | 'monthly';
  label: string;
  price: string;
  caption: string;
  highlighted: boolean;
}

export const PAYWALL_COPY = {
  title: 'Kairos Pro',
  subtitle: 'Tu entrenamiento híbrido, sin límites.',
  // Shown verbatim on the paywall AND the store listing — honesty is the pitch.
  promises: [
    'Te avisamos 2 días antes de cobrar. Sin sorpresas.',
    'Exporta tus datos en CSV o JSON gratis, siempre. Son tuyos.',
    'Cancela en un tap. Sin llamadas, sin trucos.',
  ],
  ctaLabel: `Probar ${TRIAL_DAYS} días gratis`,
  // The X. Always present — this is the anti-dark-pattern in the UI.
  closeLabel: 'Ahora no',
  restoreLabel: 'Restaurar compra',
  exportLabel: 'Exportar mis datos',
  legalNote: 'Puedes cancelar cuando quieras desde Ajustes. Nunca cobramos sin avisar.',
  plans: [
    {
      id: 'yearly',
      label: 'Anual',
      price: '39,99 € / año',
      caption: `${TRIAL_DAYS} días gratis, luego 39,99 €/año`,
      highlighted: true,
    },
    {
      id: 'monthly',
      label: 'Mensual',
      price: '5,99 € / mes',
      caption: `${TRIAL_DAYS} días gratis, luego 5,99 €/mes`,
      highlighted: false,
    },
  ] satisfies PaywallPlan[],
  features: [
    'Coach Kai sin límites',
    'Análisis avanzado de tu rendimiento híbrido',
    'Bloques y dashboards ilimitados',
    'Copia en la nube entre dispositivos',
  ],
} as const;

/** Copy for the pre-charge banner shown in the trial's last days. */
export function preChargeCopy(notice: PreChargeNotice): string {
  const dias = notice.daysLeft === 1 ? '1 día' : `${notice.daysLeft} días`;
  return `Tu prueba termina en ${dias}. Te cobraremos entonces; cancela antes si no quieres continuar.`;
}

// ======================== ANALYTICS ========================

export function trackPaywallViewed(source: string): void {
  track(ANALYTICS_EVENTS.paywall_viewed, { source });
}

export function trackPaywallDismissed(source: string): void {
  track(ANALYTICS_EVENTS.paywall_dismissed, { source });
}
