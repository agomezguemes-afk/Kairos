// KAIROS — Kai Proposals (pure model + deterministic generator).
//
// The output of Loop B ("Kai thinks while you're away", see docs/KAIROS_VISION).
// A Proposal is the autonomy-preserving unit: Kai *proposes*, you dispose
// (accept/dismiss). It is a first-class, reviewable object — never a silent
// mutation of your space.
//
// This module is pure (no store, no network, no RN) so the reasoning is
// unit-tested directly. It ships real value with deterministic rules *before*
// any LLM is involved; an LLM pass can later enrich/replace the wording while
// reusing this same Proposal shape. Rule of the house: silence > noise — emit
// at most a couple of high-confidence proposals, highest priority first.

export type ProposalKind = 'insight' | 'deload' | 'progress' | 'recover' | 'balance' | 'start';
export type ProposalTone = 'focus' | 'progress' | 'recover' | 'celebrate';

export interface Proposal {
  /** Stable id per rule so the card doesn't flicker across re-renders. */
  id: string;
  kind: ProposalKind;
  tone: ProposalTone;
  /** Kai's voice: what it noticed. Short, first-person, warm. */
  headline: string;
  /** The reasoning + what accepting will do. One or two sentences. */
  detail: string;
  /** Label for the accept action ("Aplicar", "Crear", …). */
  acceptLabel: string;
  /** Priority for ordering (higher wins). Internal. */
  priority: number;
}

export interface ProposalInputs {
  now: number;
  /** null when the user has never trained. */
  daysSinceLastWorkout: number | null;
  sessionsLast7Days: number;
  /** Sessions per domain in the last ~14 days (keys match Discipline). */
  domainCounts: Readonly<Record<string, number>>;
  /** A lift whose best has not improved in `weeks` weeks, if detected. */
  stalledLift: { name: string; weeks: number } | null;
  /** A personal record hit recently, if any. */
  recentPr: { name: string } | null;
  streak: number;
  blocksCount: number;
}

const WEEKS_STALLED_FLAG = 3;
const OVERREACH_SESSIONS = 5;
const RETURN_GAP_DAYS = 5;
const STREAK_MILESTONES = [7, 30, 100];

/** Total sessions across all domains in the window. */
function totalDomainSessions(counts: Readonly<Record<string, number>>): number {
  return Object.values(counts).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
}

/**
 * Produce Kai's proposals for the current state, highest priority first, capped.
 * Returns [] when nothing is worth saying (the common, correct case).
 */
export function generateProposals(input: ProposalInputs, max = 2): Proposal[] {
  const out: Proposal[] = [];

  // Empty space → the only thing worth proposing is to begin.
  if (input.blocksCount === 0) {
    return [
      {
        id: 'start',
        kind: 'start',
        tone: 'focus',
        headline: 'Tu espacio está vacío',
        detail: 'Empecemos por el primer bloque. Lo montamos juntos en un minuto.',
        acceptLabel: 'Crear con Kai',
        priority: 100,
      },
    ];
  }

  // Celebrate first — competence made visible is what sustains the habit.
  if (input.recentPr) {
    out.push({
      id: `pr-${input.recentPr.name}`,
      kind: 'progress',
      tone: 'celebrate',
      headline: `Récord en ${input.recentPr.name}`,
      detail: 'Lo dejé anotado en tu progreso. Vas subiendo.',
      acceptLabel: 'Ver progreso',
      priority: 90,
    });
  }

  const milestone = STREAK_MILESTONES.includes(input.streak) ? input.streak : null;
  if (milestone) {
    out.push({
      id: `streak-${milestone}`,
      kind: 'progress',
      tone: 'celebrate',
      headline: `${milestone} días seguidos`,
      detail: 'Ya no es esfuerzo. Es quién eres.',
      acceptLabel: 'Ver racha',
      priority: 85,
    });
  }

  // Overreach → propose recovery before the body asks for it.
  if (input.sessionsLast7Days >= OVERREACH_SESSIONS) {
    out.push({
      id: 'deload',
      kind: 'deload',
      tone: 'recover',
      headline: 'Mucha carga esta semana',
      detail: `${input.sessionsLast7Days} sesiones en siete días. Hoy yo bajaría el ritmo — el progreso cuaja en el descanso.`,
      acceptLabel: 'Aligerar hoy',
      priority: 80,
    });
  }

  // Plateau → name it and offer a way out (variation / deload).
  if (input.stalledLift && input.stalledLift.weeks >= WEEKS_STALLED_FLAG) {
    out.push({
      id: `plateau-${input.stalledLift.name}`,
      kind: 'insight',
      tone: 'focus',
      headline: `${input.stalledLift.name} lleva ${input.stalledLift.weeks} semanas plano`,
      detail:
        'Suele ser el mismo estímulo. Si quieres, cambio la variante o bajo volumen una semana.',
      acceptLabel: 'Cambiar algo',
      priority: 70,
    });
  }

  // Hybrid imbalance → suggest the missing domain (the anti-fragmentation wedge).
  const total = totalDomainSessions(input.domainCounts);
  if (total >= 4) {
    const entries = Object.entries(input.domainCounts);
    const top = entries.sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] / total >= 0.85) {
      out.push({
        id: `balance-${top[0]}`,
        kind: 'balance',
        tone: 'focus',
        headline: `Casi todo es ${spanishDomain(top[0])} últimamente`,
        detail:
          'Un día de otra cosa te haría más completo y cuidaría las articulaciones. Puedo sugerir un bloque.',
        acceptLabel: 'Sugerir bloque',
        priority: 60,
      });
    }
  }

  // Return after a gap → ease back in, don't shame.
  if (input.daysSinceLastWorkout !== null && input.daysSinceLastWorkout >= RETURN_GAP_DAYS) {
    out.push({
      id: 'return',
      kind: 'recover',
      tone: 'recover',
      headline: 'Cuánto tiempo',
      detail: `${input.daysSinceLastWorkout} días fuera. Volvemos suave, sin prisa.`,
      acceptLabel: 'Sesión suave',
      priority: 50,
    });
  }

  return out.sort((a, b) => b.priority - a.priority).slice(0, max);
}

const DOMAIN_ES: Record<string, string> = {
  strength: 'fuerza',
  running: 'carrera',
  calisthenics: 'calistenia',
  mobility: 'movilidad',
  team_sport: 'deporte de equipo',
  cycling: 'ciclismo',
  swimming: 'natación',
  general: 'general',
};

function spanishDomain(key: string): string {
  return DOMAIN_ES[key] ?? key;
}
