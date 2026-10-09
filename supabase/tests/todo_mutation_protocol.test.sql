begin;

select plan(19);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  'a1000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'todo-sync-test@example.invalid',
  '',
  timezone('utc', now()),
  '{}'::jsonb,
  '{}'::jsonb,
  timezone('utc', now()),
  timezone('utc', now())
)
on conflict (id) do nothing;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  'a1000000-0000-4000-8000-000000000002',
  'authenticated',
  'authenticated',
  'todo-sync-other@example.invalid',
  '',
  timezone('utc', now()),
  '{}'::jsonb,
  '{}'::jsonb,
  timezone('utc', now()),
  timezone('utc', now())
)
on conflict (id) do nothing;

insert into public.todos (user_id, todo_id, payload)
values (
  'a1000000-0000-4000-8000-000000000002',
  910000020,
  '{"text":"belongs to another account"}'::jsonb
)
on conflict (user_id, todo_id) do nothing;

create function pg_temp.todo_test_payload(p_user_id uuid, p_todo_id bigint)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $$
  select payload from public.todos
   where user_id = p_user_id and todo_id = p_todo_id
$$;

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);

select is(
  public.apply_todo_mutation(
    'a2000000-0000-4000-8000-000000000001', 1, 'create', 910000001,
    '{"text":"created"}'::jsonb, null
  )->>'status',
  'cutover_pending',
  'New clients wait for the controlled legacy-write cutover'
);

insert into public.todos (user_id, todo_id, payload)
values ('a1000000-0000-4000-8000-000000000001', 910000010, '{"text":"legacy"}'::jsonb);
update public.todos
   set payload = '{"text":"legacy update"}'::jsonb
 where user_id = 'a1000000-0000-4000-8000-000000000001'
   and todo_id = 910000010;
select is(
  (select revision from public.todos
    where user_id = 'a1000000-0000-4000-8000-000000000001' and todo_id = 910000010),
  1::bigint,
  'Compatible legacy updates advance the revision during rollout'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);

select is(
  (select count(*)::integer from public.todos
    where user_id = 'a1000000-0000-4000-8000-000000000002'),
  0,
  'RLS hides another account Tasks from the authenticated user'
);

update public.todos set payload = '{"text":"cross-account update"}'::jsonb
 where user_id = 'a1000000-0000-4000-8000-000000000002'
   and todo_id = 910000020;

reset role;

select is(
  pg_temp.todo_test_payload('a1000000-0000-4000-8000-000000000002', 910000020),
  '{"text":"belongs to another account"}'::jsonb,
  'RLS prevents updating another account Task'
);

set local role authenticated;
select is(
  (select count(*)::integer from public.todos
    where user_id = 'a1000000-0000-4000-8000-000000000001'
      and todo_id = 910000010),
  1,
  'RLS still permits reading the authenticated account Task'
);

select throws_ok(
  $$insert into public.todos (user_id, todo_id, payload)
    values ('a1000000-0000-4000-8000-000000000002', 910000021, '{"text":"cross-account"}'::jsonb)$$,
  '42501',
  null,
  'RLS rejects inserting a Task for another account'
);

reset role;

update app_private.todo_sync_config
   set legacy_writes_allowed = false
 where singleton = true;

insert into public.workspaces (user_id, workspace_id, name, is_deleted)
values
  ('a1000000-0000-4000-8000-000000000001', 'active-workspace', 'Active', false),
  ('a1000000-0000-4000-8000-000000000001', 'deleted-workspace', 'Deleted', true);

select is(
  public.apply_todo_mutation(
    'a2000000-0000-4000-8000-000000000010', 1, 'create', 910000011,
    '{"text":"valid workspace","desktopWorkspaceId":"active-workspace"}'::jsonb, null
  )->>'status',
  'applied',
  'Create accepts a Workspace owned by the authenticated user when active'
);

select is(
  public.apply_todo_mutation(
    'a2000000-0000-4000-8000-000000000011', 1, 'create', 910000012,
    '{"text":"invalid workspace","desktopWorkspaceId":"deleted-workspace"}'::jsonb, null
  )->>'status',
  'workspace_invalid',
  'Create rejects a deleted Workspace without reserving the Task ID'
);

select is(
  public.apply_todo_mutation(
    'a2000000-0000-4000-8000-000000000001', 1, 'create', 910000001,
    '{"text":"created"}'::jsonb, null
  )->>'status',
  'applied',
  'Create registers a never-seen Task ID'
);

select is(
  (public.apply_todo_mutation(
    'a2000000-0000-4000-8000-000000000001', 1, 'create', 910000001,
    '{"text":"created"}'::jsonb, null
  )->>'revision')::integer,
  0,
  'Retrying the same operation ID returns its original revision'
);

select is(
  public.apply_todo_mutation(
    'a2000000-0000-4000-8000-000000000002', 1, 'update', 910000001,
    '{"text":"updated"}'::jsonb, 0
  )->>'status',
  'applied',
  'Update with the current revision succeeds'
);

select is(
  public.apply_todo_mutation(
    'a2000000-0000-4000-8000-000000000003', 1, 'update', 910000001,
    '{"text":"stale"}'::jsonb, 0
  )->>'status',
  'conflict',
  'Stale Update is rejected without replacing the current Task'
);

select is(
  public.apply_todo_mutation(
    'a2000000-0000-4000-8000-000000000004', 1, 'delete', 910000001,
    null, 1
  )->>'status',
  'applied',
  'Delete with the current revision creates a tombstone'
);

select is(
  public.apply_todo_mutation(
    'a2000000-0000-4000-8000-000000000005', 1, 'update', 910000001,
    '{"text":"resurrect"}'::jsonb, 2
  )->>'status',
  'deleted',
  'Update cannot revive a tombstoned Task'
);

select is(
  public.apply_todo_mutation(
    'a2000000-0000-4000-8000-000000000006', 1, 'create', 910000001,
    '{"text":"reuse"}'::jsonb, null
  )->>'status',
  'deleted',
  'Create cannot reuse a registered deleted Task ID'
);

select is(
  public.apply_todo_mutation(
    'a2000000-0000-4000-8000-000000000007', 0, 'create', 910000002,
    '{"text":"old protocol"}'::jsonb, null
  )->>'status',
  'protocol_upgrade_required',
  'RPC rejects an unsupported client protocol'
);

select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$select public.apply_todo_mutation(
    'a2000000-0000-4000-8000-000000000008', 1, 'create', 910000003,
    '{"text":"anonymous"}'::jsonb, null
  )$$,
  '42501',
  null,
  'Unauthenticated RPC calls are rejected'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
select set_config('app.todo_mutation_rpc', 'enabled', true);

select throws_ok(
  $$insert into public.todos (user_id, todo_id, payload)
    values ('a1000000-0000-4000-8000-000000000001', 910000004, '{"text":"legacy"}'::jsonb)$$,
  '55000',
  null,
  'Legacy direct writes remain blocked even if a client spoofs the former RPC GUC'
);

select is(
  public.apply_todo_mutation(
    'a2000000-0000-4000-8000-000000000009', 1, 'create', 910000005,
    '{"text":"protocol"}'::jsonb, null
  )->>'status',
  'applied',
  'Protocol RPC remains usable while legacy direct writes are blocked'
);

reset role;
select * from finish();
rollback;
