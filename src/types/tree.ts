// KAIROS — Progress Tree Types

export type TreeType = 'oak' | 'palm' | 'bamboo' | 'cactus';

export interface TreeTypeConfig {
  id: TreeType;
  name: string;
  emoji: string;
  symbol: string;
  metricLabel: string;
  metricUnit: string;
  /** Cumulative thresholds for each level (1-5). */
  thresholds: [number, number, number, number, number];
}

export const TREE_CONFIGS: Record<TreeType, TreeTypeConfig> = {
  oak: {
    id: 'oak',
    name: 'Roble',
    emoji: '🌳',
    symbol: 'Fuerza',
    metricLabel: 'Volumen total',
    metricUnit: 'kg',
    thresholds: [1_000, 5_000, 15_000, 40_000, 100_000],
  },
  palm: {
    id: 'palm',
    name: 'Palmera',
    emoji: '🌴',
    symbol: 'Resistencia',
    metricLabel: 'Distancia total',
    metricUnit: 'km',
    thresholds: [10, 50, 150, 400, 1_000],
  },
  bamboo: {
    id: 'bamboo',
    name: 'Bambú',
    emoji: '🎋',
    symbol: 'Constancia',
    metricLabel: 'Días activos',
    metricUnit: 'días',
    thresholds: [7, 30, 90, 180, 365],
  },
  cactus: {
    id: 'cactus',
    name: 'Cactus',
    emoji: '🌵',
    symbol: 'Superación',
    metricLabel: 'Récords personales',
    metricUnit: 'PRs',
    thresholds: [3, 10, 25, 50, 100],
  },
};

/** Level 0 = seed, levels 1-5 = growth stages. */
export interface TreeProgress {
  treeType: TreeType;
  level: number; // 0-5
  currentValue: number;
  nextThreshold: number | null; // null if max level
  percentToNext: number; // 0-100
}

export interface TreeMetrics {
  totalVolume: number;      // kg * reps
  totalDistance: number;     // km
  totalActiveDays: number;  // unique days with activity
  totalPRs: number;         // PR cards count
  /** Set of YYYY-MM-DD strings for active days. */
  activeDaySet: string[];
}

export function createEmptyMetrics(): TreeMetrics {
  return {
    totalVolume: 0,
    totalDistance: 0,
    totalActiveDays: 0,
    totalPRs: 0,
    activeDaySet: [],
  };
}
