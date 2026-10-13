import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const authFile = path.resolve('.playwright', 'synthetic-user.json');

export default async function globalSetup() {
  const url = process.env.E2E_SUPABASE_URL || 'http://127.0.0.1:54321';
  const admin = createClient(url, process.env.E2E_SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `release-${randomUUID()}@example.com`;
  const password = `Local-only-${randomUUID()}-Aa1!`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) throw createError;

  try {
    const userClient = createClient(url, process.env.E2E_SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: loginError } = await userClient.auth.signInWithPassword({ email, password });
    if (loginError) throw loginError;

    const workspaceId = `release-e2e-${randomUUID()}`;
    const { error: workspaceError } = await userClient.from('workspaces').insert({
      user_id: created.user.id,
      workspace_id: workspaceId,
      name: 'Release E2E Workspace',
      is_deleted: false,
    });
    if (workspaceError) throw workspaceError;

    const today = new Date().toISOString().slice(0, 10);
    const packGroupId = `release-pack-${randomUUID()}`;
    const taskIds = [Date.now() * 10, Date.now() * 10 + 1, Date.now() * 10 + 2];
    const { error: legacyWriteError } = await userClient.from('todos').insert({
      user_id: created.user.id,
      todo_id: taskIds[0] - 1,
      payload: { id: taskIds[0] - 1, text: 'Old client write must be rejected' },
    });
    if (!legacyWriteError
      || legacyWriteError.code !== '55000'
      || !legacyWriteError.message?.includes('Todo write protocol upgrade required')) {
      throw new Error('Local old-client direct write was not rejected by the expected protocol guard.');
    }

    const tasks = [
      {
        id: taskIds[0],
        title: 'Release E2E Pack One',
        text: 'Pack member one',
        cardType: 'text',
        desktopWorkspaceId: workspaceId,
        desktopGroupId: packGroupId,
        desktopGroupName: 'Release E2E Pack',
        desktopCanvasX: 80,
        desktopCanvasY: 80,
        dateString: today,
        updatedAt: new Date().toISOString(),
      },
      {
        id: taskIds[1],
        title: 'Release E2E Pack Two',
        text: 'Pack member two',
        cardType: 'text',
        desktopWorkspaceId: workspaceId,
        desktopGroupId: packGroupId,
        desktopGroupName: 'Release E2E Pack',
        desktopCanvasX: 80,
        desktopCanvasY: 80,
        dateString: today,
        updatedAt: new Date().toISOString(),
      },
      {
        id: taskIds[2],
        title: 'Release E2E Detail',
        text: 'Initial detail text',
        cardType: 'text',
        desktopWorkspaceId: workspaceId,
        desktopCanvasX: 420,
        desktopCanvasY: 80,
        dateString: today,
        updatedAt: new Date().toISOString(),
      },
    ];

    for (const task of tasks) {
      const { data, error } = await userClient.rpc('apply_todo_mutation', {
        p_operation_id: randomUUID(),
        p_protocol_version: 1,
        p_operation: 'create',
        p_todo_id: task.id,
        p_payload: task,
        p_expected_revision: null,
      });
      if (error) throw error;
      if (data?.status !== 'applied') {
        throw new Error(`Local Task fixture creation failed: ${data?.status || 'invalid response'}`);
      }
    }

    await mkdir(path.dirname(authFile), { recursive: true });
    await writeFile(authFile, JSON.stringify({ email, password, userId: created.user.id, workspaceId, taskIds }));
  } catch (error) {
    const { error: cleanupError } = await admin.auth.admin.deleteUser(created.user.id);
    if (cleanupError) {
      console.error('Failed to remove synthetic E2E account after setup failure:', cleanupError.message);
      await mkdir(path.dirname(authFile), { recursive: true });
      await writeFile(authFile, JSON.stringify({
        userId: created.user.id,
        email,
        password,
        workspaceId: null,
        taskIds: [],
      }));
    }
    throw error;
  }
}
