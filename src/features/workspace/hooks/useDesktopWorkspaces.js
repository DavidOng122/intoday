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
import { notifySessionVerificationRequired } from '../../session/model/sessionVerification';
import {
  createCloudWorkspace,
  deleteCloudWorkspace,
  hasWorkspaceCloudMigrationCompleted,
  loadCloudWorkspaces,
  markWorkspaceCloudMigrationComplete,
  shouldAutoMigrateLegacyWorkspaces,
  updateCloudWorkspace,
} from '../data/workspaceRepository';

const CONFIRMED_DESKTOP_WORKSPACES_KEY = 'intoday_confirmed_workspaces_v1';

const loadWorkspaces = (userId, keyOverride = null) => {
  try {
    const key = getUserScopedStorageKey(keyOverride || DESKTOP_WORKSPACES_KEY, userId);
    const raw = localStorage.getItem(key);
    if (!raw && userId) return [];
    return normalizeDesktopWorkspaces(raw ? JSON.parse(raw) : null);
  } catch (error) {
    console.error('Failed to read the saved Workspace cache:', error);
    if (userId) return [];
    return DEFAULT_DESKTOP_WORKSPACES.map((item) => ({ ...item }));
  }
};

const saveConfirmedWorkspaces = (userId, workspaces) => {
  try {
    localStorage.setItem(
      getUserScopedStorageKey(CONFIRMED_DESKTOP_WORKSPACES_KEY, userId),
      JSON.stringify(workspaces),
    );
  } catch (error) {
    console.error('Failed to cache workspaces for offline viewing:', error);
  }
};

const createWorkspaceId = () => `workspace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const readActiveWorkspaceId = (ownerId, fallbackWorkspaces) => {
  try {
    const storedId = localStorage.getItem(getUserScopedStorageKey(DESKTOP_ACTIVE_WORKSPACE_KEY, ownerId));
    return fallbackWorkspaces.some((workspace) => workspace.id === storedId)
      ? storedId
      : fallbackWorkspaces[0]?.id || DEFAULT_DESKTOP_WORKSPACE_ID;
  } catch (error) {
    console.error('Failed to read the active Workspace selection:', error);
    return fallbackWorkspaces[0]?.id || DEFAULT_DESKTOP_WORKSPACE_ID;
  }
};

export const useDesktopWorkspaces = ({ userId, readOnly = false } = {}) => {
  const ownerId = userId || null;
  const initialCacheKey = ownerId ? CONFIRMED_DESKTOP_WORKSPACES_KEY : DESKTOP_WORKSPACES_KEY;
  const [workspaces, setWorkspaces] = useState(() => loadWorkspaces(ownerId, initialCacheKey));
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => {
    const fallbackWorkspaces = loadWorkspaces(ownerId, initialCacheKey);
    return readActiveWorkspaceId(ownerId, fallbackWorkspaces);
  });

  useEffect(() => {
    if (!userId) return undefined;

    let cancelled = false;
    if (readOnly || globalThis.navigator?.onLine === false) {
      const cachedWorkspaces = loadWorkspaces(userId, CONFIRMED_DESKTOP_WORKSPACES_KEY);
      window.queueMicrotask(() => {
        if (cancelled) return;
        setWorkspaces(cachedWorkspaces);
        setActiveWorkspaceId(readActiveWorkspaceId(userId, cachedWorkspaces));
      });
      return () => {
        cancelled = true;
      };
    }

    const hydrate = async () => {
      try {
        const localWorkspaces = loadWorkspaces(userId, DESKTOP_WORKSPACES_KEY);
        const cloudWorkspaces = await loadCloudWorkspaces(userId);

        if (cancelled) return;

        const migrationCompleted = hasWorkspaceCloudMigrationCompleted(userId);
        const shouldMigrate = shouldAutoMigrateLegacyWorkspaces({
          cloudWorkspaces,
          localWorkspaces,
          migrationCompleted,
        });

        if (shouldMigrate) {
          for (const workspace of localWorkspaces) {
            try {
              await createCloudWorkspace(userId, workspace);
            } catch (error) {
              if (error?.code === '55000') {
                console.warn(`Skipped restoring retired Workspace "${workspace.id}".`);
                continue;
              }
              throw error;
            }
          }
          markWorkspaceCloudMigrationComplete(userId);
        }

        const nextCloudWorkspaces = await loadCloudWorkspaces(userId);

        if (cancelled) return;

        setWorkspaces(nextCloudWorkspaces);
        saveConfirmedWorkspaces(userId, nextCloudWorkspaces);
        const storedId = localStorage.getItem(getUserScopedStorageKey(DESKTOP_ACTIVE_WORKSPACE_KEY, ownerId));
        const nextActiveWorkspaceId = nextCloudWorkspaces.some((workspace) => workspace.id === storedId)
          ? storedId
          : nextCloudWorkspaces[0]?.id || DEFAULT_DESKTOP_WORKSPACE_ID;
        setActiveWorkspaceId(nextActiveWorkspaceId);
      } catch (error) {
        console.error('Failed to load workspaces from Supabase:', error);
        notifySessionVerificationRequired(error);
        if (!cancelled) {
          const cachedWorkspaces = loadWorkspaces(userId, CONFIRMED_DESKTOP_WORKSPACES_KEY);
          setWorkspaces(cachedWorkspaces);
          setActiveWorkspaceId(readActiveWorkspaceId(userId, cachedWorkspaces));
        }
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [ownerId, readOnly, userId]);

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId) || workspaces[0],
    [activeWorkspaceId, workspaces],
  );

  useEffect(() => {
    if (userId) return;
    try {
      localStorage.setItem(getUserScopedStorageKey(DESKTOP_WORKSPACES_KEY, ownerId), JSON.stringify(workspaces));
    } catch (error) {
      console.error('Failed to persist the guest Workspace cache:', error);
    }
  }, [ownerId, userId, workspaces]);

  useEffect(() => {
    try {
      localStorage.setItem(
        getUserScopedStorageKey(DESKTOP_ACTIVE_WORKSPACE_KEY, ownerId),
        activeWorkspace?.id || DEFAULT_DESKTOP_WORKSPACE_ID,
      );
    } catch (error) {
      console.error('Failed to persist the active Workspace selection:', error);
    }
  }, [activeWorkspace?.id, ownerId]);

  const selectWorkspace = useCallback((workspaceId) => {
    if (workspaces.some((workspace) => workspace.id === workspaceId)) {
      setActiveWorkspaceId(workspaceId);
    }
  }, [workspaces]);

  const addWorkspace = useCallback(async () => {
    if (readOnly || (userId && globalThis.navigator?.onLine === false)) return null;
    if (workspaces.length >= MAX_DESKTOP_WORKSPACES) return null;
    const nextWorkspace = {
      id: createWorkspaceId(),
      name: getUntitledWorkspaceName(workspaces.length + 1),
    };

    if (userId) {
      try {
        await createCloudWorkspace(userId, nextWorkspace);
      } catch (error) {
        console.error('Failed to create workspace in Supabase:', error);
        throw error;
      }
    }

    const nextWorkspaces = [...workspaces, nextWorkspace];
    setWorkspaces(nextWorkspaces);
    setActiveWorkspaceId(nextWorkspace.id);
    if (userId) saveConfirmedWorkspaces(userId, nextWorkspaces);
    return nextWorkspace;
  }, [readOnly, userId, workspaces]);

  const setActiveWorkspace = useCallback((valueOrUpdater) => {
    if (readOnly || (userId && globalThis.navigator?.onLine === false)) return;
    const activeWorkspaceSnapshot = workspaces.find((workspace) => workspace.id === activeWorkspaceId) || null;
    const nextWorkspace = typeof valueOrUpdater === 'function'
      ? valueOrUpdater(activeWorkspaceSnapshot || {})
      : valueOrUpdater;

    const currentWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId);
    if (!currentWorkspace) return;
    const merged = {
      ...currentWorkspace,
      ...nextWorkspace,
      id: currentWorkspace.id,
      name: nextWorkspace?.name?.trim() || currentWorkspace.name,
    };
    const save = async () => {
      if (userId) await updateCloudWorkspace(userId, merged);
      const nextWorkspaces = workspaces.map((workspace) => (
        workspace.id === activeWorkspaceId ? merged : workspace
      ));
      setWorkspaces(nextWorkspaces);
      if (userId) saveConfirmedWorkspaces(userId, nextWorkspaces);
    };
    void save().catch((error) => {
      console.error('Failed to rename workspace:', error);
    });
  }, [activeWorkspaceId, readOnly, userId, workspaces]);

  const deleteWorkspace = useCallback(async (workspaceId) => {
    if (readOnly || (userId && globalThis.navigator?.onLine === false)) return null;
    if (workspaces.length <= 1) return null;
    const deletedWorkspace = workspaces.find((workspace) => workspace.id === workspaceId);
    if (!deletedWorkspace) return null;
    const remainingWorkspaces = workspaces.filter((workspace) => workspace.id !== workspaceId);
    const fallbackWorkspace = remainingWorkspaces[0];

    if (userId) {
      await deleteCloudWorkspace(userId, workspaceId);
      setWorkspaces(remainingWorkspaces);
      saveConfirmedWorkspaces(userId, remainingWorkspaces);
      if (activeWorkspaceId === workspaceId) setActiveWorkspaceId(fallbackWorkspace.id);
      return deletedWorkspace;
    }

    setWorkspaces(remainingWorkspaces);
    if (activeWorkspaceId === workspaceId) setActiveWorkspaceId(fallbackWorkspace.id);
    return deletedWorkspace;
  }, [activeWorkspaceId, readOnly, userId, workspaces]);

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
