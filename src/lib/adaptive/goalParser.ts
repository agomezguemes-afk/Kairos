// Deterministic goal interpreter (ES + EN). Runs offline and instantly so
// the UI can show "what I understood" while the user types; an LLM can
// later refine the result, but never replaces this as the fallback.

import type { ParsedGoal, Quality, Sport } from './types';

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Order matters only for display; every match is collected.
// Spain and Latin America ("trotar", "básquet", "cascarita"). "bloque" is
// left out on purpose: in Kairos it means a training block.
const SPORT_TERMS: [Sport, string[]][] = [
  ['padel', ['padel', 'pickleball']],
  ['tennis', ['tenis', 'tennis']],
  [
    'climbing',
    [
      'escalada',
      'escalar',
      'escalo',
      'escalador',
      'escaladora',
      'encadenar',
      'climbing',
      'climb',
      'boulder',
      'bulder',
      'rocodromo',
    ],
  ],
  [
    'hiking',
    [
      'hiking',
      'senderismo',
      'trekking',
      'montana',
      'montanismo',
      'monte',
      'hike',
      'caminar',
      'caminata',
      'andando',
      'alpinismo',
    ],
  ],
  [
    'running',
    [
      'correr',
      'corro',
      'corriendo',
      'trotar',
      'trote',
      'running',
      'runner',
      'run',
      'carrera',
      '10k',
      '5k',
      '21k',
      'maraton',
      'trail',
      'san silvestre',
    ],
  ],
  [
    'cycling',
    [
      'bici',
      'bicicleta',
      'ciclismo',
      'ciclista',
      'cycling',
      'spinning',
      'rodillo',
      'mtb',
      'btt',
      'pedalear',
    ],
  ],
  [
    'football',
    ['futbol', 'football', 'soccer', 'futbito', 'futbolito', 'futsal', 'cascarita', 'pachanga'],
  ],
  ['basketball', ['baloncesto', 'basket', 'basketball', 'basquet', 'basquetbol', 'basketbol']],
  ['swimming', ['nadar', 'natacion', 'swim', 'swimming', 'piscina', 'crol', 'waterpolo']],
  [
    'strength',
    [
      'gimnasio',
      'gym',
      'pesas',
      'powerlifting',
      'halterofilia',
      'musculacion',
      'hipertrofia',
      'calistenia',
      'dominadas',
      'sentadilla',
      'press banca',
      'peso muerto',
      'crossfit',
      'mamado',
    ],
  ],
];

const WEEKDAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const EVERY_DAY = ['todos los dias', 'a diario', 'cada dia', 'every day', 'daily'];
const WEEKENDS = ['findes', 'finde', 'fines de semana', 'fin de semana', 'weekends'];

/** Position of a term in the normalised text, to order sports as written. */
function termIndex(text: string, term: string): number {
  const m = new RegExp(`\\b${term}\\b`).exec(text);
  return m ? m.index : Number.MAX_SAFE_INTEGER;
}

const QUALITY_TERMS: [Quality, string[]][] = [
  [
    'endurance',
    [
      'resistencia',
      'aguante',
      'fondo',
      'cardio',
      'endurance',
      'aerobico',
      'cansarme',
      'ahogarme',
      'stamina',
    ],
  ],
  ['strength', ['fuerza', 'fuerte', 'strength', 'stronger', 'strong', 'agarre', 'musculo']],
  [
    'power',
    ['potencia', 'explosividad', 'explosivo', 'salto', 'saltar', 'power', 'explosive', 'remate'],
  ],
  ['speed', ['velocidad', 'rapido', 'rapidez', 'agilidad', 'agil', 'sprint', 'speed', 'reflejos']],
  ['mobility', ['movilidad', 'flexibilidad', 'flexible', 'mobility', 'estirar', 'lesion', 'dolor']],
  ['technique', ['tecnica', 'technique', 'eficiencia']],
];

// When the user names a sport but no quality, these are what that sport
// most commonly limits recreational athletes on.
const SPORT_DEFAULT_QUALITIES: Record<Sport, Quality[]> = {
  padel: ['endurance', 'speed'],
  tennis: ['endurance', 'speed'],
  climbing: ['strength', 'endurance'],
  hiking: ['endurance', 'strength'],
  running: ['endurance'],
  cycling: ['endurance'],
  football: ['endurance', 'speed'],
  basketball: ['power', 'speed'],
  swimming: ['endurance', 'technique'],
  strength: ['strength'],
  general: ['strength', 'endurance'],
};

const NUMBER_WORDS: Record<string, number> = {
  un: 1,
  una: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  diez: 10,
  doce: 12,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
};

function toNumber(token: string): number | null {
  const n = Number(token);
  if (Number.isFinite(n)) return n;
  return NUMBER_WORDS[token] ?? null;
}

function hasTerm(words: Set<string>, text: string, term: string): boolean {
  return term.includes(' ') ? text.includes(term) : words.has(term);
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function parseGoal(raw: string): ParsedGoal {
  const text = normalize(raw);
  const words = new Set(text.split(' ').filter(Boolean));
  const matched: string[] = [];

  // The sport mentioned first is the main one ("correr y algo de bici").
  const found: { sport: Sport; hit: string; at: number }[] = [];
  for (const [sport, terms] of SPORT_TERMS) {
    const hits = terms.filter((t) => hasTerm(words, text, t));
    if (hits.length) {
      const first = hits.reduce((a, b) => (termIndex(text, a) <= termIndex(text, b) ? a : b));
      found.push({ sport, hit: first, at: termIndex(text, first) });
    }
  }
  found.sort((a, b) => a.at - b.at);
  const sports: Sport[] = found.map((f) => f.sport);
  matched.push(...found.map((f) => f.hit));

  const qualities: Quality[] = [];
  for (const [quality, terms] of QUALITY_TERMS) {
    const hit = terms.find((t) => hasTerm(words, text, t));
    if (hit) {
      qualities.push(quality);
      matched.push(hit);
    }
  }

  const explicitQualities = qualities.length > 0;
  if (!explicitQualities) {
    for (const s of sports.length ? sports : (['general'] as Sport[])) {
      for (const q of SPORT_DEFAULT_QUALITIES[s]) if (!qualities.includes(q)) qualities.push(q);
    }
  }

  let daysPerWeek = 3;
  let daysStated = false;
  const days = text.match(/\b(\w+) (?:dias|veces|sesiones|days|times|sessions)\b/);
  const n = days ? toNumber(days[1]) : null;
  const namedDays = WEEKDAYS.filter((d) => words.has(d));
  const everyDay = EVERY_DAY.find((t) => hasTerm(words, text, t));
  const weekend = WEEKENDS.find((t) => hasTerm(words, text, t));
  if (days && n !== null) {
    daysPerWeek = clamp(Math.round(n), 1, 7);
    matched.push(days[0]);
    daysStated = true;
  } else if (everyDay) {
    daysPerWeek = 7;
    matched.push(everyDay);
    daysStated = true;
  } else if (namedDays.length) {
    // "lunes, miércoles y viernes" is three days a week.
    daysPerWeek = clamp(namedDays.length + (weekend ? 2 : 0), 1, 7);
    matched.push(...namedDays);
    daysStated = true;
  } else if (weekend) {
    daysPerWeek = 2;
    matched.push(weekend);
    daysStated = true;
  }

  let horizonWeeks = 8;
  const horizon = text.match(/\b(\w+) (semanas?|weeks?|mes(?:es)?|months?)\b/);
  if (horizon) {
    const n = toNumber(horizon[1]);
    if (n !== null) {
      const isMonth = /^(mes|month)/.test(horizon[2]);
      horizonWeeks = clamp(Math.round(isMonth ? n * 4.3 : n), 2, 52);
      matched.push(horizon[0]);
    }
  }

  // Confidence: sport and quality each carry most of the weight; numbers
  // add a little. A bare "quiero estar mejor" stays low so the UI asks.
  let confidence = 0.15;
  if (sports.length) confidence += 0.4;
  if (explicitQualities) confidence += 0.35;
  if (daysStated || horizon) confidence += 0.1;

  return {
    raw,
    sports: sports.length ? sports : ['general'],
    qualities,
    daysPerWeek,
    horizonWeeks,
    confidence: Math.min(1, Number(confidence.toFixed(2))),
    matched,
  };
}

export const SPORT_LABEL: Record<Sport, string> = {
  padel: 'Pádel',
  tennis: 'Tenis',
  climbing: 'Escalada',
  hiking: 'Montaña',
  running: 'Running',
  cycling: 'Ciclismo',
  football: 'Fútbol',
  basketball: 'Baloncesto',
  swimming: 'Natación',
  strength: 'Fuerza',
  general: 'General',
};

export const QUALITY_LABEL: Record<Quality, string> = {
  endurance: 'Resistencia',
  strength: 'Fuerza',
  power: 'Potencia',
  speed: 'Velocidad',
  mobility: 'Movilidad',
  technique: 'Técnica',
};
