create table if not exists public.canvas_connections (
  user_id uuid not null references auth.users (id) on delete cascade,
  connection_id text not null,
  workspace_id text not null,
  source_group_id text not null,
  source_side text not null,
  target_group_id text not null,
  target_side text not null,
  is_deleted boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, connection_id),
  constraint canvas_connections_source_side_check check (source_side in ('left', 'right')),
  constraint canvas_connections_target_side_check check (target_side in ('left', 'right')),
  constraint canvas_connections_distinct_groups_check check (source_group_id < target_group_id),
  constraint canvas_connections_unique_pair unique (
    user_id,
    workspace_id,
    source_group_id,
    target_group_id
  )
);

create index if not exists canvas_connections_active_workspace_idx
on public.canvas_connections (user_id, workspace_id)
where is_deleted = false;

drop trigger if exists canvas_connections_set_updated_at on public.canvas_connections;
create trigger canvas_connections_set_updated_at
before update on public.canvas_connections
for each row
execute function public.set_updated_at();

alter table public.canvas_connections enable row level security;

revoke all on public.canvas_connections from anon;
grant select, insert, update, delete on public.canvas_connections to authenticated;

drop policy if exists "canvas_connections_select_own" on public.canvas_connections;
create policy "canvas_connections_select_own"
on public.canvas_connections
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "canvas_connections_insert_own" on public.canvas_connections;
create policy "canvas_connections_insert_own"
on public.canvas_connections
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "canvas_connections_update_own" on public.canvas_connections;
create policy "canvas_connections_update_own"
on public.canvas_connections
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "canvas_connections_delete_own" on public.canvas_connections;
create policy "canvas_connections_delete_own"
on public.canvas_connections
for delete
to authenticated
using ((select auth.uid()) = user_id);
