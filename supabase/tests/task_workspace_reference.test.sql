begin;

select plan(17);

update app_private.todo_sync_config
   set legacy_writes_allowed = false
 where singleton = true;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    'a4000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'workspace-reference-test@example.invalid',
    '',
    timezone('utc', now()),
    '{}'::jsonb,
    '{}'::jsonb,
    timezone('utc', now()),
    timezone('utc', now())
  ),
  (
    'a4000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'workspace-reference-other@example.invalid',
    '',
    timezone('utc', now()),
    '{}'::jsonb,
    '{}'::jsonb,
    timezone('utc', now()),
    timezone('utc', now())
  )
on conflict (id) do nothing;

insert into public.workspaces (user_id, workspace_id, name, is_deleted)
values
  ('a4000000-0000-4000-8000-000000000001', 'reference-active', 'Active', false),
  ('a4000000-0000-4000-8000-000000000001', 'reference-next', 'Next', false),
  ('a4000000-0000-4000-8000-000000000001', 'reference-deleted', 'Deleted', true),
  ('a4000000-0000-4000-8000-000000000002', 'reference-other-user', 'Other user', false);

select set_config('request.jwt.claim.sub', 'a4000000-0000-4000-8000-000000000001', true);

select is(
  public.apply_todo_mutation(
    'a4100000-0000-4000-8000-000000000001', 1, 'create', 940000001,
    '{"text":"active","desktopWorkspaceId":"reference-active"}'::jsonb,
    null
  )->>'status',
  'applied',
  'Create accepts an active Workspace owned by the Task user'
);

select is(
  public.apply_todo_mutation(
    'a4100000-0000-4000-8000-000000000002', 1, 'create', 940000002,
    '{"text":"missing","desktopWorkspaceId":"reference-missing"}'::jsonb,
    null
  )->>'status',
  'workspace_invalid',
  'Create rejects a missing Workspace'
);

select is(
  (select count(*)::integer from public.todos
    where user_id = 'a4000000-0000-4000-8000-000000000001'
      and todo_id = 940000002),
  0,
  'Rejected Create does not insert a Task row'
);

insert into public.workspaces (user_id, workspace_id, name, is_deleted)
values ('a4000000-0000-4000-8000-000000000001', 'reference-missing', 'Created after rejection', false);

select is(
  public.apply_todo_mutation(
    'a4100000-0000-4000-8000-000000000002', 1, 'create', 940000002,
    '{"text":"missing","desktopWorkspaceId":"reference-missing"}'::jsonb,
    null
  )->>'status',
  'workspace_invalid',
  'Retrying a rejected Operation ID returns its saved outcome after Workspace state changes'
);

select is(
  public.apply_todo_mutation(
    'a4100000-0000-4000-8000-000000000003', 1, 'create', 940000003,
    '{"text":"deleted","desktopWorkspaceId":"reference-deleted"}'::jsonb,
    null
  )->>'status',
  'workspace_invalid',
  'Create rejects a deleted Workspace'
);

select is(
  public.apply_todo_mutation(
    'a4100000-0000-4000-8000-000000000004', 1, 'create', 940000004,
    '{"text":"cross user","desktopWorkspaceId":"reference-other-user"}'::jsonb,
    null
  )->>'status',
  'workspace_invalid',
  'Create rejects another user Workspace'
);

select is(
  public.apply_todo_mutation(
    'a4100000-0000-4000-8000-000000000005', 1, 'create', 940000005,
    '{"text":"missing workspace"}'::jsonb, null
  )->>'status',
  'workspace_invalid',
  'Create without a Workspace is rejected by the database guard'
);

select throws_ok(
  $$insert into public.todos (user_id, todo_id, payload)
    values (
      'a4000000-0000-4000-8000-000000000001',
      940000006,
      '{"text":"direct write","desktopWorkspaceId":"reference-direct-missing"}'::jsonb
    )$$,
  '23503',
  null,
  'Direct Task insert cannot bypass Workspace validation'
);

select is(
  public.apply_todo_mutation(
    'a4100000-0000-4000-8000-000000000006', 1, 'update', 940000001,
    '{"text":"invalid move","desktopWorkspaceId":"reference-update-missing"}'::jsonb, 0
  )->>'status',
  'workspace_invalid',
  'Update cannot move a Task to a missing Workspace'
);

select is(
  public.apply_todo_mutation(
    'a4100000-0000-4000-8000-000000000010', 1, 'update', 940000001,
    '{"text":"cross-user move","desktopWorkspaceId":"reference-other-user"}'::jsonb, 0
  )->>'status',
  'workspace_invalid',
  'Update cannot move a Task into another user Workspace'
);

select throws_ok(
  $$update public.todos
      set payload = '{"text":"direct invalid move","desktopWorkspaceId":"reference-direct-missing"}'::jsonb
    where user_id = 'a4000000-0000-4000-8000-000000000001'
      and todo_id = 940000001$$,
  '23503',
  null,
  'Direct Task update cannot bypass Workspace validation'
);

select is(
  (select payload->>'desktopWorkspaceId' from public.todos
    where user_id = 'a4000000-0000-4000-8000-000000000001' and todo_id = 940000001),
  'reference-active',
  'Rejected Workspace move leaves the existing Task unchanged'
);

select is(
  public.apply_todo_mutation(
    'a4100000-0000-4000-8000-000000000007', 1, 'update', 940000001,
    '{"text":"deleted move","desktopWorkspaceId":"reference-deleted"}'::jsonb, 0
  )->>'status',
  'workspace_invalid',
  'Update cannot move a Task to a deleted Workspace'
);

select is(
  public.apply_todo_mutation(
    'a4100000-0000-4000-8000-000000000008', 1, 'update', 940000001,
    '{"text":"valid move","desktopWorkspaceId":"reference-next"}'::jsonb, 0
  )->>'status',
  'applied',
  'Update accepts a move to another active Workspace owned by the user'
);

set local session_replication_role = replica;
insert into public.todos (user_id, todo_id, payload, revision, is_deleted)
values (
  'a4000000-0000-4000-8000-000000000001',
  940000007,
  '{"id":940000007,"text":"legacy orphan","desktopWorkspaceId":"legacy-orphan"}'::jsonb,
  4,
  false
);
set local session_replication_role = origin;

select is(
  public.apply_todo_mutation(
    'a4100000-0000-4000-8000-000000000009', 1, 'update', 940000007,
    '{"id":940000007,"text":"legacy content edit","desktopWorkspaceId":"legacy-orphan"}'::jsonb,
    4
  )->>'status',
  'applied',
  'Existing Task can be edited without changing its historical orphan Workspace ID'
);

select is(
  (select payload->>'desktopWorkspaceId' from public.todos
    where user_id = 'a4000000-0000-4000-8000-000000000001' and todo_id = 940000007),
  'legacy-orphan',
  'Historical orphan Task remains in place and is not moved or deleted'
);

set local role authenticated;
select throws_ok(
  $$select public.apply_todo_mutation_unchecked(
    'a4100000-0000-4000-8000-000000000011',
    1,
    'create',
    940000008,
    '{"text":"unchecked","desktopWorkspaceId":"reference-active"}'::jsonb,
    null
  )$$,
  '42501',
  null,
  'Authenticated clients cannot invoke the unchecked Task mutation function'
);
reset role;

select * from finish();
rollback;
