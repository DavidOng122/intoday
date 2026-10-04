import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
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
      <DropdownMenu.Root
        open={workspaceMenuOpen}
        onOpenChange={(nextOpen) => {
          if (nextOpen) onToggleWorkspaceMenu();
          else onCloseWorkspaceMenu();
        }}
      >
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
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="desktop-workspace-name-button"
              onDoubleClick={onWorkspaceNameDoubleClick}
            >
              <span className="desktop-workspace-trigger-label">{activeWorkspace?.name || t.untitledWorkspace}</span>
              <span className="desktop-workspace-trigger-chevron" aria-hidden="true">
                <WorkspaceChevronIcon open={workspaceMenuOpen} />
              </span>
            </button>
          </DropdownMenu.Trigger>
        )}
      </div>
      <WorkspaceMenu
        activeWorkspaceId={activeWorkspaceId}
        canAddWorkspace={canAddWorkspace}
        onAddWorkspace={onAddWorkspace}
        onClose={onCloseWorkspaceMenu}
        onRequestDeleteWorkspace={onRequestDeleteWorkspace}
        onSelectWorkspace={onSelectWorkspace}
        open={workspaceMenuOpen}
        t={t}
        workspaces={workspaces}
      />
      </DropdownMenu.Root>
    </div>
  );
}

export default WorkspaceControl;
