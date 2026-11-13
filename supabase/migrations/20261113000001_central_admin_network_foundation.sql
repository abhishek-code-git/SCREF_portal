-- Add the organization relationships needed by Central Admin while preserving
-- existing school and membership rows. Existing schools are intentionally not
-- assigned to a franchise because the current schema contains no reliable map.

create table if not exists public.master_franchises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'suspended', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.master_franchise_territories (
  id uuid primary key default gen_random_uuid(),
  master_franchise_id uuid not null references public.master_franchises(id) on delete restrict,
  territory text not null,
  created_at timestamptz not null default now(),
  unique (master_franchise_id, territory)
);

create table if not exists public.franchises (
  id uuid primary key default gen_random_uuid(),
  master_franchise_id uuid not null references public.master_franchises(id) on delete restrict,
  territory_id uuid,
  name text not null,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'suspended', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.master_franchise_territories
  add constraint master_franchise_territories_master_id_id_key unique (master_franchise_id, id);
alter table public.franchises
  add constraint franchises_territory_master_fkey
  foreign key (master_franchise_id, territory_id)
  references public.master_franchise_territories(master_franchise_id, id)
  on delete restrict;

alter table public.schools
  add column if not exists franchise_id uuid references public.franchises(id) on delete restrict;

alter table public.memberships
  add column if not exists master_franchise_id uuid references public.master_franchises(id) on delete restrict,
  add column if not exists franchise_id uuid references public.franchises(id) on delete restrict;

-- Legacy school-scoped franchise_owner memberships remain valid. New network
-- memberships use master_franchise_id or franchise_id. Central memberships
-- may remain global or school-scoped as in the existing model. NOT VALID
-- preserves legacy rows while enforcing the invariant for new or updated rows.
alter table public.memberships
  drop constraint if exists memberships_organization_scope_check;
alter table public.memberships
  add constraint memberships_organization_scope_check check (
    num_nonnulls(school_id, master_franchise_id, franchise_id) <= 1
    and (
      role in ('central_super_admin', 'central_ops_admin')
      or
      (role not in ('central_super_admin', 'central_ops_admin')
        and num_nonnulls(school_id, master_franchise_id, franchise_id) = 1)
    )
    and (
      (master_franchise_id is null and franchise_id is null)
      or role = 'franchise_owner'
    )
  ) not valid;

create unique index if not exists memberships_user_master_role_unique_idx
  on public.memberships(user_id, master_franchise_id, role)
  where master_franchise_id is not null;
create unique index if not exists memberships_user_franchise_role_unique_idx
  on public.memberships(user_id, franchise_id, role)
  where franchise_id is not null;
create index if not exists franchises_master_status_idx
  on public.franchises(master_franchise_id, status, created_at desc);
create index if not exists territories_master_idx
  on public.master_franchise_territories(master_franchise_id);
create index if not exists schools_franchise_status_idx
  on public.schools(franchise_id, status, created_at desc);
create index if not exists memberships_master_user_role_idx
  on public.memberships(master_franchise_id, user_id, role)
  where master_franchise_id is not null;
create index if not exists memberships_franchise_user_role_idx
  on public.memberships(franchise_id, user_id, role)
  where franchise_id is not null;

create or replace function public.touch_network_updated_at()
returns trigger
language plpgsql set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

revoke all on function public.touch_network_updated_at() from public;
drop trigger if exists master_franchises_touch_updated_at on public.master_franchises;
create trigger master_franchises_touch_updated_at
before update on public.master_franchises
for each row execute function public.touch_network_updated_at();
drop trigger if exists franchises_touch_updated_at on public.franchises;
create trigger franchises_touch_updated_at
before update on public.franchises
for each row execute function public.touch_network_updated_at();

create or replace function public.can_access_master_franchise(_master_franchise_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_central_role() or exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and m.master_franchise_id = _master_franchise_id
      and m.role = 'franchise_owner'
  )
$$;

create or replace function public.can_access_franchise(_franchise_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_central_role() or exists (
    select 1
    from public.franchises f
    left join public.memberships direct_member
      on direct_member.franchise_id = f.id
      and direct_member.user_id = auth.uid()
      and direct_member.role = 'franchise_owner'
    where f.id = _franchise_id
      and (
        direct_member.id is not null
        or public.can_access_master_franchise(f.master_franchise_id)
      )
  )
$$;

create or replace function public.can_access_school_network(_school_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_central_role()
    or public.is_school_member(_school_id)
    or exists (
      select 1
      from public.schools s
      where s.id = _school_id
        and s.franchise_id is not null
        and public.can_access_franchise(s.franchise_id)
    )
$$;

revoke all on function public.can_access_master_franchise(uuid) from public;
revoke all on function public.can_access_franchise(uuid) from public;
revoke all on function public.can_access_school_network(uuid) from public;
grant execute on function public.can_access_master_franchise(uuid) to authenticated;
grant execute on function public.can_access_franchise(uuid) to authenticated;
grant execute on function public.can_access_school_network(uuid) to authenticated;

grant select, insert, update, delete on public.master_franchises to authenticated;
grant select, insert, update, delete on public.master_franchise_territories to authenticated;
grant select, insert, update, delete on public.franchises to authenticated;
grant all on public.master_franchises to service_role;
grant all on public.master_franchise_territories to service_role;
grant all on public.franchises to service_role;

alter table public.master_franchises enable row level security;
alter table public.master_franchise_territories enable row level security;
alter table public.franchises enable row level security;

drop policy if exists "central admins manage master franchises" on public.master_franchises;
create policy "central admins manage master franchises"
on public.master_franchises for all to authenticated
using (public.has_central_role())
with check (public.has_central_role());
drop policy if exists "assigned users view master franchises" on public.master_franchises;
create policy "assigned users view master franchises"
on public.master_franchises for select to authenticated
using (public.can_access_master_franchise(id));

drop policy if exists "central admins manage territories" on public.master_franchise_territories;
create policy "central admins manage territories"
on public.master_franchise_territories for all to authenticated
using (public.has_central_role())
with check (public.has_central_role());
drop policy if exists "assigned users view territories" on public.master_franchise_territories;
create policy "assigned users view territories"
on public.master_franchise_territories for select to authenticated
using (public.can_access_master_franchise(master_franchise_id));

drop policy if exists "central admins manage franchises" on public.franchises;
create policy "central admins manage franchises"
on public.franchises for all to authenticated
using (public.has_central_role())
with check (public.has_central_role());
drop policy if exists "assigned users view franchises" on public.franchises;
create policy "assigned users view franchises"
on public.franchises for select to authenticated
using (public.can_access_franchise(id));

-- Keep existing school-level access and add visibility through explicitly
-- assigned franchise or master-franchise memberships. School writes remain
-- restricted to Central Admin by the existing management policy.
drop policy if exists "members and central admins can view schools" on public.schools;
create policy "members and assigned network users can view schools"
on public.schools for select to authenticated
using (public.can_access_school_network(id));

drop policy if exists "network leaders view assigned memberships" on public.memberships;
create policy "network leaders view assigned memberships"
on public.memberships for select to authenticated
using (
  (school_id is not null and public.can_access_school_network(school_id))
  or (franchise_id is not null and public.can_access_franchise(franchise_id))
  or (master_franchise_id is not null and public.can_access_master_franchise(master_franchise_id))
);

drop policy if exists "network leaders view assigned profiles" on public.profiles;
create policy "network leaders view assigned profiles"
on public.profiles for select to authenticated
using (
  public.has_central_role()
  or
  exists (
    select 1 from public.memberships m
    where m.user_id = profiles.user_id
      and (
        (m.school_id is not null and public.can_access_school_network(m.school_id))
        or (m.franchise_id is not null and public.can_access_franchise(m.franchise_id))
        or (m.master_franchise_id is not null and public.can_access_master_franchise(m.master_franchise_id))
      )
  )
);
