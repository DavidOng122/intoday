create table if not exists public.todos (
  user_id uuid not null references auth.users (id) on delete cascade,
  todo_id bigint not null,
  payload jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, todo_id)
);

create index if not exists todos_user_id_idx on public.todos (user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists todos_set_updated_at on public.todos;
create trigger todos_set_updated_at
before update on public.todos
for each row
execute function public.set_updated_at();

alter table public.todos enable row level security;

drop policy if exists "todos_select_own" on public.todos;
create policy "todos_select_own"
on public.todos
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "todos_insert_own" on public.todos;
create policy "todos_insert_own"
on public.todos
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "todos_update_own" on public.todos;
create policy "todos_update_own"
on public.todos
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "todos_delete_own" on public.todos;
create policy "todos_delete_own"
on public.todos
for delete
to authenticated
using (auth.uid() = user_id);
