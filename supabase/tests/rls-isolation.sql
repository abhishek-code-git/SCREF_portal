-- RLS cross-school isolation tests for The Centennial Network (Phase 1).
-- Simulates authenticated users by switching the transaction role to
-- `authenticated` and swapping request.jwt.claims inside a transaction that is
-- rolled back, so the database is left untouched. Every result is collected in
-- a temp table so the final SELECT prints one PASS/FAIL line per test.
-- Run as a single statement batch via the database query tool.

begin;

-- Fixture schools + users (rolled back at the end)
insert into public.schools (id, code, name) values
  ('11111111-1111-1111-1111-111111111111', 'TEST-A', 'Test School A'),
  ('22222222-2222-2222-2222-222222222222', 'TEST-B', 'Test School B');

insert into public.memberships (user_id, school_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'school_principal'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'school_principal'),
  ('eeeeeeee-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'franchise_owner'),
  ('cccccccc-0000-0000-0000-000000000001', null, 'central_super_admin');

create temp table test_results (test text, outcome text);

-- Run everything below as a real authenticated role (RLS applies)
set local role authenticated;

-- Principal of School A
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- ---- Test 1: principal of School A sees only School A ----
insert into test_results
select 'T1 principal sees only own school',
  case when (select count(*) from public.schools) = 1 then 'PASS' else 'FAIL' end;

-- ---- Test 2: principal of School A cannot see School B ----
insert into test_results
select 'T2 no cross-school school read',
  case when not exists (select 1 from public.schools where code = 'TEST-B')
  then 'PASS' else 'FAIL' end;

-- ---- Test 3: principal of School A cannot read School B memberships ----
insert into test_results
select 'T3 no cross-school membership read',
  case when (
    select count(*) from public.memberships
    where school_id = '22222222-2222-2222-2222-222222222222'
  ) = 0 then 'PASS' else 'FAIL' end;

-- ---- Test 4: principal cannot grant a membership (insert denied) ----
do $$
begin
  begin
    insert into public.memberships (user_id, school_id, role)
    values ('bbbbbbbb-0000-0000-0000-000000000001',
            '11111111-1111-1111-1111-111111111111', 'teacher');
    insert into test_results values ('T4 membership insert denied for principal', 'FAIL');
  exception when insufficient_privilege OR check_violation THEN
    insert into test_results values ('T4 membership insert denied for principal', 'PASS');
  end;
end $$;

-- ---- Test 5: principal cannot edit another school's record ----
do $$
begin
  update public.schools set name = 'Hacked' where code = 'TEST-B';
  if found then
    insert into test_results values ('T5 cross-school school update denied', 'FAIL');
  else
    insert into test_results values ('T5 cross-school school update denied', 'PASS');
  end if;
end $$;

-- ---- Central admin ----
select set_config('request.jwt.claims',
  '{"sub":"cccccccc-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- ---- Test 6: central admin sees both schools ----
insert into test_results
select 'T6 central admin sees all schools',
  case when (select count(*) from public.schools) = 2 then 'PASS' else 'FAIL' end;

-- ---- Test 7: central admin can grant a membership ----
do $$
begin
  begin
    insert into public.memberships (user_id, school_id, role)
    values ('aaaaaaaa-0000-0000-0000-000000000002',
            '11111111-1111-1111-1111-111111111111', 'teacher');
    insert into test_results values ('T7 central admin can grant membership', 'PASS');
  exception when others then
    insert into test_results values ('T7 central admin can grant membership', 'FAIL');
  end;
end $$;

-- ---- Test 8: signed-in user with no membership sees no schools ----
select set_config('request.jwt.claims',
  '{"sub":"dddddddd-0000-0000-0000-000000000001","role":"authenticated"}', true);

insert into test_results
select 'T8 user without membership sees no schools',
  case when (select count(*) from public.schools) = 0 then 'PASS' else 'FAIL' end;

-- ---- Test 9: franchise owner aggregate includes only explicitly assigned schools ----
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000001","role":"authenticated"}', true);

insert into test_results
select 'T9 franchise dashboard only includes assigned schools',
  case when
    (select count(*) from public.franchise_network_dashboard()) = 1
    and not exists (
      select 1 from public.franchise_network_dashboard()
      where school_id = '22222222-2222-2222-2222-222222222222'
    )
  then 'PASS' else 'FAIL' end;

select test || ': ' || outcome as result from test_results order by test;

rollback;
