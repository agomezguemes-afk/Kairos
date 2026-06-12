-- KAIROS — profiles RLS hardening (infra-as-code)
--
-- WHY THIS EXISTS
-- The profiles table is created by an earlier "auth bootstrap" migration that
-- is NOT in this repo (it was applied via the dashboard). That means the
-- table's Row-Level Security can't be reviewed or reproduced from version
-- control. This migration brings it under code, idempotently, and closes a
-- concrete privilege-escalation hole.
--
-- THE HOLE
-- profiles.subscription_tier (free|pro) decides the AI tier: free = 30
-- calls/day on Groq, pro = 500/day on Anthropic. The RevenueCat webhook is
-- supposed to be the only thing that flips it to 'pro'. But with a plain
-- own-row UPDATE policy, an authenticated user can PATCH their own row and set
-- subscription_tier = 'pro' themselves — self-granting the paid tier and
-- bypassing the paywall entirely. (The current client never sends the column,
-- but RLS must not depend on the client behaving.)
--
-- THE FIX
-- 1. Enable RLS and pin own-row read/insert/update policies (no delete).
-- 2. A BEFORE INSERT/UPDATE trigger forces subscription_tier to a safe value
--    for any non-service_role caller: 'free' on insert, unchanged on update.
--    Only the backend (service_role: webhook / edge functions) may set it.
--
-- REVIEWER NOTE: reviewed-not-applied. Reconcile with whatever policies prod
-- currently has (dashboard) before applying. All statements are idempotent.

------------------------------------------------------------------------
-- 0. Preconditions
------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'profiles'
  ) then
    raise exception 'public.profiles does not exist — run the auth bootstrap migration first';
  end if;
end$$;

------------------------------------------------------------------------
-- 1. Enable RLS + own-row policies
------------------------------------------------------------------------

alter table public.profiles enable row level security;
-- Defense in depth: even the table owner is subject to policies, so a stray
-- broad grant can't read every user's row.
alter table public.profiles force row level security;

drop policy if exists profiles_own_select on public.profiles;
create policy profiles_own_select
  on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists profiles_own_insert on public.profiles;
create policy profiles_own_insert
  on public.profiles
  for insert
  with check (auth.uid() = id);

drop policy if exists profiles_own_update on public.profiles;
create policy profiles_own_update
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No DELETE policy: users cannot delete their profile row from the client.
-- Account deletion is a backend (service_role) operation.

------------------------------------------------------------------------
-- 2. Make subscription_tier immutable from the client
------------------------------------------------------------------------

create or replace function public.profiles_guard_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  -- The backend (RevenueCat webhook / edge functions) authenticates with the
  -- service_role key and is the only caller allowed to set the tier.
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Ignore any client-supplied tier on create; everyone starts free.
    new.subscription_tier := 'free';
  else
    -- Freeze the column on update for non-backend callers.
    new.subscription_tier := old.subscription_tier;
  end if;
  return new;
end$$;

drop trigger if exists profiles_guard_privileged_columns on public.profiles;
create trigger profiles_guard_privileged_columns
  before insert or update on public.profiles
  for each row
  execute function public.profiles_guard_privileged_columns();
