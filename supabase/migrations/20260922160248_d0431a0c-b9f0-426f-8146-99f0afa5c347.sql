alter table public.xml_import_logs
  add column if not exists processed_count integer not null default 0,
  add column if not exists phase text,
  add column if not exists error_categories jsonb not null default '{}'::jsonb;

alter table public.xml_export_logs
  add column if not exists processed_count integer not null default 0,
  add column if not exists phase text,
  add column if not exists error_categories jsonb not null default '{}'::jsonb;