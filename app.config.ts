// Kairos — Expo dynamic config
//
// Three build variants coexist on the same device. The active variant
// is selected via the APP_ENV environment variable (read at config time,
// before the bundle is built). Default is "development" so a plain
// `expo start` Just Works for day-to-day coding.
//
//   APP_ENV=development → com.alvaro.kairos.dev      "Kairos Dev"
//   APP_ENV=staging     → com.alvaro.kairos.staging  "Kairos β"
//   APP_ENV=production  → com.alvaro.kairos          "Kairos"
//
// All other fields (icons, splash, plugins) are shared. If the dev
// variant ever needs a tinted icon, swap `iconFor(env)` to return a
// different asset path.

import { type ExpoConfig, type ConfigContext } from '@expo/config';

type AppEnv = 'development' | 'staging' | 'production';

function resolveEnv(): AppEnv {
  const raw = (process.env.APP_ENV ?? '').trim().toLowerCase();
  if (raw === 'staging' || raw === 'production' || raw === 'development') return raw;
  return 'development';
}

interface VariantConfig {
  name: string;
  slug: string;
  iosBundleId: string;
  androidPackage: string;
  scheme: string;
}

const VARIANTS: Record<AppEnv, VariantConfig> = {
  development: {
    name: 'Kairos Dev',
    slug: 'kairos-dev',
    iosBundleId: 'com.alvaro.kairos.dev',
    androidPackage: 'com.kairos.app.dev',
    scheme: 'kairos-dev',
  },
  staging: {
    name: 'Kairos β',
    slug: 'kairos-staging',
    iosBundleId: 'com.alvaro.kairos.staging',
    androidPackage: 'com.kairos.app.staging',
    scheme: 'kairos-staging',
  },
  production: {
    name: 'Kairos',
    slug: 'kairos',
    iosBundleId: 'com.alvaro.kairos',
    androidPackage: 'com.kairos.app',
    scheme: 'kairos',
  },
};

export default ({ config }: ConfigContext): ExpoConfig => {
  const env = resolveEnv();
  const variant = VARIANTS[env];

  return {
    ...config,
    name: variant.name,
    slug: variant.slug,
    scheme: variant.scheme,
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#F7F7F5',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: variant.iosBundleId,
      jsEngine: 'hermes',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#F7F7F5',
      },
      jsEngine: 'hermes',
      package: variant.androidPackage,
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: ['expo-font'],
    // Surface the active variant to the JS bundle so the UI can render
    // a subtle environment chip in non-prod builds (next sprint).
    extra: {
      appEnv: env,
    },
  };
};
