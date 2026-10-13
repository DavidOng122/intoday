import { readFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const authFile = path.resolve('.playwright', 'synthetic-user.json');

export default async function globalTeardown() {
  let fixture;
  let cleanupComplete = false;
  try {
    try {
      fixture = JSON.parse(await readFile(authFile, 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') {
        cleanupComplete = true;
        return;
      }
      throw error;
    }
    const admin = createClient(
      process.env.E2E_SUPABASE_URL || 'http://127.0.0.1:54321',
      process.env.E2E_SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { data: todos, error: todoError } = await admin
      .from('todos')
      .select('todo_id, revision, is_deleted, payload')
      .eq('user_id', fixture.userId);
    if (todoError) throw todoError;

    if (todos.some(({ is_deleted: isDeleted }) => !isDeleted)) {
      const userClient = createClient(
        process.env.E2E_SUPABASE_URL || 'http://127.0.0.1:54321',
        process.env.E2E_SUPABASE_ANON_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } },
      );
      const { error: signInError } = await userClient.auth.signInWithPassword({
        email: fixture.email,
        password: fixture.password,
      });
      if (signInError) throw signInError;
      for (const todo of todos.filter(({ is_deleted: isDeleted }) => !isDeleted)) {
        const { data, error } = await userClient.rpc('apply_todo_mutation', {
          p_operation_id: randomUUID(),
          p_protocol_version: 1,
          p_operation: 'delete',
          p_todo_id: todo.todo_id,
          p_payload: null,
          p_expected_revision: todo.revision,
        });
        if (error) throw error;
        if (!['applied', 'deleted'].includes(data?.status)) {
          throw new Error(`Could not clean synthetic Task ${todo.todo_id}: ${data?.status || 'invalid response'}`);
        }
      }
    }

    const paths = [...new Set((todos || [])
      .map(({ payload }) => payload?.uploadedFileStoragePath)
      .filter((value) => typeof value === 'string' && value.startsWith(`${fixture.userId}/`)))];
    for (const storagePath of paths) {
      const { error } = await admin.storage.from('uploads').remove([storagePath]);
      if (error) throw error;
    }
    const { error: deleteError } = await admin.auth.admin.deleteUser(fixture.userId);
    if (deleteError) throw deleteError;
    cleanupComplete = true;
  } finally {
    if (cleanupComplete) await rm(authFile, { force: true });
  }
}
