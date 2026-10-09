import { supabase } from '../../../supabase.js';
import { getUserScopedStorageKey } from '../../../shared/storage/userScopedStorage.js';

const WORKSPACES_TABLE = 'workspaces';
const createOperationId = () => (
  globalThis.crypto?.randomUUID?.()
  || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  })
);

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
  if (!userId || !workspaceId) return null;
  if (!supabase) throw new Error('Supabase is not configured; Workspace deletion is unavailable.');
  const { data, error } = await supabase.rpc('delete_workspace_cascade', {
    p_workspace_id: workspaceId,
    p_operation_id: createOperationId(),
  });

  if (error) throw error;
  if (data?.status === 'last_workspace') {
    const lastWorkspaceError = new Error('At least one active Workspace must remain.');
    lastWorkspaceError.code = 'LAST_WORKSPACE';
    throw lastWorkspaceError;
  }
  if (data?.status === 'not_found') {
    const missingWorkspaceError = new Error('This Workspace is no longer active on the server.');
    missingWorkspaceError.code = 'WORKSPACE_NOT_FOUND';
    throw missingWorkspaceError;
  }
  if (data?.status !== 'deleted') {
    throw new Error(`Workspace deletion returned unexpected status "${data?.status}".`);
  }
  return workspaceId;
};
