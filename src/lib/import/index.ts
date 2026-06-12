// Entry point for workout data imports: format detection + IR → history.

import { csvToRecords } from './csv';
import { looksLikeStrong, parseStrongCsv } from './strongCsv';
import { looksLikeHevy, parseHevyCsv } from './hevyCsv';
import type { ImportParseResult } from './types';

export { buildPreview } from './types';
export type { ImportParseResult, ImportPreview, ImportedWorkout } from './types';
export { toHistoryEntries } from './toHistory';

export class ImportFormatError extends Error {
  constructor() {
    super('Formato no reconocido — exporta el CSV desde Strong o Hevy.');
    this.name = 'ImportFormatError';
  }
}

/** Sniff the header and route to the right parser. Throws ImportFormatError. */
export function parseWorkoutCsv(text: string): ImportParseResult {
  const { header } = csvToRecords(text.slice(0, 8192));
  if (looksLikeHevy(header)) return parseHevyCsv(text);
  if (looksLikeStrong(header)) return parseStrongCsv(text);
  throw new ImportFormatError();
}
