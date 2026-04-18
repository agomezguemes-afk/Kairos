// KAIROS — Mission Types
// Weekly AI-generated missions that guide user progress.

export type ISOTimestamp = string;

// ======================== MISSION STATUS ========================

export type MissionStatus = 'active' | 'completed' | 'skipped' | 'expired';

// ======================== MISSION CATEGORY ========================

export type MissionCategory =
  | 'volume'       // complete X blocks/sets
  | 'pr'           // beat a personal record
  | 'streak'       // maintain streak
  | 'exploration'  // try new exercises/disciplines
  | 'consistency'; // train X days

// ======================== MISSION ========================

export interface Mission {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: MissionCategory;
  status: MissionStatus;

  // Progress tracking
  targetValue: number;
  currentValue: number;

  // Timing
  createdAt: ISOTimestamp;
  completedAt: ISOTimestamp | null;
  expiresAt: ISOTimestamp; // end of the week

  // Week identifier (ISO week, e.g. "2026-W15")
  weekId: string;
}

// ======================== MISSION TEMPLATE ========================

export interface MissionTemplate {
  category: MissionCategory;
  icon: string;
  titleFn: (target: number) => string;
  descriptionFn: (target: number) => string;
  targetRange: [number, number]; // [min, max]
  /** Check function key — used by missionService to evaluate progress */
  checkKey: string;
}

// ======================== COMPLETED MISSION RECORD ========================

export interface CompletedMission {
  id: string;
  title: string;
  icon: string;
  category: MissionCategory;
  completedAt: ISOTimestamp;
  weekId: string;
}
