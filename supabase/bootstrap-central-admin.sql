-- Run once, after every file in supabase/migrations has been applied.
-- Replace the email below with the first Central Admin's existing Auth email.
do $$
declare
  target_user_id uuid;
begin
  select id into target_user_id from auth.users where lower(email) = lower('replace-with-admin@example.com');
  if target_user_id is null then
    raise exception 'Create and confirm the first Auth user before running this script.';
  end if;
  insert into public.profiles (user_id, full_name, phone)
  values (target_user_id, 'Central Admin', '')
  on conflict (user_id) do nothing;
  insert into public.memberships (user_id, role)
  values (target_user_id, 'central_super_admin')
  on conflict do nothing;
end $$;
