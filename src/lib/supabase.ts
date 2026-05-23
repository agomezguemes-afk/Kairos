// KAIROS — Supabase client
// Single initialised instance shared across the entire app.
// URL is public (project identifier); anon key is loaded from the env so it
// stays out of version control even though it is technically public-safe.
//
// When SKIP_AUTH is true (local dev without a Supabase project) the client
// is created with a placeholder key so the SDK doesn't throw, but all
// auth/data calls are no-ops because the key is invalid by design.

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SKIP_AUTH } from '../config/constants';

const SUPABASE_URL = 'https://odueiggkwtquidzbjgqf.supabase.co';

const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

if (!SKIP_AUTH && !SUPABASE_ANON_KEY) {
  console.warn(
    '[Kairos/Supabase] EXPO_PUBLIC_SUPABASE_ANON_KEY is not set. ' +
      'Add it to .env — see .env.example for instructions.',
  );
}

// SDK requires a non-empty string. Use a sentinel that is structurally
// invalid (not a JWT) so it never accidentally authenticates anything.
const effectiveKey = SUPABASE_ANON_KEY || 'placeholder-key-skip-auth-is-true';

export const supabase = createClient(SUPABASE_URL, effectiveKey, {
  auth: {
    storage: AsyncStorage,
    // Disable background token refresh when SKIP_AUTH is on — avoids
    // making network calls that will always fail with the sentinel key.
    autoRefreshToken: !SKIP_AUTH,
    persistSession: !SKIP_AUTH,
    detectSessionInUrl: false,
  },
});
