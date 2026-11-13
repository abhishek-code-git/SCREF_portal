CREATE OR REPLACE FUNCTION public.handle_new_user_centre()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  new_school_id uuid;
  inv record;
  found_invite boolean := false;
begin
  for inv in
    select *
    from public.staff_invites
    where lower(email) = lower(new.email)
      and accepted_at is null
  loop
    found_invite := true;
    insert into public.memberships (user_id, school_id, role)
    values (new.id, inv.school_id, inv.role)
    on conflict do nothing;

    if inv.class_id is not null and inv.role = 'teacher' then
      update public.classes
      set class_teacher = new.id
      where id = inv.class_id
        and class_teacher is null;
    end if;

    update public.staff_invites
    set accepted_at = now()
    where id = inv.id;
  end loop;

  if not found_invite
    and not exists (select 1 from public.memberships where user_id = new.id)
  then
    insert into public.schools (code, name, city, state, address, academic_year, status, created_by)
    values (
      'CEN-' || lpad(nextval('public.school_code_seq')::text, 4, '0'),
      coalesce(nullif(new.raw_user_meta_data->>'centre_name', ''), 'My Centre'),
      coalesce(new.raw_user_meta_data->>'city', ''),
      coalesce(new.raw_user_meta_data->>'state', ''),
      coalesce(new.raw_user_meta_data->>'address', ''),
      coalesce(nullif(new.raw_user_meta_data->>'academic_year', ''), '2026-27'),
      'onboarding',
      new.id
    )
    returning id into new_school_id;

    insert into public.memberships (user_id, school_id, role)
    values (new.id, new_school_id, 'franchise_owner');
  end if;

  return new;
end
$function$;