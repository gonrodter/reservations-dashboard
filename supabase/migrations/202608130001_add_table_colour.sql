alter table restaurant_tables
  add column if not exists colour text;

alter table restaurant_tables
  drop constraint if exists restaurant_tables_colour_check;

alter table restaurant_tables
  add constraint restaurant_tables_colour_check
  check (
    colour is null or colour in (
      'teal',
      'green',
      'olive',
      'amber',
      'orange',
      'clay',
      'rose',
      'magenta',
      'purple',
      'brown'
    )
  );
