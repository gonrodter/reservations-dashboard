-- Baseline exported from the production project on 2026-08-13.
-- This migration is intentionally idempotent so the current policies can be
-- brought under version control without changing their behaviour.

alter table public.booking_hours enable row level security;
alter table public.booking_tables enable row level security;
alter table public.bookings enable row level security;
alter table public.restaurant_settings enable row level security;
alter table public.restaurant_tables enable row level security;
alter table public.restaurant_users enable row level security;
alter table public.restaurants enable row level security;
alter table public.special_dates enable row level security;
alter table public.table_combination_members enable row level security;
alter table public.table_combinations enable row level security;
alter table public.user_profiles enable row level security;

drop policy if exists "restaurant users delete booking hours" on public.booking_hours;
create policy "restaurant users delete booking hours" on public.booking_hours
  for delete to authenticated
  using (public.has_restaurant_access(restaurant_id));

drop policy if exists "restaurant users insert booking hours" on public.booking_hours;
create policy "restaurant users insert booking hours" on public.booking_hours
  for insert to authenticated
  with check (public.has_restaurant_access(restaurant_id));

drop policy if exists "restaurant users read booking hours" on public.booking_hours;
create policy "restaurant users read booking hours" on public.booking_hours
  for select to authenticated
  using (public.has_restaurant_access(restaurant_id));

drop policy if exists "restaurant users update booking hours" on public.booking_hours;
create policy "restaurant users update booking hours" on public.booking_hours
  for update to authenticated
  using (public.has_restaurant_access(restaurant_id))
  with check (public.has_restaurant_access(restaurant_id));

drop policy if exists "restaurant users read booking tables" on public.booking_tables;
create policy "restaurant users read booking tables" on public.booking_tables
  for select to authenticated
  using (exists (
    select 1
    from public.bookings b
    where b.id = booking_tables.booking_id
      and public.has_restaurant_access(b.restaurant_id)
  ));

drop policy if exists "restaurant users read bookings" on public.bookings;
create policy "restaurant users read bookings" on public.bookings
  for select to authenticated
  using (public.has_restaurant_access(restaurant_id));

drop policy if exists "restaurant users insert settings" on public.restaurant_settings;
create policy "restaurant users insert settings" on public.restaurant_settings
  for insert to authenticated
  with check (public.has_restaurant_access(restaurant_id));

drop policy if exists "restaurant users read settings" on public.restaurant_settings;
create policy "restaurant users read settings" on public.restaurant_settings
  for select to authenticated
  using (public.has_restaurant_access(restaurant_id));

drop policy if exists "restaurant users update settings" on public.restaurant_settings;
create policy "restaurant users update settings" on public.restaurant_settings
  for update to authenticated
  using (public.has_restaurant_access(restaurant_id))
  with check (public.has_restaurant_access(restaurant_id));

drop policy if exists "restaurant users delete tables" on public.restaurant_tables;
create policy "restaurant users delete tables" on public.restaurant_tables
  for delete to authenticated
  using (public.has_restaurant_access(restaurant_id));

drop policy if exists "restaurant users insert tables" on public.restaurant_tables;
create policy "restaurant users insert tables" on public.restaurant_tables
  for insert to authenticated
  with check (public.has_restaurant_access(restaurant_id));

drop policy if exists "restaurant users read tables" on public.restaurant_tables;
create policy "restaurant users read tables" on public.restaurant_tables
  for select to authenticated
  using (public.has_restaurant_access(restaurant_id));

drop policy if exists "restaurant users update tables" on public.restaurant_tables;
create policy "restaurant users update tables" on public.restaurant_tables
  for update to authenticated
  using (public.has_restaurant_access(restaurant_id))
  with check (public.has_restaurant_access(restaurant_id));

drop policy if exists "superadmin delete restaurant users" on public.restaurant_users;
create policy "superadmin delete restaurant users" on public.restaurant_users
  for delete to authenticated
  using (public.is_superadmin());

drop policy if exists "superadmin insert restaurant users" on public.restaurant_users;
create policy "superadmin insert restaurant users" on public.restaurant_users
  for insert to authenticated
  with check (public.is_superadmin());

drop policy if exists "superadmin update restaurant users" on public.restaurant_users;
create policy "superadmin update restaurant users" on public.restaurant_users
  for update to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

drop policy if exists "users read own restaurant memberships" on public.restaurant_users;
create policy "users read own restaurant memberships" on public.restaurant_users
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_superadmin());

drop policy if exists "restaurant users read restaurant" on public.restaurants;
create policy "restaurant users read restaurant" on public.restaurants
  for select to authenticated
  using (public.has_restaurant_access(id));

drop policy if exists "superadmin delete restaurants" on public.restaurants;
create policy "superadmin delete restaurants" on public.restaurants
  for delete to authenticated
  using (public.is_superadmin());

drop policy if exists "superadmin insert restaurants" on public.restaurants;
create policy "superadmin insert restaurants" on public.restaurants
  for insert to authenticated
  with check (public.is_superadmin());

drop policy if exists "superadmin update restaurants" on public.restaurants;
create policy "superadmin update restaurants" on public.restaurants
  for update to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

drop policy if exists "restaurant users delete special dates" on public.special_dates;
create policy "restaurant users delete special dates" on public.special_dates
  for delete to authenticated
  using (public.has_restaurant_access(restaurant_id));

drop policy if exists "restaurant users insert special dates" on public.special_dates;
create policy "restaurant users insert special dates" on public.special_dates
  for insert to authenticated
  with check (public.has_restaurant_access(restaurant_id));

drop policy if exists "restaurant users read special dates" on public.special_dates;
create policy "restaurant users read special dates" on public.special_dates
  for select to authenticated
  using (public.has_restaurant_access(restaurant_id));

drop policy if exists "restaurant users update special dates" on public.special_dates;
create policy "restaurant users update special dates" on public.special_dates
  for update to authenticated
  using (public.has_restaurant_access(restaurant_id))
  with check (public.has_restaurant_access(restaurant_id));

drop policy if exists "restaurant users delete combination members" on public.table_combination_members;
create policy "restaurant users delete combination members" on public.table_combination_members
  for delete to authenticated
  using (exists (
    select 1
    from public.table_combinations tc
    where tc.id = table_combination_members.combination_id
      and public.has_restaurant_access(tc.restaurant_id)
  ));

drop policy if exists "restaurant users insert combination members" on public.table_combination_members;
create policy "restaurant users insert combination members" on public.table_combination_members
  for insert to authenticated
  with check (exists (
    select 1
    from public.table_combinations tc
    join public.restaurant_tables rt
      on rt.id = table_combination_members.table_id
    where tc.id = table_combination_members.combination_id
      and tc.restaurant_id = rt.restaurant_id
      and public.has_restaurant_access(tc.restaurant_id)
  ));

drop policy if exists "restaurant users read combination members" on public.table_combination_members;
create policy "restaurant users read combination members" on public.table_combination_members
  for select to authenticated
  using (exists (
    select 1
    from public.table_combinations tc
    where tc.id = table_combination_members.combination_id
      and public.has_restaurant_access(tc.restaurant_id)
  ));

drop policy if exists "restaurant users delete combinations" on public.table_combinations;
create policy "restaurant users delete combinations" on public.table_combinations
  for delete to authenticated
  using (public.has_restaurant_access(restaurant_id));

drop policy if exists "restaurant users insert combinations" on public.table_combinations;
create policy "restaurant users insert combinations" on public.table_combinations
  for insert to authenticated
  with check (public.has_restaurant_access(restaurant_id));

drop policy if exists "restaurant users read combinations" on public.table_combinations;
create policy "restaurant users read combinations" on public.table_combinations
  for select to authenticated
  using (public.has_restaurant_access(restaurant_id));

drop policy if exists "restaurant users update combinations" on public.table_combinations;
create policy "restaurant users update combinations" on public.table_combinations
  for update to authenticated
  using (public.has_restaurant_access(restaurant_id))
  with check (public.has_restaurant_access(restaurant_id));

drop policy if exists "users read own profile" on public.user_profiles;
create policy "users read own profile" on public.user_profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_superadmin());
