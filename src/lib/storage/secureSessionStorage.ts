// KAIROS — SecureStore-backed storage adapter for the Supabase auth session.
//
// The Supabase session (access + refresh tokens) was persisted in AsyncStorage,
// which is unencrypted plaintext on device — readable from a backup or a
// compromised/rooted device, and a stolen refresh token mints new access
// tokens until it's revoked. This adapter moves it into the iOS Keychain /
// Android Keystore via expo-secure-store, chunked to fit the Keychain item
// limit (see secureChunk.ts).
//
// Three robustness requirements baked in:
//   1. Web (Expo web) has no SecureStore — fall back to AsyncStorage there.
//   2. One-time migration: existing users have a plaintext session in
//      AsyncStorage. On first read we move it into SecureStore and scrub the
//      plaintext copy, so nobody is logged out by the upgrade.
//   3. Resilience: if a Keychain op throws (rare device states), fall back to
//      AsyncStorage rather than lock the user out. Primary path stays secure.

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { chunk, chunkKey, metaKey, parseChunkCount, reassemble } from './secureChunk';

interface SupportedStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const useSecure = Platform.OS === 'ios' || Platform.OS === 'android';

async function secureGet(key: string): Promise<string | null> {
  const count = parseChunkCount(await SecureStore.getItemAsync(metaKey(key)));
  if (count === null) return null;
  const parts: (string | null)[] = [];
  for (let i = 0; i < count; i++) {
    parts.push(await SecureStore.getItemAsync(chunkKey(key, i)));
  }
  return reassemble(parts);
}

async function secureRemove(key: string): Promise<void> {
  const count = parseChunkCount(await SecureStore.getItemAsync(metaKey(key)));
  if (count !== null) {
    for (let i = 0; i < count; i++) {
      await SecureStore.deleteItemAsync(chunkKey(key, i));
    }
  }
  await SecureStore.deleteItemAsync(metaKey(key));
}

async function secureSet(key: string, value: string): Promise<void> {
  // Clear stale chunks first so shrinking a value never leaves orphans that
  // would corrupt the next read.
  await secureRemove(key);
  const parts = chunk(value);
  for (let i = 0; i < parts.length; i++) {
    await SecureStore.setItemAsync(chunkKey(key, i), parts[i]);
  }
  await SecureStore.setItemAsync(metaKey(key), String(parts.length));
}

function warn(op: string, e: unknown): void {
  if (__DEV__) console.warn(`[Kairos/SecureStore] ${op} fell back to AsyncStorage:`, e);
}

export const secureSessionStorage: SupportedStorage = {
  async getItem(key) {
    if (!useSecure) return AsyncStorage.getItem(key);
    try {
      const secure = await secureGet(key);
      if (secure !== null) return secure;

      // One-time migration from the legacy plaintext AsyncStorage location.
      const legacy = await AsyncStorage.getItem(key);
      if (legacy !== null) {
        try {
          await secureSet(key, legacy);
          await AsyncStorage.removeItem(key); // scrub the plaintext copy
        } catch (e) {
          warn('migration', e); // keep the legacy value if the move fails
        }
        return legacy;
      }
      return null;
    } catch (e) {
      warn('getItem', e);
      return AsyncStorage.getItem(key);
    }
  },

  async setItem(key, value) {
    if (!useSecure) return AsyncStorage.setItem(key, value);
    try {
      await secureSet(key, value);
    } catch (e) {
      warn('setItem', e);
      await AsyncStorage.setItem(key, value);
    }
  },

  async removeItem(key) {
    if (!useSecure) return AsyncStorage.removeItem(key);
    try {
      await secureRemove(key);
      // Also clear any legacy plaintext copy on sign-out.
      await AsyncStorage.removeItem(key).catch(() => {});
    } catch (e) {
      warn('removeItem', e);
      await AsyncStorage.removeItem(key);
    }
  },
};
