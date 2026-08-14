-- Cross-tenant smoke test for the live/seeded database.
-- It discovers one non-superadmin user and a restaurant that user does not
-- belong to. The whole test is read-only and rolls back its session settings.

begin;

do $$
declare
  v_user_id uuid;
  v_restaurant_id uuid;
  v_other_restaurant_id uuid;
begin
  select ru.user_id, ru.restaurant_id
    into v_user_id, v_restaurant_id
  from public.restaurant_users ru
  left join public.user_profiles up on up.id = ru.user_id
  where coalesce(up.global_role, 'restaurant_user') <> 'superadmin'
  order by ru.created_at
  limit 1;

  if v_user_id is null then
    raise exception 'RLS test requires a non-superadmin restaurant user';
  end if;

  select r.id
    into v_other_restaurant_id
  from public.restaurants r
  where r.id <> v_restaurant_id
    and not exists (
      select 1
      from public.restaurant_users ru
      where ru.user_id = v_user_id
        and ru.restaurant_id = r.id
    )
  order by r.id
  limit 1;

  if v_other_restaurant_id is null then
    raise exception 'RLS test requires a second, inaccessible restaurant';
  end if;

  perform set_config('test.user_id', v_user_id::text, true);
  perform set_config('test.restaurant_id', v_restaurant_id::text, true);
  perform set_config('test.other_restaurant_id', v_other_restaurant_id::text, true);
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.user_id'), true);

do $$
declare
  v_own uuid := current_setting('test.restaurant_id')::uuid;
  v_other uuid := current_setting('test.other_restaurant_id')::uuid;
  v_count bigint;
begin
  select count(*) into v_count from public.restaurants where id = v_own;
  if v_count <> 1 then
    raise exception 'RLS failure: user cannot read their own restaurant';
  end if;

  select count(*) into v_count from public.restaurants where id = v_other;
  if v_count <> 0 then
    raise exception 'RLS leak: restaurants';
  end if;

  select count(*) into v_count from public.restaurant_settings where restaurant_id = v_other;
  if v_count <> 0 then raise exception 'RLS leak: restaurant_settings'; end if;

  select count(*) into v_count from public.restaurant_tables where restaurant_id = v_other;
  if v_count <> 0 then raise exception 'RLS leak: restaurant_tables'; end if;

  select count(*) into v_count from public.table_combinations where restaurant_id = v_other;
  if v_count <> 0 then raise exception 'RLS leak: table_combinations'; end if;

  select count(*) into v_count from public.booking_hours where restaurant_id = v_other;
  if v_count <> 0 then raise exception 'RLS leak: booking_hours'; end if;

  select count(*) into v_count from public.special_dates where restaurant_id = v_other;
  if v_count <> 0 then raise exception 'RLS leak: special_dates'; end if;

  select count(*) into v_count from public.bookings where restaurant_id = v_other;
  if v_count <> 0 then raise exception 'RLS leak: bookings'; end if;

  select count(*) into v_count from public.restaurant_users where restaurant_id = v_other;
  if v_count <> 0 then raise exception 'RLS leak: restaurant_users'; end if;
end;
$$;

rollback;
