create table if not exists public.piggy_bank_classes (
  class_code text primary key,
  pin_hash text not null,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.piggy_bank_admin_settings (
  setting text primary key,
  value text not null
);

insert into public.piggy_bank_admin_settings (setting, value)
values ('admin_hash', 'e9e894af57326d42d21e66047994a6160e567d02a8ab271715b13c64ad92b18b')
on conflict (setting) do nothing;

alter table public.piggy_bank_classes enable row level security;
alter table public.piggy_bank_admin_settings enable row level security;

create or replace function public.pb_load_class(
  p_class_code text,
  p_pin_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data public.piggy_bank_classes;
begin
  select *
    into row_data
    from public.piggy_bank_classes
    where class_code = upper(trim(p_class_code));

  if not found then
    return jsonb_build_object('status', 'new');
  end if;

  if row_data.pin_hash <> p_pin_hash then
    return jsonb_build_object('status', 'bad_pin');
  end if;

  return jsonb_build_object(
    'status', 'found',
    'state', row_data.state,
    'updated_at', row_data.updated_at
  );
end;
$$;

create or replace function public.pb_save_class(
  p_class_code text,
  p_pin_hash text,
  p_state jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_hash text;
begin
  select pin_hash
    into existing_hash
    from public.piggy_bank_classes
    where class_code = upper(trim(p_class_code));

  if found and existing_hash <> p_pin_hash then
    return jsonb_build_object('status', 'bad_pin');
  end if;

  insert into public.piggy_bank_classes (class_code, pin_hash, state, updated_at)
  values (upper(trim(p_class_code)), p_pin_hash, p_state, now())
  on conflict (class_code) do update
    set state = excluded.state,
        updated_at = now();

  return jsonb_build_object('status', 'saved');
end;
$$;

create or replace function public.pb_admin_list_classes(
  p_admin_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  expected_hash text;
begin
  select value
    into expected_hash
    from public.piggy_bank_admin_settings
    where setting = 'admin_hash';

  if expected_hash is null or expected_hash <> p_admin_hash then
    return jsonb_build_object('status', 'bad_admin');
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'classes',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'class_code', class_code,
            'state', state,
            'updated_at', updated_at
          )
          order by updated_at desc
        )
        from public.piggy_bank_classes
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.pb_load_class(text, text) to anon;
grant execute on function public.pb_save_class(text, text, jsonb) to anon;
grant execute on function public.pb_admin_list_classes(text) to anon;
