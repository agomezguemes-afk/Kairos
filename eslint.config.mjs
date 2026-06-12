// ESLint flat config — Kairos
//
// Foundation: eslint-config-expo (Expo's official preset, includes React,
// React Native, react-hooks, react-native essentials). Layered with
// eslint-config-prettier to disable rules that would conflict with
// prettier formatting.
//
// We start permissive: only catch real bugs (no-undef, unused vars warn).
// Stylistic rules go through prettier. We can tighten progressively.

import expoConfig from 'eslint-config-expo/flat.js';
import prettier from 'eslint-config-prettier';

export default [
  ...expoConfig,
  prettier,
  {
    ignores: [
      'node_modules/**',
      'ios/**',
      'android/**',
      '.expo/**',
      'dist/**',
      'build/**',
      'coverage/**',
      'expo-env.d.ts',
      'metro.config.js',
      'babel.config.js',
      // Supabase Edge Functions run on Deno, not Node/RN. They import
      // from URLs and use Deno globals that this ESLint config can't
      // resolve. They have their own deno.json + linting via `deno lint`.
      'supabase/functions/**',
    ],
  },
  {
    rules: {
      // Warnings, not errors — we want CI to surface them without blocking.
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      // We use React 17+ JSX transform — no need for React in scope.
      'react/react-in-jsx-scope': 'off',
      // Display names rarely useful for React.memo wrappers in this codebase.
      'react/display-name': 'off',
      // The valibot idiom pairs a schema const with a same-name inferred type
      // (`const X = v.object(...)` + `type X = v.InferInput<typeof X>`).
      // That's deliberate; tsc already errors on real redeclarations.
      '@typescript-eslint/no-redeclare': 'off',

      // ── React Compiler (Expo SDK 54 enables this experimental ruleset).
      // These check that components stay compatible with the React Compiler's
      // auto-memoization analysis. Baseline policy: keep visibility (warn)
      // but don't block CI — the codebase predates the compiler rollout and
      // a clean-up sweep is its own PR.
      'react-hooks/immutability':              'warn',
      'react-hooks/refs':                      'warn',
      'react-hooks/set-state-in-effect':       'warn',
      'react-hooks/purity':                    'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      // Classic hook rules stay strict — these catch real bugs.
      // 'react-hooks/rules-of-hooks' and 'react-hooks/exhaustive-deps'
      // keep their inherited severities.
    },
  },
];
