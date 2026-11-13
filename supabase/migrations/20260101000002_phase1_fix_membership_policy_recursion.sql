-- Fix: 'school leadership can view school members' policy queried the same
-- table it protected, causing RLS infinite recursion. Move the check into a
-- security-definer helper and reference it from the policy instead.

drop policy if exists "school leadership can view school members" on public.memberships;

create or replace function public.can_view_school_members(_school_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.memberships me
    where me.user_id = auth.uid()
      and (
        me.role in ('central_super_admin','central_ops_admin')
        or (
          me.role in ('franchise_owner','school_principal')
          and me.school_id = _school_id
        )
      )
  )
$$;

create policy "school leadership can view school members"
on public.memberships for select to authenticated
using (public.can_view_school_members(school_id));
