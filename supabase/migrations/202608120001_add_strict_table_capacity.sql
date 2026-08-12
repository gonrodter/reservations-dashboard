alter table public.restaurant_settings
  add column if not exists strict_table_capacity boolean not null default false;

comment on column public.restaurant_settings.strict_table_capacity is
  'When true, a party may only use a table with exact capacity or one spare seat.';
