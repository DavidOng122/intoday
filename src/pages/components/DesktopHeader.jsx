import { WorkspaceControl } from '../../features/workspace';

function DesktopHeader({
  activeWorkspace,
  activeWorkspaceId,
  canAddWorkspace,
  inboxCount,
  inboxEnabled,
  inboxTriggerRef,
  isWorkspaceNameEditing,
  onAddWorkspace,
  onCloseWorkspaceMenu,
  onCommitWorkspaceRename,
  onOpenInbox,
  onOpenProfile,
  onOpenSearch,
  onRequestDeleteWorkspace,
  onSelectWorkspace,
  onToggleWorkspaceMenu,
  onWorkspaceNameChange,
  onWorkspaceNameDoubleClick,
  onWorkspaceNameKeyDown,
  t,
  userProfile,
  workspaceControlRef,
  workspaceMenuOpen,
  workspaceNameDraft,
  workspaceNameInputRef,
  workspaces,
}) {
  return (
    <header className="desktop-minimal-header">
      <div className="desktop-minimal-brand">
        <WorkspaceControl
          activeWorkspace={activeWorkspace}
          activeWorkspaceId={activeWorkspaceId}
          canAddWorkspace={canAddWorkspace}
          isWorkspaceNameEditing={isWorkspaceNameEditing}
          onAddWorkspace={onAddWorkspace}
          onCloseWorkspaceMenu={onCloseWorkspaceMenu}
          onCommitWorkspaceRename={onCommitWorkspaceRename}
          onRequestDeleteWorkspace={onRequestDeleteWorkspace}
          onSelectWorkspace={onSelectWorkspace}
          onToggleWorkspaceMenu={onToggleWorkspaceMenu}
          onWorkspaceNameChange={onWorkspaceNameChange}
          onWorkspaceNameDoubleClick={onWorkspaceNameDoubleClick}
          onWorkspaceNameKeyDown={onWorkspaceNameKeyDown}
          t={t}
          workspaceControlRef={workspaceControlRef}
          workspaceMenuOpen={workspaceMenuOpen}
          workspaceNameDraft={workspaceNameDraft}
          workspaceNameInputRef={workspaceNameInputRef}
          workspaces={workspaces}
        />
      </div>
      <div className="desktop-topbar-actions">
        <button type="button" onClick={onOpenSearch} className="desktop-header-icon-button">
          <svg width="19" height="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16.625 16.625L13.1812 13.1812M15.0417 8.70833C15.0417 12.2061 12.2061 15.047 8.70833 15.0417C5.21053 15.0417 2.375 12.2061 2.375 8.70833C2.375 5.21053 5.21053 2.375 8.70833 2.375C12.2061 2.375 15.0417 5.21053 15.0417 8.70833Z" stroke="#1E1E1E" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {inboxEnabled && (
          <button
            ref={inboxTriggerRef}
            type="button"
            onClick={onOpenInbox}
            className="desktop-inbox-trigger"
            aria-label={`${t.inbox || 'Inbox'} (${inboxCount})`}
            title={t.inbox || 'Inbox'}
          >
            <span className="desktop-inbox-trigger-icon" aria-hidden="true">
              <svg width="19" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
              </svg>
            </span>
            <span className="desktop-inbox-trigger-label">{t.inbox || 'Inbox'}</span>
            <span className="desktop-inbox-trigger-count" aria-hidden="true">{inboxCount}</span>
          </button>
        )}
        <button type="button" className="desktop-profile-trigger desktop-header-avatar-button" onClick={onOpenProfile}>
          {userProfile.avatarUrl ? (
            <img src={userProfile.avatarUrl} alt={userProfile.fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontFamily: 'DM Serif Display, serif', fontSize: 18, color: 'var(--desktop-root-text)' }}>{userProfile.initial}</span>
          )}
        </button>
      </div>
    </header>
  );
}

export default DesktopHeader;
