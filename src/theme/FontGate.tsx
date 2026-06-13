// KAIROS — FontGate: hold the first paint until the brand type is ready.
//
// Custom fonts load async; rendering text before they register causes a
// flash from system → brand face. FontGate shows a calm branded splash (gold
// wordmark dot on the warm ground) until `fontsReady`, then reveals children.
// On a font load error it still proceeds (system fallback) so the app never
// hangs on a blank screen.
//
// Adopt with one line at the app root, wrapping the tree:
//   <FontGate><AppContent /></FontGate>

import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Shadows } from './tokens';
import { useKairosFonts } from './fonts';

export default function FontGate({ children }: { children: React.ReactNode }) {
  const { fontsReady } = useKairosFonts();

  if (!fontsReady) {
    // System font here on purpose — the brand face isn't registered yet.
    return (
      <View style={styles.splash}>
        <View style={styles.mark}>
          <Text style={styles.markText}>K</Text>
        </View>
        <ActivityIndicator color={Colors.gold.base} style={styles.spinner} />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg.warm,
  },
  mark: {
    width: 76,
    height: 76,
    borderRadius: Radius['2xl'],
    backgroundColor: Colors.gold.base,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.cardWarm,
  },
  markText: {
    fontSize: 40,
    fontWeight: '700',
    color: Colors.ink.inverse,
    letterSpacing: -1,
  },
  spinner: { marginTop: 28 },
});
