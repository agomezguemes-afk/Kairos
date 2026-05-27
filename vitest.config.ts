import { defineConfig } from 'vitest/config';

/**
 * Vitest config — pure-TS test runner for non-React-Native logic.
 *
 * Scope: business logic, selectors, pure modules. React Native components
 * are not tested here (they need React Native test setup, deferred to
 * the E2E phase).
 *
 * The `*.dev.ts` legacy suites are still runnable directly (`npx tsx
 * path/to/file.dev.ts`); CI exercises them through
 * `__tests__/dev-suites.test.ts` which spawns each one as a subprocess
 * and asserts exit code 0. This avoids rewriting 18 files in one go —
 * migration is incremental.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'ios', 'android', 'dist', '.expo'],
    environment: 'node',
    // 30s per file — dev suites spawn tsx subprocesses which adds latency.
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      exclude: [
        '**/*.dev.ts',
        '**/*.test.ts',
        '**/__tests__/**',
        '**/types/**',
        'src/theme/**',
      ],
    },
  },
});
