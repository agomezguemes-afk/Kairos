// Station node — visual anchor on the spine for one row.
//
// Combines SHAPE + ICON + COLOR per WCAG (info never conveyed by color
// alone). Six variants:
//   pending     → hollow neutral ring
//   inProgress  → neutral ring + filled inner dot
//   completed   → solid gold + check icon (the only routine gold moment)
//   skipped     → hollow neutral + × icon
//   note        → diamond outline
//   divider     → short neutral bar across the rail
//   section     → solid neutral capsule (thicker than divider)
//
// Gold appears only on `completed`. Pending and structural stations stay
// neutral so the user's eye is drawn to what they've actually done.

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
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../../theme/tokens';
import type { StationKind, StationState } from '../lib/spineLayout';

export const STATION_SIZE = 14;

interface Props {
  kind: StationKind;
  state: StationState;
  /** Discipline colour for the completed node. Defaults to gold if a caller
   *  hasn't adopted the Ola-2 "gold = Kai only" rule yet. */
  accent?: string;
}

function ariaLabel(kind: StationKind, state: StationState): string {
  if (kind === 'divider') return 'Divisor';
  if (kind === 'section') return 'Sección';
  if (kind === 'note') return 'Nota';
  const head = kind === 'exercise' ? 'Ejercicio' : kind === 'superset' ? 'Superserie' : 'Elemento';
  switch (state) {
    case 'completed':
      return `${head}, completado`;
    case 'inProgress':
      return `${head}, en progreso`;
    case 'skipped':
      return `${head}, omitido`;
    default:
      return `${head}, pendiente`;
  }
}

function StationNodeImpl({ kind, state, accent }: Props) {
  if (kind === 'divider') {
    return <View style={styles.dividerBar} accessibilityLabel={ariaLabel(kind, state)} />;
  }

  if (kind === 'section') {
    return <View style={styles.sectionCap} accessibilityLabel={ariaLabel(kind, state)} />;
  }

  if (kind === 'note') {
    return (
      <View style={styles.diamondWrap} accessibilityLabel={ariaLabel(kind, state)}>
        <View style={styles.diamond} />
      </View>
    );
  }

  if (kind === 'superset') {
    return (
      <View style={styles.stackWrap} accessibilityLabel={ariaLabel(kind, state)}>
        <View style={[styles.circleBase, styles.circlePending, styles.stackBack]} />
        <View style={[styles.circleBase, styles.circlePending, styles.stackFront]} />
      </View>
    );
  }

  // exercise / tool — circle with state variants
  if (state === 'completed') {
    return (
      <View
        style={[
          styles.circleBase,
          styles.circleCompleted,
          accent ? { backgroundColor: accent, shadowColor: accent } : null,
        ]}
        accessibilityLabel={ariaLabel(kind, state)}
      >
        <Feather name="check" size={9} color={Colors.ink.inverse} />
      </View>
    );
  }

  if (state === 'skipped') {
    return (
      <View
        style={[styles.circleBase, styles.circleSkipped]}
        accessibilityLabel={ariaLabel(kind, state)}
      >
        <Feather name="x" size={9} color={Colors.ink.muted} />
      </View>
    );
  }

  if (state === 'inProgress') {
    return <InProgressNode label={ariaLabel(kind, state)} />;
  }

  return (
    <View
      style={[styles.circleBase, styles.circlePending]}
      accessibilityLabel={ariaLabel(kind, state)}
    />
  );
}

/**
 * Active station — slightly larger than peers, ink.primary border + dot,
 * dot breathes via a subtle pulse. Reduced-motion users get the steady
 * state. Stays on the neutral palette: gold is reserved for completion.
 */
function InProgressNode({ label }: { label: string }) {
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

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.9 + pulse.value * 0.25 }],
    opacity: 0.7 + pulse.value * 0.3,
  }));

  return (
    <View style={styles.inProgressWrap} accessibilityLabel={label}>
      <View style={styles.circleInProgressActive}>
        <Animated.View style={[styles.innerDotActive, dotStyle]} />
      </View>
    </View>
  );
}

const StationNode = React.memo(StationNodeImpl);
export default StationNode;

const styles = StyleSheet.create({
  circleBase: {
    width: STATION_SIZE,
    height: STATION_SIZE,
    borderRadius: STATION_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg.void,
  },
  circlePending: {
    borderWidth: 1.5,
    borderColor: Colors.hair.strong,
  },
  circleInProgress: {
    borderWidth: 1.5,
    borderColor: Colors.ink.secondary,
  },
  inProgressWrap: {
    width: STATION_SIZE + 4,
    height: STATION_SIZE + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleInProgressActive: {
    width: STATION_SIZE + 2,
    height: STATION_SIZE + 2,
    borderRadius: (STATION_SIZE + 2) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg.void,
    borderWidth: 2,
    borderColor: Colors.ink.primary,
  },
  innerDotActive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.ink.primary,
  },
  circleCompleted: {
    backgroundColor: Colors.gold.base,
    // Tiny shadow so the only chromatic moment on the rail also reads
    // as the only deeper-than-flat element. Cheap polish, big payoff.
    shadowColor: Colors.gold.deep,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 2,
  },
  circleSkipped: {
    borderWidth: 1.5,
    borderColor: Colors.hair.strong,
  },
  innerDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.ink.secondary,
  },
  diamondWrap: {
    width: STATION_SIZE,
    height: STATION_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diamond: {
    width: STATION_SIZE - 4,
    height: STATION_SIZE - 4,
    borderWidth: 1.5,
    borderColor: Colors.hair.strong,
    backgroundColor: Colors.bg.void,
    transform: [{ rotate: '45deg' }],
  },
  dividerBar: {
    width: STATION_SIZE + 6,
    height: 2,
    backgroundColor: Colors.hair.strong,
    borderRadius: 1,
  },
  sectionCap: {
    width: STATION_SIZE,
    height: 4,
    backgroundColor: Colors.ink.secondary,
    borderRadius: 2,
  },
  stackWrap: {
    width: STATION_SIZE + 4,
    height: STATION_SIZE + 4,
    position: 'relative',
  },
  stackBack: {
    position: 'absolute',
    top: 0,
    left: 4,
    backgroundColor: Colors.bg.surface,
  },
  stackFront: {
    position: 'absolute',
    top: 4,
    left: 0,
  },
});
