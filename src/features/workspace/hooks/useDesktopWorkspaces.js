import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_DESKTOP_WORKSPACES,
  DEFAULT_DESKTOP_WORKSPACE_ID,
  DELETED_DESKTOP_WORKSPACES_KEY,
  DESKTOP_ACTIVE_WORKSPACE_KEY,
  DESKTOP_WORKSPACES_KEY,
  MAX_DESKTOP_WORKSPACES,
} from '../../../shared/config/workspaceConstants';
import {
  getUntitledWorkspaceName,
  normalizeDesktopWorkspaces,
} from '../../../lib/workspaceUtils';

const loadWorkspaces = () => {
  try {
    return normalizeDesktopWorkspaces(JSON.parse(localStorage.getItem(DESKTOP_WORKSPACES_KEY) || 'null'));
  } catch {
    return DEFAULT_DESKTOP_WORKSPACES.map((item) => ({ ...item }));
  }
};

const createWorkspaceId = () => `workspace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const loadDeletedWorkspaces = () => {
  try {
    const value = JSON.parse(localStorage.getItem(DELETED_DESKTOP_WORKSPACES_KEY) || '[]');
    return Array.isArray(value) ? value.filter((workspace) => workspace?.id && workspace?.deletedAt) : [];
  } catch {
    return [];
  }
};

export const useDesktopWorkspaces = () => {
  const [workspaces, setWorkspaces] = useState(loadWorkspaces);
  const [deletedWorkspaces, setDeletedWorkspaces] = useState(loadDeletedWorkspaces);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => {
    const storedId = localStorage.getItem(DESKTOP_ACTIVE_WORKSPACE_KEY);
    const initialWorkspaces = loadWorkspaces();
    return initialWorkspaces.some((workspace) => workspace.id === storedId)
      ? storedId
      : initialWorkspaces[0].id;
  });

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId) || workspaces[0],
    [activeWorkspaceId, workspaces],
  );

  useEffect(() => {
    localStorage.setItem(DESKTOP_WORKSPACES_KEY, JSON.stringify(workspaces));
  }, [workspaces]);

  useEffect(() => {
    localStorage.setItem(DESKTOP_ACTIVE_WORKSPACE_KEY, activeWorkspace?.id || DEFAULT_DESKTOP_WORKSPACE_ID);
  }, [activeWorkspace?.id]);

  useEffect(() => {
    localStorage.setItem(DELETED_DESKTOP_WORKSPACES_KEY, JSON.stringify(deletedWorkspaces));
  }, [deletedWorkspaces]);

  const selectWorkspace = useCallback((workspaceId) => {
    if (workspaces.some((workspace) => workspace.id === workspaceId)) {
      setActiveWorkspaceId(workspaceId);
    }
  }, [workspaces]);

  const addWorkspace = useCallback(() => {
    if (workspaces.length >= MAX_DESKTOP_WORKSPACES) return null;
    const nextWorkspace = {
      id: createWorkspaceId(),
      name: getUntitledWorkspaceName(workspaces.length + 1),
    };
    setWorkspaces((current) => [...current, nextWorkspace]);
    setActiveWorkspaceId(nextWorkspace.id);
    return nextWorkspace;
  }, [workspaces.length]);

  const setActiveWorkspace = useCallback((valueOrUpdater) => {
    setWorkspaces((current) => current.map((workspace) => {
      if (workspace.id !== activeWorkspaceId) return workspace;
      const nextWorkspace = typeof valueOrUpdater === 'function'
        ? valueOrUpdater(workspace)
        : valueOrUpdater;
      return {
        ...workspace,
        ...nextWorkspace,
        id: workspace.id,
        name: nextWorkspace?.name?.trim() || workspace.name,
      };
    }));
  }, [activeWorkspaceId]);

  const deleteWorkspace = useCallback((workspaceId) => {
    if (workspaces.length <= 1) return null;
    const deletedWorkspace = workspaces.find((workspace) => workspace.id === workspaceId);
    if (!deletedWorkspace) return null;
    const remainingWorkspaces = workspaces.filter((workspace) => workspace.id !== workspaceId);
    const fallbackWorkspace = remainingWorkspaces[0];
    const archivedWorkspace = {
      ...deletedWorkspace,
      deletedAt: new Date().toISOString(),
    };
    setWorkspaces(remainingWorkspaces);
    setDeletedWorkspaces((current) => [
      archivedWorkspace,
      ...current.filter((workspace) => workspace.id !== workspaceId),
    ]);
    if (activeWorkspaceId === workspaceId) setActiveWorkspaceId(fallbackWorkspace.id);
    return archivedWorkspace;
  }, [activeWorkspaceId, workspaces]);

  const restoreWorkspace = useCallback((workspaceId) => {
    if (workspaces.length >= MAX_DESKTOP_WORKSPACES) return null;
    const archivedWorkspace = deletedWorkspaces.find((workspace) => workspace.id === workspaceId);
    if (!archivedWorkspace) return null;
    const restoredWorkspace = {
      id: archivedWorkspace.id,
      name: archivedWorkspace.name || getUntitledWorkspaceName(workspaces.length + 1),
    };
    setDeletedWorkspaces((current) => current.filter((workspace) => workspace.id !== workspaceId));
    setWorkspaces((current) => [...current, restoredWorkspace]);
    setActiveWorkspaceId(restoredWorkspace.id);
    return restoredWorkspace;
  }, [deletedWorkspaces, workspaces.length]);

  return {
    activeWorkspace,
    activeWorkspaceId: activeWorkspace?.id || DEFAULT_DESKTOP_WORKSPACE_ID,
    addWorkspace,
    canAddWorkspace: workspaces.length < MAX_DESKTOP_WORKSPACES,
    deleteWorkspace,
    deletedWorkspaces,
    restoreWorkspace,
    selectWorkspace,
    setActiveWorkspace,
    workspaces,
  };
};
