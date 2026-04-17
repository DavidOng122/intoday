import { DEFAULT_DESKTOP_WORKSPACES, LEGACY_SAMPLE_WORKSPACE_IDS, DEFAULT_DESKTOP_WORKSPACE_ID } from './desktopConstants';

export const normalizeDesktopWorkspaces = (value) => {
  if (!Array.isArray(value) || !value.length) return getDefaultDesktopWorkspaces();
  const normalized = value
    .filter((workspace) => workspace && !LEGACY_SAMPLE_WORKSPACE_IDS.has(workspace.id))
    .filter((workspace) => workspace && typeof workspace.id === 'string' && typeof workspace.name === 'string')
    .map((workspace, index) => ({
      id: workspace.id,
      name: workspace.name.trim() || getUntitledWorkspaceName(index + 1),
      iconType: workspace.iconType === 'letter' ? 'letter' : 'dot',
      iconLetter: typeof workspace.iconLetter === 'string' ? workspace.iconLetter.slice(0, 1).toUpperCase() : null,
      iconBackground: typeof workspace.iconBackground === 'string' ? workspace.iconBackground : null,
      iconColor: typeof workspace.iconColor === 'string' ? workspace.iconColor : null,
    }));
  return normalized.length ? normalized : getDefaultDesktopWorkspaces();
};

export const getTaskWorkspaceId = (task) => (
  typeof task?.desktopWorkspaceId === 'string' && task.desktopWorkspaceId.trim()
    ? task.desktopWorkspaceId
    : DEFAULT_DESKTOP_WORKSPACE_ID
);

export const taskBelongsToWorkspace = (task, workspaceId) => getTaskWorkspaceId(task) === workspaceId;

export const getDefaultDesktopWorkspaces = () => DEFAULT_DESKTOP_WORKSPACES.map((workspace) => ({ ...workspace }));

export const getUntitledWorkspaceName = (index) => (index <= 1 ? 'Untitled' : `Untitled ${index}`);

export const areTaskIdSelectionsEqual = (currentIds, nextIds) => (
  currentIds.length === nextIds.length && nextIds.every((taskId) => currentIds.includes(taskId))
);