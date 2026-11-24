import { describe, expect, it } from 'vitest';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

import { migrateCoachState } from './coachMigrate';

interface Mini {
  sessions: string[];
  checkins: string[];
  add: (id: string) => void;
}

/** In-memory storage that behaves like AsyncStorage (async, string values). */
function memoryStorage(
  seed: Record<string, string>,
): StateStorage & { data: Record<string, string> } {
  const data = { ...seed };
  return {
    data,
    getItem: async (k) => data[k] ?? null,
    setItem: async (k, v) => {
      data[k] = v;
    },
    removeItem: async (k) => {
      delete data[k];
    },
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('coach store migration', () => {
  it('a version bump keeps every stored session and check-in', async () => {
    const storage = memoryStorage({
      coach: JSON.stringify({
        state: { sessions: ['s1', 's2', 's3'], checkins: ['c1', 'c2'] },
        version: 1,
      }),
    });
    const store = createStore<Mini>()(
      persist(
        (set, get) => ({
          sessions: [],
          checkins: [],
          add: (id) => set({ sessions: [...get().sessions, id] }),
        }),
        {
          name: 'coach',
          storage: createJSONStorage(() => storage),
          version: 2,
          migrate: migrateCoachState<Mini>,
        },
      ),
    );
    await flush();
    store.getState().add('s4');
    await flush();

    expect(store.getState().sessions).toEqual(['s1', 's2', 's3', 's4']);
    expect(store.getState().checkins).toEqual(['c1', 'c2']);
    const onDisk = JSON.parse(storage.data.coach);
    expect(onDisk.state.sessions).toEqual(['s1', 's2', 's3', 's4']);
    expect(onDisk.version).toBe(2);
  });

  it('garbage on disk migrates to an empty patch instead of throwing', () => {
    expect(migrateCoachState(null, 1)).toEqual({});
    expect(migrateCoachState('corrupt', 1)).toEqual({});
  });
});
