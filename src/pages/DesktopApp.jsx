import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import DesktopLogin from '../DesktopLogin';
import { useSyncedTodos } from '../entities/task/data/useSyncedTodos';
import { useDesktopSession } from '../features/session';
import { useDesktopSearch } from '../features/search';
import {
  isInboxItem,
  useInboxData,
  useInboxItemCreation,
  useInboxPanel,
  useInboxPlacement,
} from '../features/inbox';
import {
  DESKTOP_APP_WINDOW_SCALE,
  getCanvasDeletionSummary,
  useCanvasDeleteShortcut,
  useCanvasDragPresentation,
  useCanvasEntries,
  useCanvasSelection,
  useCanvasTaskDrop,
  useDesktopConnections,
  useDesktopDragRuntime,
  useDesktopTaskDrag,
  useDesktopViewport,
} from '../features/canvas';
import { useDesktopCapture, useUploadedFileLifecycle } from '../features/capture';
import { useTextTaskDetail, useTextTaskPersistence } from '../features/task-detail';
import { useDesktopWorkspaces, useWorkspaceControl } from '../features/workspace';
import {
  cleanupDesktopGroupMetadata,
  createUpdatedTimestamp,
  usePackActions,
} from '../features/pack';
import { getLogicalToday } from '../lib/dateHelpers';
import { dateKey } from '../lib/dateUtils';
import {
  CARD_TYPES,
  getTaskCardPresentation,
  normalizeCardType,
} from '../entities/task/model/taskCardPresentation';

import { useDesktopTaskActions } from '../hooks/useDesktopTaskActions';
import { normalizeTask } from '../lib/taskNormalize';
import { taskBelongsToWorkspace } from '../lib/workspaceUtils';
import DesktopCanvasArea from './components/DesktopCanvasArea';
import DesktopHeader from './components/DesktopHeader';
import DesktopModalLayer from './components/DesktopModalLayer';

const LazyDesktopProfilePage = React.lazy(() => import('../features/session/components/DesktopProfilePage'));
const LazyDesktopSearchModal = React.lazy(() => import('../features/search/components/DesktopSearchModal'));
const LazyPackFullView = React.lazy(() => import('../features/pack/components/PackFullView'));

// Root-level app window scale (OS density scaling) — unrelated to canvas zoom.
// The entire desktop app wrapper is scaled down to 0.8 so the UI fits a typical
// consumer monitor pixel density. Drag overlay positions must compensate for this.
const GlobalStyles = () => {
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    const style = document.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; }
      html, body, #root { margin: 0; min-height: 100%; background: #ffffff; }
      body { overflow: hidden; }
      button, input { font: inherit; }
      ::selection { background-color: #ef4444; color: white; }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(link);
      document.head.removeChild(style);
    };
  }, []);
  return null;
};

function App({ session }) {
  const {
    handleSignOut,
    language,
    loading,
    profileOpen,
    setLanguage,
    setProfileOpen,
    t,
    user,
    userProfile,
  } = useDesktopSession();
  const currentUser = user || session?.user || null;
  const selectedDate = getLogicalToday();
  const {
    activeWorkspace,
    activeWorkspaceId,
    addWorkspace,
    canAddWorkspace,
    deleteWorkspace,
    deletedWorkspaces,
    restoreWorkspace,
    selectWorkspace,
    setActiveWorkspace,
    workspaces,
  } = useDesktopWorkspaces({ userId: currentUser?.id || null });
  const {
    workspaceMenuOpen,
    isWorkspaceNameEditing,
    workspaceNameDraft,
    workspaceNameInputRef,
    workspaceControlRef,
    closeWorkspaceMenu,
    toggleWorkspaceMenu,
    changeWorkspaceNameDraft,
    commitWorkspaceRename,
    handleWorkspaceNameKeyDown,
    handleWorkspaceNameDoubleClick,
  } = useWorkspaceControl({
    activeWorkspace,
    defaultWorkspaceId: activeWorkspaceId,
    setActiveWorkspace,
  });
  const [pendingWorkspaceDeletion, setPendingWorkspaceDeletion] = useState(null);
  const [isCanvasFileDragActive, setIsCanvasFileDragActive] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [pendingGroupPrompt, setPendingGroupPrompt] = useState(null);
  const [pendingGroupName, setPendingGroupName] = useState('');
  const [activeGroupView, setActiveGroupView] = useState(null);
  const [pendingCanvasDeletion, setPendingCanvasDeletion] = useState(null);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [tasks, setTasks, commitTodos] = useSyncedTodos({
    userId: currentUser?.id || null,
    normalizeTodo: normalizeTask,
  });
  const { activeTextTask, closeTextTask, openTextTask } = useTextTaskDetail({ tasks });
  // The feature flag stays off until the Inbox UI is ready. Once enabled, the
  // existing canvas and global search receive only organized Library items.
  const activeWorkspaceTasks = useMemo(
    () => tasks.filter((task) => taskBelongsToWorkspace(task, activeWorkspaceId)),
    [activeWorkspaceId, tasks],
  );
  const {
    inboxItems,
    inboxCount,
    inboxTargetPacks,
    libraryItems,
  } = useInboxData(activeWorkspaceTasks);
  const currentWorkspaceTasks = libraryItems;
  const selectedDateKey = dateKey(selectedDate);
  const {
    canvasEntries,
    canvasEntriesRef,
  } = useCanvasEntries({ currentWorkspaceTasks });
  const selectedDateRef = useRef(selectedDate);
  const tasksRef = useRef(currentWorkspaceTasks);
  const dragRuntime = useDesktopDragRuntime();
  const {
    desktopDragAnchorPointerOffsetRef,
    desktopDragAnchorSizeRef,
    desktopDragDetachedFromGroupRef,
    desktopDragModeRef,
    desktopDragOverlayNodeRef,
    desktopDragPointerRef,
    selectedTaskIdsRef: dragSelectedTaskIdsRef,
    suppressAllTaskClicksUntilRef,
    suppressTaskClickRef,
    suppressTaskClickTimeoutRef,
  } = dragRuntime;
  const {
    draggedTaskId,
    dragSession,
    isGroupDragActive,
    desktopDragOverlapTargetId,
    desktopDragOverlayActive,
    desktopDragOverlaySnapshot,
    setDraggedTaskId,
    setDragSession,
    setIsGroupDragActive,
    setDesktopDragOverlapTargetId,
    setDesktopDragOverlayActive,
    setDesktopDragOverlaySnapshot,
    connectDragPresentation,
  } = useCanvasDragPresentation({
    desktopDragDetachedFromGroupRef,
    desktopDragModeRef,
    desktopDragPointerRef,
    selectedDateKey,
  });
  const {
    selectedTaskIds,
    selectedTaskIdsRef,
    handleSelectionChange,
  } = useCanvasSelection({
    selectedTaskIdsRef: dragSelectedTaskIdsRef,
    suppressTaskClickTimeoutRef,
  });
  const handleCanvasDeletionRequest = useCallback((selectedIds) => {
    const summary = getCanvasDeletionSummary(t, tasksRef.current, selectedIds);
    if (summary) setPendingCanvasDeletion(summary);
  }, [t]);
  useCanvasDeleteShortcut({
    activeGroupView,
    selectedTaskIdsRef,
    onRequestDeletion: handleCanvasDeletionRequest,
  });
  const searchDragSeparateRef = useRef(false);
  const {
    handleSearchTaskLongPress,
    historyOpen,
    setHistoryOpen,
  } = useDesktopSearch({ searchDragSeparateRef });

  const { inboxOpen, openInbox, closeInbox } = useInboxPanel();
  const [isInboxDragActive, setIsInboxDragActive] = useState(false);
  const inboxTriggerRef = useRef(null);
  const showStatus = useCallback((message) => {
    setToastMessage(message);
    window.setTimeout(() => {
      setToastMessage((current) => (current === message ? null : current));
    }, 2200);
  }, [setToastMessage]);
  const {
    commitInboxPlacement,
    handleMoveInboxItemToPack,
  } = useInboxPlacement({
    commitTodos,
    inboxTargetPacks,
    onStatus: showStatus,
  });
  const handleInboxCanvasDrop = useCallback(async (drop) => {
    try {
      await commitInboxPlacement(drop);
    } finally {
      setIsInboxDragActive(false);
    }
  }, [commitInboxPlacement]);
  const handleInboxCanvasDragCancel = useCallback(() => {
    setIsInboxDragActive(false);
    openInbox();
  }, [openInbox]);
  const confirmWorkspaceDeletion = useCallback(() => {
    if (!pendingWorkspaceDeletion || workspaces.length <= 1) {
      setPendingWorkspaceDeletion(null);
      return;
    }
    const deletedAt = createUpdatedTimestamp();
    setTasks((currentTasks) => currentTasks.map((task) => (
      taskBelongsToWorkspace(task, pendingWorkspaceDeletion.id)
        ? normalizeTask({
          ...task,
          desktopWorkspaceDeletedAt: deletedAt,
          desktopWorkspaceDeletedName: pendingWorkspaceDeletion.name,
          updatedAt: deletedAt,
        })
        : task
    )));
    deleteWorkspace(pendingWorkspaceDeletion.id);
    setActiveGroupView(null);
    setPendingWorkspaceDeletion(null);
    showStatus('Workspace deleted. Restore it later from Settings.');
  }, [deleteWorkspace, pendingWorkspaceDeletion, setActiveGroupView, setPendingWorkspaceDeletion, setTasks, showStatus, workspaces]);
  const handleRestoreWorkspace = useCallback((workspaceId) => {
    const restoredWorkspace = restoreWorkspace(workspaceId);
    if (!restoredWorkspace) return false;
    const restoredAt = createUpdatedTimestamp();
    setTasks((currentTasks) => currentTasks.map((task) => (
      task.desktopWorkspaceId === workspaceId && task.desktopWorkspaceDeletedAt
        ? normalizeTask({
          ...task,
          desktopWorkspaceDeletedAt: null,
          desktopWorkspaceDeletedName: null,
          updatedAt: restoredAt,
        })
        : task
    )));
    showStatus(`${restoredWorkspace.name} restored.`);
    return true;
  }, [restoreWorkspace, setTasks, showStatus]);
  const canvasFileDragDepthRef = useRef(0);
  const {
    viewportContainerRef,
    flowInstanceRef,
    canvasBounds,
    canvasBoundsRef,
    canvasViewportSize,
    clampCanvasPosition,
    getCanvasPointFromClient,
    getDesktopDragAnchorPosition,
  } = useDesktopViewport({
    desktopDragAnchorPointerOffsetRef,
    desktopDragAnchorSizeRef,
  });
  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);
  useEffect(() => {
    tasksRef.current = currentWorkspaceTasks;
  }, [currentWorkspaceTasks]);
  useUploadedFileLifecycle({ tasks });
  useEffect(() => {
    const existingIds = new Set(currentWorkspaceTasks.map((task) => task.id));
    handleSelectionChange((current) => {
      const next = current.filter((taskId) => existingIds.has(taskId));
      const changed = next.length !== current.length;
      return changed ? next : current;
    });
  }, [currentWorkspaceTasks, handleSelectionChange]);

  const onCommitInternalDrop = useCanvasTaskDrop({
    runtime: dragRuntime,
    canvas: {
      cleanupDesktopGroupMetadata,
      searchDragSeparateRef,
      selectedDateRef,
      setPendingGroupName,
      setPendingGroupPrompt,
      setTasks,
    },
    canvasBoundsRef,
  });

  const {
    startDesktopTaskDrag,
    syncDesktopDraggedTaskPosition,
    handleTaskPointerDown,
    handleTaskPointerMove,
    handleTaskPointerUp,
    handleTaskPointerCancel,
    handleFlowNodeDragStart,
    handleFlowNodeDrag,
    handleFlowNodeDragStop,
  } = useDesktopTaskDrag({
    canvas: {
      runtime: dragRuntime,
      entriesRef: canvasEntriesRef,
      viewport: {
        canvasBoundsRef,
        getCanvasPointFromClient,
        getDesktopDragAnchorPosition,
      },
      presentation: {
        setDesktopDragOverlapTargetId,
        setDesktopDragOverlayActive,
        setDesktopDragOverlaySnapshot,
        setDraggedTaskId,
        setIsGroupDragActive,
        setDragSession,
      },
    },
    application: {
      onCommitInternalDrop,
    },
    bridges: {
      search: {
        searchDragSeparateRef,
        setHistoryOpen,
      },
      externalSource: {
        isTask: isInboxItem,
        onCancel: handleInboxCanvasDragCancel,
        onDrop: handleInboxCanvasDrop,
        onDropFailure: handleInboxCanvasDragCancel,
        // Keep the source mounted for pointer capture. InboxPanel becomes
        // visually and interactively transparent while the Canvas owns the drop.
        onOverlayReady: () => setIsInboxDragActive(true),
      },
    },
  });
  useLayoutEffect(() => {
    connectDragPresentation({
      syncDesktopDraggedTaskPosition,
    });
    return () => connectDragPresentation(null);
  }, [
    connectDragPresentation,
    syncDesktopDraggedTaskPosition,
  ]);
  const {
    connections,
    removeConnection,
    removeGroupConnections,
    rewirePackConnections,
    createConnectionFromFlow,
    isValidConnection,
  } = useDesktopConnections({
    entries: canvasEntries,
    onStatus: showStatus,
    tasks,
    userId: currentUser?.id || null,
    workspaceId: activeWorkspaceId,
  });
  const {
    showToast,
    openUploadedFileTask,
    handleCanvasFileDragEnter,
    handleCanvasFileDragOver,
    handleCanvasFileDragLeave,
    handleCanvasFileDrop,
    importFiles,
    applyAsyncMetadata,
  } = useDesktopCapture({
    activeWorkspaceId,
    canvasFileDragDepthRef,
    draggedTaskId,
    getCanvasPointFromClient,
    clampCanvasPosition,
    inboxEnabled: true,
    isCanvasFileDragActive,
    selectedDateKey,
    selectedDateRef,
    setFullscreenImage,
    setIsCanvasFileDragActive,
    setTasks,
    setToastMessage,
    userId: currentUser?.id || null,
  });

  const {
    handleCreateInboxItem,
  } = useInboxItemCreation({
    activeWorkspaceId,
    selectedDateKey,
    commitTodos,
    applyAsyncMetadata,
    onStatus: showStatus,
  });

  const {
    deleteTasksByIds,
    confirmCanvasDeletion,
    cancelCanvasDeletion,
    handleTaskClick,
  } = useDesktopTaskActions({
    cleanupDesktopGroupMetadata,
    openUploadedFileTask,
    onOpenTextTask: openTextTask,
    onGroupsDeleted: removeGroupConnections,
    pendingCanvasDeletion,
    selectedTaskIdsRef,
    setFullscreenImage,
    setPendingCanvasDeletion,
    setSelectedTaskIds: handleSelectionChange,
    setTasks,
    suppressAllTaskClicksUntilRef,
    suppressTaskClickRef,
    tasksRef,
    t,
    user: currentUser,
  });

  const {
    handleSaveTextTask,
  } = useTextTaskPersistence({
    setTasks,
  });

  const {
    updateActiveGroupMetadata,
    closeActiveGroupView,
    handleGroupCardOpen,
    handleHistoryPackOpen,
    handleHistoryPackItemOpen,
    handleConfirmGroupPrompt,
    handleCancelGroupPrompt,
  } = usePackActions({
    activeGroupView,
    currentWorkspaceTasks,
    pendingGroupName,
    pendingGroupPrompt,
    setActiveGroupView,
    setHistoryOpen,
    setPendingGroupName,
    setPendingGroupPrompt,
    setTasks,
    suppressAllTaskClicksUntilRef,
    tasksRef,
    handleTaskClick,
    onPacksMerged: rewirePackConnections,
  });

  const handleSearchModalTaskClick = (task) => {
    if (!task.id) return;
    const { redirectUrl } = getTaskCardPresentation(task, t);
    if (task.uploadedFileStorageKey || task.uploadedFileStoragePath) {
      setHistoryOpen(false);
      void openUploadedFileTask(task);
      return;
    }
    if (redirectUrl) {
      if (normalizeCardType(task.cardType) === CARD_TYPES.PHOTO) {
        setFullscreenImage(task.photoUrl || task.photoDataUrl || redirectUrl);
        return;
      }
      window.open(redirectUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    setHistoryOpen(false);
  };

  const handleSearchModalTaskLongPress = (task) => {
    handleSearchTaskLongPress(task, startDesktopTaskDrag);
  };

  const handleGroupViewTaskOpen = (task) => {
    closeActiveGroupView();
    handleTaskClick(task);
  };


  if (loading) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff' }}>
        <div style={{ width: 42, height: 42, borderRadius: '50%', border: '4px solid #e8e0d6', borderTop: '4px solid #ED1F1F', animation: 'desktop-spin 1s linear infinite' }} />
        <style>{`@keyframes desktop-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
  if (!currentUser) return <DesktopLogin />;
  return (
    <>
      <GlobalStyles />
      <div
        style={{
          width: '100vw',
          height: '100dvh',
          overflow: 'hidden',
          background: 'var(--desktop-root-bg)',
        }}
      >
        <div
          style={{
            width: `${100 / DESKTOP_APP_WINDOW_SCALE}vw`,
            height: `${100 / DESKTOP_APP_WINDOW_SCALE}dvh`,
            transform: `scale(${DESKTOP_APP_WINDOW_SCALE})`,
            transformOrigin: 'top left',
          }}
        >
      <div className="desktop-app" style={{ width: '100%', height: '100%', overflow: 'hidden', background: 'var(--desktop-root-bg)', color: 'var(--desktop-root-text)', fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column' }}>
        <DesktopHeader
          activeWorkspace={activeWorkspace}
          activeWorkspaceId={activeWorkspaceId}
          canAddWorkspace={canAddWorkspace}
          inboxCount={inboxCount}
          inboxEnabled
          inboxTriggerRef={inboxTriggerRef}
          isWorkspaceNameEditing={isWorkspaceNameEditing}
          onAddWorkspace={addWorkspace}
          onCloseWorkspaceMenu={closeWorkspaceMenu}
          onCommitWorkspaceRename={commitWorkspaceRename}
          onOpenInbox={openInbox}
          onOpenProfile={() => setProfileOpen(true)}
          onOpenSearch={() => setHistoryOpen(true)}
          onRequestDeleteWorkspace={setPendingWorkspaceDeletion}
          onSelectWorkspace={selectWorkspace}
          onToggleWorkspaceMenu={toggleWorkspaceMenu}
          onWorkspaceNameChange={changeWorkspaceNameDraft}
          onWorkspaceNameDoubleClick={handleWorkspaceNameDoubleClick}
          onWorkspaceNameKeyDown={handleWorkspaceNameKeyDown}
          t={t}
          userProfile={userProfile}
          workspaceControlRef={workspaceControlRef}
          workspaceMenuOpen={workspaceMenuOpen}
          workspaceNameDraft={workspaceNameDraft}
          workspaceNameInputRef={workspaceNameInputRef}
          workspaces={workspaces}
        />

        <DesktopCanvasArea
          canvasBounds={canvasBounds}
          canvasViewportSize={canvasViewportSize}
          connections={connections}
          desktopDragOverlapTargetId={desktopDragOverlapTargetId}
          desktopDragOverlayActive={desktopDragOverlayActive}
          desktopDragOverlayNodeRef={desktopDragOverlayNodeRef}
          desktopDragOverlaySnapshot={desktopDragOverlaySnapshot}
          flowInstanceRef={flowInstanceRef}
          dragSession={dragSession}
          draggedTaskId={draggedTaskId}
          handleCanvasFileDragEnter={handleCanvasFileDragEnter}
          handleCanvasFileDragLeave={handleCanvasFileDragLeave}
          handleCanvasFileDragOver={handleCanvasFileDragOver}
          handleCanvasFileDrop={handleCanvasFileDrop}
          handleGroupCardOpen={handleGroupCardOpen}
          handleTaskClick={handleTaskClick}
          handleTaskPointerCancel={handleTaskPointerCancel}
          handleTaskPointerDown={handleTaskPointerDown}
          handleTaskPointerMove={handleTaskPointerMove}
          handleTaskPointerUp={handleTaskPointerUp}
          handleFlowNodeDragStart={handleFlowNodeDragStart}
          handleFlowNodeDrag={handleFlowNodeDrag}
          handleFlowNodeDragStop={handleFlowNodeDragStop}
          handleSelectionChange={handleSelectionChange}
          isCanvasFileDragActive={isCanvasFileDragActive}
          isGroupDragActive={isGroupDragActive}
          removeConnection={removeConnection}
          canvasEntries={canvasEntries}
          selectedTaskIds={selectedTaskIds}
          createConnectionFromFlow={createConnectionFromFlow}
          isValidConnection={isValidConnection}
          t={t}
          viewportContainerRef={viewportContainerRef}
        />

        <DesktopModalLayer
          ProfilePageComponent={LazyDesktopProfilePage}
          SearchModalComponent={LazyDesktopSearchModal}
          PackFullViewComponent={LazyPackFullView}
          activeGroupView={activeGroupView}
          activeTextTask={activeTextTask}
          canRestoreWorkspace={canAddWorkspace}
          currentUser={currentUser}
          deletedWorkspaces={deletedWorkspaces}
          fullscreenImage={fullscreenImage}
          historyOpen={historyOpen}
          inboxAnchorRef={inboxTriggerRef}
          inboxItems={inboxItems}
          inboxOpen={inboxOpen}
          inboxPackOptions={inboxTargetPacks}
          isInboxDragActive={isInboxDragActive}
          language={language}
          onCancelCanvasDeletion={cancelCanvasDeletion}
          onCancelGroupPrompt={handleCancelGroupPrompt}
          onCancelWorkspaceDeletion={() => setPendingWorkspaceDeletion(null)}
          onCloseActiveGroupView={closeActiveGroupView}
          onCloseFullscreenImage={() => setFullscreenImage(null)}
          onCloseInbox={closeInbox}
          onCloseProfile={() => setProfileOpen(false)}
          onCloseSearch={() => setHistoryOpen(false)}
          onConfirmCanvasDeletion={confirmCanvasDeletion}
          onConfirmGroupPrompt={handleConfirmGroupPrompt}
          onConfirmWorkspaceDeletion={confirmWorkspaceDeletion}
          onCreateInboxItem={handleCreateInboxItem}
          onDeleteGroupTasks={deleteTasksByIds}
          onGroupNameChange={setPendingGroupName}
          onGroupTaskOpen={handleGroupViewTaskOpen}
          onGroupToast={showToast}
          onImportFiles={importFiles}
          onInboxTaskPointerCancel={handleTaskPointerCancel}
          onInboxTaskPointerDown={handleTaskPointerDown}
          onInboxTaskPointerMove={handleTaskPointerMove}
          onInboxTaskPointerUp={handleTaskPointerUp}
          onMoveInboxItemToPack={handleMoveInboxItemToPack}
          onRestoreWorkspace={handleRestoreWorkspace}
          onSaveTextTask={handleSaveTextTask}
          onSearchPackClick={handleHistoryPackOpen}
          onSearchPackItemClick={handleHistoryPackItemOpen}
          onSearchTaskClick={handleSearchModalTaskClick}
          onSearchTaskLongPress={handleSearchModalTaskLongPress}
          onSearchTaskPointerDown={handleTaskPointerDown}
          onSetLanguage={setLanguage}
          onSignOut={handleSignOut}
          onTextTaskClose={closeTextTask}
          onUpdateGroup={updateActiveGroupMetadata}
          pendingCanvasDeletion={pendingCanvasDeletion}
          pendingGroupName={pendingGroupName}
          pendingGroupPrompt={pendingGroupPrompt}
          pendingWorkspaceDeletion={pendingWorkspaceDeletion}
          profileOpen={profileOpen}
          searchTasks={currentWorkspaceTasks}
          t={t}
          toastMessage={toastMessage}
        />
      </div>
      </div>
      </div>
    </>
  );
}

export default App;
