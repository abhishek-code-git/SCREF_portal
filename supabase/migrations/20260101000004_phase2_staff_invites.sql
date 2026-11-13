create table public.staff_invites (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  email text not null,
  role public.app_role not null default 'teacher',
  class_id uuid references public.classes(id) on delete set null,
  invited_by uuid default auth.uid(),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (school_id, email)
);

grant select, insert, delete on public.staff_invites to authenticated;
grant all on public.staff_invites to service_role;
alter table public.staff_invites enable row level security;

create policy "leadership views invites" on public.staff_invites for select to authenticated
using (public.has_school_role(school_id, array['central_super_admin','central_ops_admin','franchise_owner','school_principal']::public.app_role[]) or public.has_central_role());

create policy "leadership creates staff invites" on public.staff_invites for insert to authenticated
with check (
  public.has_school_role(school_id, array['franchise_owner','school_principal']::public.app_role[])
  and role in ('teacher','admissions_staff','accountant','transport_manager','school_principal')
);

create policy "leadership deletes pending invites" on public.staff_invites for delete to authenticated
using (accepted_at is null and public.has_school_role(school_id, array['franchise_owner','school_principal']::public.app_role[]));

create or replace function public.handle_new_user_centre()
returns trigger language plpgsql security definer set search_path = public
as $$
declare new_school_id uuid; inv record; found_invite boolean := false;
begin
  for inv in select * from public.staff_invites where lower(email) = lower(new.email) and accepted_at is null loop
    found_invite := true;
    insert into public.memberships (user_id, school_id, role) values (new.id, inv.school_id, inv.role) on conflict do nothing;
    if inv.class_id is not null and inv.role = 'teacher' then
      update public.classes set class_teacher = new.id where id = inv.class_id and class_teacher is null;
    end if;
    update public.staff_invites set accepted_at = now() where id = inv.id;
  end loop;

  if not found_invite and not exists (select 1 from public.memberships where user_id = new.id) then
    insert into public.schools (code, name, city, state, academic_year, status, created_by)
    values ('CEN-' || lpad(nextval('public.school_code_seq')::text, 4, '0'),
      coalesce(nullif(new.raw_user_meta_data->>'centre_name',''), 'My Centre'),
      coalesce(new.raw_user_meta_data->>'city',''), coalesce(new.raw_user_meta_data->>'state',''),
      coalesce(nullif(new.raw_user_meta_data->>'academic_year',''), '2026-27'), 'onboarding', new.id)
    returning id into new_school_id;
    insert into public.memberships (user_id, school_id, role) values (new.id, new_school_id, 'franchise_owner');
  end if;
  return new;
end $$;