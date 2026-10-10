import test from 'node:test';
import assert from 'node:assert/strict';

import { createTodoMutationRepository } from './todoMutationRepository.js';

const workspaceMutation = {
  operationId: '00000000-0000-4000-8000-000000000001',
  kind: 'update',
  todoId: 17,
  payload: { id: 17, text: 'moved', desktopWorkspaceId: 'missing-workspace' },
  expectedRevision: 2,
};

test('maps a database Workspace guard rejection to a recoverable sync conflict', async () => {
  const repository = createTodoMutationRepository({
    client: {
      rpc: async () => ({
        data: null,
        error: {
          code: '23503',
          constraint: 'todos_workspace_active_fkey',
          message: 'Task Workspace is missing or inactive',
        },
      }),
    },
    normalizeTodo: (todo) => todo,
  });

  assert.deepEqual(await repository.apply(workspaceMutation), {
    status: 'workspace_invalid',
    todo_id: 17,
  });
});

test('does not convert unrelated database errors into Workspace conflicts', async () => {
  const repository = createTodoMutationRepository({
    client: {
      rpc: async () => ({
        data: null,
        error: { code: '23503', constraint: 'todos_user_id_fkey', message: 'unrelated' },
      }),
    },
    normalizeTodo: (todo) => todo,
  });

  await assert.rejects(
    repository.apply(workspaceMutation),
    (error) => error.code === '23503' && error.constraint === 'todos_user_id_fkey',
  );
});
