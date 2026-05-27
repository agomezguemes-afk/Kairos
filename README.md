# Kairos

> The Training OS — a personal operating system for physical wellness.

React Native + Expo SDK 54. iOS-first (Android scaffolded, not yet validated).
Backed by Supabase for auth + profile storage, Groq for AI assistance.

This project is under active development. For questions or suggestions:
**agomezguemes@gmail.com**.

---

## Quick start

```bash
npm install
npm start              # Expo dev server (Metro)
npm run ios            # Build + run on iOS simulator
```

## Quality gates

All commands are pure and run locally — same set is enforced in CI.

```bash
npm run typecheck      # tsc --noEmit
npm run lint           # ESLint flat config (expo + react-compiler)
npm run lint:fix       # auto-fix what it can
npm run format         # prettier --write
npm run format:check   # CI prettier validation
npm test               # Vitest (currently bridges legacy .dev.ts suites)
npm run test:watch     # interactive
npm run test:coverage  # v8 coverage report
```

A `pre-commit` hook (husky + lint-staged) auto-formats and lints staged
`.ts/.tsx` files. CI re-runs the full set on every PR and main push.

## Branching

Trunk-based on `main`. Feature branches → PR → squash/merge to main.
`feat/canvas` is the historical baseline branch and is now upstream of
main as of `v0.1.0`.

## Releases

Tagged with SemVer (`v0.1.0`, `v0.2.0`, …). See `CHANGELOG.md` for the
human-readable history.

---

## Supabase setup

Kairos uses Supabase for authentication and profile storage.

1. Open your project at https://supabase.com/dashboard/project/odueiggkwtquidzbjgqf/settings/api
2. Copy the **anon / public** key.
3. Paste it into `.env`: `EXPO_PUBLIC_SUPABASE_ANON_KEY=your_key`
4. Run this SQL in the Supabase SQL editor to create the `profiles` table:

```sql
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  fitness_level text,
  primary_goal text,
  disciplines jsonb default '[]',
  weekly_frequency integer,
  age integer,
  weight_kg numeric,
  height_cm numeric,
  injuries text,
  workout_place text,
  onboarding_completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);
```

## Kai (AI assistant) setup

Kai uses [Groq](https://console.groq.com) for free, low-latency inference
over Llama 3. No credit card required.

1. Sign up at https://console.groq.com and create an API key.
2. Copy `.env.example` to `.env` in the project root.
3. Paste your key into `EXPO_PUBLIC_GROQ_API_KEY=`.
4. Restart the dev server: `npm start`.

If the key is missing or Groq fails, Kai falls back to the offline mock
service so the chat never breaks.

## Architecture

Top-level: `docs/MVP_PRD.md` plus per-feature specs in `docs/superpowers/`.
Day-to-day conventions: see `CLAUDE.md` (also serves as agent instructions).
