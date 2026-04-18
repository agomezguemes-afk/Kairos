import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import TrainingCard from '../../components/TrainingCard';
import AnimatedButton from '../../Buttons/AnimatedButton';
import KairosIcon from '../../components/KairosIcon';
import { useTraining } from '../../context/TrainingContext';
import {
  MuscleGroup,
  MUSCLE_GROUPS,
  DURATION_OPTIONS,
} from '../../types/training';
import {
  determineTrainingType,
  getTrainingName,
} from '../../utils/trainingLogic';

type SelectionMode = 'training' | 'rest' | 'none';

import DurationDisplay from '../../components/Slider/DurationDisplay';
// import DurationSlider from '../../components/Slider/DurationSlider';  // Comentado temporalmente para aislar el problema
import IntensityZones from '../../components/Slider/IntensityZones';

export default function WorkoutTab() {
  const [selectedMuscles, setSelectedMuscles] = useState<MuscleGroup[]>([]);
  const [selectedDuration, setSelectedDuration] = useState<number>(60);
  const [mode, setMode] = useState<SelectionMode>('none');
  
  const { registerDay, markRestDay } = useTraining();
  
  const { width } = Dimensions.get('window');

  // ========== CÁLCULO DE ANCHO PARA 3 COLUMNAS ==========
  
  const cardWidth = useMemo(() => {
    const containerPadding = 24 * 2;
    const totalGap = 12 * 2;
    const availableWidth = width - containerPadding - totalGap;
    return availableWidth / 3;
  }, [width]);

  // ========== HANDLERS ==========
  
  const toggleMuscle = useCallback((muscle: MuscleGroup) => {
    setSelectedMuscles(prev => {
      const isSelected = prev.includes(muscle);
      const updated = isSelected
        ? prev.filter(m => m !== muscle)
        : [...prev, muscle];
      
      setMode(updated.length > 0 ? 'training' : 'none');
      return updated;
    });
  }, []);

  const toggleRestDay = useCallback(() => {
    if (mode === 'rest') {
      setMode('none');
    } else {
      setSelectedMuscles([]);
      setMode('rest');
    }
  }, [mode]);

  const handleConfirm = useCallback(() => {
    if (mode === 'none') {
      Alert.alert('Selección requerida', 'Selecciona un entrenamiento o día de descanso');
      return;
    }

    if (mode === 'rest') {
      markRestDay();
      Alert.alert(
        'Día de descanso registrado',
        'Tu racha se mantiene activa',
        [{ text: 'OK', onPress: () => setMode('none') }]
      );
      return;
    }

    if (selectedMuscles.length === 0) {
      Alert.alert('Selección requerida', 'Selecciona al menos un grupo muscular');
      return;
    }

    try {
      const trainingType = determineTrainingType(selectedMuscles);
      const trainingName = getTrainingName(trainingType, selectedMuscles);

      registerDay({
        type: 'training',
        trainingData: {
          muscleGroups: selectedMuscles,
          trainingType,
          duration: selectedDuration,
        },
      });

      Alert.alert(
        'Entrenamiento registrado',
        `${trainingName} · ${selectedDuration} min`,
        [{
          text: 'OK',
          onPress: () => {
            setSelectedMuscles([]);
            setSelectedDuration(60);
            setMode('none');
          },
        }]
      );
    } catch (error) {
      Alert.alert('Error', 'Hubo un problema al registrar el entrenamiento');
      console.error('Registration error:', error);
    }
  }, [mode, selectedMuscles, selectedDuration, registerDay, markRestDay]);

  // ========== COMPUTED VALUES ==========
  
  const isConfirmEnabled = mode !== 'none';

  const summaryText = useMemo(() => {
    if (mode === 'rest') return 'Día de descanso';
    if (mode === 'training' && selectedMuscles.length > 0) {
      return getTrainingName(
        determineTrainingType(selectedMuscles),
        selectedMuscles
      );
    }
    return '';
  }, [mode, selectedMuscles]);

  // Dividir las opciones de duración en 2 filas
  const durationRows = useMemo(() => {
    const half = Math.ceil(DURATION_OPTIONS.length / 2);
    return {
      row1: DURATION_OPTIONS.slice(0, half),
      row2: DURATION_OPTIONS.slice(half),
    };
  }, []);

  // ========== RENDER ==========

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Text style={styles.title}>Entrenar</Text>
      <Text style={styles.subtitle}>
        Selecciona los grupos musculares trabajados hoy
      </Text>

      {/* Grid de 3 columnas - TrainingCard ORIGINALES */}
      <View style={styles.grid}>
        {MUSCLE_GROUPS.map((option, index) => (
          <View 
            key={option.id} 
            style={[
              styles.gridItem,
              { 
                width: cardWidth,
                marginRight: (index + 1) % 3 !== 0 ? 12 : 0,
                marginBottom: 12,
              }
            ]}
          >
            <TrainingCard
              option={option}
              selected={selectedMuscles.includes(option.id)}
              onPress={() => toggleMuscle(option.id)}
              disabled={mode === 'rest'}
            />
          </View>
        ))}
        
        {/* Botón "Día de descanso" */}
        <View 
          style={[
            styles.restDayContainer,
            { 
              width: cardWidth * 3 + 24,
              marginTop: 12,
            }
          ]}
        >
          <AnimatedButton
            title="Día de descanso"
            icon={<KairosIcon name="sleep" size={20} color="#C9A96E" />}
            onPress={toggleRestDay}
            disabled={mode === 'training'}
            selected={mode === 'rest'}
            variant="option"
            style={styles.restDayButton}
          />
        </View>
      </View>

      {/* Selector de duración - EN 2 FILAS */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Duración total ({selectedDuration} min)
        </Text>
        
        {/* Placeholder para el slider (comentado temporalmente) */}
        {/* <DurationSlider value={selectedDuration} onValueChange={setSelectedDuration} /> */}  // Comentado temporalmente
        <View style={{ padding: 20, backgroundColor: '#f0f0f0', borderRadius: 10, marginBottom: 16 }}>
          <Text style={{ color: '#333', textAlign: 'center' }}>Slider deshabilitado temporalmente para pruebas</Text>
        </View>
        
        {/* Primera fila de duraciones */}
        <View style={styles.durationRow}>
          {durationRows.row1.map(duration => (
            <AnimatedButton
              key={duration}
              title={`${duration}'`}
              onPress={() => setSelectedDuration(duration)}
              selected={selectedDuration === duration}
              variant="option"
              width="auto"
              style={styles.durationButton}
            />
          ))}
        </View>
        
        {/* Segunda fila de duraciones */}
        <View style={styles.durationRow}>
          {durationRows.row2.map(duration => (
            <AnimatedButton
              key={duration}
              title={`${duration}'`}
              onPress={() => setSelectedDuration(duration)}
              selected={selectedDuration === duration}
              variant="option"
              width="auto"
              style={styles.durationButton}
            />
          ))}
        </View>
      </View>

      {/* Resumen */}
      {mode !== 'none' && (
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Resumen</Text>
          <Text style={styles.summaryText}>{summaryText}</Text>
          {mode === 'training' && (
            <Text style={styles.summaryDuration}>
              {selectedDuration} minutos
            </Text>
          )}
        </View>
      )}

      {/* Botón confirmar */}
      <AnimatedButton
        title={mode === 'rest' ? 'Confirmar descanso' : 'Confirmar entrenamiento'}
        onPress={handleConfirm}
        disabled={!isConfirmEnabled}
        variant="primary"
        style={styles.confirmButton}
      />
    </ScrollView>
  );
}

// ========== ESTILOS ==========

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0d',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 32,
  },
  // Grid de 3 columnas
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 32,
  },
  gridItem: {
    // El ancho se calcula dinámicamente
  },
  // Día de descanso
  restDayContainer: {
    // El ancho se calcula dinámicamente
  },
  restDayButton: {
    paddingVertical: 20,
    paddingHorizontal: 24,
    width: '100%',
  },
  // Sección de duración
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  // Filas de duración
  durationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8, // Espacio entre filas
  },
  durationButton: {
    flex: 1,
    marginHorizontal: 4,
    minWidth: 60, // Ancho mínimo para que se vean bien
    maxWidth: 80, // Ancho máximo para que no se expandan demasiado
  },
  // Resumen
  summary: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  summaryDuration: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: '600',
  },
  // Botón confirmar
  confirmButton: {
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});