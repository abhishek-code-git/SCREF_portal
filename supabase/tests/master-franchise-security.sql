-- Master Franchisee RLS and read-model tests. Run as one SQL Editor batch.
-- Fixtures and policy tests are enclosed in a transaction and rolled back.
begin;

insert into public.master_franchises(id, name, status) values
  ('71000000-0000-0000-0000-000000000001', 'Test Master A', 'active'),
  ('71000000-0000-0000-0000-000000000002', 'Test Master B', 'active'),
  ('71000000-0000-0000-0000-000000000003', 'Test Master Suspended', 'suspended');
insert into public.master_franchise_territories(id, master_franchise_id, territory) values
  ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'TEST-MASTER-A'),
  ('72000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000002', 'TEST-MASTER-B'),
  ('72000000-0000-0000-0000-000000000003', '71000000-0000-0000-0000-000000000003', 'TEST-MASTER-SUSPENDED');
insert into public.franchises(id, master_franchise_id, territory_id, name, status) values
  ('73000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', 'Active franchise A', 'active'),
  ('73000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', 'Pending franchise A', 'pending'),
  ('73000000-0000-0000-0000-000000000003', '71000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000002', 'Active franchise B', 'active');
insert into public.schools(id, code, name, status, franchise_id) values
  ('74000000-0000-0000-0000-000000000001', 'MTEST-A', 'Active School A', 'active', '73000000-0000-0000-0000-000000000001'),
  ('74000000-0000-0000-0000-000000000002', 'MTEST-B', 'Active School B', 'active', '73000000-0000-0000-0000-000000000003'),
  ('74000000-0000-0000-0000-000000000003', 'MTEST-ONBOARDING', 'Onboarding School A', 'onboarding', '73000000-0000-0000-0000-000000000001');
insert into public.classes(id, school_id, name, section) values
  ('75000000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000001', 'Grade 4', 'A');
insert into public.students(id, school_id, class_id, full_name, roll_no, parent_name, status) values
  ('76000000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000001', '75000000-0000-0000-0000-000000000001', 'Private Test Student', 1, 'Test Parent', 'active');
insert into public.attendance_records(id, school_id, class_id, student_id, att_date, status) values
  ('77000000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000001', '75000000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000001', current_date, 'present');
insert into public.memberships(user_id, master_franchise_id, role) values
  ('78000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'franchise_owner'),
  ('78000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000002', 'franchise_owner'),
  ('78000000-0000-0000-0000-000000000003', '71000000-0000-0000-0000-000000000003', 'franchise_owner'),
  ('78000000-0000-0000-0000-000000000004', '73000000-0000-0000-0000-000000000001', 'franchise_owner'),
  ('78000000-0000-0000-0000-000000000005', null, 'central_super_admin');
create temp table master_test_results(test text, outcome text) on commit drop;
grant all on master_test_results to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"78000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

do $$ begin
  begin
    insert into public.franchises(master_franchise_id, territory_id, name, status)
    values ('71000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', 'Requested franchise', 'pending');
    insert into master_test_results values ('Master can request pending franchise in own active network', 'PASS');
  exception when others then insert into master_test_results values ('Master can request pending franchise in own active network', 'FAIL'); end;
  begin
    insert into public.franchises(master_franchise_id, territory_id, name, status)
    values ('71000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', 'Invalid active request', 'active');
    insert into master_test_results values ('Master cannot request active franchise', 'FAIL');
  exception when insufficient_privilege or check_violation then insert into master_test_results values ('Master cannot request active franchise', 'PASS'); end;
  begin
    insert into public.franchises(master_franchise_id, territory_id, name, status)
    values ('71000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000002', 'Other network request', 'pending');
    insert into master_test_results values ('Master cannot request franchise in another master', 'FAIL');
  exception when insufficient_privilege or check_violation then insert into master_test_results values ('Master cannot request franchise in another master', 'PASS'); end;
  begin
    insert into public.franchises(master_franchise_id, territory_id, name, status)
    values ('71000000-0000-0000-0000-000000000003', '72000000-0000-0000-0000-000000000003', 'Suspended network request', 'pending');
    insert into master_test_results values ('Master cannot request franchise while suspended', 'FAIL');
  exception when insufficient_privilege or check_violation then insert into master_test_results values ('Master cannot request franchise while suspended', 'PASS'); end;
end $$;

do $$ begin
  begin update public.franchises set status = 'active' where id = '73000000-0000-0000-0000-000000000002';
    insert into master_test_results values ('Master cannot approve or change franchise status', case when found then 'FAIL' else 'PASS' end);
  exception when others then insert into master_test_results values ('Master cannot approve or change franchise status', 'PASS'); end;
  delete from public.franchises where id = '73000000-0000-0000-0000-000000000002';
  insert into master_test_results values ('Master cannot delete a franchise', case when found then 'FAIL' else 'PASS' end);
end $$;

do $$ begin
  begin
    insert into public.schools(name, status, franchise_id, created_by)
    values ('Requested School', 'onboarding', '73000000-0000-0000-0000-000000000001', auth.uid());
    insert into master_test_results values ('Master can request onboarding school under active own franchise', 'PASS');
  exception when others then insert into master_test_results values ('Master can request onboarding school under active own franchise', 'FAIL'); end;
  begin
    insert into public.schools(name, status, franchise_id, created_by)
    values ('Active School Request', 'active', '73000000-0000-0000-0000-000000000001', auth.uid());
    insert into master_test_results values ('Master cannot create active school', 'FAIL');
  exception when insufficient_privilege or check_violation then insert into master_test_results values ('Master cannot create active school', 'PASS'); end;
  begin
    insert into public.schools(name, status, franchise_id, created_by)
    values ('Other Network School', 'onboarding', '73000000-0000-0000-0000-000000000003', auth.uid());
    insert into master_test_results values ('Master cannot request school in another network', 'FAIL');
  exception when insufficient_privilege or check_violation then insert into master_test_results values ('Master cannot request school in another network', 'PASS'); end;
  begin
    insert into public.schools(name, status, franchise_id, created_by)
    values ('Pending Franchise School', 'onboarding', '73000000-0000-0000-0000-000000000002', auth.uid());
    insert into master_test_results values ('Master cannot request school under pending franchise', 'FAIL');
  exception when insufficient_privilege or check_violation then insert into master_test_results values ('Master cannot request school under pending franchise', 'PASS'); end;
  begin
    insert into public.schools(name, status, franchise_id, created_by)
    values ('Unassigned School', 'onboarding', null, auth.uid());
    insert into master_test_results values ('Master cannot request unassigned school', 'FAIL');
  exception when insufficient_privilege or check_violation then insert into master_test_results values ('Master cannot request unassigned school', 'PASS'); end;
  begin
    insert into public.schools(name, status, franchise_id, created_by)
    values ('Spoofed Creator School', 'onboarding', '73000000-0000-0000-0000-000000000001', '78000000-0000-0000-0000-000000000002');
    insert into master_test_results values ('Master cannot spoof school creator', 'FAIL');
  exception when insufficient_privilege or check_violation then insert into master_test_results values ('Master cannot spoof school creator', 'PASS'); end;
end $$;

do $$ begin
  update public.schools set status = 'active' where id = '74000000-0000-0000-0000-000000000003';
  insert into master_test_results values ('Master cannot approve own school request', case when found then 'FAIL' else 'PASS' end);
end $$;

do $$ begin
  begin
    insert into public.memberships(user_id, franchise_id, role) values ('79000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', 'franchise_owner');
    insert into master_test_results values ('Master can add franchise owner in own network', 'PASS');
  exception when others then insert into master_test_results values ('Master can add franchise owner in own network', 'FAIL'); end;
  begin
    insert into public.memberships(user_id, school_id, role) values ('79000000-0000-0000-0000-000000000002', '74000000-0000-0000-0000-000000000001', 'school_principal');
    insert into master_test_results values ('Master can add principal in own network', 'PASS');
  exception when others then insert into master_test_results values ('Master can add principal in own network', 'FAIL'); end;
  delete from public.memberships where user_id = '79000000-0000-0000-0000-000000000001' and franchise_id = '73000000-0000-0000-0000-000000000001';
  insert into master_test_results values ('Master can remove franchise owner in own network', case when found then 'PASS' else 'FAIL' end);
  delete from public.memberships where user_id = '79000000-0000-0000-0000-000000000002' and school_id = '74000000-0000-0000-0000-000000000001';
  insert into master_test_results values ('Master can remove principal in own network', case when found then 'PASS' else 'FAIL' end);
  begin
    insert into public.memberships(user_id, master_franchise_id, role) values ('79000000-0000-0000-0000-000000000003', '71000000-0000-0000-0000-000000000001', 'franchise_owner');
    insert into master_test_results values ('Master cannot grant master-level ownership', 'FAIL');
  exception when insufficient_privilege or check_violation then insert into master_test_results values ('Master cannot grant master-level ownership', 'PASS'); end;
  begin
    insert into public.memberships(user_id, school_id, role) values ('79000000-0000-0000-0000-000000000004', '74000000-0000-0000-0000-000000000001', 'teacher');
    insert into master_test_results values ('Master cannot grant teacher role', 'FAIL');
  exception when insufficient_privilege or check_violation then insert into master_test_results values ('Master cannot grant teacher role', 'PASS'); end;
  begin
    insert into public.memberships(user_id, role) values ('79000000-0000-0000-0000-000000000005', 'central_ops_admin');
    insert into master_test_results values ('Master cannot grant central role', 'FAIL');
  exception when insufficient_privilege or check_violation then insert into master_test_results values ('Master cannot grant central role', 'PASS'); end;
  begin
    insert into public.memberships(user_id, franchise_id, role) values ('79000000-0000-0000-0000-000000000006', '73000000-0000-0000-0000-000000000003', 'franchise_owner');
    insert into master_test_results values ('Master cannot touch another master people', 'FAIL');
  exception when insufficient_privilege or check_violation then insert into master_test_results values ('Master cannot touch another master people', 'PASS'); end;
end $$;

insert into master_test_results
select 'Master overview available only to owner and Central Admin',
  case when exists (select 1 from public.master_franchise_overview('71000000-0000-0000-0000-000000000001')) then 'PASS' else 'FAIL' end;
insert into master_test_results
select 'Master franchise stats available for own network',
  case when (select count(*) from public.master_franchise_franchise_stats('71000000-0000-0000-0000-000000000001')) >= 2 then 'PASS' else 'FAIL' end;
insert into master_test_results
select 'Master owner cannot read raw student rows', case when (select count(*) from public.students) = 0 then 'PASS' else 'FAIL' end;
insert into master_test_results
select 'Master owner cannot read raw attendance rows', case when (select count(*) from public.attendance_records) = 0 then 'PASS' else 'FAIL' end;
insert into master_test_results
select 'Existing franchise dashboard returns own network aggregate only',
  case when (select count(*) from public.franchise_network_dashboard('71000000-0000-0000-0000-000000000001', null)) = 2
       and not exists (select 1 from public.franchise_network_dashboard('71000000-0000-0000-0000-000000000001', null) where school_id = '74000000-0000-0000-0000-000000000002')
       then 'PASS' else 'FAIL' end;

select set_config('request.jwt.claims', '{"sub":"78000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
do $$ begin
  begin
    insert into public.franchises(master_franchise_id, territory_id, name, status)
    values ('71000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', 'Franchise-owner request', 'pending');
    insert into master_test_results values ('Franchise-level owner cannot request franchise', 'FAIL');
  exception when insufficient_privilege or check_violation then insert into master_test_results values ('Franchise-level owner cannot request franchise', 'PASS'); end;
  begin
    insert into public.memberships(user_id, school_id, role) values ('79000000-0000-0000-0000-000000000007', '74000000-0000-0000-0000-000000000001', 'school_principal');
    insert into master_test_results values ('Franchise-level owner cannot grant principal', 'FAIL');
  exception when insufficient_privilege or check_violation then insert into master_test_results values ('Franchise-level owner cannot grant principal', 'PASS'); end;
end $$;

select set_config('request.jwt.claims', '{"sub":"78000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
do $$ begin
  begin
    insert into public.franchises(master_franchise_id, territory_id, name, status)
    values ('71000000-0000-0000-0000-000000000003', '72000000-0000-0000-0000-000000000003', 'Suspended owner request', 'pending');
    insert into master_test_results values ('Owner cannot request franchise while own master is suspended', 'FAIL');
  exception when insufficient_privilege or check_violation then insert into master_test_results values ('Owner cannot request franchise while own master is suspended', 'PASS'); end;
end $$;

select set_config('request.jwt.claims', '{"sub":"78000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
insert into master_test_results select 'Owner of another master receives its own overview', case when exists (select 1 from public.master_franchise_overview('71000000-0000-0000-0000-000000000002')) then 'PASS' else 'FAIL' end;
insert into master_test_results select 'Owner of another master receives its own franchise stats', case when exists (select 1 from public.master_franchise_franchise_stats('71000000-0000-0000-0000-000000000002')) then 'PASS' else 'FAIL' end;
insert into master_test_results select 'Other master owner receives no overview rows', case when not exists (select 1 from public.master_franchise_overview('71000000-0000-0000-0000-000000000001')) then 'PASS' else 'FAIL' end;
insert into master_test_results select 'Other master owner receives no franchise stats', case when not exists (select 1 from public.master_franchise_franchise_stats('71000000-0000-0000-0000-000000000001')) then 'PASS' else 'FAIL' end;
select set_config('request.jwt.claims', '{"sub":"78000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
insert into master_test_results select 'Unrelated user receives no overview rows', case when not exists (select 1 from public.master_franchise_overview('71000000-0000-0000-0000-000000000001')) then 'PASS' else 'FAIL' end;
insert into master_test_results select 'Unrelated user receives no franchise stats', case when not exists (select 1 from public.master_franchise_franchise_stats('71000000-0000-0000-0000-000000000001')) then 'PASS' else 'FAIL' end;
select set_config('request.jwt.claims', '{"sub":"78000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
insert into master_test_results select 'Central Admin can read any master overview', case when exists (select 1 from public.master_franchise_overview('71000000-0000-0000-0000-000000000001')) then 'PASS' else 'FAIL' end;
insert into master_test_results select 'Central Admin can read any master franchise stats', case when (select count(*) from public.master_franchise_franchise_stats('71000000-0000-0000-0000-000000000001')) >= 2 then 'PASS' else 'FAIL' end;

reset role;
select test, outcome from master_test_results order by test;
do $$ begin
  if exists (select 1 from master_test_results where outcome <> 'PASS') then
    raise notice 'FAIL: one or more master franchise security checks failed';
  else
    raise notice 'PASS: all master franchise security checks passed';
  end if;
end $$;
rollback;
