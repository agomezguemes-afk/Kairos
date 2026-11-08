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
const SPORT_TERMS: [Sport, string[]][] = [
  ['padel', ['padel']],
  ['tennis', ['tenis', 'tennis']],
  [
    'climbing',
    ['escalada', 'escalar', 'escalo', 'climbing', 'climb', 'boulder', 'bulder', 'rocodromo'],
  ],
  ['hiking', ['hiking', 'senderismo', 'trekking', 'montana', 'montanismo', 'monte', 'hike']],
  [
    'running',
    ['correr', 'corro', 'running', 'run', 'carrera', '10k', '5k', '21k', 'maraton', 'trail'],
  ],
  ['cycling', ['bici', 'bicicleta', 'ciclismo', 'cycling', 'spinning', 'rodillo', 'mtb']],
  ['football', ['futbol', 'football', 'soccer', 'futbito', 'futsal']],
  ['basketball', ['baloncesto', 'basket', 'basketball']],
  ['swimming', ['nadar', 'natacion', 'swim', 'swimming', 'piscina']],
  ['strength', ['gimnasio', 'gym', 'pesas', 'powerlifting', 'halterofilia', 'musculacion']],
];

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

  const sports: Sport[] = [];
  for (const [sport, terms] of SPORT_TERMS) {
    const hit = terms.find((t) => hasTerm(words, text, t));
    if (hit) {
      sports.push(sport);
      matched.push(hit);
    }
  }

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
  const days = text.match(/\b(\w+) (?:dias|veces|sesiones|days|times|sessions)\b/);
  if (days) {
    const n = toNumber(days[1]);
    if (n !== null) {
      daysPerWeek = clamp(Math.round(n), 1, 7);
      matched.push(days[0]);
    }
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
  if (days || horizon) confidence += 0.1;

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
