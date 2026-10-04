import { useState } from 'react';
import { CircleAlert, Plus, Trash2 } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { getDesktopPortalContainer } from '../../../shared/ui/desktopPortal';
import { WorkspaceMoreIcon } from '../../../shared/ui/icons/DesktopIcons';
import { MAX_DESKTOP_WORKSPACES } from '../../../shared/config/workspaceConstants';

const WorkspaceMenu = ({
  activeWorkspaceId,
  canAddWorkspace,
  onAddWorkspace,
  onClose,
  onRequestDeleteWorkspace,
  onSelectWorkspace,
  open,
  t = {},
  workspaces,
}) => {
  const [actionsWorkspaceId, setActionsWorkspaceId] = useState(null);

  if (!open) return null;

  const limitReached = !canAddWorkspace;
  return (
    <DropdownMenu.Portal container={getDesktopPortalContainer()}>
    <DropdownMenu.Content
      className={`desktop-workspace-menu desktop-spaces-popover ${limitReached ? 'is-limit-reached' : ''}`}
      aria-label={t.workspaceMenuTitle || 'My Spaces'}
      side="bottom"
      align="start"
      sideOffset={10}
      collisionPadding={8}
    >
      <div className="desktop-workspace-menu-label">{t.workspaceMenuTitle || 'My Spaces'}</div>
      <div className="desktop-workspace-menu-list">
        {workspaces.map((workspace) => {
          const active = workspace.id === activeWorkspaceId;
          return (
            <div key={workspace.id} className={`desktop-workspace-menu-row ${active ? 'is-active' : ''}`}>
              <DropdownMenu.Item
                className="desktop-workspace-menu-select"
                onSelect={() => {
                  onSelectWorkspace(workspace.id);
                  onClose();
                }}
              >
                {workspace.name}
              </DropdownMenu.Item>
              {active && (
                <DropdownMenu.Sub
                  open={actionsWorkspaceId === workspace.id}
                  onOpenChange={(nextOpen) => setActionsWorkspaceId(nextOpen ? workspace.id : null)}
                >
                  <DropdownMenu.SubTrigger
                    className="desktop-workspace-menu-more"
                    aria-label={`${t.workspaceMenuTitle || 'Workspace'} actions for ${workspace.name}`}
                  >
                    <WorkspaceMoreIcon />
                  </DropdownMenu.SubTrigger>
                  <DropdownMenu.Portal container={getDesktopPortalContainer()}>
                    <DropdownMenu.SubContent
                      className="desktop-workspace-delete-popover"
                      sideOffset={6}
                      collisionPadding={8}
                    >
                      <DropdownMenu.Item
                        className="desktop-workspace-delete-action"
                        disabled={workspaces.length <= 1}
                        onSelect={() => {
                          setActionsWorkspaceId(null);
                          onClose();
                          onRequestDeleteWorkspace(workspace);
                        }}
                      >
                        <Trash2 aria-hidden="true" />
                        <span>{t.deleteWorkspace || 'Delete workspace'}</span>
                      </DropdownMenu.Item>
                    </DropdownMenu.SubContent>
                  </DropdownMenu.Portal>
                </DropdownMenu.Sub>
              )}
            </div>
          );
        })}
      </div>
      <div className="desktop-workspace-menu-divider" />
      {limitReached && (
        <div className="desktop-workspace-limit">
          <div className="desktop-workspace-limit-copy">
            <span><CircleAlert aria-hidden="true" />{t.workspaceLimitReached || 'Free plan limit reached'}</span>
            <strong>{workspaces.length}/{MAX_DESKTOP_WORKSPACES}</strong>
          </div>
          <div className="desktop-workspace-limit-progress" />
        </div>
      )}
      <DropdownMenu.Item
        className="desktop-workspace-add-button"
        disabled={limitReached}
        onSelect={() => {
          onAddWorkspace();
          onClose();
        }}
      >
        <span className="desktop-workspace-add-icon"><Plus aria-hidden="true" /></span>
        <span>{t.addWorkspace || 'Add workspace'}</span>
      </DropdownMenu.Item>
    </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
};

export default WorkspaceMenu;
