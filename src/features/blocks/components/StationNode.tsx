// Station node — visual anchor on the spine for one row.
//
// Combines SHAPE + ICON + COLOR per WCAG (info not conveyed by color alone).
// Six variants:
//   pending     → hollow gold circle
//   inProgress  → concentric (gold ring + gold inner dot)
//   completed   → solid gold + check icon
//   skipped     → hollow neutral + × icon
//   note        → diamond outline (rotated square)
//   divider     → short horizontal gold bar across the spine
//   section     → solid gold capsule (thicker than divider, marks structure)

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../../theme/tokens';
import type { StationKind, StationState } from '../lib/spineLayout';

export const STATION_SIZE = 14;

interface Props {
  kind: StationKind;
  state: StationState;
}

function ariaLabel(kind: StationKind, state: StationState): string {
  if (kind === 'divider') return 'Divisor';
  if (kind === 'section') return 'Sección';
  if (kind === 'note')    return 'Nota';
  const head = kind === 'exercise'
    ? 'Ejercicio'
    : kind === 'superset'
      ? 'Superserie'
      : 'Elemento';
  switch (state) {
    case 'completed':  return `${head}, completado`;
    case 'inProgress': return `${head}, en progreso`;
    case 'skipped':    return `${head}, omitido`;
    default:           return `${head}, pendiente`;
  }
}

function StationNodeImpl({ kind, state }: Props) {
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
        style={[styles.circleBase, styles.circleCompleted]}
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
        <Feather name="x" size={9} color={Colors.hair.strong} />
      </View>
    );
  }

  if (state === 'inProgress') {
    return (
      <View
        style={[styles.circleBase, styles.circlePending]}
        accessibilityLabel={ariaLabel(kind, state)}
      >
        <View style={styles.innerDot} />
      </View>
    );
  }

  return (
    <View
      style={[styles.circleBase, styles.circlePending]}
      accessibilityLabel={ariaLabel(kind, state)}
    />
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
    borderWidth: 2,
    borderColor: Colors.gold.deep,
  },
  circleCompleted: {
    backgroundColor: Colors.gold.base,
  },
  circleSkipped: {
    borderWidth: 2,
    borderColor: Colors.hair.strong,
  },
  innerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.gold.base,
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
    borderWidth: 2,
    borderColor: Colors.gold.deep,
    backgroundColor: Colors.bg.void,
    transform: [{ rotate: '45deg' }],
  },
  dividerBar: {
    width: STATION_SIZE + 6,
    height: 2,
    backgroundColor: Colors.gold.deep,
    borderRadius: 1,
  },
  sectionCap: {
    width: STATION_SIZE,
    height: 4,
    backgroundColor: Colors.gold.base,
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
    backgroundColor: Colors.gold.glow,
  },
  stackFront: {
    position: 'absolute',
    top: 4,
    left: 0,
  },
});
