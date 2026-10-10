create or replace function app_private.guard_task_workspace_reference()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_workspace_id text;
begin
  if tg_op = 'UPDATE'
     and old.user_id = new.user_id
     and old.payload->'desktopWorkspaceId'
         is not distinct from new.payload->'desktopWorkspaceId' then
    return new;
  end if;

  if jsonb_typeof(new.payload->'desktopWorkspaceId') is distinct from 'string' then
    raise exception 'Task Workspace is missing or inactive'
      using errcode = '23503', constraint = 'todos_workspace_active_fkey';
  end if;

  v_workspace_id := new.payload->>'desktopWorkspaceId';
  if nullif(btrim(v_workspace_id), '') is null or v_workspace_id <> btrim(v_workspace_id) then
    raise exception 'Task Workspace is missing or inactive'
      using errcode = '23503', constraint = 'todos_workspace_active_fkey';
  end if;

  perform 1
    from public.workspaces workspace
   where workspace.user_id = new.user_id
     and workspace.workspace_id = v_workspace_id
     and not workspace.is_deleted
   for share;

  if not found then
    raise exception 'Task Workspace is missing or inactive'
      using errcode = '23503', constraint = 'todos_workspace_active_fkey';
  end if;

  return new;
end;
$$;

revoke all on function app_private.guard_task_workspace_reference() from public, anon, authenticated, service_role;
drop trigger if exists todos_guard_workspace_reference on public.todos;
create trigger todos_guard_workspace_reference
before insert or update of user_id, payload on public.todos
for each row execute function app_private.guard_task_workspace_reference();

do $$
begin
  if to_regprocedure('public.apply_todo_mutation_unchecked(uuid,integer,text,bigint,jsonb,bigint)') is null then
    alter function public.apply_todo_mutation(uuid, integer, text, bigint, jsonb, bigint)
      rename to apply_todo_mutation_unchecked;
  end if;
end;
$$;

revoke all on function public.apply_todo_mutation_unchecked(uuid, integer, text, bigint, jsonb, bigint)
  from public, anon, authenticated, service_role;

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
  v_current public.todos%rowtype;
  v_current_found boolean := false;
  v_current_workspace_id text;
  v_requested_workspace_id text;
  v_constraint text;
  v_request jsonb;
  v_saved_request jsonb;
  v_saved_outcome jsonb;
  v_result jsonb;
begin
  if p_operation = 'update'
     and v_user_id is not null
     and p_operation_id is not null
     and p_todo_id > 0
     and p_expected_revision is not null
     and jsonb_typeof(p_payload) = 'object' then
    select protocol_version, legacy_writes_allowed
      into v_protocol_version, v_legacy_writes_allowed
      from app_private.todo_sync_config
     where singleton = true;

    if p_protocol_version is not distinct from v_protocol_version
       and not coalesce(v_legacy_writes_allowed, false)
       and not exists (
         select 1 from app_private.todo_mutation_operations operation
          where operation.user_id = v_user_id
            and operation.operation_id = p_operation_id
       ) then
      select * into v_current
        from public.todos
       where user_id = v_user_id and todo_id = p_todo_id;
      v_current_found := found;

      if v_current_found and not v_current.is_deleted
         and v_current.revision = p_expected_revision then
        v_current_workspace_id := v_current.payload->>'desktopWorkspaceId';
        v_requested_workspace_id := p_payload->>'desktopWorkspaceId';

        if v_current_workspace_id is distinct from v_requested_workspace_id
           and jsonb_typeof(p_payload->'desktopWorkspaceId') = 'string'
           and nullif(btrim(v_requested_workspace_id), '') is not null
           and v_requested_workspace_id = btrim(v_requested_workspace_id) then
          perform 1
            from public.workspaces workspace
           where workspace.user_id = v_user_id
             and workspace.workspace_id = v_requested_workspace_id
             and not workspace.is_deleted
           for share;
        end if;
      end if;
    end if;
  end if;

  begin
    return public.apply_todo_mutation_unchecked(
      p_operation_id,
      p_protocol_version,
      p_operation,
      p_todo_id,
      p_payload,
      p_expected_revision
    );
  exception when foreign_key_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint is distinct from 'todos_workspace_active_fkey' then
      raise;
    end if;
    if v_user_id is null or p_operation_id is null then
      raise;
    end if;

    v_request := jsonb_build_object(
      'protocol_version', p_protocol_version,
      'operation', p_operation,
      'todo_id', p_todo_id,
      'payload', p_payload,
      'expected_revision', p_expected_revision
    );
    v_result := jsonb_build_object('status', 'workspace_invalid', 'todo_id', p_todo_id);
    insert into app_private.todo_mutation_operations (user_id, operation_id, request, outcome)
    values (v_user_id, p_operation_id, v_request, v_result)
    on conflict (user_id, operation_id) do nothing;

    select request, outcome
      into v_saved_request, v_saved_outcome
      from app_private.todo_mutation_operations
     where user_id = v_user_id and operation_id = p_operation_id
     for update;
    if v_saved_request is distinct from v_request then
      raise exception 'Operation ID was reused for a different request'
        using errcode = '22023';
    end if;
    return coalesce(v_saved_outcome, v_result);
  end;
end;
$$;

revoke all on function public.apply_todo_mutation(uuid, integer, text, bigint, jsonb, bigint)
  from public, anon;
grant execute on function public.apply_todo_mutation(uuid, integer, text, bigint, jsonb, bigint)
  to authenticated;

comment on function public.apply_todo_mutation(uuid, integer, text, bigint, jsonb, bigint) is
  'CAS Task mutation endpoint. Workspace changes lock the destination Workspace before touching the Task, while a database trigger rejects invalid Workspace references on every write path.';
