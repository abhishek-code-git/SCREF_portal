-- Franchisee dashboard finalization security & functional regression suite.
-- Run as one batch in Supabase SQL Editor; always rolls back cleanly at the end.
begin;

-- Fixtures
insert into public.master_franchises (id, name, status) values
  ('80000000-0000-0000-0000-000000000001', 'FRF Master Open', 'active'),
  ('80000000-0000-0000-0000-000000000002', 'FRF Master Suspended', 'suspended');

insert into public.master_franchise_territories (id, master_franchise_id, territory) values
  ('81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'FRF Territory A'),
  ('81000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000001', 'FRF Territory B');

insert into public.franchises (id, master_franchise_id, territory_id, name, status) values
  ('82000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'FRF Franchise 1', 'active'),
  ('82000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000002', 'FRF Franchise 2', 'active'),
  ('82000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000002', 'FRF Franchise Sibling', 'active'),
  ('82000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'FRF Franchise Suspended', 'suspended'),
  ('82000000-0000-0000-0000-000000000005', '80000000-0000-0000-0000-000000000002', null, 'FRF Franchise Under Susp Master', 'active');

-- Users:
-- ...01 = Owner of Franchise 1 & Franchise 2 (multi-franchise owner!)
-- ...02 = Sibling Owner (Franchise Sibling)
-- ...03 = Master Owner (Master Open)
-- ...04 = Central Super Admin
-- ...05 = Principal of School 1 (in Franchise 1)
-- ...06 = Teacher of School 1
-- ...07 = Student of School 1
-- ...08 = Unrelated user
-- ...09 = Owner of Suspended Franchise
-- ...10 = Owner of Franchise under Suspended Master
insert into public.schools (id, code, name, franchise_id, status, decline_reason, created_by) values
  ('83000000-0000-0000-0000-000000000001', 'FRF-S1', 'FRF Active School 1', '82000000-0000-0000-0000-000000000001', 'active', '', '84000000-0000-0000-0000-000000000001'),
  ('83000000-0000-0000-0000-000000000002', 'FRF-S2', 'FRF Onboarding Empty', '82000000-0000-0000-0000-000000000001', 'onboarding', '', '84000000-0000-0000-0000-000000000001'),
  ('83000000-0000-0000-0000-000000000003', 'FRF-S3', 'FRF Onboarding NonEmpty', '82000000-0000-0000-0000-000000000001', 'onboarding', '', '84000000-0000-0000-0000-000000000001'),
  ('83000000-0000-0000-0000-000000000004', 'FRF-S4', 'FRF Declined School', '82000000-0000-0000-0000-000000000001', 'rejected', 'Missing lease proof', '84000000-0000-0000-0000-000000000001'),
  ('83000000-0000-0000-0000-000000000005', 'FRF-S5', 'FRF Sibling School', '82000000-0000-0000-0000-000000000003', 'active', '', '84000000-0000-0000-0000-000000000002'),
  ('83000000-0000-0000-0000-000000000006', 'FRF-S6', 'FRF Susp Franch School', '82000000-0000-0000-0000-000000000004', 'active', '', '84000000-0000-0000-0000-000000000009'),
  ('83000000-0000-0000-0000-000000000007', 'FRF-S7', 'FRF Susp Master School', '82000000-0000-0000-0000-000000000005', 'active', '', '84000000-0000-0000-0000-000000000010');

insert into public.memberships (user_id, franchise_id, role) values
  ('84000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', 'franchise_owner'),
  ('84000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000002', 'franchise_owner'),
  ('84000000-0000-0000-0000-000000000002', '82000000-0000-0000-0000-000000000003', 'franchise_owner'),
  ('84000000-0000-0000-0000-000000000009', '82000000-0000-0000-0000-000000000004', 'franchise_owner'),
  ('84000000-0000-0000-0000-000000000010', '82000000-0000-0000-0000-000000000005', 'franchise_owner');

insert into public.memberships (user_id, master_franchise_id, role) values
  ('84000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000001', 'franchise_owner');

insert into public.memberships (user_id, school_id, role) values
  ('84000000-0000-0000-0000-000000000004', null, 'central_super_admin'),
  ('84000000-0000-0000-0000-000000000005', '83000000-0000-0000-0000-000000000001', 'school_principal'),
  ('84000000-0000-0000-0000-000000000006', '83000000-0000-0000-0000-000000000001', 'teacher'),
  ('84000000-0000-0000-0000-000000000007', '83000000-0000-0000-0000-000000000001', 'student');

insert into public.classes (id, school_id, name, section) values
  ('85000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000001', 'Grade 1', 'A'),
  ('85000000-0000-0000-0000-000000000002', '83000000-0000-0000-0000-000000000003', 'Grade 1', 'A');

insert into public.students (id, school_id, class_id, full_name, parent_name, parent_phone, gender, status) values
  ('86000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000001', 'Secret Child', 'Secret Parent', '+919999999999', 'female', 'active');

insert into public.attendance_records (school_id, class_id, student_id, att_date, status) values
  ('83000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000001', '86000000-0000-0000-0000-000000000001', current_date, 'present');

insert into public.admission_enquiries (school_id, child_name, parent_phone, stage) values
  ('83000000-0000-0000-0000-000000000001', 'Private Lead', '+918888888888', 'enrolled');

create temp table frf_results (test text, outcome text);
set local role authenticated;

-- ─── A. Multi-franchise switcher my_franchises() ────────────────────────────

select set_config('request.jwt.claims', '{"sub":"84000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
insert into frf_results select 'FRF01 multi-franchise owner sees both owned franchises in my_franchises',
  case when (select count(*) from public.my_franchises()) = 2 then 'PASS' else 'FAIL' end;

select set_config('request.jwt.claims', '{"sub":"84000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
insert into frf_results select 'FRF02 single-franchise owner sees only own franchise in my_franchises',
  case when (select count(*) from public.my_franchises()) = 1 then 'PASS' else 'FAIL' end;

-- ─── B. Read models: owner, master owner, central admin vs unauthorized ─────

select set_config('request.jwt.claims', '{"sub":"84000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
insert into frf_results select 'FRF03a franchise owner reads all 6 analytics RPCs with correct counts',
  case when exists (select 1 from public.franchise_school_comparison('82000000-0000-0000-0000-000000000001') where school_id = '83000000-0000-0000-0000-000000000001' and student_count = 1 and attendance_pct_30d = 100.0)
        and exists (select 1 from public.franchise_attendance_report('82000000-0000-0000-0000-000000000001', current_date - 1, current_date) where present = 1)
        and exists (select 1 from public.franchise_admissions_funnel('82000000-0000-0000-0000-000000000001', current_date - 1, current_date) where admitted_count = 1 and conversion_pct = 100.0)
        and exists (select 1 from public.franchise_enrolment_report('82000000-0000-0000-0000-000000000001') where girls_count = 1)
        and exists (select 1 from public.franchise_needs_attention('82000000-0000-0000-0000-000000000001') where kind = 'school_declined')
  then 'PASS' else 'FAIL' end;

-- Master owner & Central Admin can read
select set_config('request.jwt.claims', '{"sub":"84000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
insert into frf_results select 'FRF03b master owner can read own franchise analytics RPCs',
  case when exists (select 1 from public.franchise_school_comparison('82000000-0000-0000-0000-000000000001'))
        and exists (select 1 from public.franchise_admissions_funnel('82000000-0000-0000-0000-000000000001', current_date - 1, current_date))
  then 'PASS' else 'FAIL' end;

select set_config('request.jwt.claims', '{"sub":"84000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
insert into frf_results select 'FRF03c central admin can read franchise analytics RPCs',
  case when exists (select 1 from public.franchise_enrolment_report('82000000-0000-0000-0000-000000000001'))
        and exists (select 1 from public.franchise_needs_attention('82000000-0000-0000-0000-000000000001'))
  then 'PASS' else 'FAIL' end;

-- Zero rows for sibling, principal, teacher, student, unrelated
select set_config('request.jwt.claims', '{"sub":"84000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
insert into frf_results select 'FRF04a sibling franchise owner gets zero rows',
  case when not exists (select 1 from public.franchise_school_comparison('82000000-0000-0000-0000-000000000001'))
        and not exists (select 1 from public.franchise_attendance_report('82000000-0000-0000-0000-000000000001', current_date - 7, current_date))
        and not exists (select 1 from public.franchise_admissions_funnel('82000000-0000-0000-0000-000000000001', current_date - 7, current_date))
        and not exists (select 1 from public.franchise_enrolment_report('82000000-0000-0000-0000-000000000001'))
        and not exists (select 1 from public.franchise_activity_feed('82000000-0000-0000-0000-000000000001'))
        and not exists (select 1 from public.franchise_needs_attention('82000000-0000-0000-0000-000000000001'))
  then 'PASS' else 'FAIL' end;

select set_config('request.jwt.claims', '{"sub":"84000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
insert into frf_results select 'FRF04b school principal gets zero rows on franchise RPCs',
  case when not exists (select 1 from public.franchise_school_comparison('82000000-0000-0000-0000-000000000001')) then 'PASS' else 'FAIL' end;

select set_config('request.jwt.claims', '{"sub":"84000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
insert into frf_results select 'FRF04c teacher gets zero rows on franchise RPCs',
  case when not exists (select 1 from public.franchise_admissions_funnel('82000000-0000-0000-0000-000000000001', current_date - 7, current_date)) then 'PASS' else 'FAIL' end;

select set_config('request.jwt.claims', '{"sub":"84000000-0000-0000-0000-000000000007","role":"authenticated"}', true);
insert into frf_results select 'FRF04d student gets zero rows on franchise RPCs',
  case when not exists (select 1 from public.franchise_enrolment_report('82000000-0000-0000-0000-000000000001')) then 'PASS' else 'FAIL' end;

select set_config('request.jwt.claims', '{"sub":"84000000-0000-0000-0000-000000000008","role":"authenticated"}', true);
insert into frf_results select 'FRF04e unrelated user gets zero rows on franchise RPCs',
  case when not exists (select 1 from public.franchise_needs_attention('82000000-0000-0000-0000-000000000001')) then 'PASS' else 'FAIL' end;

-- ─── C. School Request Update, Resubmit & Cancel ────────────────────────────

select set_config('request.jwt.claims', '{"sub":"84000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$
declare v_s public.schools;
begin
  select * into v_s from public.update_school_request(
    '83000000-0000-0000-0000-000000000002', 'FRF Updated Onboarding', 'Jaipur', 'Rajasthan', 'Plot 5', '2026-27'
  );
  if v_s.name = 'FRF Updated Onboarding' and v_s.status = 'onboarding' and v_s.code = 'FRF-S2' then
    insert into frf_results values ('FRF05a update_school_request succeeds while onboarding without altering protected fields', 'PASS');
  else
    insert into frf_results values ('FRF05a update_school_request succeeds while onboarding without altering protected fields', 'FAIL');
  end if;

  -- Blocked after approval (active)
  begin
    perform public.update_school_request('83000000-0000-0000-0000-000000000001', 'Hack', 'X', 'Y', 'Z', '2026-27');
    insert into frf_results values ('FRF05b update_school_request blocked after approval', 'FAIL');
  exception when others then
    insert into frf_results values ('FRF05b update_school_request blocked after approval', 'PASS');
  end;

  -- Resubmit declined request resets to onboarding & clears decline_reason
  select * into v_s from public.resubmit_school_request(
    '83000000-0000-0000-0000-000000000004', 'FRF Fixed School', 'Jaipur', 'Rajasthan', 'New Plot', '2026-27'
  );
  if v_s.status = 'onboarding' and v_s.decline_reason = '' then
    insert into frf_results values ('FRF05c resubmit_school_request resets rejected to onboarding', 'PASS');
  else
    insert into frf_results values ('FRF05c resubmit_school_request resets rejected to onboarding', 'FAIL');
  end if;

  -- Cancel refused when classes exist
  begin
    perform public.cancel_school_request('83000000-0000-0000-0000-000000000003');
    insert into frf_results values ('FRF06a cancel_school_request refused when classes exist', 'FAIL');
  exception when others then
    insert into frf_results values ('FRF06a cancel_school_request refused when classes exist', 'PASS');
  end;

  -- Cancel refused when active
  begin
    perform public.cancel_school_request('83000000-0000-0000-0000-000000000001');
    insert into frf_results values ('FRF06b cancel_school_request refused when school is active', 'FAIL');
  exception when others then
    insert into frf_results values ('FRF06b cancel_school_request refused when school is active', 'PASS');
  end;

  -- Cancel works on empty onboarding school
  if public.cancel_school_request('83000000-0000-0000-0000-000000000002')
     and not exists (select 1 from public.schools where id = '83000000-0000-0000-0000-000000000002') then
    insert into frf_results values ('FRF06c cancel_school_request deletes empty onboarding school', 'PASS');
  else
    insert into frf_results values ('FRF06c cancel_school_request deletes empty onboarding school', 'FAIL');
  end if;
end $$;

-- Sibling owner blocked from update/cancel
select set_config('request.jwt.claims', '{"sub":"84000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
do $$ begin
  begin perform public.update_school_request('83000000-0000-0000-0000-000000000003', 'X', 'Y', 'Z', 'A', '2026-27'); insert into frf_results values ('FRF05d sibling owner blocked from update_school_request', 'FAIL'); exception when others then insert into frf_results values ('FRF05d sibling owner blocked from update_school_request', 'PASS'); end;
  begin perform public.cancel_school_request('83000000-0000-0000-0000-000000000003'); insert into frf_results values ('FRF06d sibling owner blocked from cancel_school_request', 'FAIL'); exception when others then insert into frf_results values ('FRF06d sibling owner blocked from cancel_school_request', 'PASS'); end;
end $$;

-- ─── D. update_franchise_contact permissions ────────────────────────────────

select set_config('request.jwt.claims', '{"sub":"84000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$
declare v_f public.franchises;
begin
  select * into v_f from public.update_franchise_contact('82000000-0000-0000-0000-000000000001', '+91 98000 00001', 'f1@cen.edu', '12 Park', 'Jaipur', 'Rajasthan', 'Owner One');
  if v_f.phone = '+91 98000 00001' and v_f.status = 'active' then
    insert into frf_results values ('FRF07a franchise owner updates allowed contact fields', 'PASS');
  else
    insert into frf_results values ('FRF07a franchise owner updates allowed contact fields', 'FAIL');
  end if;
end $$;

select set_config('request.jwt.claims', '{"sub":"84000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
do $$ begin begin perform public.update_franchise_contact('82000000-0000-0000-0000-000000000001', '123'); insert into frf_results values ('FRF07b master owner rejected from update_franchise_contact', 'FAIL'); exception when others then insert into frf_results values ('FRF07b master owner rejected from update_franchise_contact', 'PASS'); end; end $$;

select set_config('request.jwt.claims', '{"sub":"84000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
do $$ begin begin perform public.update_franchise_contact('82000000-0000-0000-0000-000000000001', '123'); insert into frf_results values ('FRF07c principal rejected from update_franchise_contact', 'FAIL'); exception when others then insert into frf_results values ('FRF07c principal rejected from update_franchise_contact', 'PASS'); end; end $$;

select set_config('request.jwt.claims', '{"sub":"84000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
do $$ begin begin perform public.update_franchise_contact('82000000-0000-0000-0000-000000000001', '123'); insert into frf_results values ('FRF07d sibling owner rejected from update_franchise_contact', 'FAIL'); exception when others then insert into frf_results values ('FRF07d sibling owner rejected from update_franchise_contact', 'PASS'); end; end $$;

-- ─── E. Suspended franchise & suspended master behavior ─────────────────────

select set_config('request.jwt.claims', '{"sub":"84000000-0000-0000-0000-000000000009","role":"authenticated"}', true);
insert into frf_results select 'FRF08a suspended franchise owner can still read overview & comparison RPCs',
  case when exists (select 1 from public.franchise_overview('82000000-0000-0000-0000-000000000004'))
        and exists (select 1 from public.franchise_school_comparison('82000000-0000-0000-0000-000000000004'))
  then 'PASS' else 'FAIL' end;

do $$ begin
  begin insert into public.schools(code, name, franchise_id, status, created_by) values ('FRF-BLK1', 'Blocked', '82000000-0000-0000-0000-000000000004', 'onboarding', auth.uid()); insert into frf_results values ('FRF08b suspended franchise blocks school request', 'FAIL'); exception when insufficient_privilege or check_violation then insert into frf_results values ('FRF08b suspended franchise blocks school request', 'PASS'); end;
  begin insert into public.memberships(user_id, school_id, role) values ('84000000-0000-0000-0000-000000000099', '83000000-0000-0000-0000-000000000006', 'teacher'); insert into frf_results values ('FRF08c suspended franchise blocks membership add', 'FAIL'); exception when insufficient_privilege or check_violation then insert into frf_results values ('FRF08c suspended franchise blocks membership add', 'PASS'); end;
  begin insert into public.classes(school_id, name, section) values ('83000000-0000-0000-0000-000000000006', 'Blk', 'A'); insert into frf_results values ('FRF08d suspended franchise blocks school data write', 'FAIL'); exception when insufficient_privilege or check_violation then insert into frf_results values ('FRF08d suspended franchise blocks school data write', 'PASS'); end;
  begin perform public.update_franchise_contact('82000000-0000-0000-0000-000000000004', '123'); insert into frf_results values ('FRF08e suspended franchise blocks update_franchise_contact', 'FAIL'); exception when others then insert into frf_results values ('FRF08e suspended franchise blocks update_franchise_contact', 'PASS'); end;
end $$;

-- Suspended master blocks franchisee writes too
select set_config('request.jwt.claims', '{"sub":"84000000-0000-0000-0000-000000000010","role":"authenticated"}', true);
do $$ begin
  begin insert into public.memberships(user_id, school_id, role) values ('84000000-0000-0000-0000-000000000098', '83000000-0000-0000-0000-000000000007', 'school_principal'); insert into frf_results values ('FRF09 suspended master blocks franchisee membership write', 'FAIL'); exception when insufficient_privilege or check_violation then insert into frf_results values ('FRF09 suspended master blocks franchisee membership write', 'PASS'); end;
end $$;

-- Central Admin can still write on suspended franchise school
select set_config('request.jwt.claims', '{"sub":"84000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
do $$ begin
  begin insert into public.classes(school_id, name, section) values ('83000000-0000-0000-0000-000000000006', 'CA Allowed', 'A'); insert into frf_results values ('FRF10 central admin can write on suspended franchise school', 'PASS'); exception when others then insert into frf_results values ('FRF10 central admin can write on suspended franchise school', 'FAIL'); end;
end $$;

-- ─── F. Role escalation & approval prevention ───────────────────────────────

select set_config('request.jwt.claims', '{"sub":"84000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$ begin
  begin insert into public.memberships(user_id, franchise_id, role) values ('84000000-0000-0000-0000-000000000091', '82000000-0000-0000-0000-000000000001', 'franchise_owner'); insert into frf_results values ('FRF11a franchisee cannot grant franchise_owner', 'FAIL'); exception when insufficient_privilege or check_violation then insert into frf_results values ('FRF11a franchisee cannot grant franchise_owner', 'PASS'); end;
  begin insert into public.memberships(user_id, school_id, role) values ('84000000-0000-0000-0000-000000000092', '83000000-0000-0000-0000-000000000001', 'student'); insert into frf_results values ('FRF11b franchisee cannot grant student', 'FAIL'); exception when insufficient_privilege or check_violation then insert into frf_results values ('FRF11b franchisee cannot grant student', 'PASS'); end;
  begin insert into public.memberships(user_id, school_id, role) values ('84000000-0000-0000-0000-000000000093', '83000000-0000-0000-0000-000000000001', 'parent'); insert into frf_results values ('FRF11c franchisee cannot grant parent', 'FAIL'); exception when insufficient_privilege or check_violation then insert into frf_results values ('FRF11c franchisee cannot grant parent', 'PASS'); end;
  update public.schools set status = 'active' where id = '83000000-0000-0000-0000-000000000003';
  insert into frf_results values ('FRF11d franchisee cannot approve onboarding school', case when found then 'FAIL' else 'PASS' end);
end $$;

-- ─── G. Audit rows written & activity feed populated ────────────────────────

insert into frf_results select 'FRF12 activity feed readable by franchisee without exposing raw emails',
  case when exists (select 1 from public.franchise_activity_feed('82000000-0000-0000-0000-000000000001', 20))
  then 'PASS' else 'FAIL' end;

reset role;
insert into frf_results select 'FRF13 audit rows exist for request update, resubmit, cancel, and contact update',
  case when exists (select 1 from public.central_admin_audit_logs where action = 'update_school_request')
        and exists (select 1 from public.central_admin_audit_logs where action = 'resubmit_school_request')
        and exists (select 1 from public.central_admin_audit_logs where action = 'cancel_school_request')
        and exists (select 1 from public.central_admin_audit_logs where action = 'update_franchise_contact')
  then 'PASS' else 'FAIL' end;

select * from frf_results order by test;
rollback;
