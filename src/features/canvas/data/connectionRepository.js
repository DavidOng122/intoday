import { isSupabaseConfigured, supabase } from '../../../supabase.js';
import { normalizeDesktopConnection } from '../model/canvasConnections.js';
export { drainConnectionOperations } from './connectionSync.js';

const CONNECTIONS_TABLE = 'canvas_connections';
const createOperationId = () => (
  globalThis.crypto?.randomUUID?.()
  || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  })
);

export const isConnectionCloudSyncEnabled = () => {
  if (!isSupabaseConfigured || !supabase) return false;
  const viteEnv = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
  const flag = viteEnv.VITE_CANVAS_CONNECTIONS_CLOUD_ENABLED;
  return flag === undefined || flag === null || flag === '' || flag === 'true';
};

export const fromConnectionRow = (row) => normalizeDesktopConnection({
  id: row.connection_id,
  workspaceId: row.workspace_id,
  sourceGroupId: row.source_group_id,
  sourceSide: row.source_side,
  targetGroupId: row.target_group_id,
  targetSide: row.target_side,
  revision: row.revision,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const toConnectionRow = (userId, connection) => ({
  user_id: userId,
  connection_id: connection.id,
  workspace_id: connection.workspaceId,
  source_group_id: connection.sourceGroupId,
  source_side: connection.sourceSide,
  target_group_id: connection.targetGroupId,
  target_side: connection.targetSide,
  is_deleted: false,
  revision: connection.revision ?? 0,
  created_at: connection.createdAt,
  updated_at: connection.updatedAt,
});

export const loadCloudConnections = async (userId, workspaceId) => {
  const { data, error } = await supabase
    .from(CONNECTIONS_TABLE)
    .select('connection_id, workspace_id, source_group_id, source_side, target_group_id, target_side, revision, created_at, updated_at')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(fromConnectionRow).filter(Boolean);
};

export const loadCloudConnectionTombstones = async (userId, workspaceId) => {
  const { data, error } = await supabase
    .from(CONNECTIONS_TABLE)
    .select('connection_id, revision')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .eq('is_deleted', true);
  if (error) throw error;
  return new Map((data || []).map((row) => [row.connection_id, Number(row.revision)]));
};

export const executeConnectionOperation = async (userId, operation) => {
  const connection = operation.connection;
  const { data, error } = await supabase.rpc('apply_canvas_connection_mutation', {
    p_operation_id: operation.operationId || createOperationId(),
    p_operation: operation.type,
    p_connection_id: operation.connectionId || connection?.id,
    p_workspace_id: operation.workspaceId || connection?.workspaceId,
    p_source_group_id: connection?.sourceGroupId ?? null,
    p_source_side: connection?.sourceSide ?? null,
    p_target_group_id: connection?.targetGroupId ?? null,
    p_target_side: connection?.targetSide ?? null,
    p_expected_revision: operation.expectedRevision ?? null,
  });
  if (error) throw error;
  if (!data || typeof data.status !== 'string') {
    throw new Error('The Connection sync endpoint returned an invalid response.');
  }
  if (data.status === 'conflict') {
    const conflict = new Error(`Connection ${data.connection_id || operation.connectionId} changed on another device.`);
    conflict.code = 'CONNECTION_CONFLICT';
    throw conflict;
  }
  if (!['applied', 'deleted'].includes(data.status)) {
    throw new Error(`The Connection sync endpoint returned status "${data.status}".`);
  }
  return data;
};
