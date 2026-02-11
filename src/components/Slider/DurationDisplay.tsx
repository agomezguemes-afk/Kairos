import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

const INTENSITY_ZONES = [
  { 
    label: 'Recuperación', 
    emoji: '🌱', 
    color: '#10b981',
    description: 'Activación suave',
    min: 0, 
    max: 30,
  },
  { 
    label: 'Estándar', 
    emoji: '💪', 
    color: '#3b82f6',
    description: 'Entreno balanceado',
    min: 30, 
    max: 60,
  },
  { 
    label: 'Intenso', 
    emoji: '🔥', 
    color: '#f59e0b',
    description: 'Alta intensidad',
    min: 60, 
    max: 90,
  },
  { 
    label: 'Extremo', 
    emoji: '🚀', 
    color: '#ef4444',
    description: 'Desafío máximo',
    min: 90, 
    max: 120,
  },
  { 
    label: 'Maratón', 
    emoji: '🏃‍♂️', 
    color: '#8b5cf6',
    description: 'Resistencia pura',
    min: 120, 
    max: 180,
  },
];

interface DurationDisplayProps {
  minutes: number;
}

const AnimatedView = Animated.createAnimatedComponent(View);
const AnimatedText = Animated.createAnimatedComponent(Text);

export default function DurationDisplay({ minutes }: DurationDisplayProps) {
  // Animaciones
  const scale = useSharedValue(1);
  const emojiScale = useSharedValue(1);
  const textOpacity = useSharedValue(1);
  const borderWidth = useSharedValue(2);
  
  // Encontrar zona actual
  const currentZone = INTENSITY_ZONES.find(z => minutes >= z.min && minutes < z.max) 
    || INTENSITY_ZONES[INTENSITY_ZONES.length - 1];

  // Efecto "pop" al cambiar de minutos (especialmente al cambiar zona)
  useEffect(() => {
    const lastZone = INTENSITY_ZONES.find(z => (minutes - 1) >= z.min && (minutes - 1) < z.max);
    
    if (!lastZone || lastZone.label !== currentZone.label) {
      // Efecto de cambio de zona
      scale.value = withSequence(
        withSpring(1.08, { damping: 8 }),
        withSpring(1, { damping: 10 })
      );
      
      emojiScale.value = withSequence(
        withTiming(1.3, { duration: 100 }),
        withSpring(1, { damping: 8 })
      );
      
      borderWidth.value = withSequence(
        withTiming(4, { duration: 100 }),
        withTiming(2, { duration: 200 })
      );
    } else {
      // Efecto sutil al cambiar dentro de la misma zona
      scale.value = withSequence(
        withTiming(1.02, { duration: 50 }),
        withSpring(1, { damping: 15 })
      );
    }
    
    // Efecto de parpadeo del texto
    textOpacity.value = withSequence(
      withTiming(0.7, { duration: 50 }),
      withTiming(1, { duration: 100 })
    );
  }, [minutes]);

  const formatTime = (min: number) => {
    if (min < 60) return `${min} min`;
    const hours = Math.floor(min / 60);
    const mins = min % 60;
    return mins === 0 ? `${hours}h` : `${hours}h ${mins}min`;
  };

  // Estilos animados
  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    borderWidth: borderWidth.value,
    borderColor: currentZone.color,
  }));

  const emojiStyle = useAnimatedStyle(() => ({
    transform: [{ scale: emojiScale.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  return (
    <AnimatedView style={[styles.container, containerStyle]}>
      <AnimatedText style={[styles.emoji, emojiStyle]}>
        {currentZone.emoji}
      </AnimatedText>
      
      <View style={styles.textContainer}>
        <AnimatedText style={[styles.time, textStyle]}>
          {formatTime(minutes)}
        </AnimatedText>
        <View style={styles.labelContainer}>
          <AnimatedText 
            style={[styles.label, { color: currentZone.color }, textStyle]}
          >
            · {currentZone.label}
          </AnimatedText>
          <AnimatedText style={[styles.description, textStyle]}>
            {currentZone.description}
          </AnimatedText>
        </View>
      </View>
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  emoji: {
    fontSize: 32,
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  time: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  label: {
    fontSize: 18,
    fontWeight: '700',
    marginRight: 8,
  },
  description: {
    color: '#d1d5db',
    fontSize: 14,
    fontWeight: '500',
  },
});