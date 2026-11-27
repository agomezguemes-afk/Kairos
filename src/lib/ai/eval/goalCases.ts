// Spanish goals as people write them, to score any goal interpreter (the
// rules parser, an on-device model, the cloud) on the same ground.
//
// `sport` lists every acceptable primary sport: where the sport is not in
// the app's list, the prompt asks for the closest by physical demands, and
// more than one can be right. Days and weeks are only checked when the
// person states them.

import type { ParsedGoal, Sport } from '../../adaptive/types';

export interface GoalCase {
  text: string;
  sport: Sport[];
  days?: number;
  /** Weeks to the deadline; ±1 is accepted ("2 meses" is 8 or 9). */
  weeks?: number;
  /** What the case exercises, for reading failures. */
  tag: 'directo' | 'jerga' | 'latam' | 'sin tildes' | 'implícito' | 'no listado' | 'plazo';
}

export const GOAL_CASES: readonly GoalCase[] = [
  { text: 'quiero mejorar mi resistencia en pádel', sport: ['padel'], tag: 'directo' },
  {
    text: 'Quiero aguantar más en pádel, juego martes y jueves',
    sport: ['padel'],
    days: 2,
    tag: 'directo',
  },
  {
    text: 'padel 3 dias por semana para competir en 2 meses',
    sport: ['padel'],
    days: 3,
    weeks: 8,
    tag: 'sin tildes',
  },
  {
    text: 'me ahogo en el tercer set y no llego a las bolas en el tenis',
    sport: ['tennis'],
    tag: 'implícito',
  },
  {
    text: 'mejorar mi saque y mi velocidad en la pista de tenis',
    sport: ['tennis'],
    tag: 'directo',
  },
  { text: 'jugar pickleball sin acabar reventado', sport: ['padel', 'tennis'], tag: 'no listado' },
  { text: 'ganar fuerza para escalar en 3 meses', sport: ['climbing'], weeks: 13, tag: 'plazo' },
  { text: 'encadenar un 6b en bloque', sport: ['climbing'], tag: 'jerga' },
  {
    text: 'quiero bajar de peso y empezar a correr, puedo 3 veces por semana',
    sport: ['running'],
    days: 3,
    tag: 'directo',
  },
  { text: 'preparar una media maratón en 12 semanas', sport: ['running'], weeks: 12, tag: 'plazo' },
  { text: 'bajar de 50 minutos en un 10k', sport: ['running'], tag: 'jerga' },
  {
    text: 'carrera de 5 km con mi hija dentro de 8 semanas',
    sport: ['running'],
    weeks: 8,
    tag: 'plazo',
  },
  { text: 'trotar todos los días por las mañanas', sport: ['running'], days: 7, tag: 'latam' },
  { text: 'quiero correr una ultra de montaña', sport: ['running', 'hiking'], tag: 'no listado' },
  { text: 'subir el Teide el verano que viene', sport: ['hiking'], tag: 'implícito' },
  { text: 'hacer el Camino de Santiago andando', sport: ['hiking'], tag: 'implícito' },
  { text: 'senderismo por los Pirineos, rutas de 20 km', sport: ['hiking'], tag: 'directo' },
  { text: 'mejorar en bici, salgo los findes', sport: ['cycling'], days: 2, tag: 'jerga' },
  { text: 'subir puertos con la bici sin morir', sport: ['cycling'], tag: 'jerga' },
  { text: 'andar en bici más rápido', sport: ['cycling'], tag: 'latam' },
  { text: 'nadar 1500 metros seguidos', sport: ['swimming'], tag: 'directo' },
  { text: 'aprender a nadar crol bien', sport: ['swimming'], tag: 'directo' },
  { text: 'mejorar en waterpolo', sport: ['swimming'], tag: 'no listado' },
  {
    text: 'rendir más en el fútbol, entreno lunes, miércoles y viernes',
    sport: ['football'],
    days: 3,
    tag: 'directo',
  },
  { text: 'jugar al futbol sin lesionarme los isquios', sport: ['football'], tag: 'sin tildes' },
  { text: 'agarrar condición para la cascarita con mis amigos', sport: ['football'], tag: 'latam' },
  { text: 'saltar más en baloncesto', sport: ['basketball'], tag: 'directo' },
  { text: 'mejorar mi juego en el básquet', sport: ['basketball'], tag: 'latam' },
  { text: 'ponerme fuerte en el gimnasio', sport: ['strength'], tag: 'directo' },
  { text: 'levantar 100 kg en press banca', sport: ['strength'], tag: 'directo' },
  { text: 'hipertrofia, 4 días a la semana', sport: ['strength'], days: 4, tag: 'jerga' },
  { text: 'hacer dominadas, ahora no llego a ninguna', sport: ['strength'], tag: 'implícito' },
  { text: 'hacer crossfit', sport: ['strength', 'general'], tag: 'no listado' },
  { text: 'quiero estar en forma en general', sport: ['general'], tag: 'directo' },
  { text: 'volver a hacer deporte después del embarazo', sport: ['general'], tag: 'implícito' },
  { text: 'me canso subiendo escaleras', sport: ['general'], tag: 'implícito' },
  { text: 'ganar movilidad de cadera para el yoga', sport: ['general'], tag: 'no listado' },
  { text: 'estar mamado para el verano', sport: ['strength'], tag: 'jerga' },
  { text: 'ir al gym 5 veces por semana', sport: ['strength'], days: 5, tag: 'jerga' },
  { text: 'correr la San Silvestre en 6 semanas', sport: ['running'], weeks: 6, tag: 'plazo' },
];

/**
 * Held-out cases, written after the rules parser's vocabulary was tuned on
 * GOAL_CASES and never used to tune it: the honest measure of how the
 * rules (or a model) handle phrasing nobody planned for.
 */
export const GOAL_HOLDOUT: readonly GoalCase[] = [
  {
    text: 'quiero acabar el Ironman de Lanzarote',
    sport: ['swimming', 'cycling', 'running'],
    tag: 'no listado',
  },
  { text: 'hacer la Quebrantahuesos', sport: ['cycling'], tag: 'implícito' },
  { text: 'jugar mejor al squash', sport: ['tennis', 'padel'], tag: 'no listado' },
  {
    text: 'llegar en forma a la pretemporada del equipo de fútbol sala',
    sport: ['football'],
    tag: 'directo',
  },
  { text: 'salir a rodar con la grupeta los domingos', sport: ['cycling'], days: 1, tag: 'jerga' },
  {
    text: 'quiero hacer mi primer ochomil algún día',
    sport: ['hiking', 'climbing'],
    tag: 'implícito',
  },
  { text: 'bajar mi tiempo en los 100 libres', sport: ['swimming'], tag: 'jerga' },
  { text: 'ganar masa muscular, voy tres días', sport: ['strength'], days: 3, tag: 'directo' },
  { text: 'echar unas canastas sin ahogarme', sport: ['basketball'], tag: 'implícito' },
  { text: 'correr un maratón en 16 semanas', sport: ['running'], weeks: 16, tag: 'plazo' },
  { text: 'hacer vías largas de escalada este verano', sport: ['climbing'], tag: 'directo' },
  {
    text: 'agarrar fuerza en el gym para no lastimarme jugando fut',
    sport: ['strength', 'football'],
    tag: 'latam',
  },
  { text: 'subir montes con la mochila cargada', sport: ['hiking'], tag: 'directo' },
  { text: 'mejorar el revés a dos manos', sport: ['tennis', 'padel'], tag: 'implícito' },
  { text: 'nadar en aguas abiertas la travesía de agosto', sport: ['swimming'], tag: 'directo' },
  {
    text: 'hacer sentadillas sin que me duela la rodilla, sábado y domingo',
    sport: ['strength'],
    days: 2,
    tag: 'directo',
  },
];

export interface GoalScore {
  case: GoalCase;
  sportOk: boolean;
  daysOk: boolean | null;
  weeksOk: boolean | null;
  got: Pick<ParsedGoal, 'sports' | 'daysPerWeek' | 'horizonWeeks'>;
}

export function scoreGoal(c: GoalCase, parsed: ParsedGoal): GoalScore {
  return {
    case: c,
    sportOk: c.sport.includes(parsed.sports[0]),
    daysOk: c.days === undefined ? null : parsed.daysPerWeek === c.days,
    weeksOk: c.weeks === undefined ? null : Math.abs(parsed.horizonWeeks - c.weeks) <= 1,
    got: {
      sports: parsed.sports,
      daysPerWeek: parsed.daysPerWeek,
      horizonWeeks: parsed.horizonWeeks,
    },
  };
}

export interface EvalSummary {
  cases: number;
  /** Share of cases whose primary sport is acceptable. */
  sport: number;
  /** Share of the cases that state days, read right. */
  days: number;
  weeks: number;
  /** Cases where any checked field was wrong. */
  misses: GoalScore[];
}

const share = (xs: (boolean | null)[]) => {
  const checked = xs.filter((x): x is boolean => x !== null);
  return checked.length ? checked.filter(Boolean).length / checked.length : 1;
};

export function summarise(scores: GoalScore[]): EvalSummary {
  return {
    cases: scores.length,
    sport: share(scores.map((s) => s.sportOk)),
    days: share(scores.map((s) => s.daysOk)),
    weeks: share(scores.map((s) => s.weeksOk)),
    misses: scores.filter((s) => !s.sportOk || s.daysOk === false || s.weeksOk === false),
  };
}
