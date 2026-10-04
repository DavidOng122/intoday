import React from 'react';
import { X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { getDesktopPortalContainer } from '../../shared/ui/desktopPortal';
import { InboxPanel } from '../../features/inbox';
import { PackPrompt } from '../../features/pack';
import { TextTaskDetailModal } from '../../features/task-detail';
import DesktopDeleteConfirmModal from '../../shared/ui/DeleteConfirmModal';

function DesktopModalLayer({
  ProfilePageComponent,
  SearchModalComponent,
  PackFullViewComponent,
  activeGroupView,
  activeTextTask,
  canRestoreWorkspace,
  currentUser,
  deletedWorkspaces,
  fullscreenImage,
  historyOpen,
  inboxAnchorRef,
  inboxItems,
  inboxOpen,
  inboxPackOptions,
  isInboxDragActive,
  language,
  onCancelCanvasDeletion,
  onCancelGroupPrompt,
  onCancelWorkspaceDeletion,
  onCloseActiveGroupView,
  onCloseFullscreenImage,
  onCloseInbox,
  onCloseProfile,
  onCloseSearch,
  onConfirmCanvasDeletion,
  onConfirmGroupPrompt,
  onConfirmWorkspaceDeletion,
  onCreateInboxItem,
  onDeleteGroupTasks,
  onGroupNameChange,
  onGroupTaskOpen,
  onGroupToast,
  onImportFiles,
  onInboxTaskPointerCancel,
  onInboxTaskPointerDown,
  onInboxTaskPointerMove,
  onInboxTaskPointerUp,
  onMoveInboxItemToPack,
  onRestoreWorkspace,
  onSaveTextTask,
  onSearchPackClick,
  onSearchPackItemClick,
  onSearchTaskClick,
  onSearchTaskLongPress,
  onSearchTaskPointerDown,
  onSetLanguage,
  onSignOut,
  onTextTaskClose,
  onUpdateGroup,
  pendingCanvasDeletion,
  pendingGroupName,
  pendingGroupPrompt,
  pendingWorkspaceDeletion,
  profileOpen,
  searchTasks,
  t,
  toastMessage,
}) {
  return (
    <>
      {profileOpen ? (
        <React.Suspense fallback={null}>
          {React.createElement(ProfilePageComponent, {
            open: true,
            onClose: onCloseProfile,
            user: currentUser,
            language,
            setLanguage: onSetLanguage,
            deletedWorkspaces,
            canRestoreWorkspace,
            onRestoreWorkspace,
            onSignOut,
          })}
        </React.Suspense>
      ) : null}
      {historyOpen ? (
        <React.Suspense fallback={null}>
          {React.createElement(SearchModalComponent, {
            open: true,
            tasks: searchTasks,
            language,
            t,
            onClose: onCloseSearch,
            onTaskClick: onSearchTaskClick,
            onPackClick: onSearchPackClick,
            onPackItemClick: onSearchPackItemClick,
            onTaskPointerDown: onSearchTaskPointerDown,
            onTaskLongPress: onSearchTaskLongPress,
          })}
        </React.Suspense>
      ) : null}
      <InboxPanel
        open={inboxOpen}
        isDraggingOut={isInboxDragActive}
        items={inboxItems}
        packOptions={inboxPackOptions}
        t={t}
        onClose={onCloseInbox}
        onCreateItem={onCreateInboxItem}
        onImportFiles={onImportFiles}
        onMoveToPack={onMoveInboxItemToPack}
        onTaskPointerDown={onInboxTaskPointerDown}
        onTaskPointerMove={onInboxTaskPointerMove}
        onTaskPointerUp={onInboxTaskPointerUp}
        onTaskPointerCancel={onInboxTaskPointerCancel}
        anchorRef={inboxAnchorRef}
      />

      <PackPrompt
        prompt={pendingGroupPrompt}
        groupName={pendingGroupName}
        setGroupName={onGroupNameChange}
        onConfirm={onConfirmGroupPrompt}
        onCancel={onCancelGroupPrompt}
      />
      {activeGroupView ? (
        <React.Suspense fallback={null}>
          {          React.createElement(PackFullViewComponent, {
            view: activeGroupView,
            labels: t,
            language,
            onClose: onCloseActiveGroupView,
            onDeleteTasks: onDeleteGroupTasks,
            onUpdateGroup,
            onToast: onGroupToast,
            onTaskOpen: onGroupTaskOpen,
          })}
        </React.Suspense>
      ) : null}
      {activeTextTask ? (
        <TextTaskDetailModal
          key={activeTextTask.id}
          task={activeTextTask}
          labels={t}
          language={language}
          onClose={onTextTaskClose}
          onSave={onSaveTextTask}
        />
      ) : null}
      <DesktopDeleteConfirmModal
        open={Boolean(pendingWorkspaceDeletion)}
        title={`Delete “${pendingWorkspaceDeletion?.name || 'Workspace'}”?`}
        description="All items in this workspace will be removed. You can restore the workspace later from Settings."
        onCancel={onCancelWorkspaceDeletion}
        onConfirm={onConfirmWorkspaceDeletion}
      />
      <DesktopDeleteConfirmModal
        open={Boolean(pendingCanvasDeletion)}
        title={pendingCanvasDeletion?.title || t.deleteObjectQuestion}
        cancelLabel={t.cancel}
        confirmLabel={t.delete}
        onCancel={onCancelCanvasDeletion}
        onConfirm={onConfirmCanvasDeletion}
      />
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: 32,
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#333',
          color: '#FFF',
          padding: '10px 20px',
          borderRadius: 999,
          fontSize: 14,
          fontWeight: 500,
          zIndex: 99999,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          animation: 'fadeInOut 3s forwards',
        }}>
          {toastMessage}
        </div>
      )}

      <Dialog.Root
        open={Boolean(fullscreenImage)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) onCloseFullscreenImage();
        }}
      >
      {fullscreenImage && (
        <Dialog.Portal container={getDesktopPortalContainer()}>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'fadeIn 0.2s ease-out',
          }}
        />
        <Dialog.Content
          aria-label="Fullscreen image viewer"
          onClick={(event) => {
            if (event.target === event.currentTarget) onCloseFullscreenImage();
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'zoom-out',
            outline: 'none',
          }}
        >
          <Dialog.Close asChild>
          <button
            type="button"
            aria-label="Close fullscreen image"
            style={{
              position: 'absolute',
              top: 40,
              right: 40,
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              borderRadius: '50%',
              width: 48,
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              cursor: 'pointer',
              zIndex: 100001,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(event) => { event.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)'; }}
            onMouseLeave={(event) => { event.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'; }}
          >
            <X size={24} />
          </button>
          </Dialog.Close>
          <img
            src={fullscreenImage}
            alt="Fullscreen"
            style={{
              maxWidth: '90%',
              maxHeight: '90%',
              objectFit: 'contain',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              userSelect: 'none',
              WebkitUserDrag: 'none',
            }}
            onClick={(event) => event.stopPropagation()}
          />
        </Dialog.Content>
        </Dialog.Portal>
      )}
      </Dialog.Root>
    </>
  );
}

export default DesktopModalLayer;
