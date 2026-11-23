-- Keep inactive master owners able to see their own status and network summaries,
-- while removing all owner write access until Central Admin reactivates the network.
create or replace function public.can_access_master_franchise(_master_franchise_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_central_role() or exists (
    select 1 from public.memberships m
    where m.master_franchise_id = _master_franchise_id
      and m.user_id = auth.uid()
      and m.role = 'franchise_owner'
  )
$$;

drop policy if exists "master owners manage network people" on public.memberships;
create policy "master owners manage network people"
on public.memberships for all to authenticated
using (
  (role = 'franchise_owner' and franchise_id is not null
     and public.is_master_owner_of_franchise(franchise_id)
     and exists (
       select 1 from public.franchises f join public.master_franchises mf on mf.id = f.master_franchise_id
       where f.id = franchise_id and f.status = 'active' and mf.status = 'active'
     ))
  or
  (role = 'school_principal' and school_id is not null
     and public.is_master_owner_of_school(school_id)
     and exists (
       select 1 from public.schools s join public.franchises f on f.id = s.franchise_id
       join public.master_franchises mf on mf.id = f.master_franchise_id
       where s.id = school_id and s.status = 'active' and f.status = 'active' and mf.status = 'active'
     ))
)
with check (
  (role = 'franchise_owner' and franchise_id is not null
     and public.is_master_owner_of_franchise(franchise_id)
     and exists (
       select 1 from public.franchises f join public.master_franchises mf on mf.id = f.master_franchise_id
       where f.id = franchise_id and f.status = 'active' and mf.status = 'active'
     ))
  or
  (role = 'school_principal' and school_id is not null
     and public.is_master_owner_of_school(school_id)
     and exists (
       select 1 from public.schools s join public.franchises f on f.id = s.franchise_id
       join public.master_franchises mf on mf.id = f.master_franchise_id
       where s.id = school_id and s.status = 'active' and f.status = 'active' and mf.status = 'active'
     ))
);

-- Network owners only need owner/principal roster rows. School principals retain
-- the school-level membership visibility required by existing school workflows.
drop policy if exists "network leaders view assigned memberships" on public.memberships;
create policy "network leaders view assigned memberships"
on public.memberships for select to authenticated
using (
  public.has_central_role()
  or (
    role in ('franchise_owner', 'school_principal')
    and (
      (master_franchise_id is not null and public.can_access_master_franchise(master_franchise_id))
      or (franchise_id is not null and public.can_access_franchise(franchise_id))
      or (school_id is not null and public.can_access_school_network(school_id))
    )
  )
  or (
    school_id is not null
    and public.has_school_role(school_id, array['school_principal'::public.app_role])
  )
);

drop policy if exists "network leaders view assigned profiles" on public.profiles;
create policy "network leaders view assigned profiles"
on public.profiles for select to authenticated
using (
  public.has_central_role()
  or profiles.user_id = auth.uid()
  or exists (
    select 1 from public.memberships m
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
      )
  )
);

-- Master owners need the default year for school-request forms, but no other settings.
drop policy if exists "master owners read default academic year" on public.network_settings;
create policy "master owners read default academic year"
on public.network_settings for select to authenticated
using (setting_key = 'default_academic_year' and public.is_master_owner((
  select m.master_franchise_id from public.memberships m
  where m.user_id = auth.uid() and m.role = 'franchise_owner' and m.master_franchise_id is not null
  limit 1
)));
