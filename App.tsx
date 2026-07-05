// TEMPORARY PREVIEW HARNESS — mounts only PremiumOnboarding for review.
// Restore the real app with: git checkout -- App.tsx
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from './src/theme/ThemeContext';
import FontGate from './src/theme/FontGate';
import PremiumOnboarding from './src/features/onboarding/premium/PremiumOnboarding';
import KaiPreview from './src/features/kai/__KaiPreview';
import FacePreview from './src/features/onboarding/premium/__FacePreview';
import KaiConcepts from './src/features/onboarding/premium/__KaiConcepts';
import type { OnboardingDraft } from './src/features/onboarding/flow/onboardingFlow';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <ScrollView contentContainerStyle={styles.errWrap}>
          <Text style={styles.errTitle}>RENDER ERROR</Text>
          <Text style={styles.errMsg}>{String(this.state.error.message)}</Text>
          <Text style={styles.errStack}>{String(this.state.error.stack).slice(0, 1600)}</Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [result, setResult] = useState<OnboardingDraft | null>(null);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <ThemeProvider>
          <FontGate>
          <ErrorBoundary>
          {result ? (
            <ScrollView contentContainerStyle={styles.done}>
              <Text style={styles.h}>✅ Onboarding completado</Text>
              <Text style={styles.code}>{JSON.stringify(result, null, 2)}</Text>
              <Pressable style={styles.btn} onPress={() => setResult(null)}>
                <Text style={styles.btnText}>Reiniciar y probar de nuevo</Text>
              </Pressable>
            </ScrollView>
          ) : (
            <PremiumOnboarding key="ms1" initialStep="manuscrito" manuscriptAutoplay onComplete={setResult} />
          )}
          </ErrorBoundary>
          </FontGate>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  done: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 24 },
  h: { fontSize: 22, fontWeight: '700', color: '#1C1C1E' },
  code: { fontFamily: 'monospace', fontSize: 13, color: '#1C1C1E' },
  btn: {
    marginTop: 12,
    height: 52,
    paddingHorizontal: 24,
    borderRadius: 99,
    backgroundColor: '#C9A96E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 16 },
  errWrap: { padding: 24, paddingTop: 80, gap: 10 },
  errTitle: { fontSize: 16, fontWeight: '700', color: '#D94040' },
  errMsg: { fontSize: 14, color: '#1C1C1E' },
  errStack: { fontFamily: 'monospace', fontSize: 11, color: '#636366' },
});
