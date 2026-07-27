import { describe, it, expect } from 'vitest';
import type { Discipline, WorkoutBlock } from '../../../types/core';
import { createWorkoutBlock } from '../../../types/core';
import {
  groupBlocksIntoFolders,
  resolveBlockFolderOpen,
  type BlockFolder,
  type BlockSingleton,
} from './blockFolders';

// Minimal factory: a real WorkoutBlock (so no `as` casts and future field
// reads stay safe) with a deterministic id and the given discipline.
const block = (id: string, discipline: Discipline): WorkoutBlock => ({
  ...createWorkoutBlock('u1', 0, discipline, { name: id }),
  id,
});

const ids = (folder: BlockFolder): string[] => folder.blocks.map((b) => b.id);

describe('groupBlocksIntoFolders', () => {
  it('returns [] for an empty list', () => {
    expect(groupBlocksIntoFolders([])).toEqual([]);
  });

  it('leaves a single block as a loose card', () => {
    const b = block('a', 'strength');
    const result = groupBlocksIntoFolders([b]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual<BlockSingleton>({ kind: 'single', block: b });
  });

  it('groups 2 blocks of the same discipline into one folder', () => {
    const a = block('a', 'strength');
    const b = block('b', 'strength');
    const result = groupBlocksIntoFolders([a, b]);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('folder');
    const folder = result[0] as BlockFolder;
    expect(folder.discipline).toBe('strength');
    expect(folder.blocks).toHaveLength(2);
    expect(ids(folder)).toEqual(['a', 'b']);
  });

  it('keeps 2 blocks of different disciplines as two loose cards', () => {
    const a = block('a', 'strength');
    const b = block('b', 'running');
    const result = groupBlocksIntoFolders([a, b]);
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.kind)).toEqual(['single', 'single']);
  });

  it('groups a mixed interleaved list in order of first appearance', () => {
    // First appearance: strength → running → mobility.
    const s1 = block('s1', 'strength');
    const r1 = block('r1', 'running');
    const m1 = block('m1', 'mobility');
    const s2 = block('s2', 'strength');
    const m2 = block('m2', 'mobility');
    const s3 = block('s3', 'strength');

    const result = groupBlocksIntoFolders([s1, r1, m1, s2, m2, s3]);

    expect(result).toHaveLength(3);
    // strength folder first (its first member s1 appeared first)
    expect(result[0].kind).toBe('folder');
    expect((result[0] as BlockFolder).discipline).toBe('strength');
    expect(ids(result[0] as BlockFolder)).toEqual(['s1', 's2', 's3']);
    // running single next (single running block)
    expect(result[1]).toEqual<BlockSingleton>({ kind: 'single', block: r1 });
    // mobility folder last
    expect(result[2].kind).toBe('folder');
    expect((result[2] as BlockFolder).discipline).toBe('mobility');
    expect(ids(result[2] as BlockFolder)).toEqual(['m1', 'm2']);
  });

  it('respects the caller sort: input order drives output order (across and within)', () => {
    const s1 = block('s1', 'strength');
    const s2 = block('s2', 'strength');
    const r1 = block('r1', 'running');

    // running first in input → running single leads the output.
    const runningFirst = groupBlocksIntoFolders([r1, s1, s2]);
    expect(runningFirst.map((i) => i.kind)).toEqual(['single', 'folder']);
    expect((runningFirst[0] as BlockSingleton).block.id).toBe('r1');

    // strength first in input → strength folder leads; members keep input order.
    const strengthFirst = groupBlocksIntoFolders([s2, s1, r1]);
    expect(strengthFirst.map((i) => i.kind)).toEqual(['folder', 'single']);
    expect(ids(strengthFirst[0] as BlockFolder)).toEqual(['s2', 's1']);
  });

  it("forms a folder for 'general' with ≥2 (no special-casing)", () => {
    const a = block('a', 'general');
    const b = block('b', 'general');
    const result = groupBlocksIntoFolders([a, b]);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('folder');
    expect((result[0] as BlockFolder).discipline).toBe('general');
    expect((result[0] as BlockFolder).blocks).toHaveLength(2);
  });
});

describe('resolveBlockFolderOpen', () => {
  it('stays closed for an untouched folder with no highlight', () => {
    expect(resolveBlockFolderOpen(undefined, false)).toBe(false);
  });

  it('opens an untouched folder that contains the highlighted block', () => {
    expect(resolveBlockFolderOpen(undefined, true)).toBe(true);
  });

  it('honours a remembered-open folder with no highlight', () => {
    expect(resolveBlockFolderOpen(true, false)).toBe(true);
  });

  it('opens a remembered-closed folder when it holds the highlight (highlight wins)', () => {
    expect(resolveBlockFolderOpen(false, true)).toBe(true);
  });

  it('honours a remembered-closed folder with no highlight', () => {
    expect(resolveBlockFolderOpen(false, false)).toBe(false);
  });

  it('stays open when both remembered-open and highlighted', () => {
    expect(resolveBlockFolderOpen(true, true)).toBe(true);
  });
});
