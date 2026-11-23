-- Franchisee security regression tests. Run as one batch in the Supabase SQL editor.
-- The transaction is always rolled back; output contains PASS/FAIL rows only.
begin;

insert into public.master_franchises (id, name, status) values
  ('10000000-0000-0000-0000-000000000001', 'RLS Master A', 'active'),
  ('10000000-0000-0000-0000-000000000002', 'RLS Master B', 'active');
insert into public.master_franchise_territories (id, master_franchise_id, territory) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'A'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'B');
insert into public.franchises (id, master_franchise_id, territory_id, name, status) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'RLS Franchise A', 'active'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'RLS Franchise B', 'active');
insert into public.schools (id, code, name, franchise_id, status, created_by) values
  ('40000000-0000-0000-0000-000000000001', 'RLS-FR-A', 'RLS School A', '30000000-0000-0000-0000-000000000001', 'active', '90000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000002', 'RLS-FR-B', 'RLS School B', '30000000-0000-0000-0000-000000000002', 'active', '90000000-0000-0000-0000-000000000002');
insert into public.memberships (user_id, role, franchise_id) values
  ('90000000-0000-0000-0000-000000000001', 'franchise_owner', '30000000-0000-0000-0000-000000000001'),
  ('90000000-0000-0000-0000-000000000002', 'franchise_owner', '30000000-0000-0000-0000-000000000002');
insert into public.memberships (user_id, role, master_franchise_id) values
  ('90000000-0000-0000-0000-000000000003', 'franchise_owner', '10000000-0000-0000-0000-000000000001');
insert into public.memberships (user_id, role, school_id) values
  ('90000000-0000-0000-0000-000000000004', 'school_principal', '40000000-0000-0000-0000-000000000001'),
  ('90000000-0000-0000-0000-000000000005', 'teacher', '40000000-0000-0000-0000-000000000001'),
  ('90000000-0000-0000-0000-000000000006', 'central_super_admin', null);

create temp table test_results (test text, outcome text);
set local role authenticated;

-- Franchisee scope: own schools and aggregate only; sibling scope is invisible.
select set_config('request.jwt.claims', '{"sub":"90000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
insert into test_results select 'T1 franchisee sees own franchise school', case when exists (select 1 from public.schools where id = '40000000-0000-0000-0000-000000000001') then 'PASS' else 'FAIL' end;
insert into test_results select 'T2 franchisee cannot see sibling school', case when not exists (select 1 from public.schools where id = '40000000-0000-0000-0000-000000000002') then 'PASS' else 'FAIL' end;
insert into test_results select 'T3 franchise overview own scope', case when exists (select 1 from public.franchise_overview('30000000-0000-0000-0000-000000000001')) then 'PASS' else 'FAIL' end;
insert into test_results select 'T4 franchise overview sibling scope denied', case when not exists (select 1 from public.franchise_overview('30000000-0000-0000-0000-000000000002')) then 'PASS' else 'FAIL' end;

do $$ begin
  begin
    insert into public.schools(code, name, franchise_id, status, created_by) values ('RLS-REQ-A', 'Request A', '30000000-0000-0000-0000-000000000001', 'onboarding', auth.uid());
    insert into test_results values ('T5 franchisee requests onboarding school', 'PASS');
  exception when others then insert into test_results values ('T5 franchisee requests onboarding school', 'FAIL'); end;
  begin
    insert into public.schools(code, name, franchise_id, status, created_by) values ('RLS-REQ-B', 'Request B', '30000000-0000-0000-0000-000000000002', 'onboarding', auth.uid());
    insert into test_results values ('T6 franchisee cannot request sibling school', 'FAIL');
  exception when insufficient_privilege or check_violation then insert into test_results values ('T6 franchisee cannot request sibling school', 'PASS'); end;
  begin
    insert into public.memberships(user_id, school_id, role) values ('90000000-0000-0000-0000-000000000010', '40000000-0000-0000-0000-000000000001', 'school_principal');
    insert into test_results values ('T7 franchisee adds principal in own school', 'PASS');
  exception when others then insert into test_results values ('T7 franchisee adds principal in own school', 'FAIL'); end;
  begin
    insert into public.memberships(user_id, school_id, role) values ('90000000-0000-0000-0000-000000000011', '40000000-0000-0000-0000-000000000001', 'central_ops_admin');
    insert into test_results values ('T8 franchisee cannot grant central role', 'FAIL');
  exception when insufficient_privilege or check_violation then insert into test_results values ('T8 franchisee cannot grant central role', 'PASS'); end;
end $$;

-- Master owners retain aggregate access only; no raw school/student membership is granted by this migration.
select set_config('request.jwt.claims', '{"sub":"90000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
insert into test_results select 'T9 master owner overview allowed', case when exists (select 1 from public.franchise_overview('30000000-0000-0000-0000-000000000001')) then 'PASS' else 'FAIL' end;

-- Principal can manage staff in own school but not principals; teacher cannot manage any membership.
select set_config('request.jwt.claims', '{"sub":"90000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
do $$ begin
  begin insert into public.memberships(user_id, school_id, role) values ('90000000-0000-0000-0000-000000000012', '40000000-0000-0000-0000-000000000001', 'teacher'); insert into test_results values ('T10 principal adds own-school teacher', 'PASS'); exception when others then insert into test_results values ('T10 principal adds own-school teacher', 'FAIL'); end;
  begin insert into public.memberships(user_id, school_id, role) values ('90000000-0000-0000-0000-000000000013', '40000000-0000-0000-0000-000000000001', 'school_principal'); insert into test_results values ('T11 principal cannot add principal', 'FAIL'); exception when insufficient_privilege or check_violation then insert into test_results values ('T11 principal cannot add principal', 'PASS'); end;
end $$;
select set_config('request.jwt.claims', '{"sub":"90000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
do $$ begin
  begin insert into public.memberships(user_id, school_id, role) values ('90000000-0000-0000-0000-000000000014', '40000000-0000-0000-0000-000000000001', 'teacher'); insert into test_results values ('T12 teacher cannot grant membership', 'FAIL'); exception when insufficient_privilege or check_violation then insert into test_results values ('T12 teacher cannot grant membership', 'PASS'); end;
end $$;

reset role;
select * from test_results order by test;
rollback;
