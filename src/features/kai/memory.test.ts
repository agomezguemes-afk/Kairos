import { describe, expect, it } from 'vitest';
import {
  EMPTY_MEMORY,
  guidanceBias,
  memoryToContext,
  observeProposalDecision,
  observeSession,
  rememberIntent,
  topDomains,
} from './memory';

describe('rememberIntent', () => {
  it('seeds + sanitizes intent/goal and keeps existing when blank', () => {
    const m = rememberIntent(EMPTY_MEMORY, { intent: '  ganar  fuerza  ', goal: 'strength' }, 1000);
    expect(m.intent).toBe('ganar fuerza');
    expect(m.goal).toBe('strength');
    expect(m.updatedAt).toBe(1000);
    const m2 = rememberIntent(m, { intent: '   ' }, 2000);
    expect(m2.intent).toBe('ganar fuerza'); // blank doesn't wipe
  });

  it('ignores a non-finite days target', () => {
    const m = rememberIntent(EMPTY_MEMORY, { daysPerWeekTarget: NaN }, 1);
    expect(m.daysPerWeekTarget).toBeNull();
  });
});

describe('observeSession', () => {
  it('builds domain affinity with recency decay and records tracked metrics', () => {
    let m = observeSession(EMPTY_MEMORY, { domain: 'strength', metrics: ['weight', 'rpe'] }, 1);
    m = observeSession(m, { domain: 'running' }, 2);
    m = observeSession(m, { domain: 'strength', metrics: ['mood'] }, 3);
    // strength trained twice (with decay) should outrank running
    expect(topDomains(m)[0]).toBe('strength');
    expect(m.trackedMetrics).toContain('weight');
    expect(m.trackedMetrics).toContain('rpe');
    expect(m.trackedMetrics).toContain('mood');
  });

  it('defaults a missing domain to general', () => {
    const m = observeSession(EMPTY_MEMORY, { domain: '' }, 1);
    expect(Object.keys(m.domainAffinity)).toContain('general');
  });
});

describe('observeProposalDecision + guidanceBias', () => {
  it('needs a minimum sample before biasing', () => {
    const m = observeProposalDecision(EMPTY_MEMORY, 'deload', false, 1);
    expect(guidanceBias(m).avoided).not.toContain('deload');
  });

  it('avoids a kind dismissed clearly more than accepted', () => {
    let m = EMPTY_MEMORY;
    for (let i = 0; i < 3; i++) m = observeProposalDecision(m, 'balance', false, i);
    expect(guidanceBias(m).avoided).toContain('balance');
  });

  it('favors a kind the user keeps accepting', () => {
    let m = EMPTY_MEMORY;
    m = observeProposalDecision(m, 'deload', true, 1);
    m = observeProposalDecision(m, 'deload', true, 2);
    expect(guidanceBias(m).favored).toContain('deload');
  });
});

describe('memoryToContext', () => {
  it('is empty for an empty memory', () => {
    expect(memoryToContext(EMPTY_MEMORY)).toBe('');
  });

  it('summarizes goal, intent, domains, metrics and avoided guidance', () => {
    let m = rememberIntent(
      EMPTY_MEMORY,
      { goal: 'strength', intent: 'volver tras lesión', daysPerWeekTarget: 4 },
      1,
    );
    m = observeSession(m, { domain: 'strength', metrics: ['rpe'] }, 2);
    for (let i = 0; i < 3; i++) m = observeProposalDecision(m, 'balance', false, i);
    const ctx = memoryToContext(m);
    expect(ctx).toMatch(/Objetivo: strength/);
    expect(ctx).toMatch(/volver tras lesión/);
    expect(ctx).toMatch(/4 días/);
    expect(ctx).toMatch(/strength/);
    expect(ctx).toMatch(/rpe/);
    expect(ctx).toMatch(/Evita sugerencias.*balance/);
  });
});
