-- Phase 2: school structure (classes, students, attendance) + demo school seed + fresh centre on signup

create sequence if not exists public.school_code_seq start 2;

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  section text not null default 'A',
  class_teacher uuid,
  created_at timestamptz not null default now(),
  unique (school_id, name, section)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  full_name text not null,
  roll_no int not null default 1,
  parent_name text not null default '',
  parent_phone text not null default '',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  att_date date not null default current_date,
  status text not null check (status in ('present','absent','late','leave')),
  marked_by uuid,
  created_at timestamptz not null default now(),
  unique (student_id, att_date)
);

create index classes_school_idx on public.classes(school_id);
create index students_school_idx on public.students(school_id);
create index students_class_idx on public.students(class_id);
create index attendance_school_date_idx on public.attendance_records(school_id, att_date);
create index attendance_class_date_idx on public.attendance_records(class_id, att_date);

create or replace function public.has_school_role(_school_id uuid, _roles public.app_role[])
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where school_id = _school_id and user_id = auth.uid() and role = any(_roles)
  )
$$;

grant select, insert, update, delete on public.classes to authenticated;
grant select, insert, update, delete on public.students to authenticated;
grant select, insert, update on public.attendance_records to authenticated;
grant all on public.classes to service_role;
grant all on public.students to service_role;
grant all on public.attendance_records to service_role;

alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.attendance_records enable row level security;

-- Classes: every school member reads; leadership manages
create policy "school members can view classes"
on public.classes for select to authenticated
using (public.is_school_member(school_id) or public.has_central_role());

create policy "school leadership manages classes"
on public.classes for all to authenticated
using (public.has_school_role(school_id, array['central_super_admin','central_ops_admin','franchise_owner','school_principal','admissions_staff']::public.app_role[]))
with check (public.has_school_role(school_id, array['central_super_admin','central_ops_admin','franchise_owner','school_principal','admissions_staff']::public.app_role[]));

-- Students: every school member reads; leadership manages
create policy "school members can view students"
on public.students for select to authenticated
using (public.is_school_member(school_id) or public.has_central_role());

create policy "school leadership manages students"
on public.students for all to authenticated
using (public.has_school_role(school_id, array['central_super_admin','central_ops_admin','franchise_owner','school_principal','admissions_staff']::public.app_role[]))
with check (public.has_school_role(school_id, array['central_super_admin','central_ops_admin','franchise_owner','school_principal','admissions_staff']::public.app_role[]));

-- Attendance: any school member can view and mark (teachers included)
create policy "school members can view attendance"
on public.attendance_records for select to authenticated
using (public.is_school_member(school_id) or public.has_central_role());

create policy "school members mark attendance"
on public.attendance_records for insert to authenticated
with check (public.is_school_member(school_id));

create policy "school members update attendance"
on public.attendance_records for update to authenticated
using (public.is_school_member(school_id))
with check (public.is_school_member(school_id));

-- ---- Demo school for the designated demo account (clearly-labelled sample data) ----
insert into public.schools (code, name, city, state, address, academic_year, status, created_by)
values (
  'CEN-001',
  'The Centennial School – Bhiwadi',
  'Bhiwadi',
  'Rajasthan',
  'Plot 14, Industrial Area, Bhiwadi',
  '2026-27',
  'active',
  (select id from auth.users where email = 'abhishekprajapati2422008@gmail.com')
)
on conflict (code) do nothing;

insert into public.memberships (user_id, school_id, role)
select u.id, s.id, 'franchise_owner'
from auth.users u, public.schools s
where u.email = 'abhishekprajapati2422008@gmail.com' and s.code = 'CEN-001'
on conflict do nothing;

insert into public.classes (school_id, name, section)
select s.id, v.name, v.section
from public.schools s,
(values ('Nursery','A'),('Class 1','A'),('Class 5','A'),('Class 9','A'),('Class 10','B')) as v(name, section)
where s.code = 'CEN-001';

with cls as (
  select c.*, row_number() over (order by c.created_at, c.name) as ord
  from public.classes c
  where c.school_id = (select id from public.schools where code = 'CEN-001')
)
insert into public.students (school_id, class_id, full_name, roll_no, parent_name, parent_phone)
select cls.school_id, cls.id, n.full_name, n.rn, 'Mr. ' || split_part(n.full_name, ' ', 2),
       '+91 98' || lpad((((cls.ord * 7919 + n.rn * 137) % 99999999))::text, 8, '0')
from cls
cross join (values ('Aarav Sharma',1),('Ishita Verma',2),('Kabir Nanda',3),('Myra Joshi',4),('Reyansh Gupta',5),('Anaya Mehta',6)) as n(full_name, rn);

-- ---- Fresh centre for every new signup: a school plus an owner membership is ----
-- ---- created server-side on account creation; the browser never sends school/role. ----
create or replace function public.handle_new_user_centre()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare new_school_id uuid;
begin
  if not exists (select 1 from public.memberships where user_id = new.id) then
    insert into public.schools (code, name, city, state, academic_year, status, created_by)
    values (
      'CEN-' || lpad(nextval('public.school_code_seq')::text, 4, '0'),
      coalesce(nullif(new.raw_user_meta_data->>'centre_name',''), 'My Centre'),
      coalesce(new.raw_user_meta_data->>'city',''),
      coalesce(new.raw_user_meta_data->>'state',''),
      coalesce(nullif(new.raw_user_meta_data->>'academic_year',''), '2026-27'),
      'onboarding',
      new.id
    )
    returning id into new_school_id;
    insert into public.memberships (user_id, school_id, role)
    values (new.id, new_school_id, 'franchise_owner');
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created_centre on auth.users;
create trigger on_auth_user_created_centre
after insert on auth.users
for each row execute function public.handle_new_user_centre();
