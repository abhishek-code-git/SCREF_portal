-- Franchisee dashboard scope and roster reads.
-- This migration returns only the franchise identity/status required to render a
-- read-only dashboard state. It does not grant a franchisee access to a sibling
-- franchise or to unrestricted profile data.

create or replace function public.franchise_dashboard_scope(_franchise_id uuid)
returns table (
  id uuid,
  name text,
  status text,
  master_status text
)
language sql stable security definer set search_path = public
as $$
  select f.id, f.name, f.status, mf.status
  from public.franchises f
  join public.master_franchises mf on mf.id = f.master_franchise_id
  where f.id = _franchise_id
    and (
      public.has_central_role()
      or exists (
        select 1 from public.memberships m
        where m.user_id = auth.uid()
          and m.role = 'franchise_owner'
          and (m.franchise_id = f.id or m.master_franchise_id = f.master_franchise_id)
      )
    );
$$;

revoke all on function public.franchise_dashboard_scope(uuid) from public;
grant execute on function public.franchise_dashboard_scope(uuid) to authenticated;

-- A franchise owner needs names and phone numbers only for people assigned to
-- schools in their own active franchise. The existing school and central rules
-- remain intact; this adds the missing franchise-scoped roster path.
drop policy if exists "network leaders view assigned profiles" on public.profiles;
create policy "network leaders view assigned profiles"
on public.profiles for select to authenticated
using (
  public.has_central_role()
  or profiles.user_id = auth.uid()
  or exists (
    select 1
    from public.memberships m
    where m.user_id = profiles.user_id
      and (
        (m.school_id is not null and public.has_school_role(m.school_id, array['school_principal'::public.app_role]))
        or (
          m.role in ('franchise_owner', 'school_principal')
          and (
            (m.master_franchise_id is not null and public.can_access_master_franchise(m.master_franchise_id))
            or (m.franchise_id is not null and public.can_access_franchise(m.franchise_id))
            or (m.school_id is not null and public.can_access_school_network(m.school_id))
          )
        )
        or (
          m.role in ('teacher', 'admissions_staff', 'accountant', 'transport_manager')
          and m.school_id is not null
          and public.is_franchise_owner_of_school(m.school_id)
        )
      )
  )
);

-- The request-school form reads just the network default academic year. It is
-- available only to owners of an active franchise in an active master network.
drop policy if exists "franchise owners read default academic year" on public.network_settings;
create policy "franchise owners read default academic year"
on public.network_settings for select to authenticated
using (
  setting_key = 'default_academic_year'
  and exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and m.role = 'franchise_owner'
      and m.franchise_id is not null
      and public.franchise_is_open(m.franchise_id)
  )
);
