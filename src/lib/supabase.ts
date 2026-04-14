// KAIROS — Supabase client
// Single initialised instance shared across the entire app.
// URL is public (project identifier); anon key is loaded from the env so it
// stays out of version control even though it is technically public-safe.

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://odueiggkwtquidzbjgqf.supabase.co';

const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!SUPABASE_ANON_KEY) {
  console.warn(
    '[Kairos/Supabase] EXPO_PUBLIC_SUPABASE_ANON_KEY is not set. ' +
      'Add it to .env — see .env.example for instructions.',
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Persist sessions in AsyncStorage so they survive app restarts.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
