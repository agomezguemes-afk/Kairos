// src/screens/SplashScreen.tsx
import React from 'react';
import { View } from 'react-native';

import {
  KairosBootSequence,
  SplashCondensed,
  useSplashTrigger,
} from '../animations/splash';

interface SplashScreenProps {
  onDone: () => void;
}

export default function SplashScreen({ onDone }: SplashScreenProps) {
  const { mode, markCompleted } = useSplashTrigger();

  if (mode === 'loading') {
    // Brief blank-white moment while we read AsyncStorage. Always under ~50ms
    // on device. Showing nothing is correct — flashing a frame of any version
    // before the resolved choice would be worse.
    return <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />;
  }

  if (mode === 'full') {
    return (
      <KairosBootSequence
        onDone={async () => {
          await markCompleted();
          onDone();
        }}
      />
    );
  }

  return <SplashCondensed onDone={onDone} />;
}
