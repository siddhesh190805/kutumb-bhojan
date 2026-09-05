create or replace function public.bootstrap_household(household_name text default 'कुटुंब भोजन')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  h uuid;
  uid uuid := auth.uid();
  is_anon boolean := coalesce((auth.jwt()->>'is_anonymous')::boolean, false);
begin
  if uid is null then
    raise exception 'authentication required';
  end if;

  select hm.household_id into h
  from public.household_members hm
  where hm.user_id = uid
  order by hm.created_at
  limit 1;

  if h is not null then
    return h;
  end if;

  if is_anon then
    select id into h
    from public.households
    where name = 'कुटुंब भोजन'
    order by created_at
    limit 1;

    if h is null then
      insert into public.households(name)
      values ('कुटुंब भोजन')
      returning id into h;
    end if;

    insert into public.household_members(household_id,user_id,role)
    values (h,uid,'member')
    on conflict (household_id,user_id) do nothing;

    return h;
  end if;

  insert into public.households(name)
  values (coalesce(nullif(trim(household_name), ''), 'कुटुंब भोजन'))
  returning id into h;

  insert into public.household_members(household_id,user_id,role)
  values (h,uid,'owner');
  return h;
end;
$$;

revoke all on function public.bootstrap_household(text) from public;
grant execute on function public.bootstrap_household(text) to authenticated;
revoke execute on function public.bootstrap_household(text) from anon;
