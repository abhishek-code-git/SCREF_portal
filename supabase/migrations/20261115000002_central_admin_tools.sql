-- Central Admin workflows: audited changes, network settings, and school decline status.
-- Does not modify existing records or create demo data.

alter table public.schools drop constraint if exists schools_status_check;
alter table public.schools add constraint schools_status_check
  check (status in ('active', 'onboarding', 'suspended', 'rejected'));

create table if not exists public.central_admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  action text not null,
  entity_table text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists central_admin_audit_created_idx
  on public.central_admin_audit_logs(created_at desc);
create index if not exists central_admin_audit_entity_idx
  on public.central_admin_audit_logs(entity_table, entity_id, created_at desc);
grant select on public.central_admin_audit_logs to authenticated;
grant all on public.central_admin_audit_logs to service_role;
alter table public.central_admin_audit_logs enable row level security;
drop policy if exists "central admins read audit logs" on public.central_admin_audit_logs;
create policy "central admins read audit logs"
  on public.central_admin_audit_logs for select to authenticated
  using (public.has_central_role());

create table if not exists public.network_settings (
  setting_key text primary key check (setting_key in ('network_name', 'default_academic_year', 'support_email', 'support_phone')),
  setting_value jsonb not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.network_settings to authenticated;
grant all on public.network_settings to service_role;
alter table public.network_settings enable row level security;
drop policy if exists "central admins manage network settings" on public.network_settings;
create policy "central admins manage network settings"
  on public.network_settings for all to authenticated
  using (public.has_central_role())
  with check (public.has_central_role());

create or replace function public.audit_central_admin_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_row jsonb := '{}'::jsonb;
  new_row jsonb := '{}'::jsonb;
  row_id uuid;
begin
  if not public.has_central_role() or auth.uid() is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if tg_op <> 'INSERT' then old_row := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then new_row := to_jsonb(new); end if;
  row_id := nullif(coalesce(new_row->>'id', new_row->>'user_id', old_row->>'id', old_row->>'user_id'), '')::uuid;

  insert into public.central_admin_audit_logs(actor_user_id, action, entity_table, entity_id, details)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    row_id,
    jsonb_strip_nulls(jsonb_build_object(
      'name', coalesce(new_row->>'name', old_row->>'name'),
      'status', coalesce(new_row->>'status', old_row->>'status'),
      'previous_status', case when tg_op = 'UPDATE' then old_row->>'status' end,
      'role', coalesce(new_row->>'role', old_row->>'role'),
      'previous_role', case when tg_op = 'UPDATE' then old_row->>'role' end,
      'school_id', coalesce(new_row->>'school_id', old_row->>'school_id'),
      'previous_school_id', case when tg_op = 'UPDATE' then old_row->>'school_id' end,
      'master_franchise_id', coalesce(new_row->>'master_franchise_id', old_row->>'master_franchise_id'),
      'previous_master_franchise_id', case when tg_op = 'UPDATE' then old_row->>'master_franchise_id' end,
      'franchise_id', coalesce(new_row->>'franchise_id', old_row->>'franchise_id'),
      'previous_franchise_id', case when tg_op = 'UPDATE' then old_row->>'franchise_id' end,
      'setting_key', coalesce(new_row->>'setting_key', old_row->>'setting_key'),
      'territory', coalesce(new_row->>'territory', old_row->>'territory')
    ))
  );
  if tg_op = 'DELETE' then return old; else return new; end if;
end
$$;
revoke all on function public.audit_central_admin_change() from public;

drop trigger if exists central_audit_memberships on public.memberships;
create trigger central_audit_memberships after insert or update or delete on public.memberships
  for each row execute function public.audit_central_admin_change();
drop trigger if exists central_audit_schools on public.schools;
create trigger central_audit_schools after insert or update or delete on public.schools
  for each row execute function public.audit_central_admin_change();
drop trigger if exists central_audit_master_franchises on public.master_franchises;
create trigger central_audit_master_franchises after insert or update or delete on public.master_franchises
  for each row execute function public.audit_central_admin_change();
drop trigger if exists central_audit_franchises on public.franchises;
create trigger central_audit_franchises after insert or update or delete on public.franchises
  for each row execute function public.audit_central_admin_change();
drop trigger if exists central_audit_territories on public.master_franchise_territories;
create trigger central_audit_territories after insert or update or delete on public.master_franchise_territories
  for each row execute function public.audit_central_admin_change();
drop trigger if exists central_audit_network_settings on public.network_settings;
create trigger central_audit_network_settings after insert or update or delete on public.network_settings
  for each row execute function public.audit_central_admin_change();
