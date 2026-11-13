-- Link a student record to an existing Supabase Auth account for a real student portal.
-- No Auth users are created by this migration.
alter table public.students
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create unique index if not exists students_user_id_unique_idx
  on public.students(user_id) where user_id is not null;

drop policy if exists "school members can view classes" on public.classes;
create policy "school members can view classes" on public.classes for select to authenticated
using (
  public.can_access_class(id, school_id)
  or (
    public.has_school_role(school_id, array['student']::public.app_role[])
    and exists (select 1 from public.students s where s.class_id = classes.id and s.user_id = auth.uid())
  )
  or (
    public.is_school_member(school_id)
    and not public.has_school_role(school_id, array['teacher','student']::public.app_role[])
  )
);

drop policy if exists "school members can view students" on public.students;
create policy "school members can view students" on public.students for select to authenticated
using (
  public.can_access_class(class_id, school_id)
  or (user_id = auth.uid() and public.has_school_role(school_id, array['student']::public.app_role[]))
);

drop policy if exists "school members can view attendance" on public.attendance_records;
create policy "school members can view attendance" on public.attendance_records for select to authenticated
using (
  public.can_access_class(class_id, school_id)
  or (
    public.has_school_role(school_id, array['student']::public.app_role[])
    and exists (select 1 from public.students s where s.id = attendance_records.student_id and s.user_id = auth.uid())
  )
);
