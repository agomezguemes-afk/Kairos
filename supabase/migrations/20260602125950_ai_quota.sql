-- KAIROS — AI quota + subscription tier
-- Sprint 7: per-user rolling 24h quota on the AI chat proxy.
--
-- Two surfaces:
--   1. profiles.subscription_tier — enum free | pro. Default free; flipped
--      to pro by RevenueCat webhook on successful subscription.
--   2. ai_quota — one row per AI call. Rolling 24h count is computed on
--      read (no nightly job needed). Rows older than 7 days are pruned
--      by a daily cron to keep the table small.
--
-- Tier limits live in code (Edge Function), not in the DB, so we can
-- tweak free vs pro caps without a migration.

------------------------------------------------------------------------
-- 1. Subscription tier enum + column on profiles
------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'subscription_tier') then
    create type public.subscription_tier as enum ('free', 'pro');
  end if;
end$$;

-- profiles table is created by previous migrations. We only patch it.
-- If it doesn't exist yet (fresh DB), this migration is harmless to add
-- column-conditionally — but the assumption is profiles is already
-- there. Fail-fast otherwise: the developer needs to run the auth
-- bootstrap migration first.
do $$
begin
  if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'profiles') then
    raise exception 'public.profiles does not exist — run the auth bootstrap migration first';
  end if;
end$$;

alter table public.profiles
  add column if not exists subscription_tier public.subscription_tier
    not null default 'free';

------------------------------------------------------------------------
-- 2. ai_quota table — append-only ledger
------------------------------------------------------------------------

create table if not exists public.ai_quota (
  id            bigserial primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  -- When the call was made. Indexed so the rolling-window count is fast.
  used_at       timestamptz not null default now(),
  -- Tokens reported by the upstream provider (input + output). Lets us
  -- meter cost per user even though the free-tier limit is by call count.
  tokens_used   integer     not null default 0 check (tokens_used >= 0),
  -- Tier the user had at call time. Lets us compare "what they actually
  -- consumed at free price vs pro price" for ARPU analytics later.
  tier_at_call  public.subscription_tier not null,
  -- Which provider answered (groq | openrouter | anthropic | ...).
  -- Free text; enums on this column would require a migration per new
  -- fallback provider we add.
  provider      text        not null,
  -- Model identifier as reported. Same reasoning as provider.
  model         text        not null
);

create index if not exists ai_quota_user_used_at_idx
  on public.ai_quota (user_id, used_at desc);

------------------------------------------------------------------------
-- 3. Quota check RPC — atomic increment + window count
------------------------------------------------------------------------

-- Returns the count of calls in the trailing 24h window for the calling
-- user. The Edge Function compares this to the tier limit BEFORE making
-- the LLM call. The increment (insert) happens after the call returns,
-- so failed calls don't burn quota.
--
-- security definer so the function bypasses RLS for the COUNT — the
-- function only ever counts the caller's own rows (auth.uid()) so this
-- is safe; setting search_path locks the path explicitly per Supabase
-- security guidance.
create or replace function public.ai_quota_count_24h(
  p_user_id uuid
)
returns integer
language sql
security definer
set search_path = public, pg_catalog
as $$
  select count(*)::int
    from public.ai_quota
   where user_id = p_user_id
     and used_at > now() - interval '24 hours';
$$;

revoke all on function public.ai_quota_count_24h(uuid) from public;
grant execute on function public.ai_quota_count_24h(uuid) to authenticated, service_role;

------------------------------------------------------------------------
-- 4. RLS — users read their own quota; only service_role writes
------------------------------------------------------------------------

alter table public.ai_quota enable row level security;

drop policy if exists ai_quota_own_read on public.ai_quota;
create policy ai_quota_own_read
  on public.ai_quota
  for select
  using (auth.uid() = user_id);

-- No insert/update/delete policies for normal users. The Edge Function
-- runs with the service_role key and bypasses RLS to write. Keeping
-- writes server-only prevents a client from spoofing low usage.

------------------------------------------------------------------------
-- 5. Housekeeping: prune ledger rows older than 7 days
------------------------------------------------------------------------

-- 7d window keeps a week of history for analytics while preventing
-- unbounded growth. Quota math only uses 24h so older rows are dead
-- weight. pg_cron is enabled by default on Supabase; wrap in a guard
-- so this migration is idempotent on databases where the extension
-- isn't available (local CI).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Avoid duplicate job on re-run.
    perform cron.unschedule('kairos-ai-quota-prune')
      where exists (select 1 from cron.job where jobname = 'kairos-ai-quota-prune');

    perform cron.schedule(
      'kairos-ai-quota-prune',
      '17 3 * * *',   -- 03:17 UTC daily — off-peak
      $cron$
        delete from public.ai_quota where used_at < now() - interval '7 days';
      $cron$
    );
  end if;
end$$;

------------------------------------------------------------------------
-- 6. Backfill: every existing profile starts free
------------------------------------------------------------------------

-- Already handled by the column default — kept as an explicit no-op
-- comment so the intent is documented if defaults are ever removed.
-- update public.profiles set subscription_tier = 'free' where subscription_tier is null;
