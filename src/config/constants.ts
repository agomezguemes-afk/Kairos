// KAIROS — Global configuration constants.
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
