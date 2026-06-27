create table if not exists public.piggy_bank_admin_settings (
  setting text primary key,
  value text not null
);

insert into public.piggy_bank_admin_settings (setting, value)
values ('admin_hash', 'e9e894af57326d42d21e66047994a6160e567d02a8ab271715b13c64ad92b18b')
on conflict (setting) do update set value = excluded.value;

alter table public.piggy_bank_admin_settings enable row level security;

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

grant usage on schema public to anon;
grant execute on function public.pb_admin_list_classes(text) to anon;

notify pgrst, 'reload schema';

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'pb_admin_list_classes';
