\set ON_ERROR_STOP on

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  'b1000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'release-legacy@example.invalid',
  '',
  timezone('utc', now()),
  '{}'::jsonb,
  '{}'::jsonb,
  timezone('utc', now()),
  timezone('utc', now())
);

insert into public.workspaces (user_id, workspace_id, name, is_deleted)
values
  ('b1000000-0000-4000-8000-000000000001', 'legacy-main', 'Legacy Main', false),
  ('b1000000-0000-4000-8000-000000000001', 'legacy-other', 'Legacy Other', false);

insert into public.todos (user_id, todo_id, payload, is_deleted)
values
  (
    'b1000000-0000-4000-8000-000000000001',
    810000001,
    '{"id":810000001,"title":"Legacy upload","text":"Legacy upload body","cardType":"photo","desktopWorkspaceId":"legacy-main","desktopGroupId":"pack-a","desktopGroupName":"Legacy Pack A","uploadedFileStoragePath":"b1000000-0000-4000-8000-000000000001/810000001/legacy.txt"}'::jsonb,
    false
  ),
  (
    'b1000000-0000-4000-8000-000000000001',
    810000002,
    '{"id":810000002,"title":"Legacy pack peer","text":"Pack peer","cardType":"text","desktopWorkspaceId":"legacy-main","desktopGroupId":"pack-a","desktopGroupName":"Legacy Pack A"}'::jsonb,
    false
  ),
  (
    'b1000000-0000-4000-8000-000000000001',
    810000003,
    '{"id":810000003,"title":"Legacy inbox","text":"Inbox item","cardType":"text","collectionState":"inbox","desktopWorkspaceId":"legacy-main"}'::jsonb,
    false
  ),
  (
    'b1000000-0000-4000-8000-000000000001',
    810000004,
    '{"id":810000004,"title":"Legacy second pack","text":"Pack B","cardType":"text","desktopWorkspaceId":"legacy-main","desktopGroupId":"pack-b","desktopGroupName":"Legacy Pack B"}'::jsonb,
    false
  );

insert into public.canvas_connections (
  user_id, connection_id, workspace_id, source_group_id, source_side,
  target_group_id, target_side, is_deleted
)
values (
  'b1000000-0000-4000-8000-000000000001',
  'legacy-pack-a-pack-b',
  'legacy-main',
  'pack-a',
  'right',
  'pack-b',
  'left',
  false
);
