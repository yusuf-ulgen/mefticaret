
create or replace function public.platform_settings_guard_public_keys()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.is_public, false) and new.key ~* '(secret|password|passwd|token|api[_-]?key|credential|private|iban|webhook|signature|client[_-]?secret)' then
    raise exception 'Hassas ayar anahtarı herkese açık olarak işaretlenemez: %', new.key
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists platform_settings_guard_public_keys on public.platform_settings;
create trigger platform_settings_guard_public_keys
before insert or update on public.platform_settings
for each row execute function public.platform_settings_guard_public_keys();

create or replace function public.connectors_guard_config_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  k text;
begin
  if new.config_fields is null then
    return new;
  end if;
  if jsonb_typeof(new.config_fields) <> 'array' then
    raise exception 'config_fields bir dizi olmalıdır' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements(new.config_fields) loop
    if jsonb_typeof(item) <> 'object' then
      raise exception 'config_fields öğeleri nesne olmalıdır' using errcode = '22023';
    end if;
    for k in select jsonb_object_keys(item) loop
      if k not in ('key','label','type','required','placeholder','help','options','group') then
        raise exception 'config_fields yalnızca form tanımı içerebilir, değer saklanamaz: %', k
          using errcode = '42501';
      end if;
    end loop;
  end loop;
  return new;
end;
$$;

drop trigger if exists connectors_guard_config_fields on public.connectors;
create trigger connectors_guard_config_fields
before insert or update on public.connectors
for each row execute function public.connectors_guard_config_fields();
