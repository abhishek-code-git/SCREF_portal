create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  subject text not null,
  category text not null default 'General',
  priority text not null default 'Normal',
  message text not null,
  status text not null default 'Open',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.support_tickets to authenticated;
grant all on public.support_tickets to service_role;
alter table public.support_tickets enable row level security;
create policy "own tickets select" on public.support_tickets for select to authenticated using (auth.uid() = user_id);
create policy "own tickets insert" on public.support_tickets for insert to authenticated with check (auth.uid() = user_id);
create policy "own tickets update" on public.support_tickets for update to authenticated using (auth.uid() = user_id);
create policy "own tickets delete" on public.support_tickets for delete to authenticated using (auth.uid() = user_id);

create table public.principal_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  title text not null,
  category text not null default 'Academic',
  due_date date,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.principal_tasks to authenticated;
grant all on public.principal_tasks to service_role;
alter table public.principal_tasks enable row level security;
create policy "own tasks select" on public.principal_tasks for select to authenticated using (auth.uid() = user_id);
create policy "own tasks insert" on public.principal_tasks for insert to authenticated with check (auth.uid() = user_id);
create policy "own tasks update" on public.principal_tasks for update to authenticated using (auth.uid() = user_id);
create policy "own tasks delete" on public.principal_tasks for delete to authenticated using (auth.uid() = user_id);