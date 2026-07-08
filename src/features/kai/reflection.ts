// KAIROS — Kai's reflection (pure).
//
// The moat is the compounding, user-owned system + Kai's memory of *you*
// (docs/KAIROS_CRITIQUE §4). For that moat to exist it must be **visible**: every
// so often Kai shows how far you've come — competence made felt, which is also
// the behavior-change lever (present-tense, earned progress; not abstract goals —
// Segar). This is the surface that makes month 6 feel unmistakably more "yours"
// than week 1.
//
// Voice: docs/KAI_VOICE — a quiet expert. Specific and true, praise is earned,
// no hype, no exclamation, no emoji. Returns null when there isn't enough real
// progress to honestly point at (silence > noise; a fake reflection is worse
// than none).
//
// Pure (no store/network/RN) → unit-tested.

export interface MetricGain {
  /** Display name, e.g. "Press banca". */
  name: string;
  from: number;
  to: number;
  /** Times/HR where a lower value is the improvement. */
  lowerIsBetter?: boolean;
}

export interface ReflectionInputs {
  weeksTraining: number;
  sessionsTotal: number;
  /** Metrics that genuinely improved (already filtered by the caller). */
  gains: readonly MetricGain[];
  /** How many disciplines the user actually trains. */
  domainsCount: number;
}

export interface Reflection {
  /** Quiet, factual headline. */
  headline: string;
  /** 1–2 concrete, true lines that make competence visible. */
  lines: string[];
}

const MIN_WEEKS = 2;
const MIN_SESSIONS = 4;

/** Signed improvement magnitude of a gain, respecting polarity. */
function improvement(g: MetricGain): number {
  return g.lowerIsBetter ? g.from - g.to : g.to - g.from;
}

/** Trim a number to a tidy string (no trailing .0). */
function n(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * Kai's reflection on the user's progress, or null when it would be hollow.
 * The caller computes the inputs (e.g. from metricTrend over the user's series);
 * this stays pure so the wording + the "is there anything real to say" judgment
 * are tested directly.
 */
export function reflect(input: ReflectionInputs): Reflection | null {
  // Cold start is where churn is highest (KAIROS_CRITIQUE §7): the first
  // sessions, before there's any trend to show. Acknowledge the one thing that's
  // already real — that you started — in the present tense (Segar), plainly.
  if (input.sessionsTotal >= 1 && input.sessionsTotal < MIN_SESSIONS) {
    return {
      headline:
        input.sessionsTotal === 1 ? 'Primera sesión hecha.' : `${input.sessionsTotal} sesiones ya.`,
      lines: ['Lo más difícil de entrenar es empezar.'],
    };
  }

  if (input.weeksTraining < MIN_WEEKS || input.sessionsTotal < MIN_SESSIONS) return null;

  const realGains = input.gains
    .filter((g) => Number.isFinite(g.from) && Number.isFinite(g.to) && improvement(g) > 0)
    .sort((a, b) => improvement(b) - improvement(a));

  // Nothing genuinely improved and not much history → don't manufacture a moment.
  if (realGains.length === 0 && input.sessionsTotal < MIN_SESSIONS * 2) return null;

  const lines: string[] = [];

  const top = realGains[0];
  if (top) {
    lines.push(
      top.lowerIsBetter
        ? `Tu ${top.name} bajó de ${n(top.from)} a ${n(top.to)}.`
        : `Tu ${top.name} pasó de ${n(top.from)} a ${n(top.to)}.`,
    );
  }

  if (input.domainsCount >= 2) {
    lines.push(`Entrenas ${input.domainsCount} disciplinas, no solo una.`);
  } else if (!top) {
    // No metric gain to show, but real consistency exists — point at that, plainly.
    lines.push('Lo más difícil ya lo haces: apareces.');
  }

  return {
    headline: `${input.weeksTraining} semanas. ${input.sessionsTotal} sesiones.`,
    lines: lines.slice(0, 2),
  };
}
