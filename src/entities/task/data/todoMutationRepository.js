import { supabase } from '../../../supabase.js';

export const TODO_SYNC_PROTOCOL_VERSION = 1;
const TODOS_TABLE = 'todos';

const toCloudPayload = (todo) => {
  const {
    localPreviewUrl: _localPreviewUrl,
    uploadState: _uploadState,
    ...payload
  } = todo;

  if (payload.uploadedFileStoragePath) {
    payload.photoDataUrl = null;
    payload.photoUrl = null;
    payload.redirectUrl = null;
  }
  return payload;
};

const parseCloudPayload = (value, todoId) => {
  let payload = value;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch (error) {
      throw new Error(`Todo ${todoId} has an invalid cloud payload.`, { cause: error });
    }
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(`Todo ${todoId} has an invalid cloud payload.`);
  }
  const numericId = Number(todoId);
  if (!Number.isSafeInteger(numericId)) {
    throw new Error(`Todo ID ${todoId} is outside the supported integer range.`);
  }
  return { ...payload, id: numericId };
};

const parseCloudRow = (row, normalizeTodo) => {
  const revision = Number(row.revision);
  const todoId = Number(row.todo_id);
  if (!Number.isSafeInteger(todoId) || !Number.isSafeInteger(revision) || revision < 0) {
    throw new Error(`Todo ${row.todo_id} has an invalid ID or revision.`);
  }
  return {
    todo: normalizeTodo(parseCloudPayload(row.payload, todoId)),
    revision,
    deleted: Boolean(row.is_deleted),
  };
};

export const createTodoMutationRepository = ({ client = supabase, normalizeTodo }) => ({
  async load(userId) {
    if (!client) throw new Error('Supabase is not configured.');
    const rows = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await client
        .from(TODOS_TABLE)
        .select('todo_id, payload, revision, is_deleted')
        .eq('user_id', userId)
        .order('todo_id', { ascending: true })
        .range(offset, offset + 999);
      if (error) throw error;
      rows.push(...(data || []));
      if ((data || []).length < 1000) break;
    }
    return rows.map((row) => parseCloudRow(row, normalizeTodo));
  },

  async readOne(userId, todoId) {
    if (!client) throw new Error('Supabase is not configured.');
    const { data, error } = await client
      .from(TODOS_TABLE)
      .select('todo_id, payload, revision, is_deleted')
      .eq('user_id', userId)
      .eq('todo_id', todoId)
      .maybeSingle();
    if (error) throw error;
    return data ? parseCloudRow(data, normalizeTodo) : null;
  },

  async apply(mutation) {
    if (!client) throw new Error('Supabase is not configured.');
    let data;
    let error;
    try {
      ({ data, error } = await client.rpc('apply_todo_mutation', {
        p_operation_id: mutation.operationId,
        p_protocol_version: TODO_SYNC_PROTOCOL_VERSION,
        p_operation: mutation.kind,
        p_todo_id: mutation.todoId,
        p_payload: mutation.payload ? toCloudPayload(mutation.payload) : null,
        p_expected_revision: mutation.expectedRevision,
      }));
    } catch (rpcError) {
      if (
        rpcError?.code === '23503'
        && rpcError?.constraint === 'todos_workspace_active_fkey'
      ) {
        return { status: 'workspace_invalid', todo_id: mutation.todoId };
      }
      throw rpcError;
    }
    if (
      error?.code === '23503'
      && error?.constraint === 'todos_workspace_active_fkey'
    ) {
      return { status: 'workspace_invalid', todo_id: mutation.todoId };
    }
    if (error) throw error;
    return this.parseResult(data);
  },

  async getOutcome(userId, operationId) {
    if (!client) throw new Error('Supabase is not configured.');
    const { data, error } = await client.rpc('get_todo_mutation_outcome', {
      p_operation_id: operationId,
      p_protocol_version: TODO_SYNC_PROTOCOL_VERSION,
    });
    if (error) throw error;
    return this.parseResult(data);
  },

  parseResult(result) {
    if (!result || typeof result !== 'object' || typeof result.status !== 'string') {
      throw new Error('The todo sync endpoint returned an invalid response.');
    }
    if (result.status === 'applied') {
      return {
        ...result,
        todo: result.is_deleted
          ? null
          : parseCloudPayload(result.payload, result.todo_id),
        revision: Number(result.revision),
      };
    }
    if (!['not_found', 'conflict', 'deleted', 'workspace_invalid', 'cutover_pending', 'protocol_upgrade_required'].includes(result.status)) {
      throw new Error(`The todo sync endpoint returned unknown status "${result.status}".`);
    }
    if (result.current_payload !== undefined && result.current_payload !== null) {
      return {
        ...result,
        currentTodo: parseCloudPayload(result.current_payload, result.todo_id),
        currentRevision: Number(result.current_revision),
      };
    }
    return result;
  },
});
