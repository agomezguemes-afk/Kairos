// KAIROS — AmbientBackground: subtle depth behind premium screens.
//
// The best-in-class apps aren't flat: a soft vertical gradient ground plus a
// faint warm glow gives the canvas dimension without breaking the white+gold
// minimalism. Gold stays a *halo* here (very low opacity), never a fill.

import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Colors } from '../../../theme/tokens';

interface AmbientBackgroundProps {
  /** Vertical position of the glow centre (0 top … 1 bottom). */
  glowY?: number;
}

function AmbientBackground({ glowY = 0.2 }: AmbientBackgroundProps) {
  const { width, height } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Warm-off-white → white → faint warm foot: a soft vertical ground that
          grounds the frame instead of reading as flat white. */}
      <LinearGradient
        colors={[
          Colors.bg.warm2,
          Colors.bg.warm,
          Colors.bg.void,
          Colors.bg.surface,
          Colors.bg.warm,
        ]}
        locations={[0, 0.22, 0.55, 0.82, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Gold halo near the hero — a glow, not a fill. Slightly richer + wider so
          there's real dimension without breaking the white+gold minimalism. */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="kairosGlow" cx="50%" cy={`${glowY * 100}%`} r="80%">
            <Stop offset="0" stopColor={Colors.gold.base} stopOpacity={0.28} />
            <Stop offset="0.4" stopColor={Colors.gold.base} stopOpacity={0.1} />
            <Stop offset="1" stopColor={Colors.gold.base} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#kairosGlow)" />
      </Svg>
    </View>
  );
}

export default React.memo(AmbientBackground);
