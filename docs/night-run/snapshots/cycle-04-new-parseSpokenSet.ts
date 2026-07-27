// parseSpokenSet — the voice/typing brain of the scoreboard. Turns a natural
// utterance ("62.5 por 8, me costó") into values for the exercise's DYNAMIC
// fields + set metadata (rpe, note). Pure TS so it is exhaustively testable
// today (quick-entry row in SetCorrectionSheet) and voice-ready tomorrow: the
// recorder only has to hand its transcript to this same function.
//
// Digits only in this pass — Whisper emits digits, so spelled-out numbers
// ("ocho") are a later brief. Effort phrases ("me costó") are NOT converted to
// RPE (guessing is noise); only the explicit "rpe N" pattern sets it.

import type { FieldDefinition, FieldValue } from '../../../types/core';

export interface ParsedSet {
  /** field.id → valor parseado (number para 'number', string "m:ss" para 'time'). */
  values: Record<string, FieldValue>;
  /** RPE explícito 1..10, o null. Fuera de rango → null. */
  rpe: number | null;
  /** Texto de esfuerzo/observación sobrante, o null. */
  note: string | null;
  /** true si se reconoció al menos un valor o rpe. */
  matched: boolean;
}

const EMPTY: ParsedSet = { values: {}, rpe: null, note: null, matched: false };

// Mirrors formatScoreboardTarget's predicate so the parser writes exactly the
// fields the giant target reads.
const NUMERIC_TYPES = new Set(['number', 'time']);

interface UnitDest {
  /** Preferred well-known field id (weight/reps) — beats unit matching. */
  fieldId?: string;
  /** Fallback: match by the field's declared unit. */
  unit?: string;
  /** The alias speaks minutes, so a bare 'time' field is a valid target. */
  allowTime?: boolean;
}

const UNIT_ALIASES: Record<string, UnitDest> = {
  kilo: { fieldId: 'weight', unit: 'kg' },
  kilos: { fieldId: 'weight', unit: 'kg' },
  kg: { fieldId: 'weight', unit: 'kg' },
  rep: { fieldId: 'reps' },
  reps: { fieldId: 'reps' },
  repe: { fieldId: 'reps' },
  repes: { fieldId: 'reps' },
  repetición: { fieldId: 'reps' },
  repeticion: { fieldId: 'reps' },
  repeticiones: { fieldId: 'reps' },
  km: { unit: 'km' },
  kilómetro: { unit: 'km' },
  kilómetros: { unit: 'km' },
  kilometro: { unit: 'km' },
  kilometros: { unit: 'km' },
  metro: { unit: 'm' },
  metros: { unit: 'm' },
  m: { unit: 'm' },
  min: { unit: 'min', allowTime: true },
  minuto: { unit: 'min', allowTime: true },
  minutos: { unit: 'min', allowTime: true },
  seg: { unit: 'sec' },
  segundo: { unit: 'sec' },
  segundos: { unit: 'sec' },
  s: { unit: 'sec' },
  ppm: { unit: 'bpm' },
  pulsaciones: { unit: 'bpm' },
  cal: { unit: 'kcal' },
  kcal: { unit: 'kcal' },
  calorías: { unit: 'kcal' },
  calorias: { unit: 'kcal' },
};

// Connectors that carry no meaning once numbers/units are consumed — they must
// not leak into the note ("60 por 8 me costó" → note "me costó", not "por me
// costó"). Unit words joined here so a dangling "kg" doesn't pollute either.
const FILLERS = new Set<string>([
  'por',
  'x',
  '×',
  'y',
  'de',
  'a',
  'con',
  'el',
  'la',
  ...Object.keys(UNIT_ALIASES),
]);

type TokenKind = 'number' | 'time' | 'text';

interface Token {
  raw: string;
  kind: TokenKind;
  consumed: boolean;
}

// Time before number so "5:30" isn't split into 5 and 30; '×' gets its own
// branch because it is neither a letter nor a digit.
const TOKEN_RE = /(\d{1,2}:\d{2})|(\d+(?:\.\d+)?)|([a-zñáéíóúü]+)|(×)/g;

function tokenize(normalized: string): Token[] {
  const tokens: Token[] = [];
  for (const m of normalized.matchAll(TOKEN_RE)) {
    const kind: TokenKind = m[1] != null ? 'time' : m[2] != null ? 'number' : 'text';
    tokens.push({ raw: m[0], kind, consumed: false });
  }
  return tokens;
}

/** "5" min → "5:00", "5.5" min → "5:30" — spoken minutes into the m:ss a time field stores. */
function minutesToTime(minutes: number): string {
  let whole = Math.floor(minutes);
  let secs = Math.round((minutes - whole) * 60);
  if (secs === 60) {
    whole += 1;
    secs = 0;
  }
  return `${whole}:${String(secs).padStart(2, '0')}`;
}

export function parseSpokenSet(utterance: string, fields: FieldDefinition[]): ParsedSet {
  try {
    return parse(utterance, fields);
  } catch {
    // Contract: never throw — an unparseable utterance is simply "no match".
    return { ...EMPTY, values: {} };
  }
}

function parse(utterance: string, fields: FieldDefinition[]): ParsedSet {
  if (typeof utterance !== 'string' || !Array.isArray(fields)) return { ...EMPTY, values: {} };

  // Decimal comma only BETWEEN digits: "62,5" → "62.5" without touching the
  // separating comma of "60, 8".
  const normalized = utterance.toLowerCase().trim().replace(/(\d),(\d)/g, '$1.$2');
  const tokens = tokenize(normalized);

  const numericFields = fields
    .filter((f) => NUMERIC_TYPES.has(f.type))
    .sort((a, b) => a.order - b.order);

  const values: Record<string, FieldValue> = {};
  let rpe: number | null = null;

  // ── 1. Explicit "rpe N" — consumed even when out of range, so a stray "rpe
  // 11" doesn't leak 11 into weight as a bare number.
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].consumed || tokens[i].raw !== 'rpe') continue;
    tokens[i].consumed = true;
    let j = i + 1;
    if (tokens[j]?.raw === 'de' && !tokens[j].consumed) j += 1;
    const numTok = tokens[j];
    if (numTok && !numTok.consumed && numTok.kind === 'number' && /^\d{1,2}$/.test(numTok.raw)) {
      for (let k = i + 1; k <= j; k++) tokens[k].consumed = true;
      const n = parseInt(numTok.raw, 10);
      if (n >= 1 && n <= 10 && rpe === null) rpe = n;
    }
  }

  const resolveUnitField = (dest: UnitDest): FieldDefinition | null => {
    const free = (f: FieldDefinition) => values[f.id] === undefined;
    if (dest.fieldId) {
      const byId = numericFields.find((f) => f.id === dest.fieldId && f.type === 'number' && free(f));
      if (byId) return byId;
    }
    if (dest.unit) {
      const byUnit = numericFields.find((f) => f.unit === dest.unit && f.type === 'number' && free(f));
      if (byUnit) return byUnit;
    }
    if (dest.allowTime) {
      const byTime = numericFields.find((f) => f.type === 'time' && free(f));
      if (byTime) return byTime;
    }
    return null;
  };

  // ── 2. Number + unit/keyword pairs ("60 kg", "8 reps", "5 km"). No target
  // field for that unit → leave the number bare (step 5 will place it).
  for (let i = 0; i < tokens.length - 1; i++) {
    const num = tokens[i];
    const word = tokens[i + 1];
    if (num.consumed || num.kind !== 'number') continue;
    if (word.consumed || word.kind !== 'text') continue;
    const dest = UNIT_ALIASES[word.raw];
    if (!dest) continue;
    const field = resolveUnitField(dest);
    if (!field) continue;
    const n = Number(num.raw);
    values[field.id] = field.type === 'time' ? minutesToTime(n) : n;
    num.consumed = true;
    word.consumed = true;
  }

  // ── 3. Strength idiom "A por/x B" → weight × reps, only when the exercise
  // speaks that language (has both fields). Partial fills work too: in
  // "60 kg por 8" the weight is already taken, so only 8 → reps.
  const weightField = numericFields.find((f) => f.id === 'weight' && f.type === 'number');
  const repsField = numericFields.find((f) => f.id === 'reps' && f.type === 'number');
  if (weightField && repsField) {
    for (let i = 0; i < tokens.length - 2; i++) {
      const [a, sep, b] = [tokens[i], tokens[i + 1], tokens[i + 2]];
      if (a.kind !== 'number' || b.kind !== 'number') continue;
      if (sep.consumed || (sep.raw !== 'por' && sep.raw !== 'x' && sep.raw !== '×')) continue;
      if (a.consumed && b.consumed) continue;
      if (!a.consumed && values[weightField.id] === undefined) {
        values[weightField.id] = Number(a.raw);
        a.consumed = true;
      }
      if (!b.consumed && values[repsField.id] === undefined) {
        values[repsField.id] = Number(b.raw);
        b.consumed = true;
      }
      sep.consumed = true;
    }
  }

  // ── 4. "m:ss" tokens → time fields in order (best-effort; without a time
  // field the token is discarded, never noise for the note).
  for (const tok of tokens) {
    if (tok.consumed || tok.kind !== 'time') continue;
    tok.consumed = true;
    const field = numericFields.find((f) => f.type === 'time' && values[f.id] === undefined);
    if (field) values[field.id] = tok.raw;
  }

  // ── 5. Bare numbers fill the remaining number fields by field.order ("60 8"
  // → weight, reps). Time fields are excluded here: a bare digit can't become
  // "m:ss" without guessing the scale. Surplus numbers are discarded.
  for (const tok of tokens) {
    if (tok.consumed || tok.kind !== 'number') continue;
    tok.consumed = true;
    const field = numericFields.find((f) => f.type === 'number' && values[f.id] === undefined);
    if (field) values[field.id] = Number(tok.raw);
  }

  const matched = Object.keys(values).length > 0 || rpe !== null;

  // ── 6. Note = leftover words minus fillers — but only when something was
  // recognized: an unintelligible utterance must not create a note.
  let note: string | null = null;
  if (matched) {
    const leftover = tokens
      .filter((t) => !t.consumed && !FILLERS.has(t.raw))
      .map((t) => t.raw)
      .join(' ')
      .trim();
    if (/[a-zñáéíóúü]/.test(leftover)) note = leftover;
  }

  return { values, rpe, note, matched };
}
