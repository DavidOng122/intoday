import { supabase } from '../../../supabase.js';
import { getUserScopedStorageKey } from '../../../shared/storage/userScopedStorage.js';

const WORKSPACES_TABLE = 'workspaces';

export const getWorkspaceMigrationKey = (userId) => getUserScopedStorageKey('intoday_workspaces_cloud_migrated', userId);

export const shouldAutoMigrateLegacyWorkspaces = ({ cloudWorkspaces, localWorkspaces, migrationCompleted }) => (
  !migrationCompleted
  && Array.isArray(cloudWorkspaces)
  && cloudWorkspaces.length === 0
  && Array.isArray(localWorkspaces)
  && localWorkspaces.length > 0
);

export const hasWorkspaceCloudMigrationCompleted = (userId) => {
  if (!userId) return true;
  try {
    return localStorage.getItem(getWorkspaceMigrationKey(userId)) === 'true';
  } catch {
    return false;
  }
};

export const markWorkspaceCloudMigrationComplete = (userId) => {
  if (!userId) return false;
  try {
    localStorage.setItem(getWorkspaceMigrationKey(userId), 'true');
    return true;
  } catch {
    return false;
  }
};

export const fromWorkspaceRow = (row) => ({
  id: row?.workspace_id,
  name: row?.name || 'Untitled',
  createdAt: row?.created_at,
  updatedAt: row?.updated_at,
  deletedAt: row?.is_deleted ? (row.updated_at || row.created_at) : null,
});

export const toCloudWorkspaceRow = (userId, workspace) => ({
  user_id: userId,
  workspace_id: workspace?.id,
  name: workspace?.name || 'Untitled',
  is_deleted: false,
  created_at: workspace?.createdAt || new Date().toISOString(),
  updated_at: workspace?.updatedAt || new Date().toISOString(),
});

export const loadCloudWorkspaces = async (userId) => {
  if (!userId || !supabase) return [];
  const { data, error } = await supabase
    .from(WORKSPACES_TABLE)
    .select('workspace_id, name, is_deleted, created_at, updated_at')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []).map(fromWorkspaceRow).filter((workspace) => workspace?.id);
};

export const loadDeletedCloudWorkspaces = async (userId) => {
  if (!userId || !supabase) return [];
  const { data, error } = await supabase
    .from(WORKSPACES_TABLE)
    .select('workspace_id, name, is_deleted, created_at, updated_at')
    .eq('user_id', userId)
    .eq('is_deleted', true)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.workspace_id,
    name: row.name || 'Untitled',
    deletedAt: row.updated_at || row.created_at,
  }));
};

export const createCloudWorkspace = async (userId, workspace) => {
  if (!userId || !supabase || !workspace?.id) return null;
  const row = toCloudWorkspaceRow(userId, workspace);
  const { error } = await supabase
    .from(WORKSPACES_TABLE)
    .upsert(row, { onConflict: 'user_id,workspace_id' });

  if (error) throw error;
  return workspace;
};

export const updateCloudWorkspace = async (userId, workspace) => {
  if (!userId || !supabase || !workspace?.id) return null;
  const row = toCloudWorkspaceRow(userId, workspace);
  const { error } = await supabase
    .from(WORKSPACES_TABLE)
    .upsert(row, { onConflict: 'user_id,workspace_id' });

  if (error) throw error;
  return workspace;
};

export const deleteCloudWorkspace = async (userId, workspaceId) => {
  if (!userId || !supabase || !workspaceId) return null;
  const { error } = await supabase
    .from(WORKSPACES_TABLE)
    .update({ is_deleted: true, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId);

  if (error) throw error;
  return workspaceId;
};

export const restoreCloudWorkspace = async (userId, workspaceId) => {
  if (!userId || !supabase || !workspaceId) return null;
  const { error } = await supabase
    .from(WORKSPACES_TABLE)
    .update({ is_deleted: false, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId);

  if (error) throw error;
  return workspaceId;
};
