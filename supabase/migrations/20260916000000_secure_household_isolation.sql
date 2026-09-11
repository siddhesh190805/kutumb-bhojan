-- Migration: 20260916000000_secure_household_isolation.sql
-- Fix P0 Security Issue #4: Isolate anonymous households and provide secure invite-based family sharing.

-- 1. Replace bootstrap_household with secure per-identity household isolation
create or replace function public.bootstrap_household(household_name text default 'कुटुंब भोजन')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  h uuid;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'authentication required';
  end if;

  -- Return existing household membership if caller already belongs to one
  select hm.household_id into h
  from public.household_members hm
  where hm.user_id = uid
  order by hm.created_at
  limit 1;

  if h is not null then
    return h;
  end if;

  -- New identity: ALWAYS create an isolated household.
  -- Never bind unrelated users to a shared household by name.
  insert into public.households(name)
  values (coalesce(nullif(trim(household_name), ''), 'कुटुंब भोजन'))
  returning id into h;

  insert into public.household_members(household_id, user_id, role)
  values (h, uid, 'owner');

  -- Seed initial settings for the new household
  insert into public.household_settings(household_id, display_name)
  values (h, coalesce(nullif(trim(household_name), ''), 'कुटुंब भोजन'))
  on conflict (household_id) do nothing;

  -- Seed default frequency rules for the new household
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

  return h;
end;
$$;

revoke all on function public.bootstrap_household(text) from public, anon;
grant execute on function public.bootstrap_household(text) to authenticated;

-- 2. Household invites table for secure multi-device family pairing
create table if not exists public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  max_uses integer not null default 5 check (max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  revoked boolean not null default false
);

create index if not exists household_invites_household_idx on public.household_invites(household_id);
create index if not exists household_invites_hash_idx on public.household_invites(token_hash);

alter table public.household_invites enable row level security;
revoke all on public.household_invites from public, anon;
grant select on public.household_invites to authenticated;

drop policy if exists household_invites_member_select on public.household_invites;
create policy household_invites_member_select on public.household_invites
  for select to authenticated
  using ((select public.is_household_member(household_id)));

-- 3. Create household invite token RPC (stores only SHA-256 hash)
create or replace function public.create_household_invite(
  target_household uuid,
  expires_in_hours integer default 48,
  max_uses integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
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

  if max_uses is null or max_uses <= 0 then
    max_uses := 5;
  end if;

  -- 16-character alphanumeric uppercase token format: KB-XXXX-XXXX
  raw_token := 'KB-' || upper(encode(gen_random_bytes(2), 'hex')) || '-' || upper(encode(gen_random_bytes(2), 'hex'));
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

-- 4. Join household RPC (verifies token hash, expiration, revocation, and use count)
create or replace function public.join_household(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
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

  -- Atomically locate and lock matching active invite
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

  -- Increment use count
  update public.household_invites
  set use_count = use_count + 1
  where id = inv.id;

  -- Add user as member to household
  insert into public.household_members (household_id, user_id, role)
  values (inv.household_id, uid, 'member')
  on conflict (household_id, user_id) do nothing;

  return inv.household_id;
end;
$$;

revoke all on function public.join_household(text) from public, anon;
grant execute on function public.join_household(text) to authenticated;

-- 5. Revoke household invite RPC
create or replace function public.revoke_household_invite(invite_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  inv_household uuid;
begin
  if uid is null then
    raise exception 'authentication required';
  end if;

  select household_id into inv_household
  from public.household_invites
  where id = invite_id;

  if not found or not public.is_household_member(inv_household) then
    raise exception 'unauthorized or invite not found';
  end if;

  update public.household_invites
  set revoked = true
  where id = invite_id;

  return true;
end;
$$;

revoke all on function public.revoke_household_invite(uuid) from public, anon;
grant execute on function public.revoke_household_invite(uuid) to authenticated;
