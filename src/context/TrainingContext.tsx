import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { TrainingSession, TrainingStats } from '../types/training';
import { DayEntry, DayEntryType, WeeklyLog, StreakData, normalizeDate, isSameDay } from '../types/progress';
import { calculateStreak, getCurrentWeek, getWeekNumber } from '../utils/streakLogic';

interface EnhancedTrainingContextType {
  // Estado existente
  stats: TrainingStats;
  sessions: TrainingSession[];
  
  // Nuevo estado temporal
  streak: StreakData;
  currentWeek: WeeklyLog;
  dayEntries: DayEntry[];
  
  // Acciones existentes
  addSession: (session: TrainingSession) => void;
  
  // Nuevas acciones
  registerDay: (entry: Omit<DayEntry, 'date' | 'timestamp'>) => void;
  markRestDay: () => void;
}

const TrainingContext = createContext<EnhancedTrainingContextType | undefined>(undefined);

export function TrainingProvider({ children }: { children: ReactNode }) {
  const [dayEntries, setDayEntries] = useState<DayEntry[]>([]);

  // Calcular racha (memoizado para performance)
  const streak = useMemo(() => calculateStreak(dayEntries), [dayEntries]);

  // Calcular log semanal actual
  const currentWeek = useMemo((): WeeklyLog => {
    const { startDate, endDate } = getCurrentWeek();
    const weekNumber = getWeekNumber(startDate);
    
    const days: DayEntry[] = [];
    let totalTrainings = 0;
    let totalMinutes = 0;

    // Generar 7 días (Lun-Dom)
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const normalizedDate = normalizeDate(date);

      // Buscar entrada para este día
      const existingEntry = dayEntries.find(entry => 
        isSameDay(normalizeDate(entry.date), normalizedDate)
      );

      if (existingEntry) {
        days.push(existingEntry);
        if (existingEntry.type === 'training' && existingEntry.trainingData) {
          totalTrainings++;
          totalMinutes += existingEntry.trainingData.duration;
        }
      } else {
        // Día vacío
        days.push({
          date: normalizedDate,
          type: 'empty',
          timestamp: normalizedDate.getTime(),
        });
      }
    }

    return {
      weekNumber,
      startDate,
      days,
      totalTrainings,
      totalMinutes,
    };
  }, [dayEntries]);

  // Stats compatibles con código existente
  const sessions: TrainingSession[] = useMemo(() => {
    return dayEntries
      .filter((entry): entry is DayEntry & { trainingData: NonNullable<DayEntry['trainingData']> } => 
        entry.type === 'training' && !!entry.trainingData
      )
      .map(entry => ({
        id: `session_${entry.timestamp}`,
        date: entry.date,
        muscleGroups: entry.trainingData.muscleGroups,
        trainingType: entry.trainingData.trainingType,
        duration: entry.trainingData.duration,
        timestamp: entry.timestamp,
      }));
  }, [dayEntries]);

  const stats: TrainingStats = useMemo(() => ({
    totalSessions: sessions.length,
    currentStreak: streak.currentStreak,
    totalMinutes: sessions.reduce((acc, s) => acc + s.duration, 0),
    lastSession: sessions[sessions.length - 1],
  }), [sessions, streak]);

  // Acciones
  const addSession = (session: TrainingSession) => {
    registerDay({
      type: 'training',
      trainingData: {
        muscleGroups: session.muscleGroups,
        trainingType: session.trainingType,
        duration: session.duration,
      },
    });
  };

  const registerDay = (entry: Omit<DayEntry, 'date' | 'timestamp'>) => {
    const today = normalizeDate(new Date());
    const timestamp = Date.now();

    // Verificar si ya existe entrada para hoy
    const existingIndex = dayEntries.findIndex(e => 
      isSameDay(normalizeDate(e.date), today)
    );

    const newEntry: DayEntry = {
      ...entry,
      date: today,
      timestamp,
    };

    setDayEntries(prev => {
      if (existingIndex >= 0) {
        // Reemplazar entrada existente
        const updated = [...prev];
        updated[existingIndex] = newEntry;
        return updated;
      } else {
        // Añadir nueva entrada
        return [...prev, newEntry];
      }
    });
    
    // TODO(PERSISTENCE): Persistir en AsyncStorage
    // TODO(ANALYTICS): Enviar evento a analytics
  };

  const markRestDay = () => {
    registerDay({ type: 'rest' });
  };

  return (
    <TrainingContext.Provider
      value={{
        stats,
        sessions,
        streak,
        currentWeek,
        dayEntries,
        addSession,
        registerDay,
        markRestDay,
      }}
    >
      {children}
    </TrainingContext.Provider>
  );
}

export function useTraining() {
  const context = useContext(TrainingContext);
  if (!context) {
    throw new Error('useTraining must be used within TrainingProvider');
  }
  return context;
}
