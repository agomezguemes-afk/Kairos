import { describe, expect, it } from 'vitest';

import { detectDelimiter, parseCsv } from './csv';

describe('parseCsv', () => {
  it('parses a simple comma table', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('strips a UTF-8 BOM', () => {
    expect(parseCsv('﻿a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('keeps commas and quotes inside quoted fields', () => {
    const rows = parseCsv('name,note\n"Push, Pull","dura ""fina"""');
    expect(rows[1]).toEqual(['Push, Pull', 'dura "fina"']);
  });

  it('handles CRLF line endings and a missing final newline', () => {
    expect(parseCsv('a,b\r\n1,2\r\n3,4')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('drops fully-empty lines', () => {
    expect(parseCsv('a,b\n\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('preserves newlines embedded in quoted fields', () => {
    const rows = parseCsv('a,b\n"line1\nline2",x');
    expect(rows[1][0]).toBe('line1\nline2');
  });

  it('auto-detects a semicolon delimiter', () => {
    expect(detectDelimiter('a;b;c')).toBe(';');
    expect(parseCsv('a;b\n2,5;10')).toEqual([
      ['a', 'b'],
      ['2,5', '10'],
    ]);
  });

  it('returns [] for blank input', () => {
    expect(parseCsv('   ')).toEqual([]);
  });
});
