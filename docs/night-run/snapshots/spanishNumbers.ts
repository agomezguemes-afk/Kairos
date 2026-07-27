// Spanish spelled-out numbers → numeric value. Pure TS, no throw. Covers 0-999
// plus "y medio" (+0.5) so the 2.5 kg microload step is speakable/typeable.
// Whisper (es) frequently emits words instead of digits in connected speech
// ("sesenta y dos por ocho"), so parseSpokenSet folds these into number tokens.
// Out of scope: miles ("mil"), "coma/punto" decimals, English, multi-idioma.

export interface NumberRun {
  value: number;
  /** Nº de palabras consumidas desde `start` (para avanzar el puntero del caller). */
  length: number;
}

// Todas en minúscula; con y sin tilde. 'una' cuenta como 1 (femenino).
const UNITS: Record<string, number> = {
  cero: 0,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
};

// 10-29 dichos en una sola palabra (incluye las contracciones dieci-/veinti-).
const TEENS: Record<string, number> = {
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciséis: 16,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiuno: 21,
  veintiuna: 21,
  veintiún: 21,
  veintiun: 21,
  veintidós: 22,
  veintidos: 22,
  veintitrés: 23,
  veintitres: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiséis: 26,
  veintiseis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
};

const TENS: Record<string, number> = {
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
};

const HUNDREDS: Record<string, number> = {
  cien: 100,
  ciento: 100,
  doscientos: 200,
  doscientas: 200,
  trescientos: 300,
  trescientas: 300,
  cuatrocientos: 400,
  cuatrocientas: 400,
  quinientos: 500,
  quinientas: 500,
  seiscientos: 600,
  seiscientas: 600,
  setecientos: 700,
  setecientas: 700,
  ochocientos: 800,
  ochocientas: 800,
  novecientos: 900,
  novecientas: 900,
};

// Parsea una tirada MAXIMAL de palabras-número desde words[start]. null si
// words[start] no inicia un número. Algoritmo: centena? + resto(0-99) + "y medio".
export function parseSpanishNumberWords(words: string[], start = 0): NumberRun | null {
  let i = start;
  let total = 0;
  let matched = false;

  // 1. "medio" suelto = 0.5 (media serie / medio kilo dicho a secas).
  if (words[start] === 'medio') return { value: 0.5, length: 1 };

  // 2. Centenas.
  const hundred = HUNDREDS[words[i]];
  if (hundred != null) {
    total += hundred;
    i += 1;
    matched = true;
  }

  // 3. Resto 0-99: teens en una palabra, o decena (+ "y" + unidad), o unidad.
  let rest: number | null = null;
  const teen = TEENS[words[i]];
  const ten = TENS[words[i]];
  const unit = UNITS[words[i]];
  if (teen != null) {
    rest = teen;
    i += 1;
  } else if (ten != null) {
    rest = ten;
    i += 1;
    if (words[i] === 'y' && UNITS[words[i + 1]] != null) {
      rest += UNITS[words[i + 1]];
      i += 2;
    }
  } else if (unit != null) {
    // 'uno'/'una' are common Spanish words on their own ("una pausa larga",
    // "uno de los discos") — never accept them as a BARE standalone number,
    // or a free-text note starting with one silently turns into a phantom
    // weight/reps value and loses its first word. They still work
    // compositionally: after a hundred ("ciento uno"→101, `matched` is
    // already true here) and after a tens word via the "y"+unit branch above
    // ("sesenta y uno"→61, a different code path this guard doesn't touch).
    const isBareOnesWord = words[i] === 'uno' || words[i] === 'una';
    if (!isBareOnesWord || matched) {
      rest = unit;
      i += 1;
    }
  }
  if (rest != null) {
    total += rest;
    matched = true;
  }

  // 4. Nada reconocido → no era un número.
  if (!matched) return null;

  // 5. Fracción "y medio" → +0.5 (cubre el salto de 2.5 kg sin decimales hablados).
  if (words[i] === 'y' && words[i + 1] === 'medio') {
    total += 0.5;
    i += 2;
  }

  return { value: total, length: i - start };
}
