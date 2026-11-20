-- Central Admin policy regression checks.
-- Run in Supabase SQL Editor only after all migrations, wrapped in BEGIN/ROLLBACK.
-- Replace the UUID variables with existing test Auth users when exercising the
-- role-specific checks. This file never commits test data.
begin;

do $$
begin
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'master_franchise_territories_territory_unique_idx') then
    raise exception 'FAIL: territory uniqueness index is missing';
  end if;
  if not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'protect_last_super_admin') then
    raise exception 'FAIL: last-super-admin trigger function is missing';
  end if;
  if not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'admin_find_user_by_email') then
    raise exception 'FAIL: invite lookup function is missing';
  end if;
  raise notice 'PASS: Central Admin hardening objects exist';
end $$;

-- Manual role checks to run with real test accounts:
-- 1. As a Central Ops Admin, try inserting role central_super_admin: it must fail.
-- 2. As the only Central Super Admin, try deleting or demoting that membership: it must fail.
-- 3. As a Central Ops Admin, create a school membership: it must succeed.
-- 4. Insert territories that differ only by case/whitespace under different masters: the second must fail.
-- 5. With an authenticated browser JWT, call admin_find_user_by_email: it must fail permission denied.

rollback;
