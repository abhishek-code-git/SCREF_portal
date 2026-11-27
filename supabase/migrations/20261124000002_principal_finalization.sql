-- Principal dashboard finalization: writable guard, student completeness,
-- school profile RPC, student promotion, transfer certificates, admission enquiries,
-- principal overview & report RPCs, composite FKs, audit triggers, and staff cleanup.

-- ─── 1. Leadership & Writable Guards ────────────────────────────────────────

create or replace function public.is_school_leadership(_school_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_central_role()
    or public.has_school_role(
      _school_id,
      array['franchise_owner','school_principal']::public.app_role[]
    );
$$;

create or replace function public.school_is_writable(_school_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_central_role() or exists (
    select 1
    from public.schools s
    where s.id = _school_id
      and s.status = 'active'
      and (s.franchise_id is null or public.franchise_is_open(s.franchise_id))
  );
$$;

revoke all on function public.is_school_leadership(uuid) from public;
revoke all on function public.school_is_writable(uuid) from public;
grant execute on function public.is_school_leadership(uuid) to authenticated;
grant execute on function public.school_is_writable(uuid) to authenticated;

-- Tighten can_access_class so accountant/transport_manager no longer count for class write operations
create or replace function public.can_access_class(_class_id uuid, _school_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.classes c
    where c.id = _class_id and c.school_id = _school_id
      and (
        public.has_central_role()
        or public.has_school_role(_school_id, array['central_super_admin','central_ops_admin','franchise_owner','school_principal','admissions_staff']::public.app_role[])
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
revoke all on function public.can_access_class(uuid, uuid) from public;
grant execute on function public.can_access_class(uuid, uuid) to authenticated;

-- ─── 2. School Profile Columns & RPC ────────────────────────────────────────

alter table public.schools
  add column if not exists phone text not null default '',
  add column if not exists email text not null default '',
  add column if not exists principal_name text not null default '',
  add column if not exists logo_url text not null default '';

create or replace function public.update_school_profile(
  _school_id uuid,
  _phone text default null,
  _email text default null,
  _address text default null,
  _city text default null,
  _state text default null,
  _principal_name text default null,
  _logo_url text default null
)
returns public.schools
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.schools;
begin
  if not public.is_school_leadership(_school_id) then
    raise exception 'Forbidden: school leadership access is required' using errcode = '42501';
  end if;
  if not public.school_is_writable(_school_id) then
    raise exception 'School workspace is read-only (suspended or inactive)' using errcode = '42501';
  end if;

  update public.schools
  set
    phone = coalesce(btrim(_phone), phone),
    email = coalesce(btrim(_email), email),
    address = coalesce(btrim(_address), address),
    city = coalesce(btrim(_city), city),
    state = coalesce(btrim(_state), state),
    principal_name = coalesce(btrim(_principal_name), principal_name),
    logo_url = coalesce(btrim(_logo_url), logo_url)
  where id = _school_id
  returning * into v_row;

  if not found then
    raise exception 'School not found' using errcode = 'P0002';
  end if;

  insert into public.central_admin_audit_logs (actor_user_id, action, entity_table, entity_id, details)
  values (
    auth.uid(),
    'update_school_profile',
    'schools',
    _school_id,
    jsonb_strip_nulls(jsonb_build_object(
      'school_id', _school_id,
      'city', v_row.city,
      'state', v_row.state,
      'principal_name', nullif(v_row.principal_name, '')
    ))
  );

  return v_row;
end;
$$;

revoke all on function public.update_school_profile(uuid, text, text, text, text, text, text, text) from public;
grant execute on function public.update_school_profile(uuid, text, text, text, text, text, text, text) to authenticated;

-- ─── 3. Per-School Concurrency-Safe Counters ────────────────────────────────

create table if not exists public.school_counters (
  school_id uuid primary key references public.schools(id) on delete cascade,
  next_admission_seq bigint not null default 1,
  next_tc_seq bigint not null default 1
);
alter table public.school_counters enable row level security;
grant all on public.school_counters to service_role;

create or replace function public.next_school_admission_no(_school_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq bigint;
  v_candidate text;
begin
  loop
    insert into public.school_counters (school_id, next_admission_seq)
    values (_school_id, 2)
    on conflict (school_id) do update
      set next_admission_seq = public.school_counters.next_admission_seq + 1
    returning next_admission_seq - 1 into v_seq;

    v_candidate := 'ADM-' || lpad(v_seq::text, 6, '0');
    exit when not exists (
      select 1 from public.students s
      where s.school_id = _school_id and s.admission_no = v_candidate
    );
  end loop;
  return v_candidate;
end;
$$;

create or replace function public.next_school_tc_no(_school_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq bigint;
  v_candidate text;
begin
  loop
    insert into public.school_counters (school_id, next_tc_seq)
    values (_school_id, 2)
    on conflict (school_id) do update
      set next_tc_seq = public.school_counters.next_tc_seq + 1
    returning next_tc_seq - 1 into v_seq;

    v_candidate := 'TC-' || lpad(v_seq::text, 6, '0');
    exit when not exists (
      select 1 from public.transfer_certificates tc
      where tc.school_id = _school_id and tc.tc_no = v_candidate
    );
  end loop;
  return v_candidate;
end;
$$;

revoke all on function public.next_school_admission_no(uuid) from public;
revoke all on function public.next_school_tc_no(uuid) from public;

-- ─── 4. Student Completeness & Auto Admission No ────────────────────────────

alter table public.students
  add column if not exists admission_no text,
  add column if not exists date_of_birth date,
  add column if not exists gender text,
  add column if not exists guardian_name text not null default '',
  add column if not exists guardian_phone text not null default '',
  add column if not exists guardian_email text not null default '',
  add column if not exists address text not null default '',
  add column if not exists admitted_on date not null default current_date,
  add column if not exists left_on date,
  add column if not exists leaving_reason text not null default '';

alter table public.students drop constraint if exists students_gender_check;
alter table public.students add constraint students_gender_check
  check (gender is null or gender in ('male', 'female', 'other'));

alter table public.students drop constraint if exists students_status_check;
alter table public.students add constraint students_status_check
  check (status in ('active', 'left', 'alumni'));

create unique index if not exists students_school_admission_no_unique_idx
  on public.students(school_id, admission_no)
  where admission_no is not null;

create unique index if not exists students_id_school_id_scope_idx
  on public.students(id, school_id);

create or replace function public.assign_student_admission_no()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.admission_no is null or btrim(new.admission_no) = '' then
    new.admission_no := public.next_school_admission_no(new.school_id);
  else
    new.admission_no := btrim(new.admission_no);
  end if;
  return new;
end;
$$;

revoke all on function public.assign_student_admission_no() from public;

drop trigger if exists trg_students_assign_admission_no on public.students;
create trigger trg_students_assign_admission_no
before insert on public.students
for each row execute function public.assign_student_admission_no();

-- Backfill existing students without an admission_no
update public.students s
set admission_no = public.next_school_admission_no(s.school_id)
where s.admission_no is null;

-- ─── 5. Transfer Certificates & Issue RPC ───────────────────────────────────

create table if not exists public.transfer_certificates (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  tc_no text not null,
  issued_on date not null default current_date,
  reason text not null,
  conduct text not null default 'Good',
  class_at_leaving text not null default '',
  remarks text not null default '',
  issued_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (school_id, tc_no),
  unique (student_id),
  foreign key (student_id, school_id) references public.students(id, school_id) on delete cascade
);

create index if not exists transfer_certificates_school_idx on public.transfer_certificates(school_id);
alter table public.transfer_certificates enable row level security;
grant select, delete on public.transfer_certificates to authenticated;
grant all on public.transfer_certificates to service_role;

drop policy if exists "leadership reads transfer certificates" on public.transfer_certificates;
create policy "leadership reads transfer certificates"
on public.transfer_certificates for select to authenticated
using (public.is_school_leadership(school_id));

drop policy if exists "central deletes transfer certificates" on public.transfer_certificates;
create policy "central deletes transfer certificates"
on public.transfer_certificates for delete to authenticated
using (public.has_central_role());

create or replace function public.issue_transfer_certificate(
  _student_id uuid,
  _reason text,
  _conduct text default 'Good',
  _remarks text default ''
)
returns public.transfer_certificates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student record;
  v_tc_no text;
  v_tc public.transfer_certificates;
  v_clean_reason text;
begin
  select s.id, s.school_id, s.status, s.class_id, c.name as class_name, c.section as class_section
  into v_student
  from public.students s
  left join public.classes c on c.id = s.class_id
  where s.id = _student_id;

  if not found then
    raise exception 'Student not found' using errcode = 'P0002';
  end if;

  if not public.is_school_leadership(v_student.school_id) then
    raise exception 'Forbidden: school leadership access is required' using errcode = '42501';
  end if;

  if not public.school_is_writable(v_student.school_id) then
    raise exception 'School workspace is read-only (suspended or inactive)' using errcode = '42501';
  end if;

  if v_student.status <> 'active' then
    raise exception 'Transfer certificate can only be issued for an active student' using errcode = '22023';
  end if;

  if exists (select 1 from public.transfer_certificates where student_id = _student_id) then
    raise exception 'A transfer certificate has already been issued for this student' using errcode = '23505';
  end if;

  v_clean_reason := coalesce(nullif(btrim(_reason), ''), '');
  if v_clean_reason = '' then
    raise exception 'Leaving reason is required' using errcode = '22023';
  end if;

  v_tc_no := public.next_school_tc_no(v_student.school_id);

  update public.students
  set
    status = 'left',
    left_on = current_date,
    leaving_reason = v_clean_reason
  where id = _student_id;

  insert into public.transfer_certificates (
    school_id, student_id, tc_no, issued_on, reason, conduct, class_at_leaving, remarks, issued_by
  )
  values (
    v_student.school_id,
    _student_id,
    v_tc_no,
    current_date,
    v_clean_reason,
    coalesce(nullif(btrim(_conduct), ''), 'Good'),
    coalesce(nullif(btrim(coalesce(v_student.class_name, '') || case when v_student.class_section is not null and v_student.class_section <> '' then '-' || v_student.class_section else '' end), ''), ''),
    coalesce(btrim(_remarks), ''),
    auth.uid()
  )
  returning * into v_tc;

  insert into public.central_admin_audit_logs (actor_user_id, action, entity_table, entity_id, details)
  values (
    auth.uid(),
    'issue_tc',
    'transfer_certificates',
    v_tc.id,
    jsonb_build_object(
      'school_id', v_student.school_id,
      'student_id', _student_id,
      'tc_no', v_tc.tc_no
    )
  );

  return v_tc;
end;
$$;

revoke all on function public.issue_transfer_certificate(uuid, text, text, text) from public;
grant execute on function public.issue_transfer_certificate(uuid, text, text, text) to authenticated;

-- ─── 6. Student Promotion RPC ───────────────────────────────────────────────

create or replace function public.promote_students(
  _from_class uuid,
  _to_class uuid,
  _student_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from_school uuid;
  v_to_school uuid;
  v_ids uuid[];
  v_expected integer;
  v_matched integer;
  v_moved integer;
begin
  if _from_class is null or _to_class is null then
    raise exception 'Source and destination classes are required' using errcode = '22023';
  end if;
  if _from_class = _to_class then
    raise exception 'Destination class must be different from source class' using errcode = '22023';
  end if;

  select school_id into v_from_school from public.classes where id = _from_class;
  select school_id into v_to_school from public.classes where id = _to_class;

  if v_from_school is null or v_to_school is null then
    raise exception 'Class not found' using errcode = 'P0002';
  end if;
  if v_from_school <> v_to_school then
    raise exception 'Cannot promote students across different schools' using errcode = '42501';
  end if;

  if not public.is_school_leadership(v_from_school) then
    raise exception 'Forbidden: school leadership access is required' using errcode = '42501';
  end if;
  if not public.school_is_writable(v_from_school) then
    raise exception 'School workspace is read-only (suspended or inactive)' using errcode = '42501';
  end if;

  if _student_ids is null or coalesce(array_length(_student_ids, 1), 0) = 0 then
    raise exception 'Select at least one student to promote' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(_student_ids) as x where x is null) then
    raise exception 'Invalid null student id' using errcode = '22023';
  end if;

  select array_agg(distinct x) into v_ids from unnest(_student_ids) as x;
  v_expected := coalesce(array_length(v_ids, 1), 0);

  select count(*) into v_matched
  from public.students s
  where s.id = any(v_ids)
    and s.school_id = v_from_school
    and s.class_id = _from_class
    and s.status = 'active';

  if v_matched <> v_expected then
    raise exception 'One or more students are invalid, inactive, or not in the source class' using errcode = '22023';
  end if;

  update public.students
  set class_id = _to_class
  where id = any(v_ids)
    and school_id = v_from_school
    and class_id = _from_class
    and status = 'active';

  get diagnostics v_moved = row_count;

  insert into public.central_admin_audit_logs (actor_user_id, action, entity_table, entity_id, details)
  values (
    auth.uid(),
    'promote_students',
    'students',
    _to_class,
    jsonb_build_object(
      'school_id', v_from_school,
      'from_class', _from_class,
      'to_class', _to_class,
      'count', v_moved
    )
  );

  return v_moved;
end;
$$;

revoke all on function public.promote_students(uuid, uuid, uuid[]) from public;
grant execute on function public.promote_students(uuid, uuid, uuid[]) to authenticated;

-- ─── 7. Admission Enquiries Table ───────────────────────────────────────────

create table if not exists public.admission_enquiries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  child_name text not null,
  parent_name text not null default '',
  parent_phone text not null default '',
  parent_email text not null default '',
  target_class text not null default '',
  source text not null default 'walk_in' check (source in ('walk_in', 'phone', 'website', 'referral', 'other')),
  stage text not null default 'new' check (stage in ('new', 'contacted', 'visit_scheduled', 'applied', 'enrolled', 'lost')),
  follow_up_date date,
  assigned_to uuid references auth.users(id) on delete set null,
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admission_enquiries_school_stage_idx on public.admission_enquiries(school_id, stage);
create index if not exists admission_enquiries_followup_idx on public.admission_enquiries(school_id, follow_up_date) where follow_up_date is not null;
alter table public.admission_enquiries enable row level security;
grant select, insert, update, delete on public.admission_enquiries to authenticated;
grant all on public.admission_enquiries to service_role;

drop policy if exists "leadership and admissions read enquiries" on public.admission_enquiries;
create policy "leadership and admissions read enquiries"
on public.admission_enquiries for select to authenticated
using (
  public.has_central_role()
  or public.has_school_role(school_id, array['franchise_owner','school_principal','admissions_staff']::public.app_role[])
);

drop policy if exists "leadership and admissions insert enquiries" on public.admission_enquiries;
create policy "leadership and admissions insert enquiries"
on public.admission_enquiries for insert to authenticated
with check (
  public.school_is_writable(school_id)
  and (
    public.has_central_role()
    or public.has_school_role(school_id, array['franchise_owner','school_principal','admissions_staff']::public.app_role[])
  )
);

drop policy if exists "leadership and admissions update enquiries" on public.admission_enquiries;
create policy "leadership and admissions update enquiries"
on public.admission_enquiries for update to authenticated
using (
  public.school_is_writable(school_id)
  and (
    public.has_central_role()
    or public.has_school_role(school_id, array['franchise_owner','school_principal','admissions_staff']::public.app_role[])
  )
)
with check (
  public.school_is_writable(school_id)
  and (
    public.has_central_role()
    or public.has_school_role(school_id, array['franchise_owner','school_principal','admissions_staff']::public.app_role[])
  )
);

drop policy if exists "leadership and admissions delete enquiries" on public.admission_enquiries;
create policy "leadership and admissions delete enquiries"
on public.admission_enquiries for delete to authenticated
using (
  public.school_is_writable(school_id)
  and (
    public.has_central_role()
    or public.has_school_role(school_id, array['franchise_owner','school_principal','admissions_staff']::public.app_role[])
  )
);

-- ─── 8. Composite FKs, Indexes & Notices Pinned Column ──────────────────────

create unique index if not exists subjects_id_school_id_scope_idx on public.subjects(id, school_id);
create unique index if not exists exams_id_school_id_scope_idx on public.exams(id, school_id);

-- Students -> classes cross-school FK guard
alter table public.students drop constraint if exists students_class_school_fkey;
alter table public.students add constraint students_class_school_fkey
  foreign key (class_id, school_id) references public.classes(id, school_id) on delete cascade;

-- Attendance -> classes & students cross-school FK guards
alter table public.attendance_records drop constraint if exists attendance_class_school_fkey;
alter table public.attendance_records add constraint attendance_class_school_fkey
  foreign key (class_id, school_id) references public.classes(id, school_id) on delete cascade;

alter table public.attendance_records drop constraint if exists attendance_student_school_fkey;
alter table public.attendance_records add constraint attendance_student_school_fkey
  foreign key (student_id, school_id) references public.students(id, school_id) on delete cascade;

-- Timetable -> classes & subjects cross-school FK guards
alter table public.timetable_slots drop constraint if exists timetable_class_school_fkey;
alter table public.timetable_slots add constraint timetable_class_school_fkey
  foreign key (class_id, school_id) references public.classes(id, school_id) on delete cascade;

alter table public.timetable_slots drop constraint if exists timetable_subject_school_fkey;
alter table public.timetable_slots add constraint timetable_subject_school_fkey
  foreign key (subject_id, school_id) references public.subjects(id, school_id) on delete restrict;

-- Homework -> classes & subjects cross-school FK guards
alter table public.homework drop constraint if exists homework_class_school_fkey;
alter table public.homework add constraint homework_class_school_fkey
  foreign key (class_id, school_id) references public.classes(id, school_id) on delete cascade;

alter table public.homework drop constraint if exists homework_subject_school_fkey;
alter table public.homework add constraint homework_subject_school_fkey
  foreign key (subject_id, school_id) references public.subjects(id, school_id) on delete restrict;

-- Exam marks -> exams, classes, subjects, students cross-school FK guards
alter table public.exam_marks drop constraint if exists exam_marks_exam_school_fkey;
alter table public.exam_marks add constraint exam_marks_exam_school_fkey
  foreign key (exam_id, school_id) references public.exams(id, school_id) on delete cascade;

alter table public.exam_marks drop constraint if exists exam_marks_class_school_fkey;
alter table public.exam_marks add constraint exam_marks_class_school_fkey
  foreign key (class_id, school_id) references public.classes(id, school_id) on delete cascade;

alter table public.exam_marks drop constraint if exists exam_marks_subject_school_fkey;
alter table public.exam_marks add constraint exam_marks_subject_school_fkey
  foreign key (subject_id, school_id) references public.subjects(id, school_id) on delete cascade;

alter table public.exam_marks drop constraint if exists exam_marks_student_school_fkey;
alter table public.exam_marks add constraint exam_marks_student_school_fkey
  foreign key (student_id, school_id) references public.students(id, school_id) on delete cascade;

-- Notices -> classes cross-school FK guard (MATCH SIMPLE allows class_id IS NULL) + pinned
alter table public.notices drop constraint if exists notices_class_school_fkey;
alter table public.notices add constraint notices_class_school_fkey
  foreign key (class_id, school_id) references public.classes(id, school_id) on delete cascade;

alter table public.notices
  add column if not exists pinned boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

-- Report and lookup indexes
create index if not exists timetable_school_idx on public.timetable_slots(school_id);
create index if not exists homework_school_idx on public.homework(school_id);
create index if not exists exam_marks_school_idx on public.exam_marks(school_id);
create index if not exists attendance_school_date_idx on public.attendance_records(school_id, att_date);
create index if not exists attendance_class_date_idx on public.attendance_records(class_id, att_date);
create index if not exists exam_marks_exam_idx on public.exam_marks(exam_id, class_id);
create index if not exists students_school_class_status_idx on public.students(school_id, class_id, status);

-- ─── 9. Enforce school_is_writable on All Academic & School Write Policies ──

-- classes
drop policy if exists "school leadership manages classes" on public.classes;
create policy "school leadership inserts classes" on public.classes for insert to authenticated
with check (
  public.school_is_writable(school_id)
  and public.has_school_role(school_id, array['central_super_admin','central_ops_admin','franchise_owner','school_principal','admissions_staff']::public.app_role[])
);
create policy "school leadership updates classes" on public.classes for update to authenticated
using (
  public.school_is_writable(school_id)
  and public.has_school_role(school_id, array['central_super_admin','central_ops_admin','franchise_owner','school_principal','admissions_staff']::public.app_role[])
)
with check (
  public.school_is_writable(school_id)
  and public.has_school_role(school_id, array['central_super_admin','central_ops_admin','franchise_owner','school_principal','admissions_staff']::public.app_role[])
);
create policy "school leadership deletes classes" on public.classes for delete to authenticated
using (
  public.school_is_writable(school_id)
  and public.has_school_role(school_id, array['central_super_admin','central_ops_admin','franchise_owner','school_principal','admissions_staff']::public.app_role[])
);

-- students
drop policy if exists "school leadership manages students" on public.students;
create policy "school leadership inserts students" on public.students for insert to authenticated
with check (
  public.school_is_writable(school_id)
  and public.has_school_role(school_id, array['central_super_admin','central_ops_admin','franchise_owner','school_principal','admissions_staff']::public.app_role[])
);
create policy "school leadership updates students" on public.students for update to authenticated
using (
  public.school_is_writable(school_id)
  and public.has_school_role(school_id, array['central_super_admin','central_ops_admin','franchise_owner','school_principal','admissions_staff']::public.app_role[])
)
with check (
  public.school_is_writable(school_id)
  and public.has_school_role(school_id, array['central_super_admin','central_ops_admin','franchise_owner','school_principal','admissions_staff']::public.app_role[])
);
create policy "school leadership deletes students" on public.students for delete to authenticated
using (
  public.school_is_writable(school_id)
  and public.has_school_role(school_id, array['central_super_admin','central_ops_admin','franchise_owner','school_principal','admissions_staff']::public.app_role[])
);

-- attendance_records
drop policy if exists "school members mark attendance" on public.attendance_records;
create policy "school members mark attendance" on public.attendance_records for insert to authenticated
with check (
  public.school_is_writable(school_id)
  and (
    public.is_school_leadership(school_id)
    or (public.has_school_role(school_id, array['teacher']::public.app_role[]) and public.can_access_class(class_id, school_id))
  )
  and exists (select 1 from public.students s where s.id = attendance_records.student_id and s.class_id = attendance_records.class_id and s.school_id = attendance_records.school_id)
  and (marked_by is null or marked_by = auth.uid())
);

drop policy if exists "school members update attendance" on public.attendance_records;
create policy "school members update attendance" on public.attendance_records for update to authenticated
using (
  public.school_is_writable(school_id)
  and (
    public.is_school_leadership(school_id)
    or (public.has_school_role(school_id, array['teacher']::public.app_role[]) and public.can_access_class(class_id, school_id))
  )
)
with check (
  public.school_is_writable(school_id)
  and (
    public.is_school_leadership(school_id)
    or (public.has_school_role(school_id, array['teacher']::public.app_role[]) and public.can_access_class(class_id, school_id))
  )
  and exists (select 1 from public.students s where s.id = attendance_records.student_id and s.class_id = attendance_records.class_id and s.school_id = attendance_records.school_id)
  and (marked_by is null or marked_by = auth.uid())
);

drop policy if exists "leadership deletes attendance" on public.attendance_records;
create policy "leadership deletes attendance" on public.attendance_records for delete to authenticated
using (public.school_is_writable(school_id) and public.is_school_leadership(school_id));

-- class_teacher_assignments
drop policy if exists "school leadership manages teacher assignments" on public.class_teacher_assignments;
create policy "school leadership inserts teacher assignments" on public.class_teacher_assignments for insert to authenticated
with check (public.school_is_writable(school_id) and public.is_school_leadership(school_id));
create policy "school leadership updates teacher assignments" on public.class_teacher_assignments for update to authenticated
using (public.school_is_writable(school_id) and public.is_school_leadership(school_id))
with check (public.school_is_writable(school_id) and public.is_school_leadership(school_id));
create policy "school leadership deletes teacher assignments" on public.class_teacher_assignments for delete to authenticated
using (public.school_is_writable(school_id) and public.is_school_leadership(school_id));

-- subjects
drop policy if exists "leadership manages subjects" on public.subjects;
create policy "leadership inserts subjects" on public.subjects for insert to authenticated
with check (public.school_is_writable(school_id) and public.is_school_leadership(school_id));
create policy "leadership updates subjects" on public.subjects for update to authenticated
using (public.school_is_writable(school_id) and public.is_school_leadership(school_id))
with check (public.school_is_writable(school_id) and public.is_school_leadership(school_id));
create policy "leadership deletes subjects" on public.subjects for delete to authenticated
using (public.school_is_writable(school_id) and public.is_school_leadership(school_id));

-- timetable_slots
drop policy if exists "leadership manages timetable" on public.timetable_slots;
create policy "leadership inserts timetable" on public.timetable_slots for insert to authenticated
with check (public.school_is_writable(school_id) and public.is_school_leadership(school_id));
create policy "leadership updates timetable" on public.timetable_slots for update to authenticated
using (public.school_is_writable(school_id) and public.is_school_leadership(school_id))
with check (public.school_is_writable(school_id) and public.is_school_leadership(school_id));
create policy "leadership deletes timetable" on public.timetable_slots for delete to authenticated
using (public.school_is_writable(school_id) and public.is_school_leadership(school_id));

-- homework
drop policy if exists "teachers create homework" on public.homework;
create policy "teachers create homework" on public.homework for insert to authenticated
with check (
  public.school_is_writable(school_id)
  and created_by = auth.uid()
  and public.can_access_class(class_id, school_id)
);

drop policy if exists "teachers update own homework" on public.homework;
create policy "teachers update own homework" on public.homework for update to authenticated
using (
  public.school_is_writable(school_id)
  and created_by = auth.uid()
  and public.can_access_class(class_id, school_id)
)
with check (
  public.school_is_writable(school_id)
  and created_by = auth.uid()
  and public.can_access_class(class_id, school_id)
);

drop policy if exists "teachers delete own homework" on public.homework;
create policy "teachers delete own homework" on public.homework for delete to authenticated
using (
  public.school_is_writable(school_id)
  and created_by = auth.uid()
  and public.can_access_class(class_id, school_id)
);

drop policy if exists "leadership manages homework" on public.homework;
create policy "leadership inserts homework" on public.homework for insert to authenticated
with check (public.school_is_writable(school_id) and public.is_school_leadership(school_id));
create policy "leadership updates homework" on public.homework for update to authenticated
using (public.school_is_writable(school_id) and public.is_school_leadership(school_id))
with check (public.school_is_writable(school_id) and public.is_school_leadership(school_id));
create policy "leadership deletes homework" on public.homework for delete to authenticated
using (public.school_is_writable(school_id) and public.is_school_leadership(school_id));

-- exams
drop policy if exists "leadership manages exams" on public.exams;
create policy "leadership inserts exams" on public.exams for insert to authenticated
with check (public.school_is_writable(school_id) and public.is_school_leadership(school_id));
create policy "leadership updates exams" on public.exams for update to authenticated
using (public.school_is_writable(school_id) and public.is_school_leadership(school_id))
with check (public.school_is_writable(school_id) and public.is_school_leadership(school_id));
create policy "leadership deletes exams" on public.exams for delete to authenticated
using (public.school_is_writable(school_id) and public.is_school_leadership(school_id));

-- exam_marks
drop policy if exists "teachers enter marks when open" on public.exam_marks;
create policy "teachers enter marks when open" on public.exam_marks for insert to authenticated
with check (
  public.school_is_writable(school_id)
  and entered_by = auth.uid()
  and public.can_access_class(class_id, school_id)
  and exists (select 1 from public.exams e where e.id = exam_marks.exam_id and e.school_id = exam_marks.school_id and e.status = 'marks_open')
);

drop policy if exists "teachers update marks when open" on public.exam_marks;
create policy "teachers update marks when open" on public.exam_marks for update to authenticated
using (
  public.school_is_writable(school_id)
  and public.can_access_class(class_id, school_id)
  and exists (select 1 from public.exams e where e.id = exam_marks.exam_id and e.school_id = exam_marks.school_id and e.status = 'marks_open')
)
with check (
  public.school_is_writable(school_id)
  and entered_by = auth.uid()
  and public.can_access_class(class_id, school_id)
  and exists (select 1 from public.exams e where e.id = exam_marks.exam_id and e.school_id = exam_marks.school_id and e.status = 'marks_open')
);

drop policy if exists "leadership manages marks" on public.exam_marks;
create policy "leadership inserts marks" on public.exam_marks for insert to authenticated
with check (public.school_is_writable(school_id) and public.is_school_leadership(school_id));
create policy "leadership updates marks" on public.exam_marks for update to authenticated
using (public.school_is_writable(school_id) and public.is_school_leadership(school_id))
with check (public.school_is_writable(school_id) and public.is_school_leadership(school_id));
create policy "leadership deletes marks" on public.exam_marks for delete to authenticated
using (public.school_is_writable(school_id) and public.is_school_leadership(school_id));

-- notices
drop policy if exists "teachers create class notices" on public.notices;
create policy "teachers create class notices" on public.notices for insert to authenticated
with check (
  public.school_is_writable(school_id)
  and created_by = auth.uid()
  and class_id is not null
  and audience in ('students', 'parents')
  and public.can_access_class(class_id, school_id)
);

drop policy if exists "teachers update own notices" on public.notices;
create policy "teachers update own notices" on public.notices for update to authenticated
using (
  public.school_is_writable(school_id)
  and created_by = auth.uid()
  and class_id is not null
  and public.can_access_class(class_id, school_id)
)
with check (
  public.school_is_writable(school_id)
  and created_by = auth.uid()
  and class_id is not null
  and audience in ('students', 'parents')
  and public.can_access_class(class_id, school_id)
);

drop policy if exists "teachers delete own notices" on public.notices;
create policy "teachers delete own notices" on public.notices for delete to authenticated
using (
  public.school_is_writable(school_id)
  and created_by = auth.uid()
);

drop policy if exists "leadership manages notices" on public.notices;
create policy "leadership reads all school notices" on public.notices for select to authenticated
using (public.is_school_leadership(school_id));
create policy "leadership inserts notices" on public.notices for insert to authenticated
with check (public.school_is_writable(school_id) and public.is_school_leadership(school_id));
create policy "leadership updates notices" on public.notices for update to authenticated
using (public.school_is_writable(school_id) and public.is_school_leadership(school_id))
with check (public.school_is_writable(school_id) and public.is_school_leadership(school_id));
create policy "leadership deletes notices" on public.notices for delete to authenticated
using (public.school_is_writable(school_id) and public.is_school_leadership(school_id));

-- staff_invites writable guard
drop policy if exists "leadership creates staff invites" on public.staff_invites;
create policy "leadership creates staff invites" on public.staff_invites for insert to authenticated
with check (
  public.school_is_writable(school_id)
  and public.has_school_role(school_id, array['franchise_owner','school_principal']::public.app_role[])
  and role in ('teacher','admissions_staff','accountant','transport_manager','school_principal')
);

drop policy if exists "leadership deletes pending invites" on public.staff_invites;
create policy "leadership deletes pending invites" on public.staff_invites for delete to authenticated
using (
  accepted_at is null
  and public.school_is_writable(school_id)
  and public.has_school_role(school_id, array['franchise_owner','school_principal']::public.app_role[])
);

-- ─── 10. Staff Unassignment Trigger on Membership Removal ───────────────────

create or replace function public.cleanup_teacher_assignments_on_membership_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.school_id is not null and old.role = 'teacher' then
    if not exists (
      select 1 from public.memberships m
      where m.school_id = old.school_id
        and m.user_id = old.user_id
        and m.role = 'teacher'
        and m.id <> old.id
    ) then
      update public.classes
      set class_teacher = null
      where school_id = old.school_id
        and class_teacher = old.user_id;

      update public.class_teacher_assignments
      set is_active = false
      where school_id = old.school_id
        and teacher_user_id = old.user_id
        and is_active;
    end if;
  end if;
  return old;
end;
$$;

revoke all on function public.cleanup_teacher_assignments_on_membership_delete() from public;

drop trigger if exists trg_cleanup_teacher_on_membership_delete on public.memberships;
create trigger trg_cleanup_teacher_on_membership_delete
after delete on public.memberships
for each row execute function public.cleanup_teacher_assignments_on_membership_delete();

-- Also guard principals from removing memberships when school is suspended/inactive
drop policy if exists "principals manage school staff" on public.memberships;
create policy "principals manage school staff"
on public.memberships for all to authenticated
using (
  role in ('teacher','admissions_staff','accountant','transport_manager')
  and school_id is not null
  and public.has_school_role(school_id, array['school_principal']::public.app_role[])
  and public.school_is_writable(school_id)
)
with check (
  role in ('teacher','admissions_staff','accountant','transport_manager')
  and school_id is not null
  and public.has_school_role(school_id, array['school_principal']::public.app_role[])
  and public.school_is_writable(school_id)
);

-- ─── 11. Audit Triggers on School & Academic Tables ─────────────────────────

create or replace function public.audit_school_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_row jsonb := '{}'::jsonb;
  new_row jsonb := '{}'::jsonb;
  v_row_id uuid;
begin
  if auth.uid() is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if tg_op <> 'INSERT' then old_row := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then new_row := to_jsonb(new); end if;
  v_row_id := nullif(coalesce(new_row->>'id', old_row->>'id'), '')::uuid;

  insert into public.central_admin_audit_logs (actor_user_id, action, entity_table, entity_id, details)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    v_row_id,
    jsonb_strip_nulls(jsonb_build_object(
      'school_id', coalesce(new_row->>'school_id', old_row->>'school_id'),
      'class_id', coalesce(new_row->>'class_id', old_row->>'class_id'),
      'student_id', coalesce(new_row->>'student_id', old_row->>'student_id'),
      'exam_id', coalesce(new_row->>'exam_id', old_row->>'exam_id'),
      'status', coalesce(new_row->>'status', old_row->>'status'),
      'stage', coalesce(new_row->>'stage', old_row->>'stage'),
      'name', coalesce(new_row->>'name', new_row->>'title', new_row->>'full_name', old_row->>'name', old_row->>'title', old_row->>'full_name')
    ))
  );

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

revoke all on function public.audit_school_change() from public;

drop trigger if exists school_audit_classes on public.classes;
create trigger school_audit_classes after insert or update or delete on public.classes
  for each row execute function public.audit_school_change();

drop trigger if exists school_audit_students on public.students;
create trigger school_audit_students after insert or update or delete on public.students
  for each row execute function public.audit_school_change();

drop trigger if exists school_audit_class_teacher_assignments on public.class_teacher_assignments;
create trigger school_audit_class_teacher_assignments after insert or update or delete on public.class_teacher_assignments
  for each row execute function public.audit_school_change();

drop trigger if exists school_audit_subjects on public.subjects;
create trigger school_audit_subjects after insert or update or delete on public.subjects
  for each row execute function public.audit_school_change();

drop trigger if exists school_audit_timetable_slots on public.timetable_slots;
create trigger school_audit_timetable_slots after insert or update or delete on public.timetable_slots
  for each row execute function public.audit_school_change();

drop trigger if exists school_audit_homework on public.homework;
create trigger school_audit_homework after insert or update or delete on public.homework
  for each row execute function public.audit_school_change();

drop trigger if exists school_audit_exams on public.exams;
create trigger school_audit_exams after insert or update or delete on public.exams
  for each row execute function public.audit_school_change();

drop trigger if exists school_audit_exam_marks on public.exam_marks;
create trigger school_audit_exam_marks after insert or update or delete on public.exam_marks
  for each row execute function public.audit_school_change();

drop trigger if exists school_audit_notices on public.notices;
create trigger school_audit_notices after insert or update or delete on public.notices
  for each row execute function public.audit_school_change();

drop trigger if exists school_audit_admission_enquiries on public.admission_enquiries;
create trigger school_audit_admission_enquiries after insert or update or delete on public.admission_enquiries
  for each row execute function public.audit_school_change();

drop trigger if exists school_audit_transfer_certificates on public.transfer_certificates;
create trigger school_audit_transfer_certificates after insert or update or delete on public.transfer_certificates
  for each row execute function public.audit_school_change();

-- ─── 12. Principal Overview & Report RPCs ───────────────────────────────────

create or replace function public.principal_overview(_school_id uuid)
returns table (
  class_count bigint,
  student_count bigint,
  teacher_count bigint,
  attendance_today_marked bigint,
  attendance_today_present bigint,
  classes_without_attendance_today bigint,
  classes_without_class_teacher bigint,
  classes_without_timetable bigint,
  exams_open_for_marks bigint,
  exams_ready_to_publish bigint,
  enquiries_total bigint,
  enquiries_followup_due bigint,
  notices_last_7_days bigint
)
language sql stable security definer set search_path = public
as $$
  select
    (select count(*) from public.classes c where c.school_id = _school_id),
    (select count(*) from public.students s where s.school_id = _school_id and s.status = 'active'),
    (select count(distinct m.user_id) from public.memberships m where m.school_id = _school_id and m.role = 'teacher'),
    (select count(*) from public.attendance_records ar where ar.school_id = _school_id and ar.att_date = current_date),
    (select count(*) from public.attendance_records ar where ar.school_id = _school_id and ar.att_date = current_date and ar.status = 'present'),
    (select count(*) from public.classes c where c.school_id = _school_id and not exists (
      select 1 from public.attendance_records ar where ar.class_id = c.id and ar.att_date = current_date
    )),
    (select count(*) from public.classes c where c.school_id = _school_id and c.class_teacher is null),
    (select count(*) from public.classes c where c.school_id = _school_id and not exists (
      select 1 from public.timetable_slots ts where ts.class_id = c.id
    )),
    (select count(*) from public.exams e where e.school_id = _school_id and e.status = 'marks_open'),
    (select count(*) from public.exams e where e.school_id = _school_id and e.status = 'marks_open' and exists (
      select 1 from public.exam_marks em where em.exam_id = e.id
    )),
    (select count(*) from public.admission_enquiries ae where ae.school_id = _school_id),
    (select count(*) from public.admission_enquiries ae where ae.school_id = _school_id and ae.follow_up_date is not null and ae.follow_up_date <= current_date and ae.stage not in ('enrolled', 'lost')),
    (select count(*) from public.notices n where n.school_id = _school_id and n.created_at >= now() - interval '7 days')
  where public.is_school_leadership(_school_id);
$$;

create or replace function public.attendance_report(
  _school_id uuid,
  _from date,
  _to date
)
returns table (
  class_id uuid,
  class_name text,
  section text,
  att_date date,
  present_count bigint,
  absent_count bigint,
  late_count bigint,
  leave_count bigint,
  marked_count bigint
)
language sql stable security definer set search_path = public
as $$
  select
    c.id,
    c.name,
    c.section,
    ar.att_date,
    count(*) filter (where ar.status = 'present'),
    count(*) filter (where ar.status = 'absent'),
    count(*) filter (where ar.status = 'late'),
    count(*) filter (where ar.status = 'leave'),
    count(*)
  from public.attendance_records ar
  join public.classes c on c.id = ar.class_id and c.school_id = ar.school_id
  where ar.school_id = _school_id
    and ar.att_date between _from and _to
    and public.is_school_leadership(_school_id)
  group by c.id, c.name, c.section, ar.att_date
  order by ar.att_date desc, c.name, c.section;
$$;

create or replace function public.student_attendance_percentage(
  _school_id uuid,
  _from date,
  _to date
)
returns table (
  student_id uuid,
  admission_no text,
  full_name text,
  roll_no int,
  class_id uuid,
  class_name text,
  section text,
  present_days bigint,
  total_marked_days bigint,
  attendance_pct numeric
)
language sql stable security definer set search_path = public
as $$
  select
    s.id,
    s.admission_no,
    s.full_name,
    s.roll_no,
    c.id,
    c.name,
    c.section,
    count(*) filter (where ar.status in ('present', 'late')),
    count(ar.id),
    case
      when count(ar.id) = 0 then null
      else round((count(*) filter (where ar.status in ('present', 'late'))::numeric * 100.0) / count(ar.id)::numeric, 1)
    end
  from public.students s
  join public.classes c on c.id = s.class_id
  left join public.attendance_records ar
    on ar.student_id = s.id
    and ar.school_id = _school_id
    and ar.att_date between _from and _to
  where s.school_id = _school_id
    and s.status = 'active'
    and public.is_school_leadership(_school_id)
  group by s.id, s.admission_no, s.full_name, s.roll_no, c.id, c.name, c.section
  order by c.name, c.section, s.roll_no, s.full_name;
$$;

create or replace function public.enrolment_report(_school_id uuid)
returns table (
  class_id uuid,
  class_name text,
  section text,
  total_count bigint,
  boys_count bigint,
  girls_count bigint,
  other_count bigint
)
language sql stable security definer set search_path = public
as $$
  select
    c.id,
    c.name,
    c.section,
    count(s.id),
    count(s.id) filter (where s.gender = 'male'),
    count(s.id) filter (where s.gender = 'female'),
    count(s.id) filter (where s.gender is null or s.gender = 'other')
  from public.classes c
  left join public.students s
    on s.class_id = c.id
    and s.school_id = c.school_id
    and s.status = 'active'
  where c.school_id = _school_id
    and public.is_school_leadership(_school_id)
  group by c.id, c.name, c.section
  order by c.name, c.section;
$$;

create or replace function public.exam_result_summary(
  _exam_id uuid,
  _class_id uuid
)
returns table (
  student_id uuid,
  admission_no text,
  roll_no int,
  full_name text,
  total_obtained numeric,
  total_max numeric,
  percentage numeric,
  exam_rank bigint,
  subjects_entered bigint
)
language sql stable security definer set search_path = public
as $$
  with scoped as (
    select
      s.id as student_id,
      s.admission_no,
      s.roll_no,
      s.full_name,
      coalesce(sum(em.marks_obtained), 0) as total_obtained,
      coalesce(sum(em.max_marks), 0) as total_max,
      count(em.id) as subjects_entered
    from public.exams e
    join public.classes c on c.id = _class_id and c.school_id = e.school_id
    join public.students s on s.class_id = c.id and s.school_id = e.school_id and s.status = 'active'
    left join public.exam_marks em
      on em.exam_id = e.id
      and em.class_id = c.id
      and em.student_id = s.id
      and em.school_id = e.school_id
    where e.id = _exam_id
      and public.is_school_leadership(e.school_id)
    group by s.id, s.admission_no, s.roll_no, s.full_name
  ),
  pct as (
    select
      *,
      case
        when total_max > 0 then round((total_obtained * 100.0) / total_max, 2)
        else 0::numeric
      end as percentage
    from scoped
  )
  select
    student_id,
    admission_no,
    roll_no,
    full_name,
    total_obtained,
    total_max,
    percentage,
    case
      when total_max > 0 then dense_rank() over (order by percentage desc, total_obtained desc)
      else null::bigint
    end as exam_rank,
    subjects_entered
  from pct
  order by exam_rank nulls last, roll_no, full_name;
$$;

-- Staff directory RPC for leadership (returns profile + auth last_sign_in_at safely)
create or replace function public.school_staff_directory(_school_id uuid)
returns table (
  membership_id uuid,
  user_id uuid,
  role public.app_role,
  full_name text,
  phone text,
  email text,
  last_sign_in_at timestamptz
)
language sql stable security definer set search_path = public, auth
as $$
  select
    m.id as membership_id,
    m.user_id,
    m.role,
    coalesce(nullif(btrim(p.full_name), ''), 'Name not set') as full_name,
    coalesce(p.phone, '') as phone,
    coalesce(u.email::text, '') as email,
    u.last_sign_in_at
  from public.memberships m
  left join public.profiles p on p.user_id = m.user_id
  left join auth.users u on u.id = m.user_id
  where m.school_id = _school_id
    and m.role in ('school_principal', 'teacher', 'admissions_staff', 'accountant', 'transport_manager')
    and public.is_school_leadership(_school_id)
  order by m.role, full_name;
$$;

revoke all on function public.principal_overview(uuid) from public;
revoke all on function public.attendance_report(uuid, date, date) from public;
revoke all on function public.student_attendance_percentage(uuid, date, date) from public;
revoke all on function public.enrolment_report(uuid) from public;
revoke all on function public.exam_result_summary(uuid, uuid) from public;
revoke all on function public.school_staff_directory(uuid) from public;

grant execute on function public.principal_overview(uuid) to authenticated;
grant execute on function public.attendance_report(uuid, date, date) to authenticated;
grant execute on function public.student_attendance_percentage(uuid, date, date) to authenticated;
grant execute on function public.enrolment_report(uuid) to authenticated;
grant execute on function public.exam_result_summary(uuid, uuid) to authenticated;
grant execute on function public.school_staff_directory(uuid) to authenticated;
