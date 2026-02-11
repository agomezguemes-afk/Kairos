import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  useAnimatedReaction,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDER_WIDTH = SCREEN_WIDTH - 48;
const MIN_VALUE = 0;
const MAX_VALUE = 180;
const STEP = 10;
const THUMB_SIZE = 36;
const SLIDER_HEIGHT = 50;

interface DurationSliderProps {
  value: number;
  onValueChange: (value: number) => void;
}

export default function DurationSlider({ value, onValueChange }: DurationSliderProps) {
  // Valores animados
  const translateX = useSharedValue((value / MAX_VALUE) * SLIDER_WIDTH);
  const thumbScale = useSharedValue(1);
  const rippleScale = useSharedValue(0);
  const rippleOpacity = useSharedValue(0);
  const isSliding = useSharedValue(false);
  const savedTranslateX = useSharedValue(0);

  // Sincronizar con valor externo
  useAnimatedReaction(
    () => value,
    (newValue) => {
      if (!isSliding.value) {
        const newPosition = (newValue / MAX_VALUE) * SLIDER_WIDTH;
        translateX.value = withSpring(newPosition, {
          damping: 15,
          stiffness: 150,
        });
      }
    }
  );

  // Calcular valor basado en posición
  const calculateValueFromPosition = (position: number) => {
    'worklet';
    const percentage = position / SLIDER_WIDTH;
    const rawValue = percentage * MAX_VALUE;
    const snappedValue = Math.round(rawValue / STEP) * STEP;
    return Math.max(MIN_VALUE, Math.min(snappedValue, MAX_VALUE));
  };

  // Gesture - API CORRECTA
  const panGesture = Gesture.Pan()
    .onStart(() => {
      isSliding.value = true;
      savedTranslateX.value = translateX.value;
      thumbScale.value = withSpring(1.1, { damping: 10 });
    })
    .onUpdate((event) => {
      let newX = savedTranslateX.value + event.translationX;
      newX = Math.max(0, Math.min(newX, SLIDER_WIDTH));
      translateX.value = newX;
      
      const newValue = calculateValueFromPosition(newX);
      runOnJS(onValueChange)(newValue);
    })
    .onEnd(() => {
      const snappedValue = calculateValueFromPosition(translateX.value);
      const snappedPosition = (snappedValue / MAX_VALUE) * SLIDER_WIDTH;
      
      translateX.value = withSpring(snappedPosition, {
        damping: 15,
        stiffness: 150,
      });
      
      thumbScale.value = withSpring(1, { damping: 10 });
      isSliding.value = false;
      
      // Efecto de ondulación
      rippleScale.value = 1;
      rippleOpacity.value = 1;
      rippleScale.value = withTiming(2, { duration: 400 });
      rippleOpacity.value = withTiming(0, { duration: 400 });
    });

  // Estilos animados
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { scale: thumbScale.value },
    ],
  }));

  const rippleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rippleScale.value }],
    opacity: rippleOpacity.value,
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: translateX.value + THUMB_SIZE / 2,
  }));

  return (
    <View style={styles.container}>
      <View style={styles.sliderContainer}>
        {/* Track de fondo */}
        <View style={styles.track}>
          {/* Fill animado */}
          <Animated.View style={[styles.trackFill, fillStyle]} />
        </View>

        {/* Marcadores (cada 30 minutos) */}
        <View style={styles.markersContainer}>
          {[0, 30, 60, 90, 120, 150, 180].map((marker) => (
            <View
              key={marker}
              style={[
                styles.marker,
                { left: `${(marker / MAX_VALUE) * 100}%` },
              ]}
            >
              <View style={styles.markerDot} />
              {marker % 60 === 0 && (
                <View style={styles.markerLabel}>
                  <Text style={styles.markerText}>
                    {marker === 0 ? '0' : `${marker / 60}h`}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Gesture Detector */}
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.thumbContainer, thumbStyle]}>
            {/* Efecto de ondulación */}
            <Animated.View style={[styles.ripple, rippleStyle]} />
            
            {/* Thumb principal */}
            <View style={styles.thumb}>
              <View style={styles.thumbInner} />
            </View>
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: SLIDER_HEIGHT,
    justifyContent: 'center',
    marginVertical: 8,
  },
  sliderContainer: {
    height: THUMB_SIZE,
    justifyContent: 'center',
  },
  track: {
    height: 8,
    backgroundColor: '#27272a',
    borderRadius: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  trackFill: {
    position: 'absolute',
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  },
  markersContainer: {
    position: 'absolute',
    width: '100%',
    height: 30,
    top: -15,
  },
  marker: {
    position: 'absolute',
    alignItems: 'center',
  },
  markerDot: {
    width: 2,
    height: 6,
    backgroundColor: '#4b5563',
    borderRadius: 1,
  },
  markerLabel: {
    position: 'absolute',
    top: 10,
  },
  markerText: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '500',
  },
  thumbContainer: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    left: -THUMB_SIZE / 2,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 2,
  },
  thumbInner: {
    width: 12,
    height: 12,
    backgroundColor: '#fff',
    borderRadius: 3,
    opacity: 0.9,
  },
  ripple: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    zIndex: 1,
  },
});
