-- KAIROS — atomic AI quota reservation (fixes a TOCTOU cap bypass)
--
-- THE RACE
-- The proxy previously (1) counted the caller's 24h calls, (2) compared to the
-- cap, then (3) inserted a ledger row AFTER the upstream call returned. Between
-- (1) and (3) the row doesn't exist yet, so N concurrent requests all read
-- count < cap and all proceed — a burst sails past the daily cap.
--
-- THE FIX
-- ai_quota_reserve() does the count + insert atomically under a per-user
-- transaction advisory lock, so concurrent reservations for the same user are
-- serialized and the (count+1)-th caller past the cap is denied. The inserted
-- row IS the reservation: the edge function finalizes its token count on
-- success, or releases (deletes) it if the upstream call fails — preserving the
-- "failed calls don't burn quota" guarantee without reintroducing the race.
--
-- REVIEWER NOTE: reviewed-not-applied. Needs DB-side testing (a concurrency
-- test hitting reserve() in parallel) before deploy. Idempotent.

------------------------------------------------------------------------
-- 1. Reserve a slot atomically
------------------------------------------------------------------------

create or replace function public.ai_quota_reserve(
  p_user_id  uuid,
  p_cap      integer,
  p_tier     public.subscription_tier,
  p_provider text,
  p_model    text
)
returns table (
  allowed        boolean,
  used_today     integer,
  reservation_id bigint,
  oldest_used_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_count  integer;
  v_id     bigint;
  v_oldest timestamptz;
begin
  -- Serialize reservations for THIS user within the transaction. Different
  -- users hash to different keys and don't contend.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select count(*) into v_count
    from public.ai_quota
   where user_id = p_user_id
     and used_at > now() - interval '24 hours';

  if v_count >= p_cap then
    -- Earliest call still in the window → when a slot frees up.
    select q.used_at into v_oldest
      from public.ai_quota q
     where q.user_id = p_user_id
       and q.used_at > now() - interval '24 hours'
     order by q.used_at asc
     limit 1;
    return query select false, v_count, null::bigint, v_oldest;
    return;
  end if;

  insert into public.ai_quota (user_id, tokens_used, tier_at_call, provider, model)
       values (p_user_id, 0, p_tier, p_provider, p_model)
    returning id into v_id;

  return query select true, v_count + 1, v_id, null::timestamptz;
end$$;

revoke all on function
  public.ai_quota_reserve(uuid, integer, public.subscription_tier, text, text)
  from public;
grant execute on function
  public.ai_quota_reserve(uuid, integer, public.subscription_tier, text, text)
  to service_role;

------------------------------------------------------------------------
-- 2. Release a reservation (upstream failed → don't burn quota)
------------------------------------------------------------------------

create or replace function public.ai_quota_release(
  p_user_id        uuid,
  p_reservation_id bigint
)
returns void
language sql
security definer
set search_path = public, pg_catalog
as $$
  delete from public.ai_quota
   where id = p_reservation_id
     and user_id = p_user_id;
$$;

revoke all on function public.ai_quota_release(uuid, bigint) from public;
grant execute on function public.ai_quota_release(uuid, bigint) to service_role;

------------------------------------------------------------------------
-- 3. Finalize a reservation's token count (upstream succeeded)
------------------------------------------------------------------------

create or replace function public.ai_quota_finalize(
  p_user_id        uuid,
  p_reservation_id bigint,
  p_tokens         integer
)
returns void
language sql
security definer
set search_path = public, pg_catalog
as $$
  update public.ai_quota
     set tokens_used = greatest(0, coalesce(p_tokens, 0))
   where id = p_reservation_id
     and user_id = p_user_id;
$$;

revoke all on function public.ai_quota_finalize(uuid, bigint, integer) from public;
grant execute on function public.ai_quota_finalize(uuid, bigint, integer) to service_role;
