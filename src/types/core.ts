// KAIROS — CORE TYPES v4 (content-node model)

// ======================== UTILITIES ========================

export type ISOTimestamp = string;

let _idCounter = 0;
export function generateId(): string {
  _idCounter += 1;
  return `${Date.now()}_${_idCounter}_${Math.random().toString(36).substring(2, 9)}`;
}

// ======================== FIELD SYSTEM ========================

export type FieldType = 'number' | 'text' | 'boolean' | 'rating' | 'time';

export type BaseFieldId =
  | 'weight'
  | 'reps'
  | 'rir'
  | 'distance'
  | 'duration'
  | 'pace'
  | 'heartRate'
  | 'calories'
  | 'perceivedEffort'
  | 'progression';

export interface FieldDefinition {
  id: string;
  name: string;
  type: FieldType;
  unit: string | null;
  isBase: boolean;
  isPrimary: boolean;
  order: number;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: FieldValue;
}

export type FieldValue = number | string | boolean | null;
export type FieldValues = Record<string, FieldValue>;

// ======================== DISCIPLINES ========================

export type Discipline =
  | 'strength'
  | 'running'
  | 'calisthenics'
  | 'mobility'
  | 'team_sport'
  | 'cycling'
  | 'swimming'
  | 'general';

export interface DisciplineConfig {
  id: Discipline;
  name: string;
  icon: string;
  color: string;
  defaultFields: FieldDefinition[];
}

function baseField(
  id: BaseFieldId,
  name: string,
  unit: string | null,
  opts?: Partial<FieldDefinition>
): FieldDefinition {
  return {
    id,
    name,
    type: 'number',
    unit,
    isBase: true,
    isPrimary: false,
    order: 0,
    ...opts,
  };
}

export const DISCIPLINE_CONFIGS: Record<Discipline, DisciplineConfig> = {
  strength: {
    id: 'strength',
    name: 'Strength',
    icon: 'weightlifting',
    color: '#E84545',
    defaultFields: [
      baseField('weight', 'Weight', 'kg', { isPrimary: true, order: 0, step: 2.5 }),
      baseField('reps', 'Reps', null, { order: 1, step: 1, min: 1 }),
      baseField('rir', 'RIR', null, { order: 2, min: 0, max: 5, step: 1 }),
    ],
  },
  running: {
    id: 'running',
    name: 'Running',
    icon: 'running',
    color: '#5B8DEF',
    defaultFields: [
      baseField('distance', 'Distance', 'km', { isPrimary: true, order: 0, step: 0.1 }),
      baseField('duration', 'Duration', 'min', { order: 1, step: 1 }),
      baseField('pace', 'Pace', 'min/km', { order: 2, step: 0.05 }),
      baseField('heartRate', 'Heart rate', 'bpm', { order: 3, step: 1 }),
    ],
  },
  calisthenics: {
    id: 'calisthenics',
    name: 'Calisthenics',
    icon: 'calisthenics',
    color: '#1DB88E',
    defaultFields: [
      baseField('reps', 'Reps', null, { isPrimary: true, order: 0, step: 1 }),
      baseField('duration', 'Hold time', 'sec', { order: 1, step: 5 }),
      baseField('progression', 'Progression', null, { order: 2, min: 1, max: 10 }),
    ],
  },
  mobility: {
    id: 'mobility',
    name: 'Mobility',
    icon: 'mobility',
    color: '#8B5CF6',
    defaultFields: [
      baseField('duration', 'Duration', 'min', { isPrimary: true, order: 0, step: 1 }),
      baseField('perceivedEffort', 'Feeling', '/10', { order: 1, min: 1, max: 10 }),
    ],
  },
  team_sport: {
    id: 'team_sport',
    name: 'Team sport',
    icon: 'team_sport',
    color: '#F0A030',
    defaultFields: [
      baseField('duration', 'Duration', 'min', { isPrimary: true, order: 0, step: 5 }),
      baseField('perceivedEffort', 'Intensity', '/10', { order: 1, min: 1, max: 10 }),
      baseField('calories', 'Calories', 'kcal', { order: 2, step: 10 }),
    ],
  },
  cycling: {
    id: 'cycling',
    name: 'Cycling',
    icon: 'cycling',
    color: '#06B6D4',
    defaultFields: [
      baseField('distance', 'Distance', 'km', { isPrimary: true, order: 0, step: 0.5 }),
      baseField('duration', 'Duration', 'min', { order: 1, step: 1 }),
      baseField('heartRate', 'Heart rate', 'bpm', { order: 2, step: 1 }),
    ],
  },
  swimming: {
    id: 'swimming',
    name: 'Swimming',
    icon: 'swimming',
    color: '#3B82F6',
    defaultFields: [
      baseField('distance', 'Distance', 'm', { isPrimary: true, order: 0, step: 25 }),
      baseField('duration', 'Duration', 'min', { order: 1, step: 1 }),
    ],
  },
  general: {
    id: 'general',
    name: 'General',
    icon: 'strength',
    color: '#C9A96E',
    defaultFields: [
      baseField('duration', 'Duration', 'min', { isPrimary: true, order: 0, step: 5 }),
      baseField('perceivedEffort', 'Effort', '/10', { order: 1, min: 1, max: 10 }),
    ],
  },
};

// ======================== SET ========================

export interface ExerciseSet {
  id: string;
  exercise_card_id: string;
  order: number;
  values: FieldValues;
  completed: boolean;
  completed_at: ISOTimestamp | null;
  notes: string | null;
}

export function createSetId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function createEmptySet(
  exerciseCardId: string,
  order: number,
  fields: FieldDefinition[]
): ExerciseSet {
  const values: FieldValues = {};
  for (const field of fields) {
    values[field.id] = field.defaultValue ?? null;
  }
  return {
    id: createSetId(),
    exercise_card_id: exerciseCardId,
    order,
    values,
    completed: false,
    completed_at: null,
    notes: null,
  };
}

// ======================== EXERCISE CARD ========================

export interface ExerciseCard {
  id: string;
  workout_block_id: string;
  order: number;
  name: string;
  icon: string;
  color: string;
  notes: string | null;
  discipline: Discipline;
  fields: FieldDefinition[];
  sets: ExerciseSet[];
  default_sets_count: number;
  rest_seconds: number;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

export function createExerciseCard(
  blockId: string,
  order: number,
  discipline: Discipline = 'strength',
  overrides?: Partial<Pick<ExerciseCard, 'name' | 'icon' | 'color'>> & { fields?: FieldDefinition[] }
): ExerciseCard {
  const config = DISCIPLINE_CONFIGS[discipline];
  const now = new Date().toISOString();
  const id = generateId();
  const fields: FieldDefinition[] = (overrides?.fields && overrides.fields.length > 0
    ? overrides.fields
    : config.defaultFields
  ).map((f: FieldDefinition, i: number): FieldDefinition => ({ ...f, order: i }));

  return {
    id,
    workout_block_id: blockId,
    order,
    name: overrides?.name ?? 'New exercise',
    icon: overrides?.icon ?? config.icon,
    color: overrides?.color ?? config.color,
    notes: null,
    discipline,
    fields,
    sets: Array.from({ length: 4 }, (_: unknown, i: number): ExerciseSet => createEmptySet(id, i, fields)),
    default_sets_count: 4,
    rest_seconds: discipline === 'strength' ? 90 : 60,
    created_at: now,
    updated_at: now,
  };
}

// ======================== WORKOUT BLOCK ========================

export type BlockStatus = 'draft' | 'in_progress' | 'completed' | 'partial';

export type BlockCover =
  | { type: 'color'; value: string }
  | { type: 'gradient'; from: string; to: string };

export interface BlockTag {
  id: string;
  name: string;
  color: string;
}

export interface WorkoutBlock {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  description: string | null;
  tags: BlockTag[];
  discipline: Discipline;
  content: import('./content').ContentNode[];
  layout: import('./content').BlockLayout;
  status: BlockStatus;
  is_favorite: boolean;
  is_archived: boolean;
  last_performed_at: ISOTimestamp | null;
  times_performed: number;
  sort_order: number;
  size: 'small' | 'medium' | 'large';
  cover: BlockCover | null;
  canvasData?: CanvasData;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

export function createWorkoutBlock(
  userId: string,
  sortOrder: number,
  discipline: Discipline = 'strength',
  overrides?: Partial<Pick<WorkoutBlock, 'name' | 'icon' | 'color' | 'description'>>
): WorkoutBlock {
  const config = DISCIPLINE_CONFIGS[discipline];
  const now = new Date().toISOString();

  return {
    id: generateId(),
    user_id: userId,
    name: overrides?.name ?? 'New block',
    icon: overrides?.icon ?? config.icon,
    color: overrides?.color ?? config.color,
    description: overrides?.description ?? null,
    tags: [],
    discipline,
    content: [],
    layout: { columns: 1 },
    status: 'draft',
    is_favorite: false,
    is_archived: false,
    last_performed_at: null,
    times_performed: 0,
    sort_order: sortOrder,
    size: 'medium',
    cover: null,
    created_at: now,
    updated_at: now,
  };
}

// ======================== CANVAS / WIDGETS ========================

export interface WidgetData {
  id: string;
  contentNodeId: string;
  position: { x: number; y: number };
  size: { w: number; h: number };
  zIndex: number;
  frozen: boolean;
  snapToGrid: boolean;
  linkedWidgetIds: string[];
}

export interface CanvasSettings {
  showGrid: boolean;
  gridSize: number;
  zoom: number;
}

export interface CanvasData {
  widgets: Record<string, WidgetData>;
  settings: CanvasSettings;
}

export function createWidget(
  contentNodeId: string,
  position: { x: number; y: number },
  size: { w: number; h: number } = { w: 280, h: 160 },
  zIndex: number = 0,
): WidgetData {
  return {
    id: generateId(),
    contentNodeId,
    position,
    size,
    zIndex,
    frozen: false,
    snapToGrid: false,
    linkedWidgetIds: [],
  };
}

export const DEFAULT_CANVAS_SETTINGS: CanvasSettings = {
  showGrid: true,
  gridSize: 24,
  zoom: 1,
};

export function getBlockExercises(block: WorkoutBlock): ExerciseCard[] {
  const result: ExerciseCard[] = [];
  for (const node of block.content) {
    if (node.type === 'exercise') {
      result.push(node.data.exercise);
    }
  }
  return result;
}

// ======================== HELPERS ========================

export function getBaseValue(set: ExerciseSet, fieldId: BaseFieldId): number | null {
  const val = set.values[fieldId];
  return typeof val === 'number' ? val : null;
}

export function isSetCompleted(set: ExerciseSet, fields: FieldDefinition[]): boolean {
  if (!set.completed) return false;
  const primaryFields: FieldDefinition[] = fields.filter(
    (f: FieldDefinition): boolean => f.type === 'number' && f.isPrimary
  );
  return primaryFields.every(
    (f: FieldDefinition): boolean => set.values[f.id] !== null
  );
}

export function calculateBlockStats(block: WorkoutBlock): {
  total_exercises: number;
  total_sets: number;
  completed_sets: number;
  total_volume: number;
  completion_percentage: number;
  estimated_duration: number;
} {
  const exercises: ExerciseCard[] = [];
  for (const node of block.content) {
    if (node.type === 'exercise') {
      exercises.push(node.data.exercise);
    }
  }
  const allSets: ExerciseSet[] = exercises.flatMap(
    (ex: ExerciseCard): ExerciseSet[] => ex.sets
  );
  const completedSets: ExerciseSet[] = allSets.filter(
    (s: ExerciseSet): boolean => s.completed
  );

  let totalVolume = 0;
  for (const ex of exercises) {
    const hasWeight: boolean = ex.fields.some((f: FieldDefinition): boolean => f.id === 'weight');
    const hasReps: boolean = ex.fields.some((f: FieldDefinition): boolean => f.id === 'reps');
    if (hasWeight && hasReps) {
      for (const set of ex.sets) {
        if (set.completed) {
          const w: number = typeof set.values['weight'] === 'number' ? (set.values['weight'] as number) : 0;
          const r: number = typeof set.values['reps'] === 'number' ? (set.values['reps'] as number) : 0;
          totalVolume += w * r;
        }
      }
    }
  }

  const totalRestTime: number = exercises.reduce(
    (acc: number, ex: ExerciseCard): number => {
      const n: number = ex.sets.length;
      return acc + (n > 0 ? (n - 1) * ex.rest_seconds : 0);
    },
    0
  );

  const estimatedDuration: number = Math.ceil((allSets.length * 45 + totalRestTime) / 60);

  return {
    total_exercises: exercises.length,
    total_sets: allSets.length,
    completed_sets: completedSets.length,
    total_volume: totalVolume,
    completion_percentage: allSets.length > 0
      ? Math.round((completedSets.length / allSets.length) * 100)
      : 0,
    estimated_duration: estimatedDuration,
  };
}

export function getPrimaryField(exercise: ExerciseCard): FieldDefinition | undefined {
  return exercise.fields.find((f: FieldDefinition): boolean => f.isPrimary);
}

export function getExerciseSummary(exercise: ExerciseCard): string {
  const primary: FieldDefinition | undefined = getPrimaryField(exercise);
  if (!primary) return `${exercise.sets.length} sets`;

  const completedSets: ExerciseSet[] = exercise.sets.filter(
    (s: ExerciseSet): boolean => s.completed
  );
  if (completedSets.length === 0) return `${exercise.sets.length} sets`;

  const lastCompleted: ExerciseSet = completedSets[completedSets.length - 1];
  const val: FieldValue = lastCompleted.values[primary.id];
  if (val === null || val === undefined) return `${completedSets.length}/${exercise.sets.length} sets`;

  const unit: string = primary.unit ? ` ${primary.unit}` : '';
  return `${exercise.sets.length} × ${String(val)}${unit}`;
}
