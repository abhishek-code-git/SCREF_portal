-- Phase 1: school + membership model with school-scoped security

create type public.app_role as enum (
  'central_super_admin',
  'central_ops_admin',
  'franchise_owner',
  'school_principal',
  'admissions_staff',
  'teacher',
  'accountant',
  'transport_manager',
  'parent',
  'student'
);

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  city text not null default '',
  state text not null default '',
  address text not null default '',
  academic_year text not null default '2026-27',
  status text not null default 'active' check (status in ('active','onboarding','suspended')),
  created_by uuid,
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  school_id uuid references public.schools(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, school_id, role)
);

create index memberships_user_idx on public.memberships(user_id);
create index memberships_school_idx on public.memberships(school_id);

-- Security-definer helpers (must exist before policies reference them)
create or replace function public.has_central_role()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid()
      and role in ('central_super_admin','central_ops_admin')
  )
$$;

create or replace function public.is_school_member(_school_id uuid, _user_id uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where school_id = _school_id and user_id = _user_id
  )
$$;

create or replace function public.user_school_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select school_id from public.memberships where user_id = auth.uid()
$$;

-- Grants (Data API has no default privileges on public)
grant select, insert, update, delete on public.schools to authenticated;
grant select, insert, update, delete on public.memberships to authenticated;
grant all on public.schools to service_role;
grant all on public.memberships to service_role;

alter table public.schools enable row level security;
alter table public.memberships enable row level security;

-- Schools: members read their school; central admins manage everything
create policy "members and central admins can view schools"
on public.schools for select to authenticated
using (public.is_school_member(id) or public.has_central_role());

create policy "central admins manage schools"
on public.schools for all to authenticated
using (public.has_central_role())
with check (public.has_central_role());

-- Memberships: users see their own; school leadership sees their school's staff;
-- every mutation is restricted to central admins (never browser-sent roles)
create policy "users can view own memberships"
on public.memberships for select to authenticated
using (user_id = auth.uid());

create policy "school leadership can view school members"
on public.memberships for select to authenticated
using (
  exists (
    select 1 from public.memberships me
    where me.user_id = auth.uid()
      and (
        me.role in ('central_super_admin','central_ops_admin')
        or (
          me.role in ('franchise_owner','school_principal')
          and me.school_id = school_id
        )
      )
  )
);

create policy "central admins manage memberships"
on public.memberships for all to authenticated
using (public.has_central_role())
with check (public.has_central_role());
