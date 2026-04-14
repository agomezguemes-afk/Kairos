This App is under development, its final result cannot be determined yet. For any inquiries/suggestions you can contact me throught my email agomezguemes@gmail.com

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

-- Row-level security: users can only read/write their own row
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);
```

## Kai (AI assistant) setup

Kai uses [Groq](https://console.groq.com) for free, low-latency inference over Llama 3. No credit card required.

1. Sign up at https://console.groq.com and create an API key.
2. Copy `.env.example` to `.env` in the project root.
3. Paste your key into `EXPO_PUBLIC_GROQ_API_KEY=`.
4. Restart the dev server: `npm start` (env vars are inlined at bundle time).

If the key is missing or Groq fails, Kai automatically falls back to the offline mock service so the chat never breaks.
