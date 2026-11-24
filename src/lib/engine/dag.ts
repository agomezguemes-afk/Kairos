// Physiological causal graph. Regression alone cannot tell a confounder
// from a collider: adjusting for soreness when testing rest intervals
// would bias the answer, because soreness is itself caused by the
// treatment. The graph encodes what physiology says causes what, and
// d-separation (Pearl 2009) decides which covariates are safe.

export type CausalVar =
  | 'treatment'
  | 'load'
  | 'fitness'
  | 'fatigue'
  | 'sleep'
  | 'stress'
  | 'soreness'
  | 'pain'
  | 'performance'
  | 'adherence';

export type Dag = Record<CausalVar, CausalVar[]>;

/** parent → children. */
export const PHYSIO_DAG: Dag = {
  // A protocol change (e.g. rest interval) alters the work done and the
  // performance of that same session.
  treatment: ['load', 'performance'],
  load: ['fitness', 'fatigue', 'soreness', 'pain'],
  fitness: ['performance'],
  fatigue: ['performance'],
  sleep: ['performance', 'soreness'],
  // Unmeasured: life stress disturbs sleep and performance alike.
  stress: ['sleep', 'performance', 'adherence'],
  soreness: ['performance', 'adherence'],
  pain: ['performance', 'adherence'],
  performance: ['adherence'],
  adherence: [],
};

/** What Kairos actually records. Fitness and fatigue are latent (Banister). */
export const OBSERVED: CausalVar[] = [
  'treatment',
  'load',
  'sleep',
  'soreness',
  'pain',
  'performance',
  'adherence',
];

const VARS = Object.keys(PHYSIO_DAG) as CausalVar[];

function parentsOf(dag: Dag, v: CausalVar): CausalVar[] {
  return VARS.filter((p) => dag[p].includes(v));
}

export function descendants(dag: Dag, v: CausalVar): Set<CausalVar> {
  const out = new Set<CausalVar>();
  const stack = [...dag[v]];
  while (stack.length) {
    const c = stack.pop()!;
    if (out.has(c)) continue;
    out.add(c);
    stack.push(...dag[c]);
  }
  return out;
}

function ancestorsOf(dag: Dag, vs: CausalVar[]): Set<CausalVar> {
  const out = new Set<CausalVar>(vs);
  const stack = [...vs];
  while (stack.length) {
    for (const p of parentsOf(dag, stack.pop()!)) {
      if (!out.has(p)) {
        out.add(p);
        stack.push(p);
      }
    }
  }
  return out;
}

/**
 * X ⟂ Y | Z in the DAG, via the moralised ancestral graph (Lauritzen 1990):
 * keep ancestors of X∪Y∪Z, marry co-parents, drop directions, delete Z,
 * and check whether X can still reach Y.
 */
export function dSeparated(
  dag: Dag,
  xs: CausalVar[],
  ys: CausalVar[],
  given: CausalVar[] = [],
): boolean {
  const keep = ancestorsOf(dag, [...xs, ...ys, ...given]);
  const adj = new Map<CausalVar, Set<CausalVar>>();
  const link = (a: CausalVar, b: CausalVar) => {
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  };
  for (const v of keep) {
    const ps = parentsOf(dag, v).filter((p) => keep.has(p));
    for (const p of ps) link(p, v);
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) link(ps[i], ps[j]);
  }
  const blocked = new Set(given);
  const seen = new Set<CausalVar>(xs);
  const stack = [...xs];
  while (stack.length) {
    const v = stack.pop()!;
    if (ys.includes(v)) return false;
    for (const n of adj.get(v) ?? []) {
      if (!seen.has(n) && !blocked.has(n)) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  return true;
}

/**
 * Covariates that may enter the analysis of a randomised treatment: never a
 * descendant of it (mediators and colliders bias the effect). The rest can
 * only add precision.
 */
export function safeCovariates(
  dag: Dag,
  treatment: CausalVar,
  candidates: CausalVar[],
): CausalVar[] {
  const down = descendants(dag, treatment);
  return candidates.filter((c) => c !== treatment && !down.has(c));
}

/**
 * Smallest observed back-door adjustment set for X → Y, or null when the
 * effect is not identifiable that way (an unobserved confounder is open).
 */
export function backdoorSet(
  dag: Dag,
  x: CausalVar,
  y: CausalVar,
  observed: CausalVar[] = OBSERVED,
): CausalVar[] | null {
  const down = descendants(dag, x);
  const pool = observed.filter((v) => v !== x && v !== y && !down.has(v));
  // Back-door paths are the ones left when X's outgoing edges are cut.
  const cut: Dag = { ...dag, [x]: [] };
  for (let size = 0; size <= pool.length; size++) {
    for (const set of combinations(pool, size)) {
      if (dSeparated(cut, [x], [y], set)) return set;
    }
  }
  return null;
}

function combinations<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]];
  const out: T[][] = [];
  items.forEach((item, i) => {
    for (const rest of combinations(items.slice(i + 1), k - 1)) out.push([item, ...rest]);
  });
  return out;
}
