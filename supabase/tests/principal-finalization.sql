-- Principal finalization security and functional regression tests.
-- Run as one batch in Supabase SQL Editor; always rolls back cleanly at the end.
begin;

-- Fixtures (rolled back at the end)
insert into public.master_franchises (id, name, status) values
  ('70000000-0000-0000-0000-000000000001', 'PF Test Master A', 'active'),
  ('70000000-0000-0000-0000-000000000002', 'PF Test Master Suspended', 'suspended');

insert into public.franchises (id, master_franchise_id, name, status) values
  ('71000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'PF Franchise Active', 'active'),
  ('71000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', 'PF Franchise Suspended', 'suspended');

insert into public.schools (id, code, name, franchise_id, status) values
  ('72000000-0000-0000-0000-000000000001', 'PF-SCH-1', 'PF Active School', '71000000-0000-0000-0000-000000000001', 'active'),
  ('72000000-0000-0000-0000-000000000002', 'PF-SCH-2', 'PF Other School', '71000000-0000-0000-0000-000000000001', 'active'),
  ('72000000-0000-0000-0000-000000000003', 'PF-SCH-3', 'PF Suspended School', '71000000-0000-0000-0000-000000000001', 'suspended'),
  ('72000000-0000-0000-0000-000000000004', 'PF-SCH-4', 'PF Susp Franchise School', '71000000-0000-0000-0000-000000000002', 'active');

-- Users:
-- ...01 = Principal School 1
-- ...02 = Principal School 2
-- ...03 = Teacher School 1 (assigned to Class 1A)
-- ...04 = Student School 1
-- ...05 = Accountant School 1
-- ...06 = Franchisee (franchise 1)
-- ...07 = Master Owner (master 1)
-- ...08 = Central Super Admin
-- ...09 = Principal School 3 (suspended school)
-- ...10 = Principal School 4 (suspended franchise)
insert into public.memberships (user_id, school_id, role) values
  ('73000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', 'school_principal'),
  ('73000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000002', 'school_principal'),
  ('73000000-0000-0000-0000-000000000003', '72000000-0000-0000-0000-000000000001', 'teacher'),
  ('73000000-0000-0000-0000-000000000004', '72000000-0000-0000-0000-000000000001', 'student'),
  ('73000000-0000-0000-0000-000000000005', '72000000-0000-0000-0000-000000000001', 'accountant'),
  ('73000000-0000-0000-0000-000000000008', null, 'central_super_admin'),
  ('73000000-0000-0000-0000-000000000009', '72000000-0000-0000-0000-000000000003', 'school_principal'),
  ('73000000-0000-0000-0000-000000000010', '72000000-0000-0000-0000-000000000004', 'school_principal');

insert into public.memberships (user_id, franchise_id, role) values
  ('73000000-0000-0000-0000-000000000006', '71000000-0000-0000-0000-000000000001', 'franchise_owner');

insert into public.memberships (user_id, master_franchise_id, role) values
  ('73000000-0000-0000-0000-000000000007', '70000000-0000-0000-0000-000000000001', 'franchise_owner');

-- Seed classes & subjects & students across schools
insert into public.classes (id, school_id, name, section, class_teacher) values
  ('74000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', 'Class 1', 'A', '73000000-0000-0000-0000-000000000003'),
  ('74000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000001', 'Class 2', 'A', null),
  ('74000000-0000-0000-0000-000000000003', '72000000-0000-0000-0000-000000000002', 'Class 1', 'A', null),
  ('74000000-0000-0000-0000-000000000004', '72000000-0000-0000-0000-000000000003', 'Class 1', 'A', null),
  ('74000000-0000-0000-0000-000000000005', '72000000-0000-0000-0000-000000000004', 'Class 1', 'A', null);

insert into public.subjects (id, school_id, name, code) values
  ('75000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', 'Mathematics', 'MATH'),
  ('75000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000003', 'English', 'ENG');

insert into public.students (id, school_id, class_id, full_name, roll_no, gender, status) values
  ('76000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000001', 'Stu One', 1, 'male', 'active'),
  ('76000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000001', 'Stu Two', 2, 'female', 'active'),
  ('76000000-0000-0000-0000-000000000003', '72000000-0000-0000-0000-000000000002', '74000000-0000-0000-0000-000000000003', 'Other School Stu', 1, 'male', 'active'),
  ('76000000-0000-0000-0000-000000000004', '72000000-0000-0000-0000-000000000003', '74000000-0000-0000-0000-000000000004', 'Susp School Stu', 1, 'female', 'active');

insert into public.exams (id, school_id, name, exam_date, status) values
  ('77000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', 'Mid Term', current_date, 'marks_open'),
  ('77000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000003', 'Susp Term', current_date, 'marks_open');

insert into public.exam_marks (school_id, exam_id, class_id, subject_id, student_id, marks_obtained, max_marks, entered_by) values
  ('72000000-0000-0000-0000-000000000001', '77000000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000001', '75000000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000001', 90, 100, '73000000-0000-0000-0000-000000000001'),
  ('72000000-0000-0000-0000-000000000001', '77000000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000001', '75000000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000002', 75, 100, '73000000-0000-0000-0000-000000000001');

insert into public.attendance_records (school_id, class_id, student_id, att_date, status, marked_by) values
  ('72000000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000001', current_date, 'present', '73000000-0000-0000-0000-000000000003'),
  ('72000000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000002', current_date, 'absent', '73000000-0000-0000-0000-000000000003');

insert into public.admission_enquiries (school_id, child_name, stage, follow_up_date) values
  ('72000000-0000-0000-0000-000000000001', 'Enq Child', 'new', current_date);

insert into public.notices (school_id, title, audience, created_by) values
  ('72000000-0000-0000-0000-000000000001', 'Notice One', 'all', '73000000-0000-0000-0000-000000000001');

create temp table pf_test_results (test text, outcome text);

set local role authenticated;

-- ─── A. Suspended school & suspended franchise: read allowed, writes rejected ─

select set_config('request.jwt.claims', '{"sub":"73000000-0000-0000-0000-000000000009","role":"authenticated"}', true);
insert into pf_test_results select 'PF01 suspended school principal can read classes/students',
  case when exists (select 1 from public.classes where school_id = '72000000-0000-0000-0000-000000000003')
        and exists (select 1 from public.students where school_id = '72000000-0000-0000-0000-000000000003')
  then 'PASS' else 'FAIL' end;

do $$ begin
  begin insert into public.classes(school_id, name, section) values ('72000000-0000-0000-0000-000000000003', 'X', 'A'); insert into pf_test_results values ('PF02a suspended school blocks classes write', 'FAIL'); exception when insufficient_privilege or check_violation then insert into pf_test_results values ('PF02a suspended school blocks classes write', 'PASS'); end;
  begin insert into public.students(school_id, class_id, full_name) values ('72000000-0000-0000-0000-000000000003', '74000000-0000-0000-0000-000000000004', 'Blocked'); insert into pf_test_results values ('PF02b suspended school blocks students write', 'FAIL'); exception when insufficient_privilege or check_violation then insert into pf_test_results values ('PF02b suspended school blocks students write', 'PASS'); end;
  begin insert into public.attendance_records(school_id, class_id, student_id, att_date, status) values ('72000000-0000-0000-0000-000000000003', '74000000-0000-0000-0000-000000000004', '76000000-0000-0000-0000-000000000004', current_date, 'present'); insert into pf_test_results values ('PF02c suspended school blocks attendance write', 'FAIL'); exception when insufficient_privilege or check_violation then insert into pf_test_results values ('PF02c suspended school blocks attendance write', 'PASS'); end;
  begin insert into public.subjects(school_id, name, code) values ('72000000-0000-0000-0000-000000000003', 'Art', 'ART'); insert into pf_test_results values ('PF02d suspended school blocks subjects write', 'FAIL'); exception when insufficient_privilege or check_violation then insert into pf_test_results values ('PF02d suspended school blocks subjects write', 'PASS'); end;
  begin insert into public.timetable_slots(school_id, class_id, subject_id, teacher_user_id, day_of_week, period, start_time, end_time) values ('72000000-0000-0000-0000-000000000003', '74000000-0000-0000-0000-000000000004', '75000000-0000-0000-0000-000000000002', '73000000-0000-0000-0000-000000000009', 0, 1, '09:00', '09:45'); insert into pf_test_results values ('PF02e suspended school blocks timetable write', 'FAIL'); exception when insufficient_privilege or check_violation then insert into pf_test_results values ('PF02e suspended school blocks timetable write', 'PASS'); end;
  begin insert into public.homework(school_id, class_id, title, created_by) values ('72000000-0000-0000-0000-000000000003', '74000000-0000-0000-0000-000000000004', 'HW', auth.uid()); insert into pf_test_results values ('PF02f suspended school blocks homework write', 'FAIL'); exception when insufficient_privilege or check_violation then insert into pf_test_results values ('PF02f suspended school blocks homework write', 'PASS'); end;
  begin insert into public.exams(school_id, name, status) values ('72000000-0000-0000-0000-000000000003', 'Finals', 'draft'); insert into pf_test_results values ('PF02g suspended school blocks exams write', 'FAIL'); exception when insufficient_privilege or check_violation then insert into pf_test_results values ('PF02g suspended school blocks exams write', 'PASS'); end;
  begin insert into public.exam_marks(school_id, exam_id, class_id, subject_id, student_id, marks_obtained, max_marks, entered_by) values ('72000000-0000-0000-0000-000000000003', '77000000-0000-0000-0000-000000000002', '74000000-0000-0000-0000-000000000004', '75000000-0000-0000-0000-000000000002', '76000000-0000-0000-0000-000000000004', 50, 100, auth.uid()); insert into pf_test_results values ('PF02h suspended school blocks marks write', 'FAIL'); exception when insufficient_privilege or check_violation then insert into pf_test_results values ('PF02h suspended school blocks marks write', 'PASS'); end;
  begin insert into public.notices(school_id, title, created_by) values ('72000000-0000-0000-0000-000000000003', 'Blocked', auth.uid()); insert into pf_test_results values ('PF02i suspended school blocks notices write', 'FAIL'); exception when insufficient_privilege or check_violation then insert into pf_test_results values ('PF02i suspended school blocks notices write', 'PASS'); end;
  begin insert into public.admission_enquiries(school_id, child_name) values ('72000000-0000-0000-0000-000000000003', 'Blocked'); insert into pf_test_results values ('PF02j suspended school blocks enquiries write', 'FAIL'); exception when insufficient_privilege or check_violation then insert into pf_test_results values ('PF02j suspended school blocks enquiries write', 'PASS'); end;
end $$;

-- Suspended franchise blocks principal writes even when school status = 'active'
select set_config('request.jwt.claims', '{"sub":"73000000-0000-0000-0000-000000000010","role":"authenticated"}', true);
do $$ begin
  begin insert into public.subjects(school_id, name, code) values ('72000000-0000-0000-0000-000000000004', 'Blocked', 'BLK'); insert into pf_test_results values ('PF03 suspended franchise blocks school write', 'FAIL'); exception when insufficient_privilege or check_violation then insert into pf_test_results values ('PF03 suspended franchise blocks school write', 'PASS'); end;
end $$;

-- Central admin can still write to a suspended school
select set_config('request.jwt.claims', '{"sub":"73000000-0000-0000-0000-000000000008","role":"authenticated"}', true);
do $$ begin
  begin
    insert into public.subjects(school_id, name, code) values ('72000000-0000-0000-0000-000000000003', 'Central Allowed', 'CA');
    insert into pf_test_results values ('PF04 central admin can write on suspended school', 'PASS');
  exception when others then
    insert into pf_test_results values ('PF04 central admin can write on suspended school', 'FAIL');
  end;
end $$;

-- ─── B. Student admission_no uniqueness & auto-generation ───────────────────

select set_config('request.jwt.claims', '{"sub":"73000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
insert into pf_test_results select 'PF05 two inserts get distinct admission_no per school',
  case when (select count(distinct admission_no) from public.students where school_id = '72000000-0000-0000-0000-000000000001' and admission_no is not null) = 2
  then 'PASS' else 'FAIL' end;

-- ─── C. update_school_profile permissions & immutability ────────────────────

do $$
declare v_school public.schools;
begin
  select * into v_school from public.update_school_profile(
    '72000000-0000-0000-0000-000000000001',
    '+91 98111 00000', 'info@pf1.edu', '12 Main Rd', 'Jaipur', 'Rajasthan', 'Dr. Rao', ''
  );
  if v_school.phone = '+91 98111 00000' and v_school.code = 'PF-SCH-1' and v_school.status = 'active' then
    insert into pf_test_results values ('PF06 principal updates allowed school profile fields only', 'PASS');
  else
    insert into pf_test_results values ('PF06 principal updates allowed school profile fields only', 'FAIL');
  end if;
exception when others then
  insert into pf_test_results values ('PF06 principal updates allowed school profile fields only', 'FAIL');
end $$;

do $$ begin
  begin
    update public.schools set status = 'suspended', code = 'HACK' where id = '72000000-0000-0000-0000-000000000001';
    if found then insert into pf_test_results values ('PF07 principal direct update on schools denied', 'FAIL');
    else insert into pf_test_results values ('PF07 principal direct update on schools denied', 'PASS'); end if;
  exception when insufficient_privilege or check_violation then
    insert into pf_test_results values ('PF07 principal direct update on schools denied', 'PASS');
  end;
end $$;

select set_config('request.jwt.claims', '{"sub":"73000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
do $$ begin
  begin perform public.update_school_profile('72000000-0000-0000-0000-000000000001', '123'); insert into pf_test_results values ('PF08a teacher rejected from update_school_profile', 'FAIL'); exception when others then insert into pf_test_results values ('PF08a teacher rejected from update_school_profile', 'PASS'); end;
end $$;

select set_config('request.jwt.claims', '{"sub":"73000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
do $$ begin
  begin perform public.update_school_profile('72000000-0000-0000-0000-000000000001', '123'); insert into pf_test_results values ('PF08b other principal rejected from update_school_profile', 'FAIL'); exception when others then insert into pf_test_results values ('PF08b other principal rejected from update_school_profile', 'PASS'); end;
end $$;

select set_config('request.jwt.claims', '{"sub":"73000000-0000-0000-0000-000000000007","role":"authenticated"}', true);
do $$ begin
  begin perform public.update_school_profile('72000000-0000-0000-0000-000000000001', '123'); insert into pf_test_results values ('PF08c master owner rejected from update_school_profile', 'FAIL'); exception when others then insert into pf_test_results values ('PF08c master owner rejected from update_school_profile', 'PASS'); end;
end $$;

-- ─── D. promote_students ────────────────────────────────────────────────────

select set_config('request.jwt.claims', '{"sub":"73000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$
declare v_cnt int;
begin
  -- Bad batch (one valid + one from another school) must abort completely
  begin
    perform public.promote_students(
      '74000000-0000-0000-0000-000000000001',
      '74000000-0000-0000-0000-000000000002',
      array['76000000-0000-0000-0000-000000000001','76000000-0000-0000-0000-000000000003']::uuid[]
    );
    insert into pf_test_results values ('PF09a promote_students aborts whole batch on bad id', 'FAIL');
  exception when others then
    if exists (select 1 from public.students where id = '76000000-0000-0000-0000-000000000001' and class_id = '74000000-0000-0000-0000-000000000001') then
      insert into pf_test_results values ('PF09a promote_students aborts whole batch on bad id', 'PASS');
    else
      insert into pf_test_results values ('PF09a promote_students aborts whole batch on bad id', 'FAIL');
    end if;
  end;

  -- Cross-school destination class rejected
  begin
    perform public.promote_students(
      '74000000-0000-0000-0000-000000000001',
      '74000000-0000-0000-0000-000000000003',
      array['76000000-0000-0000-0000-000000000001']::uuid[]
    );
    insert into pf_test_results values ('PF09b promote_students rejects cross-school class', 'FAIL');
  exception when others then
    insert into pf_test_results values ('PF09b promote_students rejects cross-school class', 'PASS');
  end;

  -- Success path
  v_cnt := public.promote_students(
    '74000000-0000-0000-0000-000000000001',
    '74000000-0000-0000-0000-000000000002',
    array['76000000-0000-0000-0000-000000000002']::uuid[]
  );
  if v_cnt = 1 and exists (select 1 from public.students where id = '76000000-0000-0000-0000-000000000002' and class_id = '74000000-0000-0000-0000-000000000002') then
    insert into pf_test_results values ('PF09c promote_students moves student atomically', 'PASS');
  else
    insert into pf_test_results values ('PF09c promote_students moves student atomically', 'FAIL');
  end if;
end $$;

select set_config('request.jwt.claims', '{"sub":"73000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
do $$ begin
  begin perform public.promote_students('74000000-0000-0000-0000-000000000001','74000000-0000-0000-0000-000000000002',array['76000000-0000-0000-0000-000000000001']::uuid[]); insert into pf_test_results values ('PF09d teacher rejected from promote_students', 'FAIL'); exception when others then insert into pf_test_results values ('PF09d teacher rejected from promote_students', 'PASS'); end;
end $$;

-- ─── E. issue_transfer_certificate & TC privacy ─────────────────────────────

select set_config('request.jwt.claims', '{"sub":"73000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$
declare v_tc public.transfer_certificates;
begin
  select * into v_tc from public.issue_transfer_certificate('76000000-0000-0000-0000-000000000002', 'Family relocation', 'Good', 'Cleared');
  if v_tc.tc_no like 'TC-%' and exists (select 1 from public.students where id = '76000000-0000-0000-0000-000000000002' and status = 'left') then
    insert into pf_test_results values ('PF10a issue_transfer_certificate creates TC and marks student left', 'PASS');
  else
    insert into pf_test_results values ('PF10a issue_transfer_certificate creates TC and marks student left', 'FAIL');
  end if;
  begin
    perform public.issue_transfer_certificate('76000000-0000-0000-0000-000000000002', 'Second call');
    insert into pf_test_results values ('PF10b second TC call on same student fails', 'FAIL');
  exception when others then
    insert into pf_test_results values ('PF10b second TC call on same student fails', 'PASS');
  end;
end $$;

select set_config('request.jwt.claims', '{"sub":"73000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
insert into pf_test_results select 'PF10c teacher cannot read TC', case when (select count(*) from public.transfer_certificates) = 0 then 'PASS' else 'FAIL' end;

select set_config('request.jwt.claims', '{"sub":"73000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
insert into pf_test_results select 'PF10d student cannot read TC', case when (select count(*) from public.transfer_certificates) = 0 then 'PASS' else 'FAIL' end;

select set_config('request.jwt.claims', '{"sub":"73000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
insert into pf_test_results select 'PF10e accountant cannot read TC', case when (select count(*) from public.transfer_certificates) = 0 then 'PASS' else 'FAIL' end;

select set_config('request.jwt.claims', '{"sub":"73000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
insert into pf_test_results select 'PF10f other principal cannot read TC', case when (select count(*) from public.transfer_certificates) = 0 then 'PASS' else 'FAIL' end;

-- ─── F. Overview and Report RPCs ────────────────────────────────────────────

select set_config('request.jwt.claims', '{"sub":"73000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
insert into pf_test_results select 'PF11a principal_overview returns accurate counts',
  case when exists (
    select 1 from public.principal_overview('72000000-0000-0000-0000-000000000001') o
    where o.class_count = 2 and o.student_count = 1 and o.teacher_count = 1
      and o.attendance_today_marked = 2 and o.attendance_today_present = 1
      and o.enquiries_total = 1 and o.enquiries_followup_due = 1
      and o.exams_open_for_marks = 1 and o.exams_ready_to_publish = 1
  ) then 'PASS' else 'FAIL' end;

insert into pf_test_results select 'PF11b report RPCs return expected data for principal',
  case when exists (select 1 from public.attendance_report('72000000-0000-0000-0000-000000000001', current_date - 7, current_date))
        and exists (select 1 from public.student_attendance_percentage('72000000-0000-0000-0000-000000000001', current_date - 7, current_date))
        and exists (select 1 from public.enrolment_report('72000000-0000-0000-0000-000000000001'))
        and exists (select 1 from public.exam_result_summary('77000000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000001') where exam_rank = 1)
  then 'PASS' else 'FAIL' end;

-- Zero rows for teacher, student, other principal, master owner
select set_config('request.jwt.claims', '{"sub":"73000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
insert into pf_test_results select 'PF12a teacher gets zero rows from principal_overview & reports',
  case when not exists (select 1 from public.principal_overview('72000000-0000-0000-0000-000000000001'))
        and not exists (select 1 from public.attendance_report('72000000-0000-0000-0000-000000000001', current_date - 7, current_date))
  then 'PASS' else 'FAIL' end;

select set_config('request.jwt.claims', '{"sub":"73000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
insert into pf_test_results select 'PF12b student gets zero rows from principal_overview & reports',
  case when not exists (select 1 from public.principal_overview('72000000-0000-0000-0000-000000000001'))
        and not exists (select 1 from public.enrolment_report('72000000-0000-0000-0000-000000000001'))
  then 'PASS' else 'FAIL' end;

select set_config('request.jwt.claims', '{"sub":"73000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
insert into pf_test_results select 'PF12c other principal gets zero rows from principal_overview & reports',
  case when not exists (select 1 from public.principal_overview('72000000-0000-0000-0000-000000000001'))
        and not exists (select 1 from public.exam_result_summary('77000000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000001'))
  then 'PASS' else 'FAIL' end;

select set_config('request.jwt.claims', '{"sub":"73000000-0000-0000-0000-000000000007","role":"authenticated"}', true);
insert into pf_test_results select 'PF12d master owner gets zero rows from principal_overview',
  case when not exists (select 1 from public.principal_overview('72000000-0000-0000-0000-000000000001'))
  then 'PASS' else 'FAIL' end;

-- Franchisee of school and Central Admin get data
select set_config('request.jwt.claims', '{"sub":"73000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
insert into pf_test_results select 'PF13a franchisee gets data from principal_overview & reports',
  case when exists (select 1 from public.principal_overview('72000000-0000-0000-0000-000000000001'))
        and exists (select 1 from public.enrolment_report('72000000-0000-0000-0000-000000000001'))
  then 'PASS' else 'FAIL' end;

select set_config('request.jwt.claims', '{"sub":"73000000-0000-0000-0000-000000000008","role":"authenticated"}', true);
insert into pf_test_results select 'PF13b central admin gets data from principal_overview & reports',
  case when exists (select 1 from public.principal_overview('72000000-0000-0000-0000-000000000001'))
        and exists (select 1 from public.student_attendance_percentage('72000000-0000-0000-0000-000000000001', current_date - 7, current_date))
  then 'PASS' else 'FAIL' end;

-- ─── G. Audit rows written & membership delete unassigns class_teacher ──────

insert into pf_test_results select 'PF14 audit rows written for promote, issue_tc, and profile update',
  case when exists (select 1 from public.central_admin_audit_logs where action = 'promote_students' and details->>'school_id' = '72000000-0000-0000-0000-000000000001')
        and exists (select 1 from public.central_admin_audit_logs where action = 'issue_tc' and details->>'school_id' = '72000000-0000-0000-0000-000000000001')
        and exists (select 1 from public.central_admin_audit_logs where action = 'update_school_profile' and details->>'school_id' = '72000000-0000-0000-0000-000000000001')
  then 'PASS' else 'FAIL' end;

-- Deleting teacher membership unassigns class_teacher automatically
select set_config('request.jwt.claims', '{"sub":"73000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$ begin
  delete from public.memberships where user_id = '73000000-0000-0000-0000-000000000003' and school_id = '72000000-0000-0000-0000-000000000001' and role = 'teacher';
  if exists (select 1 from public.classes where id = '74000000-0000-0000-0000-000000000001' and class_teacher is null) then
    insert into pf_test_results values ('PF15 removing teacher membership clears class_teacher', 'PASS');
  else
    insert into pf_test_results values ('PF15 removing teacher membership clears class_teacher', 'FAIL');
  end if;
end $$;

reset role;
select * from pf_test_results order by test;
rollback;
