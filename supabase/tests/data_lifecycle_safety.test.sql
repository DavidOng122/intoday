begin;

select plan(32);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  'a3000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'data-lifecycle-test@example.invalid',
  '',
  timezone('utc', now()),
  '{}'::jsonb,
  '{}'::jsonb,
  timezone('utc', now()),
  timezone('utc', now())
)
on conflict (id) do nothing;

update app_private.todo_sync_config
   set legacy_writes_allowed = false
 where singleton = true;

select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000001', true);
set local role authenticated;

insert into public.workspaces (user_id, workspace_id, name, is_deleted)
values
  ('a3000000-0000-4000-8000-000000000001', 'step2-last', 'Last', false);

select is(
  public.delete_workspace_cascade(
    'step2-last',
    'a3100000-0000-4000-8000-000000000001'
  )->>'status',
  'last_workspace',
  'Server refuses to delete the final active Workspace'
);

insert into public.workspaces (user_id, workspace_id, name, is_deleted)
values
  ('a3000000-0000-4000-8000-000000000001', 'step2-survivor', 'Survivor', false),
  ('a3000000-0000-4000-8000-000000000001', 'step2-cascade', 'Cascade', false);

select is(
  public.delete_workspace_cascade(
    'step2-last',
    'a3100000-0000-4000-8000-000000000002'
  )->>'status',
  'deleted',
  'Workspace deletion succeeds while another active Workspace remains'
);

select is(
  public.delete_workspace_cascade(
    'step2-last',
    'a3100000-0000-4000-8000-000000000002'
  )->>'status',
  'deleted',
  'Retrying the same Workspace operation ID returns its saved outcome'
);

select is(
  (select count(*)::integer from public.workspaces where not is_deleted),
  2,
  'Workspace delete leaves unrelated active Workspaces intact'
);

select throws_ok(
  $$insert into public.workspaces (user_id, workspace_id, name)
    values ('a3000000-0000-4000-8000-000000000001', 'step2-last', 'Restored')$$,
  '55000',
  null,
  'Deleted Workspace IDs cannot be restored'
);

select is(
  public.apply_todo_mutation(
    'a3200000-0000-4000-8000-000000000001', 1, 'create', 930000001,
    '{"text":"Pack A","desktopWorkspaceId":"step2-cascade","desktopGroupId":"pack-a","uploadedFileStoragePath":"a3000000-0000-4000-8000-000000000001/930000001/file-a.pdf","uploadedFileStorageKey":"upload:a3000000-0000-4000-8000-000000000001:a:file-a"}'::jsonb,
    null
  )->>'status',
  'applied',
  'Task CAS creates a Pack Task with a Task-bound upload path'
);

select is(
  public.apply_todo_mutation(
    'a3200000-0000-4000-8000-000000000002', 1, 'create', 930000002,
    '{"text":"Pack B","desktopWorkspaceId":"step2-cascade","desktopGroupId":"pack-b","uploadedFileStoragePath":"a3000000-0000-4000-8000-000000000001/930000002/file-b.pdf","uploadedFileStorageKey":"upload:a3000000-0000-4000-8000-000000000001:b:file-b"}'::jsonb,
    null
  )->>'status',
  'applied',
  'Second Pack Task is created for Connection validation'
);

select is(
  public.apply_todo_mutation(
    'a3200000-0000-4000-8000-000000000004', 1, 'create', 930000003,
    '{"text":"Pack A second member","desktopWorkspaceId":"step2-cascade","desktopGroupId":"pack-a"}'::jsonb,
    null
  )->>'status',
  'applied',
  'Pack can have multiple active Task members'
);

select is(
  public.apply_todo_mutation(
    'a3200000-0000-4000-8000-000000000003', 1, 'update', 930000001,
    '{"text":"Pack A renamed","desktopWorkspaceId":"step2-cascade","desktopGroupId":"pack-a","uploadedFileStoragePath":"a3000000-0000-4000-8000-000000000001/930000001/file-a.pdf","uploadedFileStorageKey":"upload:a3000000-0000-4000-8000-000000000001:a:file-a"}'::jsonb,
    0
  )->>'status',
  'applied',
  'Task update succeeds while retaining its registered upload'
);

select is(
  (select count(*)::integer from public.list_storage_cleanup_jobs()),
  0,
  'Updating unrelated Task content does not enqueue its still-referenced upload'
);

select is(
  public.apply_canvas_connection_mutation(
    'a3300000-0000-4000-8000-000000000001',
    'upsert',
    'step2-connection',
    'step2-cascade',
    'pack-a',
    'right',
    'pack-b',
    'left',
    null
  )->>'status',
  'applied',
  'Connection CAS accepts an initial operation between active Packs'
);

select is(
  public.apply_canvas_connection_mutation(
    'a3300000-0000-4000-8000-000000000002',
    'upsert',
    'step2-connection',
    'step2-cascade',
    'pack-a',
    'left',
    'pack-b',
    'left',
    0
  )->>'status',
  'applied',
  'Connection CAS updates the matching revision'
);

select is(
  public.apply_canvas_connection_mutation(
    'a3300000-0000-4000-8000-000000000003',
    'upsert',
    'step2-connection',
    'step2-cascade',
    'pack-a',
    'right',
    'pack-b',
    'left',
    0
  )->>'status',
  'conflict',
  'Connection CAS rejects a stale revision'
);

select is(
  public.apply_todo_mutation(
    'a3200000-0000-4000-8000-000000000005', 1, 'delete', 930000001,
    null, 1
  )->>'status',
  'applied',
  'Deleting one Pack member succeeds while another member remains'
);

select is(
  (select count(*)::integer from public.canvas_connections
    where user_id = 'a3000000-0000-4000-8000-000000000001'
      and workspace_id = 'step2-cascade'
      and not is_deleted),
  1,
  'Connection survives while both endpoint Packs still have active members'
);

select is(
  public.apply_todo_mutation(
    'a3200000-0000-4000-8000-000000000006', 1, 'delete', 930000003,
    null, 0
  )->>'status',
  'applied',
  'Deleting the final Pack member succeeds'
);

select is(
  (select count(*)::integer from public.canvas_connections
    where user_id = 'a3000000-0000-4000-8000-000000000001'
      and workspace_id = 'step2-cascade'
      and not is_deleted),
  0,
  'Server removes connections when their final Pack member is deleted'
);

select is(
  public.apply_canvas_connection_mutation(
    'a3300000-0000-4000-8000-000000000004',
    'upsert',
    'step2-connection',
    'step2-cascade',
    'pack-a',
    'right',
    'pack-b',
    'left',
    0
  )->>'status',
  'conflict',
  'A stale Connection upsert cannot revive a server tombstone'
);

select is(
  public.delete_workspace_cascade(
    'step2-cascade',
    'a3100000-0000-4000-8000-000000000003'
  )->>'status',
  'deleted',
  'Workspace cascade deletes the selected Workspace'
);

select is(
  (select count(*)::integer from public.todos
    where user_id = 'a3000000-0000-4000-8000-000000000001'
      and payload->>'desktopWorkspaceId' = 'step2-cascade'),
  0,
  'Workspace cascade physically removes only its Tasks'
);

select is(
  (select count(*)::integer from public.canvas_connections
    where user_id = 'a3000000-0000-4000-8000-000000000001'
      and workspace_id = 'step2-cascade'),
  0,
  'Workspace cascade removes its Connections'
);

select is(
  (select count(*)::integer from public.list_storage_cleanup_jobs()),
  2,
  'Workspace cascade queues each Task upload for cleanup'
);

select is(
  (select public.storage_cleanup_job_is_safe(job_id)->>'status'
     from public.list_storage_cleanup_jobs()
    order by job_id
    limit 1),
  'safe',
  'Cleanup worker can verify a user-owned, unreferenced upload before deletion'
);

select throws_ok(
  $$select * from public.claim_storage_cleanup_jobs(1)$$,
  '42501',
  null,
  'Authenticated users cannot claim background cleanup jobs'
);

select throws_ok(
  $$select public.ack_storage_cleanup_job((select job_id from public.list_storage_cleanup_jobs() limit 1))$$,
  '42501',
  null,
  'Authenticated users cannot discard cleanup jobs without deleting Storage objects'
);

select throws_ok(
  $$select public.fail_storage_cleanup_job((select job_id from public.list_storage_cleanup_jobs() limit 1), 'forged')$$,
  '42501',
  null,
  'Authenticated users cannot alter background retry state'
);

reset role;
select set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;

select is(
  (with claimed as (
    select * from public.claim_storage_cleanup_jobs(2)
  )
  select bool_and(
    public.storage_cleanup_job_is_safe_for_worker(
      claimed.job_id,
      claimed.user_id,
      claimed.lease_token
    )->>'status' = 'safe'
  ) from claimed),
  true,
  'Service worker claims jobs with leases and verifies owner, retirement, and references'
);

select is(
  (select count(*)::integer from public.claim_storage_cleanup_jobs(2)),
  0,
  'Active leases prevent a second worker from claiming the same jobs'
);

reset role;
update app_private.storage_cleanup_jobs
   set lease_expires_at = timezone('utc', now()), next_attempt_at = timezone('utc', now())
 where user_id = 'a3000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;

select is(
  (with claimed as (
    select * from public.claim_storage_cleanup_jobs(1)
  )
  select public.finish_storage_cleanup_job(
    claimed.job_id,
    claimed.user_id,
    claimed.lease_token,
    'synthetic transient failure'
  ) from claimed),
  true,
  'Failed removals release the lease and schedule a retry'
);

reset role;
update app_private.storage_cleanup_jobs
   set lease_expires_at = timezone('utc', now()) + interval '5 minutes'
 where user_id = 'a3000000-0000-4000-8000-000000000001'
   and status = 'processing';
select set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;

select is(
  (select count(*)::integer from public.claim_storage_cleanup_jobs(2)),
  0,
  'Exponential retry delay prevents immediate retry loops'
);

reset role;
update app_private.storage_cleanup_jobs
   set lease_expires_at = timezone('utc', now()), next_attempt_at = timezone('utc', now())
 where user_id = 'a3000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;

select is(
  (with claimed as (
    select * from public.claim_storage_cleanup_jobs(2)
  )
  select bool_and(public.finish_storage_cleanup_job(
    claimed.job_id,
    claimed.user_id,
    claimed.lease_token,
    null
  )) from claimed),
  true,
  'Successful idempotent cleanup acknowledges and removes leased jobs'
);

select is(
  (select count(*)::integer from public.claim_storage_cleanup_jobs(2)),
  0,
  'Acknowledged jobs cannot be claimed again'
);

select * from finish();
rollback;
