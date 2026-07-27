// Compose the exact values a HECHO from the correction sheet will commit, plus
// the formatted target so the sheet's button labels/announces what it logs.
// Merge matches the store + screen behaviour verbatim: draft overrides base.

import type { FieldDefinition, FieldValue } from '../../../types/core';
import { formatScoreboardTarget, type FormattedTarget } from './format';

export interface SheetCommit {
  values: Record<string, FieldValue>;
  target: FormattedTarget | null;
}

export function resolveSheetCommit(
  base: Record<string, FieldValue>,
  draft: Record<string, FieldValue>,
  fields: FieldDefinition[],
): SheetCommit {
  const values = { ...base, ...draft };
  return { values, target: formatScoreboardTarget(fields, values) };
}
