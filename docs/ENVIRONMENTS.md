# Environments

Three build variants of Kairos coexist on the same device. They share
the codebase, the design system, and the React Native bridge — they
differ in bundle identifier, display name, and which Supabase project
they read/write.

## The matrix

| Env             | `APP_ENV`      | iOS bundle ID                  | Android package                 | Display name | Supabase project | Distribution                    |
| --------------- | -------------- | ------------------------------ | ------------------------------- | ------------ | ---------------- | ------------------------------- |
| **Development** | `development`  | `com.alvaro.kairos.dev`        | `com.kairos.app.dev`            | Kairos Dev   | DEV              | Local sim / device              |
| **Staging**     | `staging`      | `com.alvaro.kairos.staging`    | `com.kairos.app.staging`        | Kairos β     | DEV              | TestFlight Internal (EAS)       |
| **Production**  | `production`   | `com.alvaro.kairos`            | `com.kairos.app`                | Kairos       | PROD             | TestFlight External + App Store |

Dev and staging deliberately share the **DEV** Supabase. Production
points at a separate Supabase project so prod user data is never at
risk from tests, migrations, or seed scripts.

## Switching envs on a dev machine

1. Copy `.env.example` to each per-env file you intend to use:

   ```bash
   cp .env.example .env.development
   cp .env.example .env.staging
   cp .env.example .env.production
   ```

2. Fill the values for each. Dev and staging can share the same Supabase
   project (DEV); prod gets its own.

3. Activate one with:

   ```bash
   npm run env:dev       # active by default
   npm run env:staging
   npm run env:prod
   ```

   The script symlinks `.env` → `.env.<env>` and prints the active
   Supabase URL so you know what you're about to hit.

4. Start the bundler with the matching `APP_ENV`:

   ```bash
   npm start             # development (default)
   npm run start:staging
   npm run start:prod
   ```

The dynamic `app.config.ts` reads `APP_ENV` at config time and selects
the matching bundle identifier, name, and scheme.

## Supabase setup — two projects

You need **two** Supabase projects to keep dev/staging data separate
from production. Free tier covers both.

### DEV project (shared by development + staging)

1. https://supabase.com/dashboard → New project → name it
   `kairos-dev` (or similar).
2. Run the SQL from `README.md` (profiles table + RLS policies) in the
   SQL editor.
3. Copy the project URL and anon key into `.env.development` and
   `.env.staging`.

### PROD project (production only)

1. Same flow, name `kairos-prod`. **Do not** seed it with test data.
2. Copy URL + anon key into `.env.production`.
3. Treat the URL like any other production credential — never paste it
   into a development chat, dashboard, or screenshot.

## Building each variant

### Local builds (today — xcodebuild)

The current device pipeline (CLAUDE.md → `Physical iPhone Deployment`)
uses xcodebuild directly. Set `APP_ENV` before running:

```bash
APP_ENV=development npx expo prebuild --clean
xcodebuild -workspace ios/Kairos.xcworkspace -scheme Kairos \
  -configuration Release -destination 'id=<DEVICE_ID>' \
  CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM=FH6BYZT9F3
```

For staging/production builds, swap `APP_ENV` accordingly and re-run
`expo prebuild`. The Xcode project's `Info.plist` and bundle ID will
update automatically because `app.config.ts` regenerates the native
config.

### EAS builds (eventual — when we adopt EAS Build)

```bash
eas build --profile development   # development variant, internal distribution
eas build --profile preview       # staging variant, internal distribution
eas build --profile production    # prod variant, store distribution
```

`eas.json` already has the profiles wired. EAS subscription is required
to actually execute (free tier covers limited builds/month).

## CI behaviour

The GitHub Actions workflow (`.github/workflows/ci.yml`) does **not**
inject any `APP_ENV`. It runs typecheck, lint, tests, and format
checks against the codebase only — no native build, no env-specific
behaviour.

When EAS auto-builds land (Fase 3), staging builds will trigger on
every push to `main`, and prod builds on tag push (`v*.*.*`).

## Gotchas

- **`process.env.EXPO_PUBLIC_*` is read at bundle time**, not at
  runtime. Changing `.env` requires restarting the Metro bundler. The
  switch script makes this explicit by printing the active values.
- **Supabase Row-Level Security must be on in both projects.** The
  anon key is technically exposable, so RLS is what actually protects
  the data.
- **App Store builds need a unique `bundleIdentifier` registered in
  App Store Connect.** The production bundle ID (`com.alvaro.kairos`)
  is registered; dev and staging are not (and don't need to be —
  they're internal-distribution only).
- **Versioning lives in `app.config.ts`.** When releasing, bump
  `version` there + `package.json` + tag the commit. EAS auto-increments
  `buildNumber` for production builds.
