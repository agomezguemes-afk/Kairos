import { DayEntry, StreakData, normalizeDate, isSameDay } from '../types/progress';

/**
 * Calcula la racha actual basándose en continuidad diaria
 * 
 * REGLAS:
 * - Racha aumenta si hay actividad (training o rest) el día anterior
 * - Racha se reinicia si hay un día sin registro
 * - Solo cuenta días hasta hoy (no futuros)
 */
export function calculateStreak(entries: DayEntry[]): StreakData {
  if (entries.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: null,
    };
  }

  // Ordenar por fecha descendente (más reciente primero)
  const sortedEntries = [...entries]
    .filter(e => e.type !== 'empty') // Ignorar días vacíos
    .sort((a, b) => b.timestamp - a.timestamp);

  if (sortedEntries.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: null,
    };
  }

  const today = normalizeDate(new Date());
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  // Verificar si la última actividad fue ayer o hoy
  const lastEntry = sortedEntries[0];
  const lastDate = normalizeDate(lastEntry.date);
  const daysDiff = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff > 1) {
    // Última actividad hace más de 1 día → racha reiniciada
    currentStreak = 0;
  } else {
    // Calcular racha hacia atrás desde hoy/ayer
    let expectedDate = new Date(today);
    if (daysDiff === 1) {
      expectedDate.setDate(expectedDate.getDate() - 1);
    }

    for (const entry of sortedEntries) {
      const entryDate = normalizeDate(entry.date);
      
      if (isSameDay(entryDate, expectedDate)) {
        currentStreak++;
        tempStreak++;
        expectedDate.setDate(expectedDate.getDate() - 1);
      } else if (entryDate < expectedDate) {
        // Hubo un día sin registro → racha rota
        break;
      }
    }
  }

  // Calcular racha más larga histórica
  tempStreak = 0;
  let prevDate: Date | null = null;

  for (const entry of sortedEntries) {
    const entryDate = normalizeDate(entry.date);
    
    if (!prevDate) {
      tempStreak = 1;
    } else {
      const diff = Math.floor((prevDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diff === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    
    prevDate = entryDate;
  }
  
  longestStreak = Math.max(longestStreak, tempStreak, currentStreak);

  return {
    currentStreak,
    longestStreak,
    lastActivityDate: lastEntry.date,
  };
}

/**
 * Verifica si dos fechas son consecutivas
 */
export function isConsecutiveDay(prevDate: Date, currentDate: Date): boolean {
  const prev = normalizeDate(prevDate);
  const curr = normalizeDate(currentDate);
  const diff = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
  return diff === 1;
}

/**
 * Obtiene el rango de la semana actual (Lun-Dom)
 */
export function getCurrentWeek(): { startDate: Date; endDate: Date } {
  const today = normalizeDate(new Date());
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  
  // Ajustar al lunes de esta semana
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  monday.setDate(today.getDate() - daysToMonday);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  return { startDate: monday, endDate: sunday };
}

/**
 * Obtiene el número de semana del año
 */
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
