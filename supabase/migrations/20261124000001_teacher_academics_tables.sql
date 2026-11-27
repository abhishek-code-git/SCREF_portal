-- Teacher academics: subjects, timetable_slots, homework, exams, exam_marks, notices.
-- Pre-requisite: classes, students, attendance_records, class_teacher_assignments all exist.

-- ─── Subjects ───────────────────────────────────────────────────────────────
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  code text not null default '',
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

create index if not exists subjects_school_idx on public.subjects(school_id);
alter table public.subjects enable row level security;
grant select, insert, update, delete on public.subjects to authenticated;

-- Everyone in the school reads subjects; leadership manages.
create policy "school members read subjects" on public.subjects for select to authenticated
using (public.is_school_member(school_id) or public.has_central_role());

create policy "leadership manages subjects" on public.subjects for all to authenticated
using (public.has_school_role(school_id, array['central_super_admin','central_ops_admin','franchise_owner','school_principal']::public.app_role[]))
with check (public.has_school_role(school_id, array['central_super_admin','central_ops_admin','franchise_owner','school_principal']::public.app_role[]));

-- ─── Timetable Slots ───────────────────────────────────────────────────────
create table if not exists public.timetable_slots (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  teacher_user_id uuid not null references auth.users(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6), -- 0=Mon,5=Sat
  period int not null check (period >= 1),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  unique (school_id, class_id, day_of_week, period)
);

create index if not exists timetable_teacher_idx on public.timetable_slots(teacher_user_id, school_id);
create index if not exists timetable_class_idx on public.timetable_slots(class_id);
alter table public.timetable_slots enable row level security;
grant select, insert, update, delete on public.timetable_slots to authenticated;

-- School members read; leadership manages.
create policy "school members read timetable" on public.timetable_slots for select to authenticated
using (public.is_school_member(school_id) or public.has_central_role());

create policy "leadership manages timetable" on public.timetable_slots for all to authenticated
using (public.has_school_role(school_id, array['central_super_admin','central_ops_admin','franchise_owner','school_principal']::public.app_role[]))
with check (public.has_school_role(school_id, array['central_super_admin','central_ops_admin','franchise_owner','school_principal']::public.app_role[]));

-- ─── Homework ───────────────────────────────────────────────────────────────
create table if not exists public.homework (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  title text not null,
  description text not null default '',
  due_date date,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists homework_class_idx on public.homework(class_id);
create index if not exists homework_teacher_idx on public.homework(created_by, school_id);
alter table public.homework enable row level security;
grant select, insert, update, delete on public.homework to authenticated;

-- Teachers of that class and leadership can read; teacher writes only their own.
create policy "class members read homework" on public.homework for select to authenticated
using (public.can_access_class(class_id, school_id));

create policy "teachers create homework" on public.homework for insert to authenticated
with check (
  created_by = auth.uid()
  and public.can_access_class(class_id, school_id)
);

create policy "teachers update own homework" on public.homework for update to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

create policy "teachers delete own homework" on public.homework for delete to authenticated
using (created_by = auth.uid());

create policy "leadership manages homework" on public.homework for all to authenticated
using (public.has_school_role(school_id, array['central_super_admin','central_ops_admin','franchise_owner','school_principal']::public.app_role[]))
with check (public.has_school_role(school_id, array['central_super_admin','central_ops_admin','franchise_owner','school_principal']::public.app_role[]));

-- ─── Exams ──────────────────────────────────────────────────────────────────
create type public.exam_status as enum ('draft', 'marks_open', 'published');

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  exam_date date,
  status public.exam_status not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists exams_school_idx on public.exams(school_id);
alter table public.exams enable row level security;
grant select, insert, update, delete on public.exams to authenticated;

create policy "school members read exams" on public.exams for select to authenticated
using (public.is_school_member(school_id) or public.has_central_role());

create policy "leadership manages exams" on public.exams for all to authenticated
using (public.has_school_role(school_id, array['central_super_admin','central_ops_admin','franchise_owner','school_principal']::public.app_role[]))
with check (public.has_school_role(school_id, array['central_super_admin','central_ops_admin','franchise_owner','school_principal']::public.app_role[]));

-- ─── Exam Marks ─────────────────────────────────────────────────────────────
create table if not exists public.exam_marks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  exam_id uuid not null references public.exams(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  marks_obtained numeric(6,2) not null check (marks_obtained >= 0),
  max_marks numeric(6,2) not null check (max_marks > 0),
  entered_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, student_id, subject_id)
);

create index if not exists exam_marks_exam_idx on public.exam_marks(exam_id, class_id);
create index if not exists exam_marks_student_idx on public.exam_marks(student_id);
alter table public.exam_marks enable row level security;
grant select, insert, update, delete on public.exam_marks to authenticated;

-- Teachers of that class can read and write marks ONLY when exam is marks_open.
create policy "class members read marks" on public.exam_marks for select to authenticated
using (public.can_access_class(class_id, school_id));

create policy "teachers enter marks when open" on public.exam_marks for insert to authenticated
with check (
  entered_by = auth.uid()
  and public.can_access_class(class_id, school_id)
  and exists (select 1 from public.exams e where e.id = exam_marks.exam_id and e.status = 'marks_open')
);

create policy "teachers update marks when open" on public.exam_marks for update to authenticated
using (
  public.can_access_class(class_id, school_id)
  and exists (select 1 from public.exams e where e.id = exam_marks.exam_id and e.status = 'marks_open')
)
with check (
  entered_by = auth.uid()
  and public.can_access_class(class_id, school_id)
  and exists (select 1 from public.exams e where e.id = exam_marks.exam_id and e.status = 'marks_open')
);

create policy "leadership manages marks" on public.exam_marks for all to authenticated
using (public.has_school_role(school_id, array['central_super_admin','central_ops_admin','franchise_owner','school_principal']::public.app_role[]))
with check (public.has_school_role(school_id, array['central_super_admin','central_ops_admin','franchise_owner','school_principal']::public.app_role[]));

-- ─── Notices ────────────────────────────────────────────────────────────────
create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  title text not null,
  body text not null default '',
  audience text not null default 'all' check (audience in ('all','students','parents','teachers')),
  created_by uuid not null references auth.users(id) on delete cascade,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists notices_school_idx on public.notices(school_id);
create index if not exists notices_class_idx on public.notices(class_id);
alter table public.notices enable row level security;
grant select, insert, update, delete on public.notices to authenticated;

-- School members see notices addressed to them (school-wide or for their class).
create policy "school members read notices" on public.notices for select to authenticated
using (
  published
  and (public.is_school_member(school_id) or public.has_central_role())
  and (class_id is null or public.can_access_class(class_id, school_id))
);

-- Teachers create class notices (students/parents audience only).
create policy "teachers create class notices" on public.notices for insert to authenticated
with check (
  created_by = auth.uid()
  and class_id is not null
  and audience in ('students', 'parents')
  and public.can_access_class(class_id, school_id)
);

create policy "teachers update own notices" on public.notices for update to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

create policy "teachers delete own notices" on public.notices for delete to authenticated
using (created_by = auth.uid());

-- Leadership can manage all notices including school-wide ones.
create policy "leadership manages notices" on public.notices for all to authenticated
using (public.has_school_role(school_id, array['central_super_admin','central_ops_admin','franchise_owner','school_principal']::public.app_role[]))
with check (public.has_school_role(school_id, array['central_super_admin','central_ops_admin','franchise_owner','school_principal']::public.app_role[]));
