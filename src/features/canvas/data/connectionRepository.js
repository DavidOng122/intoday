import { isSupabaseConfigured, supabase } from '../../../supabase.js';
import { normalizeDesktopConnection } from '../model/canvasConnections.js';
export { drainConnectionOperations } from './connectionSync.js';

const CONNECTIONS_TABLE = 'canvas_connections';

export const isConnectionCloudSyncEnabled = () => (
  import.meta.env.VITE_CANVAS_CONNECTIONS_CLOUD_ENABLED === 'true'
  && isSupabaseConfigured
  && Boolean(supabase)
);

export const fromConnectionRow = (row) => normalizeDesktopConnection({
  id: row.connection_id,
  workspaceId: row.workspace_id,
  sourceGroupId: row.source_group_id,
  sourceSide: row.source_side,
  targetGroupId: row.target_group_id,
  targetSide: row.target_side,
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
  created_at: connection.createdAt,
  updated_at: connection.updatedAt,
});

export const loadCloudConnections = async (userId, workspaceId) => {
  const { data, error } = await supabase
    .from(CONNECTIONS_TABLE)
    .select('connection_id, workspace_id, source_group_id, source_side, target_group_id, target_side, created_at, updated_at')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(fromConnectionRow).filter(Boolean);
};

export const executeConnectionOperation = async (userId, operation) => {
  if (operation.type === 'upsert') {
    const { error } = await supabase
      .from(CONNECTIONS_TABLE)
      .upsert(toConnectionRow(userId, operation.connection), {
        onConflict: 'user_id,connection_id',
      });
    if (error) throw error;
    return;
  }
  if (operation.type === 'delete') {
    const { error } = await supabase
      .from(CONNECTIONS_TABLE)
      .update({ is_deleted: true })
      .eq('user_id', userId)
      .eq('connection_id', operation.connectionId);
    if (error) throw error;
  }
};
