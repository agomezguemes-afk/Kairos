// KAIROS — Onboarding flow (lógica pura, sin React Native)
// Contrato de integración del sprint "Onboarding que activa" (docs/ai-board/BACKLOG.md).
// Testeable en node (vitest) — no importar nada con side effects nativos.

import type { WorkoutBlock } from '../../types/core';
import type { StarterDiscipline } from '../../lib/routines/starterTemplates';

// ── Tipos del contrato ───────────────────────────────────────────────────────

/** 0 = domingo … 6 = sábado (convención del contrato). */
export interface WeekAssignment {
  blockId: string;
  weekday: number;
}

export type OnboardingSource = 'ai' | 'template';

/** Forma que el Reveal pinta — DEV-L la expondrá desde generateOnboardingSpace (L1). */
export interface OnboardingSpaceResult {
  blocks: WorkoutBlock[];
  weekAssignments: WeekAssignment[];
  source: OnboardingSource;
  durationMs: number;
}

// ── Copy compartido ──────────────────────────────────────────────────────────

/** Micro-momento de reconocimiento al seleccionar disciplina (patrón Runna). */
export const DISCIPLINE_CAPTIONS: Record<StarterDiscipline, string> = {
  strength: 'Kai preparará tu espacio de fuerza',
  running: 'Kai preparará tu espacio de running',
  calisthenics: 'Kai preparará tu espacio de calistenia',
  yoga_mobility: 'Kai preparará tu espacio de movilidad',
  team_sport: 'Kai preparará tu espacio para tu deporte',
  hybrid: 'Kai preparará tu espacio híbrido',
};

// ── Semana sembrada (espejo local de L1 hasta que DEV-L la exponga) ──────────

// WHY: lunes-first porque es la convención de planificación en España.
const WEEK_PLANS: Record<number, number[]> = {
  1: [1],
  2: [1, 4], // lu / ju
  3: [1, 3, 5], // lu / mi / vi
  4: [1, 2, 4, 5], // lu / ma / ju / vi
  5: [1, 2, 3, 4, 6], // lu-ju + sá
  6: [1, 2, 3, 4, 5, 6],
  7: [0, 1, 2, 3, 4, 5, 6],
};

/** Normaliza la frecuencia a un plan válido. Valores fuera de rango → 3 días. */
export function planForFrequency(frequency: number): number[] {
  if (!Number.isFinite(frequency)) return WEEK_PLANS[3];
  const clamped = Math.round(frequency);
  if (clamped < 1 || clamped > 7) return WEEK_PLANS[3];
  return WEEK_PLANS[clamped];
}

/**
 * Reparte los bloques generados sobre los días del plan, ciclando cuando
 * hay menos bloques que días (1 bloque + 3 días → el mismo bloque lu/mi/vi).
 */
export function assignWeekdays(blockIds: string[], frequency: number): WeekAssignment[] {
  if (blockIds.length === 0) return [];
  return planForFrequency(frequency).map((weekday, i) => ({
    blockId: blockIds[i % blockIds.length],
    weekday,
  }));
}

// ── Loading theatre ──────────────────────────────────────────────────────────

/** Mínimo percibido del teatro de generación (labor illusion, 04-ux §S8). */
export const THEATRE_MIN_MS = 2600;
/** Cadencia de los checks intermedios — nunca hay silencio > 2s. */
export const THEATRE_STEP_INTERVAL_MS = 650;

/** 4 pasos narrados, idénticos en camino IA y fallback de plantilla. */
export function buildTheatreSteps(disciplineLabel: string): string[] {
  return [
    'Analizando tu punto de partida',
    `Seleccionando ejercicios de ${disciplineLabel.toLowerCase()}`,
    'Montando tu primer bloque',
    'Programando tu semana',
  ];
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Gate del teatro: la promesa no "resuelve" para la UI antes de minMs aunque
 * la generación sea instantánea. Los rechazos se propagan sin esperar.
 */
export async function withMinimumDuration<T>(promise: Promise<T>, minMs: number): Promise<T> {
  const [value] = await Promise.all([promise, delay(minMs)]);
  return value;
}

// ── Analytics (stub del contrato) ────────────────────────────────────────────

/** Nombres canónicos del funnel (BACKLOG.md L4). */
export const EVENTS = {
  onboardingStarted: 'onboarding_started',
  quizStepViewed: 'quiz_step_viewed',
  stepCompleted: 'onboarding_step_completed',
  spaceGenerated: 'space_generated',
  revealViewed: 'plan_reveal_viewed',
  revealAction: 'reveal_action',
  paywallViewed: 'paywall_viewed',
  paywallDismissed: 'paywall_dismissed',
} as const;

interface TrackedEvent {
  event: string;
  props?: Record<string, unknown>;
  ts: number;
}

// WHY: cola acotada en memoria para que el flujo sea observable en tests y
// el orquestador pueda verificar el funnel antes del merge con DEV-L.
const MAX_QUEUE = 200;
const trackedEvents: TrackedEvent[] = [];

// TODO(integración): sustituir por `import { track } from '../../lib/analytics'`
// (DEV-L, tarea L4 — aún no existe en esta base) y borrar este stub.
export function track(event: string, props?: Record<string, unknown>): void {
  trackedEvents.push({ event, props, ts: Date.now() });
  if (trackedEvents.length > MAX_QUEUE) trackedEvents.shift();
}

/** Solo para tests/depuración del stub. */
export function __getTrackedEvents(): readonly TrackedEvent[] {
  return [...trackedEvents];
}

/** Solo para tests del stub. */
export function __resetTrackedEvents(): void {
  trackedEvents.length = 0;
}
