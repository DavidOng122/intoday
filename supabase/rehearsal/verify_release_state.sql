\set ON_ERROR_STOP on

do $$
declare
  v_versions text[];
begin
  select array_agg(version order by version)
    into v_versions
    from supabase_migrations.schema_migrations;
  if v_versions is distinct from array[
    '20260314',
    '20260421',
    '20260809085511',
    '20260916',
    '20260925',
    '20261010000000',
    '20261010010000',
    '20261010020000'
  ]::text[] then
    raise exception 'Unexpected migration history: %', v_versions;
  end if;

  if (select count(*) from public.todos
       where user_id = 'b1000000-0000-4000-8000-000000000001'
         and not is_deleted and revision = 0) <> 4 then
    raise exception 'Legacy Tasks were not preserved with revision zero';
  end if;
  if (select count(*) from app_private.todo_id_registry
       where user_id = 'b1000000-0000-4000-8000-000000000001') <> 4 then
    raise exception 'Legacy Task IDs were not registered';
  end if;
  if (select count(*) from public.workspaces
       where user_id = 'b1000000-0000-4000-8000-000000000001'
         and not is_deleted) <> 2 then
    raise exception 'Legacy Workspaces were not preserved';
  end if;
  if (select count(*) from app_private.workspace_id_registry
       where user_id = 'b1000000-0000-4000-8000-000000000001') <> 2 then
    raise exception 'Legacy Workspace IDs were not registered';
  end if;
  if not exists (
    select 1 from public.canvas_connections
     where user_id = 'b1000000-0000-4000-8000-000000000001'
       and connection_id = 'legacy-pack-a-pack-b'
       and not is_deleted
       and revision = 0
  ) then
    raise exception 'Legacy Canvas Connection was not preserved';
  end if;
  if (select legacy_writes_allowed from app_private.todo_sync_config where singleton) is not true then
    raise exception 'Migration unexpectedly performed the operational write cutover';
  end if;
end
$$;

select 'release migration state verified' as result;
