-- OPT-IN DEMO SEED. This is not a migration and is never run automatically.
-- Use only dedicated demo Auth accounts. Replace all UUID placeholders first.
-- Requires the base migrations through 20260101000006 and all 202611 migrations
-- through 20261111000004_dashboard_performance.sql, applied in timestamp order.
begin;

create temporary table _demo_user_map (
  role_key text primary key,
  user_id uuid not null unique
);

-- Create dedicated accounts in Supabase Auth first, then paste their user IDs here.
insert into _demo_user_map(role_key, user_id) values
  ('central_admin', 'def95993-f6fa-44c0-9147-7856193fb652'),
  ('franchise_owner', '4e402d24-83dd-4baf-a84f-28a218b5c769'),
  ('principal', '6b64732d-d174-400b-b2f0-c4dfb8fbb574'),
  ('teacher', '38b2e6f2-bf72-416d-a921-0c0613ddc634'),
  ('student', 'ae54f77f-258d-49ec-a972-16cdc04a1921');

do $$
begin
  if (select count(*) from _demo_user_map) <> 5
    or exists (select 1 from _demo_user_map m left join auth.users u on u.id = m.user_id where u.id is null) then
    raise exception 'Replace demo UUID placeholders with five distinct existing Supabase Auth user IDs.';
  end if;
end $$;

-- Idempotently create clearly-labelled demo network records.
insert into public.schools(code, name, city, state, address, academic_year, status, created_by)
select 'DEMO-GJ-001', '[DEMO] Gujarat Learning Centre', 'Ahmedabad', 'Gujarat', 'Demo campus address', '2026-27', 'active', user_id
from _demo_user_map where role_key = 'franchise_owner'
on conflict (code) do nothing;

insert into public.schools(code, name, city, state, address, academic_year, status, created_by)
select 'DEMO-GJ-002', '[DEMO] Surat Onboarding School', 'Surat', 'Gujarat', 'Demo campus address', '2026-27', 'onboarding', user_id
from _demo_user_map where role_key = 'franchise_owner'
on conflict (code) do nothing;

do $$
begin
  if exists (
    select 1 from public.schools
    where code in ('DEMO-GJ-001','DEMO-GJ-002') and name not like '[DEMO]%'
  ) then
    raise exception 'A demo school code is already used by a non-demo record. Rename the DEMO codes before seeding.';
  end if;
end $$;

insert into public.memberships(user_id, school_id, role)
select m.user_id, null, 'central_super_admin'::public.app_role
from _demo_user_map m
where m.role_key = 'central_admin'
  and not exists (select 1 from public.memberships existing where existing.user_id = m.user_id and existing.school_id is null and existing.role = 'central_super_admin');

insert into public.memberships(user_id, school_id, role)
select m.user_id, s.id, roles.role::public.app_role
from _demo_user_map m
cross join (values
  ('franchise_owner','franchise_owner','DEMO-GJ-001'), ('franchise_owner','franchise_owner','DEMO-GJ-002'),
  ('principal','school_principal','DEMO-GJ-001'), ('teacher','teacher','DEMO-GJ-001'), ('student','student','DEMO-GJ-001')
) roles(role_key, role, school_code)
join public.schools s on s.code = roles.school_code
where m.role_key = roles.role_key
  and not exists (
    select 1 from public.memberships existing
    where existing.user_id = m.user_id and existing.school_id = s.id and existing.role = roles.role::public.app_role
  );

-- Display names are changed only for the five explicitly supplied demo accounts.
insert into public.profiles(user_id, full_name, phone)
select m.user_id, names.full_name, ''
from _demo_user_map m
join (values
  ('central_admin','Demo Central Admin'), ('franchise_owner','Demo Franchise Owner'),
  ('principal','Demo Principal'), ('teacher','Demo Teacher'), ('student','Demo Student')
) names(role_key, full_name) on names.role_key = m.role_key
on conflict (user_id) do update set full_name = excluded.full_name, updated_at = now();

insert into public.classes(school_id, name, section, class_teacher)
select s.id, c.name, c.section, (select user_id from _demo_user_map where role_key = 'teacher')
from public.schools s
cross join (values ('Grade 5','A'), ('Grade 8','B')) c(name, section)
where s.code = 'DEMO-GJ-001'
on conflict (school_id, name, section) do update
set class_teacher = excluded.class_teacher;

-- A student Auth account can be linked to only one student row. Refuse to
-- reassign an existing real student to demo data; use a dedicated, unlinked
-- Auth account unless this is a rerun where it is already the demo student.
do $$
begin
  if exists (
    select 1
    from _demo_user_map mapped
    join public.students linked on linked.user_id = mapped.user_id
    left join public.schools demo_school on demo_school.code = 'DEMO-GJ-001'
    left join public.classes demo_class
      on demo_class.school_id = demo_school.id
      and demo_class.name = 'Grade 5'
      and demo_class.section = 'A'
    where mapped.role_key = 'student'
      and row(linked.school_id, linked.class_id, linked.roll_no)
        is distinct from row(
        demo_school.id, demo_class.id, 1
      )
  ) then
    raise exception 'The selected student Auth user is already linked to a different student record. Replace the student UUID in _demo_user_map with a dedicated Auth user that is not linked to a student, then rerun the seed.';
  end if;
end $$;

insert into public.students(school_id, class_id, full_name, roll_no, parent_name, parent_phone, status, user_id)
select s.id, c.id, roster.full_name, roster.roll_no, roster.parent_name, '', 'active',
  case
    when roster.class_name = 'Grade 5'
      and roster.section = 'A'
      and roster.roll_no = 1
    then (select user_id from _demo_user_map where role_key = 'student')
    else null
  end
from public.schools s
join public.classes c on c.school_id = s.id
cross join (values
  ('Grade 5','A','Demo Student',1,'Demo Parent'),
  ('Grade 5','A','Aarav Sample',2,'Sample Parent'),
  ('Grade 5','A','Ishita Sample',3,'Sample Parent'),
  ('Grade 8','B','Kabir Sample',1,'Sample Parent'),
  ('Grade 8','B','Myra Sample',2,'Sample Parent')
) roster(class_name, section, full_name, roll_no, parent_name)
where s.code = 'DEMO-GJ-001' and c.name = roster.class_name and c.section = roster.section
  and not exists (select 1 from public.students existing where existing.school_id = s.id and existing.class_id = c.id and existing.roll_no = roster.roll_no);

insert into public.attendance_records(school_id, class_id, student_id, att_date, status, marked_by)
select st.school_id, st.class_id, st.id, current_date, case when st.roll_no = 2 then 'absent' else 'present' end,
  (select user_id from _demo_user_map where role_key = 'teacher')
from public.students st
join public.schools s on s.id = st.school_id and s.code = 'DEMO-GJ-001'
where st.full_name in ('Demo Student','Aarav Sample','Ishita Sample','Kabir Sample','Myra Sample')
on conflict (student_id, att_date) do nothing;

insert into public.principal_tasks(user_id, title, category, due_date)
select m.user_id, 'Review demo class attendance', 'Academic', current_date + 2
from _demo_user_map m where m.role_key = 'principal'
  and not exists (select 1 from public.principal_tasks t where t.user_id = m.user_id and t.title = 'Review demo class attendance');

commit;
