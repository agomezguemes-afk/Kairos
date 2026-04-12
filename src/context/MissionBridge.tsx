// KAIROS — Mission Bridge
// Bridges GamificationContext data into MissionProvider.
// Loads blocks from AsyncStorage since they aren't in a global context.

import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGamification } from './GamificationContext';
import { MissionProvider } from './MissionContext';
import type { WorkoutBlock } from '../types/core';

const BLOCKS_STORAGE_KEY = 'kairos_blocks_v1';

export function MissionBridge({ children }: { children: React.ReactNode }) {
  const { streak, badges, prCards } = useGamification();
  const [blocks, setBlocks] = useState<WorkoutBlock[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(BLOCKS_STORAGE_KEY);
        if (raw) setBlocks(JSON.parse(raw));
      } catch {}
    })();
  }, []);

  return (
    <MissionProvider
      blocks={blocks}
      streak={streak}
      badges={badges}
      prCards={prCards}
    >
      {children}
    </MissionProvider>
  );
}
