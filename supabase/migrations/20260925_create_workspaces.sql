create table if not exists public.workspaces (
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id text not null,
  name text not null,
  is_deleted boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, workspace_id)
);

create index if not exists workspaces_user_id_idx
on public.workspaces (user_id);

create index if not exists workspaces_active_user_idx
on public.workspaces (user_id, is_deleted, updated_at desc);

alter table public.workspaces enable row level security;

revoke all on public.workspaces from anon;
grant select, insert, update, delete on public.workspaces to authenticated;

drop policy if exists "workspaces_select_own" on public.workspaces;
create policy "workspaces_select_own"
on public.workspaces
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "workspaces_insert_own" on public.workspaces;
create policy "workspaces_insert_own"
on public.workspaces
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "workspaces_update_own" on public.workspaces;
create policy "workspaces_update_own"
on public.workspaces
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "workspaces_delete_own" on public.workspaces;
create policy "workspaces_delete_own"
on public.workspaces
for delete
to authenticated
using (auth.uid() = user_id);

drop trigger if exists workspaces_set_updated_at on public.workspaces;
create trigger workspaces_set_updated_at
before update on public.workspaces
for each row
execute function public.set_updated_at();
