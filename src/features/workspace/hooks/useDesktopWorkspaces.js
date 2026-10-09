import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_DESKTOP_WORKSPACES,
  DEFAULT_DESKTOP_WORKSPACE_ID,
  DESKTOP_ACTIVE_WORKSPACE_KEY,
  DESKTOP_WORKSPACES_KEY,
  MAX_DESKTOP_WORKSPACES,
} from '../../../shared/config/workspaceConstants';
import {
  getUntitledWorkspaceName,
  normalizeDesktopWorkspaces,
} from '../../../lib/workspaceUtils';
import { getUserScopedStorageKey } from '../../../shared/storage/userScopedStorage';
import {
  createCloudWorkspace,
  deleteCloudWorkspace,
  hasWorkspaceCloudMigrationCompleted,
  loadCloudWorkspaces,
  markWorkspaceCloudMigrationComplete,
  shouldAutoMigrateLegacyWorkspaces,
  updateCloudWorkspace,
} from '../data/workspaceRepository';

const loadWorkspaces = (userId) => {
  try {
    const key = getUserScopedStorageKey(DESKTOP_WORKSPACES_KEY, userId);
    return normalizeDesktopWorkspaces(JSON.parse(localStorage.getItem(key) || 'null'));
  } catch {
    return DEFAULT_DESKTOP_WORKSPACES.map((item) => ({ ...item }));
  }
};

const createWorkspaceId = () => `workspace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const readActiveWorkspaceId = (ownerId, fallbackWorkspaces) => {
  const storedId = localStorage.getItem(getUserScopedStorageKey(DESKTOP_ACTIVE_WORKSPACE_KEY, ownerId));
  return fallbackWorkspaces.some((workspace) => workspace.id === storedId)
    ? storedId
    : fallbackWorkspaces[0]?.id || DEFAULT_DESKTOP_WORKSPACE_ID;
};

export const useDesktopWorkspaces = ({ userId } = {}) => {
  const ownerId = userId || null;
  const [workspaces, setWorkspaces] = useState(() => (userId ? [] : loadWorkspaces(ownerId)));
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => {
    const fallbackWorkspaces = userId ? [] : loadWorkspaces(ownerId);
    return readActiveWorkspaceId(ownerId, fallbackWorkspaces);
  });

  useEffect(() => {
    if (!userId) return undefined;

    let cancelled = false;

    const hydrate = async () => {
      try {
        const localWorkspaces = loadWorkspaces(userId);
        const cloudWorkspaces = await loadCloudWorkspaces(userId);

        if (cancelled) return;

        const migrationCompleted = hasWorkspaceCloudMigrationCompleted(userId);
        const shouldMigrate = shouldAutoMigrateLegacyWorkspaces({
          cloudWorkspaces,
          localWorkspaces,
          migrationCompleted,
        });

        if (shouldMigrate) {
          await Promise.all(localWorkspaces.map((workspace) => createCloudWorkspace(userId, workspace)));
          markWorkspaceCloudMigrationComplete(userId);
        }

        const nextCloudWorkspaces = await loadCloudWorkspaces(userId);

        if (cancelled) return;

        setWorkspaces(nextCloudWorkspaces);
        const storedId = localStorage.getItem(getUserScopedStorageKey(DESKTOP_ACTIVE_WORKSPACE_KEY, ownerId));
        const nextActiveWorkspaceId = nextCloudWorkspaces.some((workspace) => workspace.id === storedId)
          ? storedId
          : nextCloudWorkspaces[0]?.id || DEFAULT_DESKTOP_WORKSPACE_ID;
        setActiveWorkspaceId(nextActiveWorkspaceId);
      } catch (error) {
        console.error('Failed to load workspaces from Supabase:', error);
        if (!cancelled) {
          setWorkspaces([]);
          setActiveWorkspaceId(DEFAULT_DESKTOP_WORKSPACE_ID);
        }
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [ownerId, userId]);

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId) || workspaces[0],
    [activeWorkspaceId, workspaces],
  );

  useEffect(() => {
    if (userId) return;
    localStorage.setItem(getUserScopedStorageKey(DESKTOP_WORKSPACES_KEY, ownerId), JSON.stringify(workspaces));
  }, [ownerId, userId, workspaces]);

  useEffect(() => {
    localStorage.setItem(
      getUserScopedStorageKey(DESKTOP_ACTIVE_WORKSPACE_KEY, ownerId),
      activeWorkspace?.id || DEFAULT_DESKTOP_WORKSPACE_ID,
    );
  }, [activeWorkspace?.id, ownerId]);

  const selectWorkspace = useCallback((workspaceId) => {
    if (workspaces.some((workspace) => workspace.id === workspaceId)) {
      setActiveWorkspaceId(workspaceId);
    }
  }, [workspaces]);

  const addWorkspace = useCallback(async () => {
    if (workspaces.length >= MAX_DESKTOP_WORKSPACES) return null;
    const nextWorkspace = {
      id: createWorkspaceId(),
      name: getUntitledWorkspaceName(workspaces.length + 1),
    };

    setWorkspaces((current) => [...current, nextWorkspace]);
    setActiveWorkspaceId(nextWorkspace.id);

    if (userId) {
      try {
        await createCloudWorkspace(userId, nextWorkspace);
      } catch (error) {
        console.error('Failed to create workspace in Supabase:', error);
        setWorkspaces((current) => current.filter((workspace) => workspace.id !== nextWorkspace.id));
        setActiveWorkspaceId(workspaces[0]?.id || DEFAULT_DESKTOP_WORKSPACE_ID);
        throw error;
      }
    }

    return nextWorkspace;
  }, [userId, workspaces]);

  const setActiveWorkspace = useCallback((valueOrUpdater) => {
    const activeWorkspaceSnapshot = workspaces.find((workspace) => workspace.id === activeWorkspaceId) || null;
    const nextWorkspace = typeof valueOrUpdater === 'function'
      ? valueOrUpdater(activeWorkspaceSnapshot || {})
      : valueOrUpdater;

    setWorkspaces((current) => current.map((workspace) => {
      if (workspace.id !== activeWorkspaceId) return workspace;
      const merged = {
        ...workspace,
        ...nextWorkspace,
        id: workspace.id,
        name: nextWorkspace?.name?.trim() || workspace.name,
      };

      if (userId) {
        void updateCloudWorkspace(userId, merged).catch((error) => {
          console.error('Failed to rename workspace in Supabase:', error);
        });
      }

      return merged;
    }));
  }, [activeWorkspaceId, userId, workspaces]);

  const deleteWorkspace = useCallback(async (workspaceId) => {
    if (workspaces.length <= 1) return null;
    const deletedWorkspace = workspaces.find((workspace) => workspace.id === workspaceId);
    if (!deletedWorkspace) return null;
    const remainingWorkspaces = workspaces.filter((workspace) => workspace.id !== workspaceId);
    const fallbackWorkspace = remainingWorkspaces[0];

    if (userId) {
      const previousWorkspaces = workspaces;
      try {
        setWorkspaces(remainingWorkspaces);
        if (activeWorkspaceId === workspaceId) setActiveWorkspaceId(fallbackWorkspace.id);
        await deleteCloudWorkspace(userId, workspaceId);
        return deletedWorkspace;
      } catch (error) {
        console.error('Failed to delete workspace in Supabase:', error);
        setWorkspaces(previousWorkspaces);
        if (activeWorkspaceId === workspaceId) setActiveWorkspaceId(workspaceId);
        throw error;
      }
    }

    setWorkspaces(remainingWorkspaces);
    if (activeWorkspaceId === workspaceId) setActiveWorkspaceId(fallbackWorkspace.id);
    return deletedWorkspace;
  }, [activeWorkspaceId, userId, workspaces]);

  return {
    activeWorkspace,
    activeWorkspaceId: activeWorkspace?.id || DEFAULT_DESKTOP_WORKSPACE_ID,
    addWorkspace,
    canAddWorkspace: workspaces.length < MAX_DESKTOP_WORKSPACES,
    deleteWorkspace,
    selectWorkspace,
    setActiveWorkspace,
    workspaces,
  };
};
