// Plate solver. Given bar weight + target + available plate sizes per side,
// returns a sorted list of plates loaded on ONE side of the bar
// (mirrored on the other side by convention).
//
// Algorithm: greedy descending. For each plate size from largest to smallest,
// add as many as possible without exceeding (target - bar) / 2. Leftover is
// returned as `shortBy` so the UI can warn ("falta 1.25 kg para llegar a 87.5").

export interface PlateInventory {
  /** Plate sizes available (kg). Will be sorted desc internally. */
  sizes: number[];
  /** Max count of each size the user has per side. If undefined, treated as ∞. */
  maxPerSide?: Partial<Record<number, number>>;
}

export const DEFAULT_KG_PLATES: PlateInventory = {
  sizes: [25, 20, 15, 10, 5, 2.5, 1.25, 0.5],
};

export const DEFAULT_LB_PLATES: PlateInventory = {
  sizes: [45, 35, 25, 10, 5, 2.5],
};

export interface PlateSolution {
  /** Plates loaded on one side, largest first. */
  plates: { size: number; count: number }[];
  /** Sum of plates on one side (kg). */
  perSideKg: number;
  /** Actual total weight loaded (bar + both sides). */
  totalKg: number;
  /** Difference target - total. 0 when exact, >0 when short, <0 when overshot. */
  shortBy: number;
  /** True if the request was unachievable as-is (target < bar OR cannot reach target). */
  warning: 'below-bar' | 'short' | 'odd-target' | null;
}

export function solvePlates(input: {
  /** Target total weight on the bar (kg). */
  target: number;
  /** Bar weight (kg). */
  bar: number;
  /** Available plate inventory. */
  inventory?: PlateInventory;
}): PlateSolution {
  const { target, bar, inventory = DEFAULT_KG_PLATES } = input;
  const empty: PlateSolution = {
    plates: [],
    perSideKg: 0,
    totalKg: bar,
    shortBy: target - bar,
    warning: null,
  };

  if (target < bar - 1e-6) {
    return { ...empty, warning: 'below-bar' };
  }
  // Plates load symmetrically on both sides — perSide must be (target - bar) / 2.
  const perSideTarget = (target - bar) / 2;
  if (perSideTarget < 1e-6) {
    return { ...empty, totalKg: bar, shortBy: 0, warning: null };
  }

  // Detect odd targets impossible to split (e.g., target - bar = 3 with no 1.5 plate).
  // We don't fail upfront — we attempt and report `shortBy` if greedy can't close.
  const sizes = [...inventory.sizes].sort((a, b) => b - a);
  const maxPerSide = inventory.maxPerSide ?? {};

  let remaining = perSideTarget;
  const loaded: { size: number; count: number }[] = [];

  for (const size of sizes) {
    if (size <= 1e-6) continue;
    const cap = maxPerSide[size];
    const maxByRemaining = Math.floor((remaining + 1e-6) / size);
    const take = cap == null ? maxByRemaining : Math.min(maxByRemaining, cap);
    if (take > 0) {
      loaded.push({ size, count: take });
      remaining -= take * size;
    }
  }

  const perSide = perSideTarget - remaining;
  const total = bar + perSide * 2;
  const short = target - total;

  let warning: PlateSolution['warning'] = null;
  if (short > 0.01) warning = 'odd-target'; // couldn't close
  // else null — exact.

  return {
    plates: loaded,
    perSideKg: round1(perSide),
    totalKg: round1(total),
    shortBy: round1(short),
    warning,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Display helpers. */
export function formatPlateList(plates: PlateSolution['plates']): string {
  if (plates.length === 0) return 'Sin discos';
  return plates.map((p) => `${p.count}×${stripZero(p.size)}`).join(' · ');
}

function stripZero(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(2).replace(/0$/, '').replace(/\.$/, '');
}
