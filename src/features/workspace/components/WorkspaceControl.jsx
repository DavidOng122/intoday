import { WorkspaceChevronIcon } from '../../../shared/ui/icons/DesktopIcons';
import WorkspaceMenu from './WorkspaceMenu';

function WorkspaceControl({
  activeWorkspace,
  activeWorkspaceId,
  canAddWorkspace,
  isWorkspaceNameEditing,
  onAddWorkspace,
  onCloseWorkspaceMenu,
  onCommitWorkspaceRename,
  onRequestDeleteWorkspace,
  onSelectWorkspace,
  onToggleWorkspaceMenu,
  onWorkspaceNameChange,
  onWorkspaceNameDoubleClick,
  onWorkspaceNameKeyDown,
  t,
  workspaceControlRef,
  workspaceMenuOpen,
  workspaceNameDraft,
  workspaceNameInputRef,
  workspaces,
}) {
  return (
    <div ref={workspaceControlRef} className="desktop-workspace-control">
      <div className={`desktop-workspace-shell ${isWorkspaceNameEditing ? 'is-editing' : ''} ${workspaceMenuOpen ? 'is-open' : ''}`}>
        {isWorkspaceNameEditing ? (
          <input
            ref={workspaceNameInputRef}
            type="text"
            value={workspaceNameDraft}
            onChange={onWorkspaceNameChange}
            onBlur={onCommitWorkspaceRename}
            onKeyDown={onWorkspaceNameKeyDown}
            className="desktop-workspace-name-input"
            aria-label="Workspace name"
          />
        ) : (
          <button
            type="button"
            className="desktop-workspace-name-button"
            aria-haspopup="menu"
            aria-expanded={workspaceMenuOpen}
            onClick={onToggleWorkspaceMenu}
            onDoubleClick={onWorkspaceNameDoubleClick}
          >
            <span className="desktop-workspace-trigger-label">{activeWorkspace?.name || t.untitledWorkspace}</span>
            <span className="desktop-workspace-trigger-chevron" aria-hidden="true">
              <WorkspaceChevronIcon open={workspaceMenuOpen} />
            </span>
          </button>
        )}
      </div>
      <WorkspaceMenu
        activeWorkspaceId={activeWorkspaceId}
        canAddWorkspace={canAddWorkspace}
        controlRef={workspaceControlRef}
        onAddWorkspace={onAddWorkspace}
        onClose={onCloseWorkspaceMenu}
        onRequestDeleteWorkspace={onRequestDeleteWorkspace}
        onSelectWorkspace={onSelectWorkspace}
        open={workspaceMenuOpen}
        t={t}
        workspaces={workspaces}
      />
    </div>
  );
}

export default WorkspaceControl;
