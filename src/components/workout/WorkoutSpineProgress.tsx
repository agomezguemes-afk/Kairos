// WorkoutSpineProgress — horizontal variant of the Spine, used as the
// central progress indicator during an ActiveWorkout. Same visual
// vocabulary as the editor's vertical spine (gold line + station
// nodes), rotated 90°. Completed exercises render as solid gold,
// current pulses, future remains hollow. Respects useReducedMotion.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { ExerciseCard } from '../../types/core';
import { Colors } from '../../theme/tokens';

const NODE_SIZE = 12;
const NODE_PULSE_SIZE = 18;
const RAIL_HEIGHT = 24;

type StationState = 'pending' | 'inProgress' | 'completed';

interface Props {
  exercises: ExerciseCard[];
  currentIndex: number;
}

function isExerciseComplete(ex: ExerciseCard): boolean {
  if (ex.sets.length === 0) return false;
  return ex.sets.every((s) => s.completed);
}

function exerciseState(ex: ExerciseCard, idx: number, currentIndex: number): StationState {
  if (isExerciseComplete(ex)) return 'completed';
  if (idx === currentIndex) return 'inProgress';
  return 'pending';
}

function PulsingNode() {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);

  React.useEffect(() => {
    if (reduceMotion) {
      pulse.value = 0.5;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.cubic) }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [pulse, reduceMotion]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + pulse.value * 0.32,
    transform: [{ scale: 0.92 + pulse.value * 0.18 }],
  }));

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.95 + pulse.value * 0.1 }],
  }));

  return (
    <View style={styles.pulseWrap}>
      <Animated.View style={[styles.pulseRing, ringStyle]} />
      <Animated.View style={[styles.pulseDot, dotStyle]} />
    </View>
  );
}

function WorkoutSpineProgressImpl({ exercises, currentIndex }: Props) {
  if (exercises.length === 0) return null;
  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel={`Ejercicio ${currentIndex + 1} de ${exercises.length}`}
    >
      <View style={styles.line} pointerEvents="none" />
      <View style={styles.nodes}>
        {exercises.map((ex, i) => {
          const state = exerciseState(ex, i, currentIndex);
          return (
            <View key={ex.id} style={styles.slot}>
              {state === 'inProgress' ? (
                <PulsingNode />
              ) : (
                <View
                  style={[
                    styles.node,
                    state === 'completed' ? styles.nodeCompleted : styles.nodePending,
                  ]}
                />
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const WorkoutSpineProgress = React.memo(WorkoutSpineProgressImpl);
export default WorkoutSpineProgress;

const styles = StyleSheet.create({
  container: {
    height: RAIL_HEIGHT,
    justifyContent: 'center',
    position: 'relative',
  },
  line: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: RAIL_HEIGHT / 2 - 1,
    height: 2,
    backgroundColor: Colors.hair.strong,
    borderRadius: 1,
  },
  nodes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  slot: {
    width: NODE_PULSE_SIZE,
    height: NODE_PULSE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  node: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    backgroundColor: Colors.bg.void,
  },
  nodePending: {
    borderWidth: 1.5,
    borderColor: Colors.hair.strong,
  },
  nodeCompleted: {
    backgroundColor: Colors.gold.base,
    borderWidth: 0,
  },
  pulseWrap: {
    width: NODE_PULSE_SIZE,
    height: NODE_PULSE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: NODE_PULSE_SIZE,
    height: NODE_PULSE_SIZE,
    borderRadius: NODE_PULSE_SIZE / 2,
    backgroundColor: Colors.gold.base,
  },
  pulseDot: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    backgroundColor: Colors.gold.base,
  },
});
