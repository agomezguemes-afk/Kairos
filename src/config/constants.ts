// KAIROS — Global configuration constants.
import Constants from 'expo-constants';
//
// SKIP_AUTH: when true the app skips Supabase auth and jumps straight to the
// main dashboard with a mock session. Flip to false to re-enable login.
export const SKIP_AUTH = true;

// SKIP_ONBOARDING: the onboarding is being redesigned around the coach
// (goal + baseline tests); until then the app opens straight on the tabs.
export const SKIP_ONBOARDING = true;

// SHOW_ENGINE_DEBUG: the engine thinks in the background and only its
// decisions reach the user. The "Tu cerebro" inspector stays in the code
// for development; flip to true to get its entry points back.
export const SHOW_ENGINE_DEBUG = false;

// SHOW_AI_LAB: the on-device model lab (download, measure, choose) is a
// development tool. It shows in the "Kairos Dev" and "Kairos β" variants and
// never in production, whatever this file says at release time.
export const SHOW_AI_LAB = Constants.expoConfig?.extra?.appEnv !== 'production';
