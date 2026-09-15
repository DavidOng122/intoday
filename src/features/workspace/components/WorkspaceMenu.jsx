import React, { useEffect, useRef, useState } from 'react';
import { CircleAlert, Plus, Trash2 } from 'lucide-react';
import { WorkspaceMoreIcon } from '../../../shared/ui/icons/DesktopIcons';
import { MAX_DESKTOP_WORKSPACES } from '../../../shared/config/workspaceConstants';

const WorkspaceMenu = ({
  activeWorkspaceId,
  canAddWorkspace,
  controlRef,
  onAddWorkspace,
  onClose,
  onRequestDeleteWorkspace,
  onSelectWorkspace,
  open,
  t = {},
  workspaces,
}) => {
  const menuRef = useRef(null);
  const [actionsWorkspaceId, setActionsWorkspaceId] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (controlRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      onClose();
    };
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (actionsWorkspaceId) {
        setActionsWorkspaceId(null);
      } else {
        onClose();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [actionsWorkspaceId, controlRef, onClose, open]);

  if (!open) return null;

  const limitReached = !canAddWorkspace;
  return (
    <div ref={menuRef} className={`desktop-workspace-menu desktop-spaces-popover ${limitReached ? 'is-limit-reached' : ''}`} role="menu" aria-label={t.workspaceMenuTitle || 'My Spaces'}>
      <div className="desktop-workspace-menu-label">{t.workspaceMenuTitle || 'My Spaces'}</div>
      <div className="desktop-workspace-menu-list">
        {workspaces.map((workspace) => {
          const active = workspace.id === activeWorkspaceId;
          return (
            <div key={workspace.id} className={`desktop-workspace-menu-row ${active ? 'is-active' : ''}`}>
              <button
                type="button"
                className="desktop-workspace-menu-select"
                onClick={() => {
                  onSelectWorkspace(workspace.id);
                  onClose();
                }}
                role="menuitem"
              >
                {workspace.name}
              </button>
              {active && (
                <button
                  type="button"
                  className="desktop-workspace-menu-more"
                  aria-label={`${t.workspaceMenuTitle || 'Workspace'} actions for ${workspace.name}`}
                  aria-expanded={actionsWorkspaceId === workspace.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    setActionsWorkspaceId((current) => (current === workspace.id ? null : workspace.id));
                  }}
                >
                  <WorkspaceMoreIcon />
                </button>
              )}
              {actionsWorkspaceId === workspace.id && (
                <div className="desktop-workspace-delete-popover" role="menu">
                  <button
                    type="button"
                    className="desktop-workspace-delete-action"
                    disabled={workspaces.length <= 1}
                    onClick={() => {
                      setActionsWorkspaceId(null);
                      onClose();
                      onRequestDeleteWorkspace(workspace);
                    }}
                    role="menuitem"
                  >
                    <Trash2 aria-hidden="true" />
                    <span>{t.deleteWorkspace || 'Delete workspace'}</span>
                  </button>
                </div>
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
      <button
        type="button"
        className="desktop-workspace-add-button"
        disabled={limitReached}
        onClick={() => {
          onAddWorkspace();
          onClose();
        }}
      >
        <span className="desktop-workspace-add-icon"><Plus aria-hidden="true" /></span>
        <span>{t.addWorkspace || 'Add workspace'}</span>
      </button>
    </div>
  );
};

export default WorkspaceMenu;
