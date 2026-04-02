// Tipos principales de la app

export interface User {
    id: string;
    email: string;
    name: string;
    level: 'beginner' | 'intermediate' | 'advanced';
    goal: 'strength' | 'hypertrophy' | 'endurance' | 'weight_loss';
    availableDays: number;
  }
  
  export interface Exercise {
    id: string;
    name: string;
    category: 'compound' | 'isolation' | 'bodyweight';
    muscleGroup: string;
  }
  
  export interface WorkoutSet {
    exercise: Exercise;
    weight: number;
    reps: number;
    rpe: number; // Rate of Perceived Exertion (1-10)
    notes?: string;
  }
  
  export interface Workout {
    id: string;
    userId: string;
    date: Date;
    sets: WorkoutSet[];
    duration: number; // minutos
    feedback?: string;
  }