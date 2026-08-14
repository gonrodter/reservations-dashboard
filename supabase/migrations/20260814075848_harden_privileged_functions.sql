-- Keep RLS helper functions outside the exposed Data API schema. Authenticated
-- users need to execute them while Postgres evaluates policies, but clients
-- cannot invoke functions in this unexposed schema through /rest/v1/rpc.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

alter function public.is_superadmin() set schema private;
alter function public.has_restaurant_access(uuid) set schema private;

create or replace function private.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_profiles
    where id = (select auth.uid())
      and global_role = 'superadmin'
  );
$$;

create or replace function private.has_restaurant_access(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.is_superadmin())
    or exists (
      select 1
      from public.restaurant_users
      where user_id = (select auth.uid())
        and restaurant_id = p_restaurant_id
    );
$$;

revoke execute on function private.is_superadmin() from public, anon;
revoke execute on function private.has_restaurant_access(uuid) from public, anon;
grant execute on function private.is_superadmin() to authenticated, service_role;
grant execute on function private.has_restaurant_access(uuid) to authenticated, service_role;

-- n8n uses an sb_secret key, which maps to service_role. These reservation
-- functions therefore do not need to be callable directly by public clients.
alter function public.create_booking_atomic(
  uuid,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  integer,
  text
) set search_path = '';

revoke execute on function public.create_booking_atomic(
  uuid,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  integer,
  text
) from public, anon, authenticated;

grant execute on function public.create_booking_atomic(
  uuid,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  integer,
  text
) to service_role;

alter function public.update_booking_atomic(
  uuid,
  uuid,
  text,
  timestamptz,
  timestamptz,
  integer
) set search_path = '';

revoke execute on function public.update_booking_atomic(
  uuid,
  uuid,
  text,
  timestamptz,
  timestamptz,
  integer
) from public, anon, authenticated;

grant execute on function public.update_booking_atomic(
  uuid,
  uuid,
  text,
  timestamptz,
  timestamptz,
  integer
) to service_role;

-- Trigger and event-trigger functions are never legitimate RPC endpoints.
alter function public.set_updated_at() set search_path = '';
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
