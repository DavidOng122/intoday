create table if not exists app_private.workspace_id_registry (
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id text not null,
  registered_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, workspace_id)
);

insert into app_private.workspace_id_registry (user_id, workspace_id)
select user_id, workspace_id from public.workspaces
on conflict (user_id, workspace_id) do nothing;

create table if not exists app_private.workspace_deletion_operations (
  user_id uuid not null references auth.users (id) on delete cascade,
  operation_id uuid not null,
  request jsonb not null,
  outcome jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, operation_id)
);

create table if not exists app_private.storage_cleanup_jobs (
  job_id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text,
  local_storage_key text,
  created_at timestamptz not null default timezone('utc', now()),
  attempts integer not null default 0,
  last_error text,
  constraint storage_cleanup_jobs_has_target check (
    storage_path is not null or local_storage_key is not null
  )
);

create table if not exists app_private.retired_upload_paths (
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  retired_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, storage_path)
);

create index if not exists storage_cleanup_jobs_user_created_idx
  on app_private.storage_cleanup_jobs (user_id, created_at, job_id);

create table if not exists app_private.connection_mutation_operations (
  user_id uuid not null references auth.users (id) on delete cascade,
  operation_id uuid not null,
  request jsonb not null,
  outcome jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, operation_id)
);

revoke all on app_private.workspace_id_registry from public, anon, authenticated, service_role;
revoke all on app_private.workspace_deletion_operations from public, anon, authenticated, service_role;
revoke all on app_private.storage_cleanup_jobs from public, anon, authenticated, service_role;
revoke all on app_private.retired_upload_paths from public, anon, authenticated, service_role;
revoke all on app_private.connection_mutation_operations from public, anon, authenticated, service_role;

alter table public.canvas_connections
  add column if not exists revision bigint not null default 0;

create index if not exists todos_active_workspace_file_path_idx
  on public.todos (user_id, (payload->>'desktopWorkspaceId'), (payload->>'uploadedFileStoragePath'))
  where is_deleted = false;

create index if not exists todos_active_group_idx
  on public.todos (user_id, (payload->>'desktopWorkspaceId'), (payload->>'desktopGroupId'))
  where is_deleted = false;

create or replace function app_private.guard_upload_path_reuse()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_path text := nullif(new.payload->>'uploadedFileStoragePath', '');
  v_old_path text := case when tg_op = 'UPDATE' then nullif(old.payload->>'uploadedFileStoragePath', '') else null end;
begin
  if new.is_deleted or v_path is null or v_path is not distinct from v_old_path then
    return new;
  end if;
  if left(v_path, length(new.user_id::text) + 1) <> new.user_id::text || '/'
     or split_part(v_path, '/', 2) <> new.todo_id::text then
    raise exception 'Upload path must be owned by the user and bound to its Task'
      using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text || ':' || v_path, 0));
  if exists (
    select 1 from app_private.retired_upload_paths retired
     where retired.user_id = new.user_id and retired.storage_path = v_path
  ) then
    raise exception 'A retired upload path cannot be restored or reused'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

revoke all on function app_private.guard_upload_path_reuse() from public, anon, authenticated, service_role;
drop trigger if exists todos_guard_upload_path_reuse on public.todos;
create trigger todos_guard_upload_path_reuse
before insert or update of payload, is_deleted on public.todos
for each row execute function app_private.guard_upload_path_reuse();

create or replace function app_private.register_workspace_id()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  if exists (
    select 1 from public.workspaces workspace
     where workspace.user_id = new.user_id
       and workspace.workspace_id = new.workspace_id
       and not workspace.is_deleted
  ) then
    return new;
  end if;

  if exists (
    select 1 from app_private.workspace_id_registry registry
     where registry.user_id = new.user_id
       and registry.workspace_id = new.workspace_id
  ) then
    raise exception 'Workspace IDs cannot be restored or reused'
      using errcode = '55000';
  end if;

  insert into app_private.workspace_id_registry (user_id, workspace_id)
  values (new.user_id, new.workspace_id)
  on conflict (user_id, workspace_id) do nothing;
  return new;
end;
$$;

revoke all on function app_private.register_workspace_id() from public, anon, authenticated, service_role;
drop trigger if exists workspaces_register_immutable_id on public.workspaces;
create trigger workspaces_register_immutable_id
before insert on public.workspaces
for each row execute function app_private.register_workspace_id();

create or replace function app_private.queue_task_file_cleanup()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_path text := nullif(old.payload->>'uploadedFileStoragePath', '');
  v_local_key text := nullif(old.payload->>'uploadedFileStorageKey', '');
begin
  if not (
    (not old.is_deleted and new.is_deleted)
    or old.payload->>'uploadedFileStoragePath' is distinct from new.payload->>'uploadedFileStoragePath'
    or old.payload->>'uploadedFileStorageKey' is distinct from new.payload->>'uploadedFileStorageKey'
  ) then
    return new;
  end if;

  if not new.is_deleted
     and old.payload->>'uploadedFileStoragePath'
         is not distinct from new.payload->>'uploadedFileStoragePath' then
    v_path := null;
  end if;
  if not new.is_deleted
     and old.payload->>'uploadedFileStorageKey'
         is not distinct from new.payload->>'uploadedFileStorageKey' then
    v_local_key := null;
  end if;

  if v_path is not null then
    if left(v_path, length(new.user_id::text) + 1) <> new.user_id::text || '/' then
      v_path := null;
    else
      perform pg_advisory_xact_lock(hashtextextended(new.user_id::text || ':' || v_path, 0));
      if exists (
        select 1 from public.todos other
         where other.user_id = new.user_id
           and other.todo_id <> new.todo_id
           and not other.is_deleted
           and other.payload->>'uploadedFileStoragePath' = v_path
      ) then
        v_path := null;
      else
        insert into app_private.retired_upload_paths (user_id, storage_path)
        values (new.user_id, v_path)
        on conflict (user_id, storage_path) do nothing;
      end if;
    end if;
  end if;

  if v_local_key is not null and exists (
    select 1 from public.todos other
     where other.user_id = new.user_id
       and other.todo_id <> new.todo_id
       and not other.is_deleted
       and other.payload->>'uploadedFileStorageKey' = v_local_key
  ) then
    v_local_key := null;
  end if;
  if v_local_key is not null
     and left(v_local_key, length('upload:' || new.user_id::text || ':'))
         <> 'upload:' || new.user_id::text || ':' then
    v_local_key := null;
  end if;

  if v_path is not null or v_local_key is not null then
    insert into app_private.storage_cleanup_jobs (user_id, storage_path, local_storage_key)
    values (new.user_id, v_path, v_local_key);
  end if;
  return new;
end;
$$;

revoke all on function app_private.queue_task_file_cleanup() from public, anon, authenticated, service_role;
drop trigger if exists todos_queue_file_cleanup on public.todos;
create trigger todos_queue_file_cleanup
after update of payload, is_deleted on public.todos
for each row execute function app_private.queue_task_file_cleanup();

create or replace function app_private.guard_todo_direct_writes()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_user_id uuid := coalesce(new.user_id, old.user_id);
  v_todo_id bigint := coalesce(new.todo_id, old.todo_id);
  v_workspace_id text := coalesce(new.payload, old.payload)->>'desktopWorkspaceId';
  v_legacy_writes_allowed boolean;
  v_rpc_authorized boolean;
begin
  select legacy_writes_allowed into v_legacy_writes_allowed
    from app_private.todo_sync_config where singleton = true;

  select
    exists (
      select 1 from app_private.todo_mutation_operations operation
       where operation.user_id = v_user_id
         and operation.request->>'todo_id' = v_todo_id::text
         and operation.outcome is null
         and (
           (tg_op = 'INSERT' and operation.request->>'operation' = 'create')
           or (tg_op = 'UPDATE' and operation.request->>'operation' in ('update', 'delete'))
         )
    )
    or exists (
      select 1 from app_private.workspace_deletion_operations operation
       where operation.user_id = v_user_id
         and operation.request->>'workspace_id' = v_workspace_id
         and operation.outcome is null
         and tg_op in ('UPDATE', 'DELETE')
    )
    into v_rpc_authorized;

  if not coalesce(v_legacy_writes_allowed, false) and not v_rpc_authorized then
    raise exception 'Todo write protocol upgrade required'
      using errcode = '55000', hint = 'Reload the client and retry using the todo mutation protocol.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  if tg_op = 'UPDATE' and not v_rpc_authorized then
    new.revision := old.revision + 1;
  end if;
  return new;
end;
$$;

revoke all on function app_private.guard_todo_direct_writes() from public, anon, authenticated, service_role;

create or replace function app_private.cascade_workspace_contents(
  p_user_id uuid,
  p_workspace_id text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_task_ids bigint[];
begin
  delete from public.canvas_connections
   where user_id = p_user_id and workspace_id = p_workspace_id;

  select array_agg(todo_id) into v_task_ids
    from public.todos
   where user_id = p_user_id
     and not is_deleted
     and payload->>'desktopWorkspaceId' = p_workspace_id;

  update public.todos
     set is_deleted = true, revision = revision + 1
   where user_id = p_user_id
     and not is_deleted
     and payload->>'desktopWorkspaceId' = p_workspace_id;

  delete from public.todos
   where user_id = p_user_id
     and payload->>'desktopWorkspaceId' = p_workspace_id;

  if coalesce(cardinality(v_task_ids), 0) > 0 then
    delete from app_private.todo_mutation_operations operation
     where operation.user_id = p_user_id
       and operation.request->>'todo_id' = any (
         select task_id::text from unnest(v_task_ids) as task_id
       );
  end if;
end;
$$;

revoke all on function app_private.cascade_workspace_contents(uuid, text) from public, anon, authenticated, service_role;

create or replace function app_private.guard_workspace_deletion()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_workspace_id text := old.workspace_id;
  v_user_id uuid := old.user_id;
  v_deactivating boolean;
  v_authorized boolean;
  v_legacy_writes_allowed boolean;
  v_active_count bigint;
begin
  if tg_op = 'UPDATE' and old.is_deleted and not new.is_deleted then
    raise exception 'Workspace restore is not supported; create a new Workspace instead'
      using errcode = '55000';
  end if;
  v_deactivating := tg_op = 'DELETE' or (tg_op = 'UPDATE' and not old.is_deleted and new.is_deleted);
  if not v_deactivating then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  select exists (
    select 1 from app_private.workspace_deletion_operations operation
     where operation.user_id = v_user_id
       and operation.request->>'workspace_id' = v_workspace_id
       and operation.outcome is null
  ) into v_authorized;

  if tg_op = 'DELETE' and old.is_deleted and v_authorized then
    return old;
  end if;

  perform workspace.workspace_id
    from public.workspaces workspace
   where workspace.user_id = v_user_id and not workspace.is_deleted
   order by workspace.workspace_id
   for update;

  select count(*) into v_active_count
    from public.workspaces workspace
   where workspace.user_id = v_user_id and not workspace.is_deleted;
  if v_active_count <= 1 then
    raise exception 'At least one active Workspace must remain'
      using errcode = '23514';
  end if;

  if not v_authorized then
    select legacy_writes_allowed into v_legacy_writes_allowed
      from app_private.todo_sync_config where singleton = true;
    if tg_op = 'DELETE' or not coalesce(v_legacy_writes_allowed, false) then
      raise exception 'Workspace deletion protocol upgrade required'
        using errcode = '55000';
    end if;

    perform app_private.cascade_workspace_contents(v_user_id, v_workspace_id);
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function app_private.guard_workspace_deletion() from public, anon, authenticated, service_role;
drop trigger if exists workspaces_guard_delete on public.workspaces;
create trigger workspaces_guard_delete
before update or delete on public.workspaces
for each row execute function app_private.guard_workspace_deletion();

create or replace function public.delete_workspace_cascade(
  p_workspace_id text,
  p_operation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_request jsonb;
  v_saved_request jsonb;
  v_saved_outcome jsonb;
  v_result jsonb;
  v_workspace public.workspaces%rowtype;
  v_active_count bigint;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if nullif(btrim(p_workspace_id), '') is null or p_operation_id is null then
    raise exception 'Workspace ID and operation ID are required' using errcode = '22023';
  end if;

  v_request := jsonb_build_object('workspace_id', p_workspace_id);
  insert into app_private.workspace_deletion_operations (user_id, operation_id, request)
  values (v_user_id, p_operation_id, v_request)
  on conflict (user_id, operation_id) do nothing;
  if not found then
    select request, outcome into v_saved_request, v_saved_outcome
      from app_private.workspace_deletion_operations
     where user_id = v_user_id and operation_id = p_operation_id
     for update;
    if v_saved_request is distinct from v_request then
      raise exception 'Operation ID was reused for a different Workspace request'
        using errcode = '22023';
    end if;
    return coalesce(v_saved_outcome, jsonb_build_object('status', 'not_found'));
  end if;

  perform workspace.workspace_id
    from public.workspaces workspace
   where workspace.user_id = v_user_id and not workspace.is_deleted
   order by workspace.workspace_id
   for update;

  select * into v_workspace from public.workspaces workspace
   where workspace.user_id = v_user_id
     and workspace.workspace_id = p_workspace_id
     and not workspace.is_deleted
   for update;
  if not found then
    v_result := jsonb_build_object('status', 'not_found', 'workspace_id', p_workspace_id);
  else
    select count(*) into v_active_count from public.workspaces workspace
     where workspace.user_id = v_user_id and not workspace.is_deleted;
    if v_active_count <= 1 then
      v_result := jsonb_build_object('status', 'last_workspace', 'workspace_id', p_workspace_id);
    else
      perform app_private.cascade_workspace_contents(v_user_id, p_workspace_id);
      update public.workspaces
         set is_deleted = true, updated_at = timezone('utc', now())
       where user_id = v_user_id and workspace_id = p_workspace_id;
      delete from public.workspaces
       where user_id = v_user_id and workspace_id = p_workspace_id;
      v_result := jsonb_build_object('status', 'deleted', 'workspace_id', p_workspace_id);
    end if;
  end if;

  update app_private.workspace_deletion_operations
     set outcome = v_result
   where user_id = v_user_id and operation_id = p_operation_id;
  return v_result;
end;
$$;

create or replace function public.queue_orphan_upload_cleanup(
  p_storage_path text,
  p_local_storage_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_job_id bigint;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_storage_path is null
     or left(p_storage_path, length(v_user_id::text) + 1) <> v_user_id::text || '/' then
    raise exception 'Upload path is not owned by the authenticated user'
      using errcode = '42501';
  end if;
  if p_local_storage_key is not null
     and left(p_local_storage_key, length('upload:' || v_user_id::text || ':'))
         <> 'upload:' || v_user_id::text || ':' then
    p_local_storage_key := null;
  end if;
  if exists (
    select 1 from public.todos todo
     where todo.user_id = v_user_id
       and not todo.is_deleted
       and todo.payload->>'uploadedFileStoragePath' = p_storage_path
  ) then
    return jsonb_build_object('status', 'still_referenced');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_storage_path, 0));
  if exists (
    select 1 from public.todos todo
     where todo.user_id = v_user_id
       and not todo.is_deleted
       and todo.payload->>'uploadedFileStoragePath' = p_storage_path
  ) then
    return jsonb_build_object('status', 'still_referenced');
  end if;
  insert into app_private.retired_upload_paths (user_id, storage_path)
  values (v_user_id, p_storage_path)
  on conflict (user_id, storage_path) do nothing;

  insert into app_private.storage_cleanup_jobs (user_id, storage_path, local_storage_key)
  values (v_user_id, p_storage_path, p_local_storage_key)
  returning job_id into v_job_id;
  return jsonb_build_object('status', 'queued', 'job_id', v_job_id);
end;
$$;

create or replace function public.list_storage_cleanup_jobs()
returns table (
  job_id bigint,
  storage_path text,
  local_storage_key text
)
language sql
security definer
set search_path = pg_catalog, app_private, auth
as $$
  select job.job_id, job.storage_path, job.local_storage_key
    from app_private.storage_cleanup_jobs job
   where job.user_id = auth.uid()
   order by job.created_at, job.job_id
   limit 100
$$;

create or replace function public.storage_cleanup_job_is_safe(p_job_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_job app_private.storage_cleanup_jobs%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select * into v_job from app_private.storage_cleanup_jobs job
   where job.job_id = p_job_id and job.user_id = v_user_id
   for update;
  if not found then
    return jsonb_build_object('status', 'missing');
  end if;
  if v_job.storage_path is not null then
    if left(v_job.storage_path, length(v_user_id::text) + 1) <> v_user_id::text || '/' then
      return jsonb_build_object('status', 'unsafe');
    end if;
    perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || v_job.storage_path, 0));
    if exists (
      select 1 from public.todos todo
       where todo.user_id = v_user_id and not todo.is_deleted
         and todo.payload->>'uploadedFileStoragePath' = v_job.storage_path
    ) then
      return jsonb_build_object('status', 'still_referenced');
    end if;
  end if;
  if v_job.local_storage_key is not null and exists (
    select 1 from public.todos todo
     where todo.user_id = v_user_id and not todo.is_deleted
       and todo.payload->>'uploadedFileStorageKey' = v_job.local_storage_key
  ) then
    return jsonb_build_object('status', 'still_referenced');
  end if;
  if v_job.local_storage_key is not null
     and left(v_job.local_storage_key, length('upload:' || v_user_id::text || ':'))
         <> 'upload:' || v_user_id::text || ':' then
    return jsonb_build_object('status', 'unsafe');
  end if;
  return jsonb_build_object('status', 'safe');
end;
$$;

create or replace function public.ack_storage_cleanup_job(p_job_id bigint)
returns boolean
language sql
security definer
set search_path = pg_catalog, app_private, auth
as $$
  with removed as (
    delete from app_private.storage_cleanup_jobs
     where job_id = p_job_id and user_id = auth.uid()
     returning 1
  )
  select exists(select 1 from removed)
$$;

create or replace function public.fail_storage_cleanup_job(
  p_job_id bigint,
  p_error text
)
returns boolean
language sql
security definer
set search_path = pg_catalog, app_private, auth
as $$
  with updated as (
    update app_private.storage_cleanup_jobs
       set attempts = attempts + 1,
           last_error = left(coalesce(nullif(p_error, ''), 'Storage cleanup failed'), 500)
     where job_id = p_job_id and user_id = auth.uid()
     returning 1
  )
  select exists(select 1 from updated)
$$;

create or replace function public.legacy_upload_writes_allowed()
returns boolean
language sql
security definer
set search_path = pg_catalog, app_private
as $$
  select coalesce(
    (select config.legacy_writes_allowed
       from app_private.todo_sync_config config
      where config.singleton = true),
    false
  )
$$;

revoke all on function public.legacy_upload_writes_allowed() from public, anon;
grant execute on function public.legacy_upload_writes_allowed() to authenticated;

create or replace function app_private.guard_connection_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_user_id uuid := coalesce(new.user_id, old.user_id);
  v_connection_id text := coalesce(new.connection_id, old.connection_id);
  v_workspace_id text := coalesce(new.workspace_id, old.workspace_id);
  v_rpc_authorized boolean;
  v_legacy_writes_allowed boolean;
begin
  select legacy_writes_allowed into v_legacy_writes_allowed
    from app_private.todo_sync_config where singleton = true;

  select
    exists (
      select 1 from app_private.connection_mutation_operations operation
       where operation.user_id = v_user_id
         and operation.request->>'connection_id' = v_connection_id
         and operation.request->>'workspace_id' = v_workspace_id
         and operation.outcome is null
         and (
           (tg_op = 'INSERT' and operation.request->>'operation' = 'upsert')
           or (tg_op = 'UPDATE' and operation.request->>'operation' in ('upsert', 'delete'))
           or (tg_op = 'DELETE' and operation.request->>'operation' = 'delete')
         )
    )
    or exists (
      select 1 from app_private.workspace_deletion_operations operation
       where operation.user_id = v_user_id
         and operation.request->>'workspace_id' = v_workspace_id
         and operation.outcome is null
    )
    into v_rpc_authorized;

  if not coalesce(v_legacy_writes_allowed, false) and not v_rpc_authorized then
    raise exception 'Connection write protocol upgrade required'
      using errcode = '55000';
  end if;

  if tg_op <> 'DELETE' and not new.is_deleted then
    if not exists (
      select 1 from public.workspaces workspace
       where workspace.user_id = new.user_id
         and workspace.workspace_id = new.workspace_id
         and not workspace.is_deleted
    ) then
      raise exception 'Connection Workspace is not active'
        using errcode = '23503';
    end if;

    perform 1 from public.todos todo
     where todo.user_id = new.user_id
       and not todo.is_deleted
       and todo.payload->>'desktopWorkspaceId' = new.workspace_id
       and todo.payload->>'desktopGroupId' = new.source_group_id
     for share;
    if not found then
      raise exception 'Connection source Pack is not active'
        using errcode = '23503';
    end if;

    perform 1 from public.todos todo
     where todo.user_id = new.user_id
       and not todo.is_deleted
       and todo.payload->>'desktopWorkspaceId' = new.workspace_id
       and todo.payload->>'desktopGroupId' = new.target_group_id
     for share;
    if not found then
      raise exception 'Connection target Pack is not active'
        using errcode = '23503';
    end if;
  end if;

  if tg_op = 'UPDATE' and not v_rpc_authorized then
    new.revision := old.revision + 1;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function app_private.guard_connection_write() from public, anon, authenticated, service_role;
drop trigger if exists canvas_connections_guard_write on public.canvas_connections;
create trigger canvas_connections_guard_write
before insert or update or delete on public.canvas_connections
for each row execute function app_private.guard_connection_write();

create or replace function app_private.cleanup_orphaned_pack_connections()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_group_id text := old.payload->>'desktopGroupId';
  v_workspace_id text := old.payload->>'desktopWorkspaceId';
  v_user_id uuid := old.user_id;
  v_task_id bigint := old.todo_id;
  v_connection public.canvas_connections%rowtype;
  v_operation_id uuid;
begin
  if old.is_deleted
     or v_group_id is null
     or (
       not new.is_deleted
       and new.payload->>'desktopGroupId' is not distinct from v_group_id
       and new.payload->>'desktopWorkspaceId' is not distinct from v_workspace_id
     ) then
    return new;
  end if;

  if not exists (
    select 1 from public.todos todo
     where todo.user_id = v_user_id
       and not todo.is_deleted
       and todo.todo_id <> v_task_id
       and todo.payload->>'desktopGroupId' = v_group_id
       and todo.payload->>'desktopWorkspaceId' = v_workspace_id
  ) then
    for v_connection in
      select * from public.canvas_connections connection
       where connection.user_id = v_user_id
         and connection.workspace_id = v_workspace_id
         and not connection.is_deleted
         and (connection.source_group_id = v_group_id or connection.target_group_id = v_group_id)
       for update
    loop
      v_operation_id := gen_random_uuid();
      insert into app_private.connection_mutation_operations (user_id, operation_id, request)
      values (
        v_user_id,
        v_operation_id,
        jsonb_build_object(
          'operation', 'delete',
          'connection_id', v_connection.connection_id,
          'workspace_id', v_connection.workspace_id,
          'expected_revision', v_connection.revision
        )
      );

      update public.canvas_connections
         set is_deleted = true, revision = revision + 1
       where user_id = v_user_id
         and connection_id = v_connection.connection_id
         and revision = v_connection.revision;

      update app_private.connection_mutation_operations
         set outcome = jsonb_build_object(
           'status', 'applied',
           'connection_id', v_connection.connection_id,
           'revision', v_connection.revision + 1
         )
       where user_id = v_user_id and operation_id = v_operation_id;
    end loop;
  end if;
  return new;
end;
$$;

revoke all on function app_private.cleanup_orphaned_pack_connections() from public, anon, authenticated, service_role;
drop trigger if exists todos_cleanup_orphaned_pack_connections on public.todos;
create trigger todos_cleanup_orphaned_pack_connections
after update of payload, is_deleted on public.todos
for each row execute function app_private.cleanup_orphaned_pack_connections();

create or replace function public.apply_canvas_connection_mutation(
  p_operation_id uuid,
  p_operation text,
  p_connection_id text,
  p_workspace_id text,
  p_source_group_id text default null,
  p_source_side text default null,
  p_target_group_id text default null,
  p_target_side text default null,
  p_expected_revision bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_request jsonb;
  v_saved_request jsonb;
  v_saved_outcome jsonb;
  v_result jsonb;
  v_row public.canvas_connections%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_operation_id is null
     or p_operation not in ('upsert', 'delete')
     or nullif(btrim(p_connection_id), '') is null
     or nullif(btrim(p_workspace_id), '') is null
     or (p_operation = 'upsert' and (
       nullif(btrim(p_source_group_id), '') is null
       or nullif(btrim(p_target_group_id), '') is null
       or p_source_group_id = p_target_group_id
       or p_source_side not in ('left', 'right')
       or p_target_side not in ('left', 'right')
     ))
     or (p_operation = 'delete' and p_expected_revision is null) then
    raise exception 'Invalid Connection mutation arguments' using errcode = '22023';
  end if;

  v_request := jsonb_build_object(
    'operation', p_operation,
    'connection_id', p_connection_id,
    'workspace_id', p_workspace_id,
    'source_group_id', p_source_group_id,
    'source_side', p_source_side,
    'target_group_id', p_target_group_id,
    'target_side', p_target_side,
    'expected_revision', p_expected_revision
  );
  insert into app_private.connection_mutation_operations (user_id, operation_id, request)
  values (v_user_id, p_operation_id, v_request)
  on conflict (user_id, operation_id) do nothing;
  if not found then
    select request, outcome into v_saved_request, v_saved_outcome
      from app_private.connection_mutation_operations
     where user_id = v_user_id and operation_id = p_operation_id
     for update;
    if v_saved_request is distinct from v_request then
      raise exception 'Connection operation ID was reused for a different request'
        using errcode = '22023';
    end if;
    return coalesce(v_saved_outcome, jsonb_build_object('status', 'not_found'));
  end if;

  if p_operation = 'upsert' then
    select * into v_row from public.canvas_connections
     where user_id = v_user_id and connection_id = p_connection_id
     for update;
    if not found then
      if p_expected_revision is not null then
        v_result := jsonb_build_object('status', 'conflict');
      else
        insert into public.canvas_connections (
          user_id, connection_id, workspace_id, source_group_id, source_side,
          target_group_id, target_side, is_deleted, revision
        ) values (
          v_user_id, p_connection_id, p_workspace_id, p_source_group_id, p_source_side,
          p_target_group_id, p_target_side, false, 0
        )
        on conflict (user_id, connection_id) do nothing
        returning * into v_row;
        if found then
          v_result := jsonb_build_object(
            'status', 'applied', 'revision', v_row.revision, 'connection_id', v_row.connection_id
          );
        else
          select * into v_row from public.canvas_connections
           where user_id = v_user_id and connection_id = p_connection_id;
          v_result := jsonb_build_object(
            'status', 'conflict', 'revision', v_row.revision, 'connection_id', v_row.connection_id
          );
        end if;
      end if;
    elsif p_expected_revision is distinct from v_row.revision then
      v_result := jsonb_build_object(
        'status', 'conflict', 'revision', v_row.revision, 'connection_id', v_row.connection_id
      );
    else
      update public.canvas_connections
         set workspace_id = p_workspace_id,
             source_group_id = p_source_group_id,
             source_side = p_source_side,
             target_group_id = p_target_group_id,
             target_side = p_target_side,
             is_deleted = false,
             revision = revision + 1
       where user_id = v_user_id and connection_id = p_connection_id
       returning * into v_row;
      v_result := jsonb_build_object(
        'status', 'applied', 'revision', v_row.revision, 'connection_id', v_row.connection_id
      );
    end if;
  else
    update public.canvas_connections
       set is_deleted = true, revision = revision + 1
     where user_id = v_user_id
       and connection_id = p_connection_id
       and workspace_id = p_workspace_id
       and not is_deleted
       and revision = p_expected_revision
     returning * into v_row;
    if found then
      v_result := jsonb_build_object(
        'status', 'applied', 'revision', v_row.revision, 'connection_id', v_row.connection_id
      );
    else
      select * into v_row from public.canvas_connections
       where user_id = v_user_id and connection_id = p_connection_id;
      if not found or v_row.is_deleted then
        v_result := jsonb_build_object('status', 'deleted', 'connection_id', p_connection_id);
      else
        v_result := jsonb_build_object(
          'status', 'conflict', 'revision', v_row.revision, 'connection_id', v_row.connection_id
        );
      end if;
    end if;
  end if;

  update app_private.connection_mutation_operations
     set outcome = v_result
   where user_id = v_user_id and operation_id = p_operation_id;
  return v_result;
end;
$$;

revoke all on function public.delete_workspace_cascade(text, uuid) from public, anon;
revoke all on function public.queue_orphan_upload_cleanup(text, text) from public, anon;
revoke all on function public.list_storage_cleanup_jobs() from public, anon;
revoke all on function public.storage_cleanup_job_is_safe(bigint) from public, anon;
revoke all on function public.ack_storage_cleanup_job(bigint) from public, anon;
revoke all on function public.fail_storage_cleanup_job(bigint, text) from public, anon;
revoke all on function public.legacy_upload_writes_allowed() from public, anon;
revoke all on function public.apply_canvas_connection_mutation(uuid, text, text, text, text, text, text, text, bigint) from public, anon;
grant execute on function public.delete_workspace_cascade(text, uuid) to authenticated;
grant execute on function public.queue_orphan_upload_cleanup(text, text) to authenticated;
grant execute on function public.list_storage_cleanup_jobs() to authenticated;
grant execute on function public.storage_cleanup_job_is_safe(bigint) to authenticated;
grant execute on function public.ack_storage_cleanup_job(bigint) to authenticated;
grant execute on function public.fail_storage_cleanup_job(bigint, text) to authenticated;
grant execute on function public.apply_canvas_connection_mutation(uuid, text, text, text, text, text, text, text, bigint) to authenticated;

drop policy if exists "uploads_insert_own" on storage.objects;
create policy "uploads_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'uploads'
  and (storage.foldername(objects.name))[1] = (select auth.uid()::text)
  and (
    public.legacy_upload_writes_allowed()
    or exists (
      select 1 from public.todos todo
      join public.workspaces workspace
        on workspace.user_id = todo.user_id
       and workspace.workspace_id = todo.payload->>'desktopWorkspaceId'
       and not workspace.is_deleted
       where todo.user_id = (select auth.uid())
         and not todo.is_deleted
         and todo.todo_id::text = (storage.foldername(objects.name))[2]
         and todo.payload->>'uploadedFileStoragePath' = objects.name
    )
  )
);

drop policy if exists "uploads_update_own" on storage.objects;
create policy "uploads_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'uploads'
  and (storage.foldername(objects.name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'uploads'
  and (storage.foldername(objects.name))[1] = (select auth.uid()::text)
  and exists (
    select 1 from public.todos todo
     where todo.user_id = (select auth.uid())
       and not todo.is_deleted
       and todo.todo_id::text = (storage.foldername(objects.name))[2]
       and todo.payload->>'uploadedFileStoragePath' = objects.name
  )
);

comment on table app_private.storage_cleanup_jobs is
  'Durable per-user Storage cleanup outbox. Jobs are queued only when no active Task references the object path.';
comment on table app_private.workspace_id_registry is
  'Permanent Workspace ID fences; deleted IDs cannot be restored or reused.';
comment on function public.delete_workspace_cascade(text, uuid) is
  'Serializes per-user Workspace deletion, refuses the last active Workspace, and cascades owned content atomically.';
comment on function public.apply_canvas_connection_mutation(uuid, text, text, text, text, text, text, text, bigint) is
  'Idempotent per-Connection CAS mutation. Stale Connection edits are rejected rather than replayed.';
