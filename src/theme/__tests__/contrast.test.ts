// Contrast gate — Design v3 §3c mandates ≥4.5:1 (WCAG 2.1 AA) for every
// ink/paper pair we ship. This is the gate that stopped the doc's proposed
// `ink.muted: #7D7263` (4.48:1 on paper.base — a fail) from shipping.
//
// It is a TEST, not a vibe: warm the ramp again and this file tells you the
// moment a token drops below AA.

import { describe, it, expect, vi } from 'vitest';

// vitest runs in node (see vitest.config.ts): stub the two native-only imports
// `tokens.ts` pulls in so the palette itself can be asserted here. Neither is
// used by the colour tokens — Platform only picks the mono font, and `fonts.ts`
// `require()`s .ttf binaries Metro would normally resolve.
vi.mock('react-native', () => ({
  Platform: { select: (o: Record<string, unknown>) => o.ios ?? o.default },
}));
vi.mock('../fonts', () => ({
  Fonts: new Proxy({}, { get: (_t, key) => String(key) }),
}));

// eslint-disable-next-line import/first -- must land after the vi.mock hoists
import { Colors } from '../tokens';

// ── WCAG 2.1 relative luminance ────────────────────────────────────────────
// https://www.w3.org/TR/WCAG21/#dfn-relative-luminance

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(fg: string, bg: string): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

const AA = 4.5;
const round = (n: number) => Math.round(n * 100) / 100;

// ── The pairs we actually ship ─────────────────────────────────────────────

const TEXT_INKS = ['primary', 'secondary', 'tertiary', 'muted'] as const;
/** Papers any text ink may sit on. */
const PAPERS = ['base', 'raised', 'warm'] as const;

describe('warm ink ramp — WCAG AA on paper', () => {
  for (const ink of TEXT_INKS) {
    for (const paper of PAPERS) {
      it(`ink.${ink} on paper.${paper} ≥ ${AA}:1`, () => {
        const r = contrast(Colors.ink[ink], Colors.paper[paper]);
        expect(
          round(r),
          `${Colors.ink[ink]} on ${Colors.paper[paper]} = ${round(r)}:1`,
        ).toBeGreaterThanOrEqual(AA);
      });
    }
  }

  // paper.deep is the darkest surface (celebration / PR). The quietest ink it
  // may carry is `tertiary` — `muted` lands at 4.28:1 there, so it is banned on
  // deep by convention and by this test's omission.
  for (const ink of ['primary', 'secondary', 'tertiary'] as const) {
    it(`ink.${ink} on paper.deep ≥ ${AA}:1`, () => {
      expect(round(contrast(Colors.ink[ink], Colors.paper.deep))).toBeGreaterThanOrEqual(AA);
    });
  }

  it('ink.muted must NOT be used on paper.deep (documents the one gap)', () => {
    expect(round(contrast(Colors.ink.muted, Colors.paper.deep))).toBeLessThan(AA);
  });

  it('ink.faint is decoration only — it is not required to pass AA', () => {
    // Guard rail: if someone "fixes" faint by darkening it into text range,
    // they've broken its purpose (hairlines, dots, disabled marks).
    expect(round(contrast(Colors.ink.faint, Colors.paper.base))).toBeLessThan(AA);
  });
});

describe('gold — the one accent', () => {
  it('gold.deep (gold-as-ink) passes AA on every paper', () => {
    for (const paper of ['base', 'raised', 'warm', 'deep'] as const) {
      const r = contrast(Colors.gold.deep, Colors.paper[paper]);
      expect(round(r), `gold.deep on paper.${paper} = ${round(r)}:1`).toBeGreaterThanOrEqual(AA);
    }
  });

  it('ink.primary is the accessible label colour on a gold fill', () => {
    expect(round(contrast(Colors.ink.primary, Colors.gold.base))).toBeGreaterThanOrEqual(AA);
  });

  // KNOWN GAP, deliberately visible: the gold CTA (GoldButton, DayCell) prints
  // ink.inverse on gold.base at ~2.1:1. It predates v3 (white-on-gold was 2.09:1)
  // and flipping it to ink-on-gold is a brand decision, not a token fix. Pinned
  // here so it can never regress further unnoticed.
  it('ink.inverse on gold.base is the known sub-AA pair (2.0–2.2:1)', () => {
    const r = contrast(Colors.ink.inverse, Colors.gold.base);
    expect(r).toBeGreaterThan(2.0);
    expect(r).toBeLessThan(2.2);
  });
});

describe('the material inversion', () => {
  it('cards are lighter than the canvas (they lift, not sink)', () => {
    expect(luminance(Colors.paper.raised)).toBeGreaterThan(luminance(Colors.paper.base));
  });

  it('the paper ramp descends: raised > base > warm > deep', () => {
    const l = (k: 'raised' | 'base' | 'warm' | 'deep') => luminance(Colors.paper[k]);
    expect(l('raised')).toBeGreaterThan(l('base'));
    expect(l('base')).toBeGreaterThan(l('warm'));
    expect(l('warm')).toBeGreaterThan(l('deep'));
  });

  it('no Tailwind grey survives in the ink ramp', () => {
    const tailwind = ['#6B7280', '#9CA3AF', '#1A1A2E', '#34344A'];
    for (const ink of Object.values(Colors.ink)) {
      expect(tailwind).not.toContain(ink);
    }
  });

  it('the grain never eats legibility (≤ 0.04 opacity)', () => {
    expect(Colors.paper.grain).toBeLessThanOrEqual(0.04);
  });
});
