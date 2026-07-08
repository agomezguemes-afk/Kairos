// KAIROS — metric trend analysis (pure).
//
// The structural edge (docs/KAIROS_VISION §3): because Kairos tracks *user-
// defined* fields, Kai must reason over progress on ANY metric the user invents
// — bar weight, RPE, 5k time, resting HR, mood, bar speed — not a fixed schema.
// This module turns a raw numeric time-series into a trend Kai can talk about.
//
// `lowerIsBetter` is the key: for time/HR/fatigue, down is progress; the
// analysis flips accordingly so "best", "PR" and "plateau" mean the right thing
// for that metric. Pure (no store/network/RN) → unit-tested directly.

export interface MetricPoint {
  /** Timestamp, ms. */
  t: number;
  value: number;
}

export type TrendDirection = 'rising' | 'flat' | 'falling' | 'insufficient';

export interface MetricTrend {
  /** Direction of the *raw* values (rising/falling/flat), or insufficient data. */
  direction: TrendDirection;
  /** Is the latest movement progress for this metric (respects lowerIsBetter)? */
  improving: boolean;
  /** The best value for this metric (max, or min if lowerIsBetter) + when. */
  best: { value: number; t: number } | null;
  /** Best was set within the recent window → celebrate a PR. */
  recentBest: boolean;
  /** Weeks since the best improved — the plateau signal. null if no data. */
  weeksSinceBest: number | null;
  /** No improvement over `plateauWeeks` (and enough data to claim it). */
  plateaued: boolean;
  /** Signed % change across the window (raw values). null if not computable. */
  changePct: number | null;
  /** Count of finite points analyzed. */
  samples: number;
}

const WEEK_MS = 7 * 24 * 3600 * 1000;

export interface AnalyzeOptions {
  /** For time/HR/fatigue metrics where a lower value is better. Default false. */
  lowerIsBetter?: boolean;
  /** Weeks without improvement to call a plateau. Default 3. */
  plateauWeeks?: number;
  /** Window (weeks) within which a new best counts as "recent". Default 2. */
  recentWeeks?: number;
  /** Flat band: |changePct| below this is "flat". Default 0.02 (2%). */
  flatBand?: number;
  /** "Now" for windowing/tests. Defaults to the latest point's time. */
  now?: number;
}

const EMPTY: MetricTrend = {
  direction: 'insufficient',
  improving: false,
  best: null,
  recentBest: false,
  weeksSinceBest: null,
  plateaued: false,
  changePct: null,
  samples: 0,
};

/**
 * Analyze a metric's series. Robust to noise/garbage: non-finite points are
 * dropped, order is normalized. Returns a conservative "insufficient" result
 * rather than guessing when there are < 3 clean points.
 */
export function analyzeMetric(
  points: readonly MetricPoint[],
  opts: AnalyzeOptions = {},
): MetricTrend {
  const lowerIsBetter = opts.lowerIsBetter ?? false;
  const plateauWeeks = opts.plateauWeeks ?? 3;
  const recentWeeks = opts.recentWeeks ?? 2;
  const flatBand = opts.flatBand ?? 0.02;

  const clean = points
    .filter((p) => p && Number.isFinite(p.t) && Number.isFinite(p.value))
    .sort((a, b) => a.t - b.t);

  if (clean.length < 3) return { ...EMPTY, samples: clean.length };

  const now = Number.isFinite(opts.now) ? (opts.now as number) : clean[clean.length - 1].t;
  const first = clean[0];
  const last = clean[clean.length - 1];

  // Best respects metric polarity.
  let best = clean[0];
  for (const p of clean) {
    if (lowerIsBetter ? p.value < best.value : p.value > best.value) best = p;
  }

  const weeksSinceBest = Math.max(0, (now - best.t) / WEEK_MS);
  const recentBest = now - best.t <= recentWeeks * WEEK_MS && best.t >= first.t;

  // Raw direction from first→last, with a flat dead-band.
  const changePct = first.value !== 0 ? (last.value - first.value) / Math.abs(first.value) : null;
  let direction: TrendDirection;
  if (changePct === null || Math.abs(changePct) < flatBand) direction = 'flat';
  else direction = changePct > 0 ? 'rising' : 'falling';

  const improving =
    direction === 'flat' ? false : lowerIsBetter ? direction === 'falling' : direction === 'rising';

  // Plateau: best hasn't improved in plateauWeeks, and we have enough span.
  const spanWeeks = (last.t - first.t) / WEEK_MS;
  const plateaued = spanWeeks >= plateauWeeks && weeksSinceBest >= plateauWeeks;

  return {
    direction,
    improving,
    best: { value: best.value, t: best.t },
    recentBest,
    weeksSinceBest,
    plateaued,
    changePct,
    samples: clean.length,
  };
}
