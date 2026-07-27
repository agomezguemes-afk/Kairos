// PaperGrain — the fibre of the canvas (Design v3 §3a).
//
// ONE tiled 256×256 greyscale PNG, `resizeMode="repeat"`, at 3.5% opacity.
// The GPU tiles a static texture: cost per frame is zero, scroll stays at 60fps.
//
// Rejected: react-native-svg's <feTurbulence> — it rasterises the filter on every
// render and you feel it the moment you scroll. (docs/DESIGN_V3_SOUL.md §3a)
//
// Mount it ONCE per window (root of the navigator + inside any native modal
// screen, which iOS presents in its own view controller above the root). Never
// per card. It is `pointerEvents="none"`, so it never eats a touch, and it has
// no accessibility surface, so VoiceOver walks straight past it.

import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { Colors } from './tokens';

// WHY the View wrapper: `pointerEvents` is a View prop, not an Image prop, and
// the grain must never intercept a touch.
function PaperGrainImpl() {
  return (
    <View
      style={styles.layer}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Image
        source={require('../../assets/textures/grain-256.png')}
        resizeMode="repeat"
        style={styles.grain}
        fadeDuration={0}
      />
    </View>
  );
}

/** The grain layer. Absolute-filled, non-interactive, invisible to VoiceOver. */
const PaperGrain = React.memo(PaperGrainImpl);
export default PaperGrain;

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    opacity: Colors.paper.grain,
  },
  grain: {
    width: '100%',
    height: '100%',
  },
});
