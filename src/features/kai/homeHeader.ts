// KAIROS — home journal header (pure).
//
// The home reads like today's page in a training journal: an editorial date line
// + a greeting that shifts through the day, so it feels alive and personal — not
// a static dashboard. Pure (no RN) so the date/greeting logic is unit-tested.

const DAYS_ES = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
const MONTHS_ES = [
  'ENE',
  'FEB',
  'MAR',
  'ABR',
  'MAY',
  'JUN',
  'JUL',
  'AGO',
  'SEP',
  'OCT',
  'NOV',
  'DIC',
];

export interface JournalHeader {
  /** e.g. "SÁBADO · 13 JUN". */
  eyebrow: string;
  /** Time-of-day greeting (no name). */
  greeting: string;
}

/** Buenas noches < 6h ≤ Buenos días < 13h ≤ Buenas tardes < 20h ≤ Buenas noches. */
export function journalHeader(now: Date): JournalHeader {
  const eyebrow = `${DAYS_ES[now.getDay()]} · ${now.getDate()} ${MONTHS_ES[now.getMonth()]}`;
  const h = now.getHours();
  const greeting =
    h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
  return { eyebrow, greeting };
}
