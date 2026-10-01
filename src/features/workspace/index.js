export { default as WorkspaceMenu } from './components/WorkspaceMenu';
export { default as WorkspaceControl } from './components/WorkspaceControl';
export {
  useDesktopWorkspaces,
} from './hooks/useDesktopWorkspaces';
export { useWorkspaceControl } from './hooks/useWorkspaceControl';
export { normalizeDesktopWorkspaces } from '../../lib/workspaceUtils';
export {
  DELETED_DESKTOP_WORKSPACES_KEY,
  DEFAULT_DESKTOP_WORKSPACE_ID,
  MAX_DESKTOP_WORKSPACES,
} from '../../shared/config/workspaceConstants';
