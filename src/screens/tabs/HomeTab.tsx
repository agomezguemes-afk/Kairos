import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
} from 'react-native';
import { useTraining } from '../../context/TrainingContext';
import { getTrainingName } from '../../utils/trainingLogic';
import { DayEntry } from '../../types/progress';

export default function HomeTab() {
  const { stats, streak, currentWeek } = useTraining();

  // ========== COMPUTED VALUES ==========

  const greetingText = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return '☀️ Buenos días';
    if (hour < 18) return '🌤️ Buenas tardes';
    return '🌙 Buenas noches';
  }, []);

  const weekProgress = useMemo(() => {
    const total = 7;
    const completed = currentWeek.totalTrainings;
    const percentage = Math.round((completed / total) * 100);
    return { completed, total, percentage };
  }, [currentWeek]);

  // ========== RENDER ==========

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.greeting}>{greetingText}</Text>
      <Text style={styles.title}>Dashboard</Text>

      {/* Tarjeta de racha */}
      <StreakCard streak={streak} />

      {/* Estadísticas generales */}
      <StatsCard stats={stats} weekProgress={weekProgress} />

      {/* Vista semanal */}
      <WeeklyView currentWeek={currentWeek} />

      {/* Último entrenamiento */}
      {stats.lastSession && (
        <LastSessionCard session={stats.lastSession} />
      )}
    </ScrollView>
  );
}

// ========== SUB-COMPONENTES ==========

interface StreakCardProps {
  streak: {
    currentStreak: number;
    longestStreak: number;
    lastActivityDate: Date | null;
  };
}

const StreakCard = React.memo(({ streak }: StreakCardProps) => {
  const streakEmoji = useMemo(() => {
    if (streak.currentStreak === 0) return '💤';
    if (streak.currentStreak < 7) return '🔥';
    if (streak.currentStreak < 30) return '🔥🔥';
    return '🔥🔥🔥';
  }, [streak.currentStreak]);

  const streakMessage = useMemo(() => {
    if (streak.currentStreak === 0) {
      return 'Comienza tu racha hoy';
    }
    if (streak.currentStreak === 1) {
      return '¡Primer día! Sigue así';
    }
    if (streak.currentStreak < 7) {
      return '¡Buen ritmo! Sigue avanzando';
    }
    if (streak.currentStreak < 30) {
      return '¡Increíble constancia!';
    }
    return '¡Eres imparable! 💪';
  }, [streak.currentStreak]);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.streakEmoji}>{streakEmoji}</Text>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardTitle}>
            Racha: {streak.currentStreak} {streak.currentStreak === 1 ? 'día' : 'días'}
          </Text>
          <Text style={styles.cardSubtitle}>{streakMessage}</Text>
        </View>
      </View>
      
      {streak.longestStreak > streak.currentStreak && (
        <View style={styles.streakMetaContainer}>
          <Text style={styles.streakMeta}>
            🏆 Récord personal: {streak.longestStreak} días
          </Text>
        </View>
      )}
    </View>
  );
});

interface StatsCardProps {
  stats: {
    totalSessions: number;
    totalMinutes: number;
  };
  weekProgress: {
    completed: number;
    total: number;
    percentage: number;
  };
}

const StatsCard = React.memo(({ stats, weekProgress }: StatsCardProps) => {
  const hours = Math.floor(stats.totalMinutes / 60);
  const minutes = stats.totalMinutes % 60;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Estadísticas generales</Text>
      
      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.totalSessions}</Text>
          <Text style={styles.statLabel}>Entrenamientos</Text>
        </View>
        
        <View style={styles.statDivider} />
        
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`}
          </Text>
          <Text style={styles.statLabel}>Tiempo total</Text>
        </View>
        
        <View style={styles.statDivider} />
        
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{weekProgress.completed}/{weekProgress.total}</Text>
          <Text style={styles.statLabel}>Esta semana</Text>
        </View>
      </View>
    </View>
  );
});

interface WeeklyViewProps {
  currentWeek: {
    days: DayEntry[];
    totalTrainings: number;
    totalMinutes: number;
  };
}

const WeeklyView = React.memo(({ currentWeek }: WeeklyViewProps) => {
  const renderDayItem = ({ item, index }: { item: DayEntry; index: number }) => (
    <DayItem day={item} dayIndex={index} />
  );

  const keyExtractor = (item: DayEntry, index: number) => `day-${index}`;

  return (
    <View style={styles.weeklySection}>
      <View style={styles.weeklyHeader}>
        <Text style={styles.cardTitle}>Esta semana</Text>
        <Text style={styles.weeklyStats}>
          {currentWeek.totalTrainings} {currentWeek.totalTrainings === 1 ? 'entreno' : 'entrenos'} · {currentWeek.totalMinutes} min
        </Text>
      </View>
      
      <FlatList
        data={currentWeek.days}
        renderItem={renderDayItem}
        keyExtractor={keyExtractor}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View style={styles.daySeparator} />}
        style={styles.weeklyList}
      />
    </View>
  );
});

interface DayItemProps {
  day: DayEntry;
  dayIndex: number;
}

const DayItem = React.memo(({ day, dayIndex }: DayItemProps) => {
  const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const dayName = dayNames[dayIndex];
  
  const { date } = day;
  const dayNumber = date.getDate();
  const month = date.getMonth() + 1;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayDate = new Date(date);
  dayDate.setHours(0, 0, 0, 0);
  
  const isToday = dayDate.getTime() === today.getTime();
  const isFuture = dayDate.getTime() > today.getTime();

  // Indicador visual
  const indicator = useMemo(() => {
    if (day.type === 'training') return '🔵';
    if (day.type === 'rest') return '⚪';
    return '◻️';
  }, [day.type]);

  // Texto descriptivo
  const description = useMemo(() => {
    if (isFuture) return '—';
    
    if (day.type === 'training' && day.trainingData) {
      const name = getTrainingName(
        day.trainingData.trainingType,
        day.trainingData.muscleGroups
      );
      return `${name} · ${day.trainingData.duration} min`;
    }
    
    if (day.type === 'rest') return 'Descanso';
    
    return '—';
  }, [day, isFuture]);

  const textColor = useMemo(() => {
    if (isFuture) return '#64748b';
    if (day.type === 'empty') return '#94a3b8';
    return '#fff';
  }, [day.type, isFuture]);

  return (
    <View style={[styles.dayItem, isToday && styles.dayItemToday]}>
      <View style={styles.dayLeft}>
        <Text style={styles.dayIndicator}>{indicator}</Text>
        <View style={styles.dayDateContainer}>
          <Text style={[styles.dayName, isToday && styles.dayNameToday]}>
            {dayName}
          </Text>
          <Text style={styles.dayDate}>
            {dayNumber}/{month}
          </Text>
        </View>
      </View>
      
      <Text style={[styles.dayDescription, { color: textColor }]} numberOfLines={1}>
        {description}
      </Text>
    </View>
  );
});

interface LastSessionCardProps {
  session: {
    date: Date;
    muscleGroups: import('../../types/training').MuscleGroup[];
    trainingType: import('../../types/training').TrainingType;
    duration: number;
  };
}

const LastSessionCard = React.memo(({ session }: LastSessionCardProps) => {
  const formatDate = (date: Date) => {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return `${days[date.getDay()]}, ${date.getDate()}/${date.getMonth() + 1}`;
  };

  const trainingName = getTrainingName(session.trainingType, session.muscleGroups);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>💪 Último entrenamiento</Text>
      <Text style={styles.lastTrainingName}>{trainingName}</Text>
      <Text style={styles.cardSubtitle}>
        {formatDate(session.date)} · {session.duration} min
      </Text>
    </View>
  );
});

// ========== ESTILOS ==========

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F5',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  greeting: {
    fontSize: 16,
    color: '#9E9E9E',
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 24,
  },

  // Card base
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeaderText: {
    flex: 1,
    marginLeft: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#6B6B6B',
    lineHeight: 20,
  },

  // Streak card
  streakEmoji: {
    fontSize: 40,
  },
  streakMetaContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  streakMeta: {
    fontSize: 14,
    color: '#9E9E9E',
  },

  // Stats card
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#C9A96E',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#9E9E9E',
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },

  // Weekly view
  weeklySection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  weeklyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  weeklyStats: {
    fontSize: 14,
    color: '#9E9E9E',
  },
  weeklyList: {
    marginTop: 8,
  },

  // Day item
  dayItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  dayItemToday: {
    backgroundColor: 'rgba(201, 169, 110, 0.08)',
    paddingHorizontal: 12,
    marginHorizontal: -12,
    borderRadius: 8,
  },
  dayLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dayIndicator: {
    fontSize: 16,
    marginRight: 12,
  },
  dayDateContainer: {
    marginRight: 16,
  },
  dayName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  dayNameToday: {
    color: '#C9A96E',
  },
  dayDate: {
    fontSize: 12,
    color: '#9E9E9E',
  },
  dayDescription: {
    fontSize: 14,
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  daySeparator: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginVertical: 4,
  },

  // Last session
  lastTrainingName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#C9A96E',
    marginTop: 8,
    marginBottom: 8,
  },
});
