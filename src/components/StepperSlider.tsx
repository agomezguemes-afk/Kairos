import React, { useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';

interface StepperSliderProps {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

export default function StepperSlider({
  value,
  onValueChange,
  min = 0,
  max = 180,
  step = 10,
  unit = 'min',
}: StepperSliderProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleIncrement = () => {
    if (value < max) {
      onValueChange(value + step);
      animatePress();
    }
  };

  const handleDecrement = () => {
    if (value > min) {
      onValueChange(value - step);
      animatePress();
    }
  };

  const animatePress = () => {
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <View style={styles.container}>
      <Pressable
        onPress={handleDecrement}
        disabled={value <= min}
        style={[styles.button, value <= min && styles.buttonDisabled]}
      >
        <Text style={styles.buttonText}>−</Text>
      </Pressable>

      <Animated.View style={[styles.valueContainer, { transform: [{ scale: scaleAnim }] }]}>
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.unit}>{unit}</Text>
      </Animated.View>

      <Pressable
        onPress={handleIncrement}
        disabled={value >= max}
        style={[styles.button, value >= max && styles.buttonDisabled]}
      >
        <Text style={styles.buttonText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 12,
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.3,
    borderColor: '#27272a',
  },
  buttonText: {
    fontSize: 28,
    fontWeight: '300',
    color: '#fff',
  },
  valueContainer: {
    minWidth: 120,
    alignItems: 'center',
    backgroundColor: '#18181b',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  value: {
    fontSize: 40,
    fontWeight: '700',
    color: '#3b82f6',
    lineHeight: 44,
  },
  unit: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
});
