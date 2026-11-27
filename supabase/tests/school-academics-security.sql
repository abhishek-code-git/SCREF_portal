-- School academics, principal finalization, and teacher security regression checks.
-- Run in Supabase SQL Editor wrapped in BEGIN/ROLLBACK.
begin;

do $$
declare
  t text;
begin
  -- 1. Verify tables exist
  foreach t in array array['subjects','timetable_slots','homework','exams','exam_marks','notices','admission_enquiries','transfer_certificates'] loop
    if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      raise exception 'FAIL: % table is missing', t;
    end if;
    if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = t and rowsecurity) then
      raise exception 'FAIL: RLS not enabled on %', t;
    end if;
  end loop;

  -- 2. Verify security policies & helpers exist
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'homework' and policyname = 'teachers create homework') then
    raise exception 'FAIL: teachers create homework policy missing';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'exam_marks' and policyname = 'teachers enter marks when open') then
    raise exception 'FAIL: teachers enter marks when open policy missing';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notices' and policyname = 'teachers create class notices') then
    raise exception 'FAIL: teachers create class notices policy missing';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'transfer_certificates' and policyname = 'leadership reads transfer certificates') then
    raise exception 'FAIL: leadership reads transfer certificates policy missing';
  end if;
  if not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'school_is_writable') then
    raise exception 'FAIL: school_is_writable helper missing';
  end if;

  raise notice 'PASS: All school academics & principal tables, RLS, and helpers are configured';
end $$;

rollback;
