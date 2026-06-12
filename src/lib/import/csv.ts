// Minimal RFC-4180 CSV parser. Handles quoted fields, escaped quotes,
// embedded commas/newlines and CRLF. No dependency — Strong/Hevy exports are
// simple enough that a battle-tested 60-line parser beats a 200KB package.

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    // Skip rows that are entirely empty (trailing newline artifacts).
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ',') {
      pushField();
      i += 1;
      continue;
    }
    if (c === '\n') {
      pushRow();
      i += 1;
      continue;
    }
    if (c === '\r') {
      // CRLF or stray CR — treat as row end, swallow the LF if present.
      pushRow();
      i += text[i + 1] === '\n' ? 2 : 1;
      continue;
    }
    field += c;
    i += 1;
  }
  if (field.length > 0 || row.length > 0) pushRow();
  return rows;
}

/** Rows → array of objects keyed by the header row. Header names are trimmed. */
export function csvToRecords(text: string): {
  header: string[];
  records: Record<string, string>[];
} {
  const rows = parseCsv(text);
  if (rows.length === 0) return { header: [], records: [] };
  const header = rows[0].map((h) => h.trim());
  const records = rows.slice(1).map((cells) => {
    const rec: Record<string, string> = {};
    for (let i = 0; i < header.length; i++) {
      rec[header[i]] = (cells[i] ?? '').trim();
    }
    return rec;
  });
  return { header, records };
}
