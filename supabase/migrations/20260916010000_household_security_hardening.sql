-- Migration: 20260916010000_household_security_hardening.sql
-- Harden invite credentials, make active-household selection durable, and quarantine
-- ownerless legacy households created by the pre-isolation anonymous bootstrap.

-- Harden the membership predicate used by SECURITY DEFINER RPCs.
create or replace function public.is_household_member(target_household uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.household_members hm
    where hm.household_id = target_household
      and hm.user_id = auth.uid()
  );
$$;

revoke all on function public.is_household_member(uuid) from public, anon;
grant execute on function public.is_household_member(uuid) to authenticated;

-- 1. Server-side active-household preference. This is never used without membership verification.
create table if not exists public.user_household_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_household_id uuid not null references public.households(id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table public.user_household_preferences enable row level security;
revoke all on public.user_household_preferences from public, anon, authenticated;

drop policy if exists user_household_preferences_self_select on public.user_household_preferences;
create policy user_household_preferences_self_select on public.user_household_preferences
  for select to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.user_household_preferences to authenticated;

create or replace function public.set_active_household(target_household uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'authentication required';
  end if;
  if target_household is null or not public.is_household_member(target_household) then
    raise exception 'unauthorized: caller is not a member of target household';
  end if;

  insert into public.user_household_preferences(user_id, active_household_id, updated_at)
  values (uid, target_household, now())
  on conflict (user_id) do update
    set active_household_id = excluded.active_household_id,
        updated_at = excluded.updated_at;

  return target_household;
end;
$$;

revoke all on function public.set_active_household(uuid) from public, anon;
grant execute on function public.set_active_household(uuid) to authenticated;

-- 2. Bootstrap now honors the server-side active-household preference first.
create or replace function public.bootstrap_household(household_name text default 'कुटुंब भोजन')
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  h uuid;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'authentication required';
  end if;

  select p.active_household_id into h
  from public.user_household_preferences p
  where p.user_id = uid
    and public.is_household_member(p.active_household_id)
  limit 1;

  if h is not null then
    return h;
  end if;

  select hm.household_id into h
  from public.household_members hm
  where hm.user_id = uid
  order by hm.created_at
  limit 1;

  if h is not null then
    insert into public.user_household_preferences(user_id, active_household_id, updated_at)
    values (uid, h, now())
    on conflict (user_id) do update
      set active_household_id = excluded.active_household_id,
          updated_at = excluded.updated_at;
    return h;
  end if;

  insert into public.households(name)
  values (coalesce(nullif(trim(household_name), ''), 'कुटुंब भोजन'))
  returning id into h;

  insert into public.household_members(household_id, user_id, role)
  values (h, uid, 'owner');

  insert into public.household_settings(household_id, display_name)
  values (h, coalesce(nullif(trim(household_name), ''), 'कुटुंब भोजन'))
  on conflict (household_id) do nothing;

  insert into public.household_frequency_rules (
    household_id, rule_key, ingredient_key, max_per_calendar_month, period,
    rule_type, preference_type, label, marathi_label, description, marathi_description
  ) values (
    h, 'paneer-monthly-frequency', 'paneer', 5, 'calendar-month',
    'ingredient_frequency', 'household_planning',
    'Paneer monthly planning limit', 'पनीर मासिक नियोजन मर्यादा',
    'Paneer should be planned no more than 5 times per calendar month (household planning preference, not a medical restriction).',
    'एका कॅलेंडर महिन्यात ५ पेक्षा जास्त वेळा पनीरचे जेवण नको (घरगुती नियोजन प्राधान्य, वैद्यकीय सल्ला नाही).'
  ) on conflict (household_id, rule_key) do nothing;

  insert into public.user_household_preferences(user_id, active_household_id, updated_at)
  values (uid, h, now())
  on conflict (user_id) do update
    set active_household_id = excluded.active_household_id,
        updated_at = excluded.updated_at;

  return h;
end;
$$;

revoke all on function public.bootstrap_household(text) from public, anon;
grant execute on function public.bootstrap_household(text) to authenticated;

-- 3. Upgrade invite credentials to 128 bits of entropy while keeping a shareable code.
create or replace function public.create_household_invite(
  target_household uuid,
  expires_in_hours integer default 48,
  max_uses integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  uid uuid := auth.uid();
  raw_token text;
  token_hash text;
  expiry timestamptz;
  invite_id uuid;
begin
  if uid is null then
    raise exception 'authentication required';
  end if;
  if not public.is_household_member(target_household) then
    raise exception 'unauthorized: caller is not a member of target household';
  end if;

  if expires_in_hours is null or expires_in_hours <= 0 or expires_in_hours > 720 then
    expires_in_hours := 48;
  end if;
  if max_uses is null or max_uses <= 0 or max_uses > 100 then
    max_uses := 5;
  end if;

  raw_token := 'KB-' || upper(encode(gen_random_bytes(4), 'hex')) || '-' ||
               upper(encode(gen_random_bytes(4), 'hex')) || '-' ||
               upper(encode(gen_random_bytes(4), 'hex')) || '-' ||
               upper(encode(gen_random_bytes(4), 'hex'));
  token_hash := encode(digest(raw_token, 'sha256'), 'hex');
  expiry := now() + (expires_in_hours || ' hours')::interval;

  insert into public.household_invites (
    household_id, token_hash, created_by, expires_at, max_uses
  ) values (
    target_household, token_hash, uid, expiry, max_uses
  ) returning id into invite_id;

  return jsonb_build_object(
    'invite_id', invite_id,
    'token', raw_token,
    'expires_at', expiry,
    'max_uses', max_uses
  );
end;
$$;

revoke all on function public.create_household_invite(uuid, integer, integer) from public, anon;
grant execute on function public.create_household_invite(uuid, integer, integer) to authenticated;

-- 4. Joining a household also makes it the caller's active household server-side.
create or replace function public.join_household(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  uid uuid := auth.uid();
  normalized_token text;
  computed_hash text;
  inv record;
begin
  if uid is null then
    raise exception 'authentication required';
  end if;

  normalized_token := upper(trim(coalesce(invite_token, '')));
  if normalized_token = '' then
    raise exception 'invalid_or_expired_invite';
  end if;
  computed_hash := encode(digest(normalized_token, 'sha256'), 'hex');

  select id, household_id, use_count, max_uses
  into inv
  from public.household_invites
  where token_hash = computed_hash
    and revoked = false
    and expires_at > now()
    and use_count < max_uses
  for update;

  if not found then
    raise exception 'invalid_or_expired_invite';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (inv.household_id, uid, 'member')
  on conflict (household_id, user_id) do nothing;

  update public.household_invites
  set use_count = use_count + 1
  where id = inv.id;

  insert into public.user_household_preferences(user_id, active_household_id, updated_at)
  values (uid, inv.household_id, now())
  on conflict (user_id) do update
    set active_household_id = excluded.active_household_id,
        updated_at = excluded.updated_at;

  return inv.household_id;
end;
$$;

revoke all on function public.join_household(text) from public, anon;
grant execute on function public.join_household(text) to authenticated;

-- 5. Quarantine ownerless households created by the insecure shared-anonymous flow.
-- Securely preserve the earliest member as owner, then revoke every later member.
-- This stops legacy anonymous members retaining access after the new isolation fix.
do $$
declare
  h record;
  keep_user uuid;
begin
  for h in
    select hh.id
    from public.households hh
    where hh.name = 'कुटुंब भोजन'
      and hh.created_at < timestamptz '2026-09-16 00:00:00+00'
      and not exists (
        select 1 from public.household_members hm
        where hm.household_id = hh.id and hm.role = 'owner'
      )
  loop
    select hm.user_id into keep_user
    from public.household_members hm
    where hm.household_id = h.id
    order by hm.created_at, hm.user_id
    limit 1;

    if keep_user is not null then
      update public.household_members
      set role = 'owner'
      where household_id = h.id and user_id = keep_user;

      delete from public.household_members
      where household_id = h.id and user_id <> keep_user;

      insert into public.user_household_preferences(user_id, active_household_id, updated_at)
      values (keep_user, h.id, now())
      on conflict (user_id) do nothing;
    end if;
  end loop;
end;
$$;
