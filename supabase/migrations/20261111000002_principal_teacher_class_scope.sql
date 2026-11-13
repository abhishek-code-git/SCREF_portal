-- Principal/teacher foundation: normalize teacher assignments and enforce class scope in RLS.
-- Existing classes.class_teacher rows are preserved and copied into the assignment table.

create unique index if not exists classes_id_school_id_scope_idx on public.classes(id, school_id);

create table if not exists public.class_teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null,
  teacher_user_id uuid not null references auth.users(id) on delete cascade,
  subject_name text not null default 'Class teacher',
  is_active boolean not null default true,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (class_id, teacher_user_id, subject_name),
  foreign key (class_id, school_id) references public.classes(id, school_id) on delete cascade
);

create index if not exists class_teacher_assignments_teacher_idx
  on public.class_teacher_assignments(teacher_user_id, school_id) where is_active;
create index if not exists class_teacher_assignments_class_idx
  on public.class_teacher_assignments(class_id) where is_active;

insert into public.class_teacher_assignments(school_id, class_id, teacher_user_id)
select c.school_id, c.id, c.class_teacher
from public.classes c
where c.class_teacher is not null
on conflict (class_id, teacher_user_id, subject_name) do nothing;

create or replace function public.sync_class_teacher_assignment()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.class_teacher is not distinct from new.class_teacher then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.class_teacher is not null then
    update public.class_teacher_assignments
      set is_active = false
      where class_id = old.id and teacher_user_id = old.class_teacher
        and subject_name = 'Class teacher' and is_active;
  end if;
  if new.class_teacher is not null then
    insert into public.class_teacher_assignments(school_id, class_id, teacher_user_id, subject_name, is_active)
    values (new.school_id, new.id, new.class_teacher, 'Class teacher', true)
    on conflict (class_id, teacher_user_id, subject_name)
    do update set school_id = excluded.school_id, is_active = true;
  end if;
  return new;
end $$;

drop trigger if exists sync_class_teacher_assignment on public.classes;
create trigger sync_class_teacher_assignment
after insert or update of class_teacher on public.classes
for each row execute function public.sync_class_teacher_assignment();

alter table public.class_teacher_assignments enable row level security;
grant select, insert, update, delete on public.class_teacher_assignments to authenticated;

drop policy if exists "teacher assignment select" on public.class_teacher_assignments;
create policy "teacher assignment select" on public.class_teacher_assignments for select to authenticated
using (
  teacher_user_id = auth.uid()
  or public.has_school_role(school_id, array['central_super_admin','central_ops_admin','franchise_owner','school_principal']::public.app_role[])
  or public.has_central_role()
);

drop policy if exists "school leadership manages teacher assignments" on public.class_teacher_assignments;
create policy "school leadership manages teacher assignments" on public.class_teacher_assignments for all to authenticated
using (
  public.has_school_role(school_id, array['central_super_admin','central_ops_admin','franchise_owner','school_principal']::public.app_role[])
  or public.has_central_role()
)
with check (
  public.has_school_role(school_id, array['central_super_admin','central_ops_admin','franchise_owner','school_principal']::public.app_role[])
  or public.has_central_role()
);

create or replace function public.can_access_class(_class_id uuid, _school_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.classes c
    where c.id = _class_id and c.school_id = _school_id
      and (
        public.has_central_role()
        or public.has_school_role(_school_id, array['central_super_admin','central_ops_admin','franchise_owner','school_principal','admissions_staff','accountant','transport_manager']::public.app_role[])
        or (c.class_teacher = auth.uid() and public.has_school_role(_school_id, array['teacher']::public.app_role[]))
        or (
          public.has_school_role(_school_id, array['teacher']::public.app_role[])
          and exists (
            select 1 from public.class_teacher_assignments a
            where a.class_id = c.id and a.school_id = c.school_id
              and a.teacher_user_id = auth.uid() and a.is_active
          )
        )
      )
  )
$$;
grant execute on function public.can_access_class(uuid, uuid) to authenticated;

-- Teachers may read only their assigned classes; other existing school roles retain school access.
drop policy if exists "school members can view classes" on public.classes;
create policy "school members can view classes" on public.classes for select to authenticated
using (
  public.has_central_role()
  or (public.is_school_member(school_id) and (
    not public.has_school_role(school_id, array['teacher']::public.app_role[])
    or public.can_access_class(id, school_id)
  ))
);

drop policy if exists "school members can view students" on public.students;
create policy "school members can view students" on public.students for select to authenticated
using (public.can_access_class(class_id, school_id));

drop policy if exists "school members can view attendance" on public.attendance_records;
create policy "school members can view attendance" on public.attendance_records for select to authenticated
using (public.can_access_class(class_id, school_id));

drop policy if exists "school members mark attendance" on public.attendance_records;
create policy "school members mark attendance" on public.attendance_records for insert to authenticated
with check (
  public.can_access_class(class_id, school_id)
  and exists (select 1 from public.students s where s.id = attendance_records.student_id and s.class_id = attendance_records.class_id and s.school_id = attendance_records.school_id)
  and (marked_by is null or marked_by = auth.uid())
);

drop policy if exists "school members update attendance" on public.attendance_records;
create policy "school members update attendance" on public.attendance_records for update to authenticated
using (public.can_access_class(class_id, school_id))
with check (
  public.can_access_class(class_id, school_id)
  and exists (select 1 from public.students s where s.id = attendance_records.student_id and s.class_id = attendance_records.class_id and s.school_id = attendance_records.school_id)
  and (marked_by is null or marked_by = auth.uid())
);
