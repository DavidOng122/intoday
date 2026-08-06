export const DESKTOP_WORKSPACES_KEY = 'desktop_workspace_items';
export const DESKTOP_ACTIVE_WORKSPACE_KEY = 'desktop_active_workspace';
export const DELETED_DESKTOP_WORKSPACES_KEY = 'desktop_deleted_workspace_items';
export const DEFAULT_DESKTOP_WORKSPACE_ID = 'workspace-untitled';
export const MAX_DESKTOP_WORKSPACES = 3;
export const LEGACY_SAMPLE_WORKSPACE_IDS = new Set(['workspace-personal-projects', 'workspace-work-setup']);
export const DEFAULT_DESKTOP_WORKSPACES = [
  {
    id: DEFAULT_DESKTOP_WORKSPACE_ID,
    name: 'Untitled',
    iconType: 'dot',
  },
];
