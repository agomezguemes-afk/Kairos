// src/lib/import/csv.ts
//
// Small, dependency-free RFC-4180 CSV tokenizer. Tolerant to the mess real
// exports carry: a UTF-8 BOM, CRLF or LF line endings, quoted fields with
// embedded commas/quotes/newlines, and comma / semicolon / tab delimiters
// (Strong and Hevy vary by locale). Fully-empty rows are dropped.

export type Delimiter = ',' | ';' | '\t';

/** Guess the delimiter from the header line by frequency. Defaults to comma. */
export function detectDelimiter(headerLine: string): Delimiter {
  const candidates: Delimiter[] = [',', ';', '\t'];
  let best: Delimiter = ',';
  let bestCount = -1;
  for (const d of candidates) {
    const count = headerLine.split(d).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Parse CSV into rows of cells. Cells are trimmed of surrounding whitespace
 * that sits OUTSIDE quotes; whitespace inside quotes is preserved verbatim.
 */
export function parseCsv(input: string, delimiter?: Delimiter): string[][] {
  const text = stripBom(input);
  if (text.trim().length === 0) return [];

  const firstLineEnd = text.search(/\r?\n/);
  const firstLine = firstLineEnd === -1 ? text : text.slice(0, firstLineEnd);
  const delim = delimiter ?? detectDelimiter(firstLine);

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let cellWasQuoted = false;

  const pushCell = () => {
    row.push(cellWasQuoted ? cell : cell.trim());
    cell = '';
    cellWasQuoted = false;
  };
  const pushRow = () => {
    pushCell();
    // Drop rows that are entirely empty (blank lines, trailing newline).
    if (!(row.length === 1 && row[0] === '')) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++; // consume the escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      cellWasQuoted = true;
    } else if (ch === delim) {
      pushCell();
    } else if (ch === '\n') {
      pushRow();
    } else if (ch === '\r') {
      // Swallow CR; the following LF (if any) triggers the row break.
      if (text[i + 1] !== '\n') pushRow();
    } else {
      cell += ch;
    }
  }

  // Flush trailing cell/row (file without a final newline).
  if (cell.length > 0 || row.length > 0) pushRow();

  return rows;
}
