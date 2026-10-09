create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated, service_role;

create table if not exists app_private.todo_sync_config (
  singleton boolean primary key default true check (singleton),
  protocol_version integer not null,
  legacy_writes_allowed boolean not null default true
);

insert into app_private.todo_sync_config (singleton, protocol_version, legacy_writes_allowed)
values (true, 1, true)
on conflict (singleton) do nothing;

revoke all on app_private.todo_sync_config from public, anon, authenticated, service_role;

alter table public.todos
  add column if not exists revision bigint not null default 0;

create table if not exists app_private.todo_id_registry (
  user_id uuid not null references auth.users (id) on delete cascade,
  todo_id bigint not null,
  registered_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, todo_id)
);

insert into app_private.todo_id_registry (user_id, todo_id)
select user_id, todo_id from public.todos
on conflict (user_id, todo_id) do nothing;

create table if not exists app_private.todo_mutation_operations (
  user_id uuid not null references auth.users (id) on delete cascade,
  operation_id uuid not null,
  request jsonb not null,
  outcome jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, operation_id)
);

revoke all on app_private.todo_id_registry from public, anon, authenticated, service_role;
revoke all on app_private.todo_mutation_operations from public, anon, authenticated, service_role;

create or replace function app_private.register_todo_id()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, app_private
as $$
begin
  insert into app_private.todo_id_registry (user_id, todo_id)
  values (new.user_id, new.todo_id)
  on conflict (user_id, todo_id) do nothing;
  return new;
end;
$$;

revoke all on function app_private.register_todo_id() from public, anon, authenticated, service_role;
drop trigger if exists todos_register_immutable_id on public.todos;
create trigger todos_register_immutable_id
after insert on public.todos
for each row execute function app_private.register_todo_id();

create or replace function app_private.guard_todo_direct_writes()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, app_private
as $$
declare
  v_legacy_writes_allowed boolean;
  v_rpc_authorized boolean;
begin
  select legacy_writes_allowed
    into v_legacy_writes_allowed
    from app_private.todo_sync_config
   where singleton = true;

  select exists (
    select 1
      from app_private.todo_mutation_operations operation
     where operation.user_id = coalesce(new.user_id, old.user_id)
       and operation.request->>'todo_id' = coalesce(new.todo_id, old.todo_id)::text
       and operation.outcome is null
       and (
         (tg_op = 'INSERT' and operation.request->>'operation' = 'create')
         or (tg_op = 'UPDATE' and operation.request->>'operation' in ('update', 'delete'))
       )
  ) into v_rpc_authorized;

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
drop trigger if exists todos_protocol_write_guard on public.todos;
create trigger todos_protocol_write_guard
before insert or update or delete on public.todos
for each row execute function app_private.guard_todo_direct_writes();

create or replace function public.apply_todo_mutation(
  p_operation_id uuid,
  p_protocol_version integer,
  p_operation text,
  p_todo_id bigint,
  p_payload jsonb default null,
  p_expected_revision bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_protocol_version integer;
  v_legacy_writes_allowed boolean;
  v_request jsonb;
  v_saved_request jsonb;
  v_saved_outcome jsonb;
  v_result jsonb;
  v_payload jsonb;
  v_row public.todos%rowtype;
  v_registered boolean;
  v_workspace_valid boolean;
  v_workspace_id text;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_operation_id is null or p_todo_id is null or p_todo_id <= 0 then
    raise exception 'A valid operation ID and Task ID are required' using errcode = '22023';
  end if;

  select protocol_version, legacy_writes_allowed
    into v_protocol_version, v_legacy_writes_allowed
    from app_private.todo_sync_config where singleton = true;
  if p_protocol_version is distinct from v_protocol_version then
    return jsonb_build_object('status', 'protocol_upgrade_required', 'required_protocol', v_protocol_version);
  end if;
  if v_legacy_writes_allowed then
    return jsonb_build_object('status', 'cutover_pending');
  end if;
  if p_operation not in ('create', 'update', 'delete') then
    raise exception 'Unsupported Task operation' using errcode = '22023';
  end if;
  if (p_operation = 'create' and (p_expected_revision is not null or jsonb_typeof(p_payload) is distinct from 'object'))
     or (p_operation <> 'create' and p_expected_revision is null)
     or (p_operation = 'delete' and p_payload is not null)
     or (p_operation = 'update' and jsonb_typeof(p_payload) is distinct from 'object') then
    raise exception 'Invalid Task mutation arguments' using errcode = '22023';
  end if;

  v_request := jsonb_build_object(
    'protocol_version', p_protocol_version,
    'operation', p_operation,
    'todo_id', p_todo_id,
    'payload', p_payload,
    'expected_revision', p_expected_revision
  );

  insert into app_private.todo_mutation_operations (user_id, operation_id, request)
  values (v_user_id, p_operation_id, v_request)
  on conflict (user_id, operation_id) do nothing;

  if not found then
    select request, outcome into v_saved_request, v_saved_outcome
      from app_private.todo_mutation_operations
     where user_id = v_user_id and operation_id = p_operation_id
     for update;
    if v_saved_request is distinct from v_request then
      raise exception 'Operation ID was reused for a different request' using errcode = '22023';
    end if;
    return coalesce(v_saved_outcome, jsonb_build_object('status', 'not_found'));
  end if;

  v_payload := jsonb_set(p_payload, '{id}', to_jsonb(p_todo_id), true);

  if p_operation = 'create' then
    v_workspace_id := nullif(btrim(v_payload->>'desktopWorkspaceId'), '');
    if v_workspace_id is not null then
      select true into v_workspace_valid
        from public.workspaces
       where user_id = v_user_id
         and workspace_id = v_workspace_id
         and is_deleted = false
       for share;
      if not coalesce(v_workspace_valid, false) then
        v_result := jsonb_build_object(
          'status', 'workspace_invalid', 'todo_id', p_todo_id
        );
        update app_private.todo_mutation_operations
           set outcome = v_result
         where user_id = v_user_id and operation_id = p_operation_id;
        return v_result;
      end if;
    end if;

    insert into app_private.todo_id_registry (user_id, todo_id)
    values (v_user_id, p_todo_id)
    on conflict (user_id, todo_id) do nothing
    returning true into v_registered;

    if not coalesce(v_registered, false) then
      select * into v_row from public.todos
       where user_id = v_user_id and todo_id = p_todo_id
       for update;
      if found and not v_row.is_deleted then
        v_result := jsonb_build_object(
          'status', 'conflict', 'todo_id', p_todo_id,
          'current_payload', v_row.payload, 'current_revision', v_row.revision
        );
      else
        v_result := jsonb_build_object('status', 'deleted', 'todo_id', p_todo_id);
      end if;
    else
      insert into public.todos (user_id, todo_id, payload, is_deleted, revision)
      values (v_user_id, p_todo_id, v_payload, false, 0);
      v_result := jsonb_build_object(
        'status', 'applied', 'todo_id', p_todo_id, 'payload', v_payload,
        'revision', 0, 'is_deleted', false
      );
    end if;
  elsif p_operation = 'update' then
    update public.todos
       set payload = v_payload, revision = revision + 1
     where user_id = v_user_id and todo_id = p_todo_id
       and is_deleted = false and revision = p_expected_revision
     returning * into v_row;
    if found then
      v_result := jsonb_build_object(
        'status', 'applied', 'todo_id', v_row.todo_id, 'payload', v_row.payload,
        'revision', v_row.revision, 'is_deleted', v_row.is_deleted
      );
    else
      select * into v_row from public.todos
       where user_id = v_user_id and todo_id = p_todo_id;
      if not found or v_row.is_deleted then
        v_result := jsonb_build_object('status', 'deleted', 'todo_id', p_todo_id);
      else
        v_result := jsonb_build_object(
          'status', 'conflict', 'todo_id', p_todo_id,
          'current_payload', v_row.payload, 'current_revision', v_row.revision
        );
      end if;
    end if;
  else
    update public.todos
       set is_deleted = true, revision = revision + 1
     where user_id = v_user_id and todo_id = p_todo_id
       and is_deleted = false and revision = p_expected_revision
     returning * into v_row;
    if found then
      v_result := jsonb_build_object(
        'status', 'applied', 'todo_id', v_row.todo_id, 'payload', v_row.payload,
        'revision', v_row.revision, 'is_deleted', true
      );
    else
      select * into v_row from public.todos
       where user_id = v_user_id and todo_id = p_todo_id;
      if not found or v_row.is_deleted then
        v_result := jsonb_build_object('status', 'deleted', 'todo_id', p_todo_id);
      else
        v_result := jsonb_build_object(
          'status', 'conflict', 'todo_id', p_todo_id,
          'current_payload', v_row.payload, 'current_revision', v_row.revision
        );
      end if;
    end if;
  end if;

  update app_private.todo_mutation_operations
     set outcome = v_result
   where user_id = v_user_id and operation_id = p_operation_id;
  return v_result;
end;
$$;

create or replace function public.get_todo_mutation_outcome(
  p_operation_id uuid,
  p_protocol_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, app_private, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_protocol_version integer;
  v_outcome jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select protocol_version into v_protocol_version
    from app_private.todo_sync_config where singleton = true;
  if p_protocol_version is distinct from v_protocol_version then
    return jsonb_build_object('status', 'protocol_upgrade_required', 'required_protocol', v_protocol_version);
  end if;
  select outcome into v_outcome
    from app_private.todo_mutation_operations
   where user_id = v_user_id and operation_id = p_operation_id;
  return coalesce(v_outcome, jsonb_build_object('status', 'not_found'));
end;
$$;

revoke all on function public.apply_todo_mutation(uuid, integer, text, bigint, jsonb, bigint) from public, anon;
revoke all on function public.get_todo_mutation_outcome(uuid, integer) from public, anon;
grant execute on function public.apply_todo_mutation(uuid, integer, text, bigint, jsonb, bigint) to authenticated;
grant execute on function public.get_todo_mutation_outcome(uuid, integer) to authenticated;

comment on table app_private.todo_sync_config is
  'Private Task sync rollout gate. Keep legacy_writes_allowed=true until journal-capable clients are adopted; cut over only via a separately reviewed migration.';
comment on table app_private.todo_id_registry is
  'Permanent per-user Task ID registry. Never remove IDs while old clients or pending operations may exist.';
comment on table app_private.todo_mutation_operations is
  'Idempotent Task mutation operation outcomes. Do not prune without an approved retry/tombstone retention policy.';
