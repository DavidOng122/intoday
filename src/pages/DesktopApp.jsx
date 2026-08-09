/* eslint-disable react-hooks/set-state-in-effect */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import DesktopLogin from '../DesktopLogin';
import { useSyncedTodos } from '../entities/task/data/useSyncedTodos';
import { useDesktopSession } from '../features/session';
import { useDesktopSearch } from '../features/search';
import {
  getInboxCount,
  getInboxItems,
  getInboxTargetPacks,
  getLibraryItems,
  InboxPanel,
  createInboxTask,
  isInboxItem,
  moveInboxItemToPack,
  placeInboxItem,
  useInboxPanel,
} from '../features/inbox';
import DesktopDeleteConfirmModal from '../shared/ui/DeleteConfirmModal';
import { DesktopCanvas } from '../features/canvas';
import { useDesktopConnections } from '../features/canvas';
import { useDesktopCapture } from '../features/capture';
import { WorkspaceMenu, useDesktopWorkspaces } from '../features/workspace';
import { GroupedTaskCard, TaskCard } from '../features/canvas';
import {
  PackPrompt,
  cleanupDesktopGroupMetadata,
  createUpdatedTimestamp,
  usePackActions,
} from '../features/pack';
import {
  WorkspaceChevronIcon,
} from '../shared/ui/icons/DesktopIcons';
import { getLogicalToday } from '../lib/dateHelpers';
import { getPackMetadataTextFromItems } from '../features/pack';
import { deleteUploadedFileBlob } from '../shared/storage/uploadedFileStorage';
import {
  getPackIconFromTasks,
  getPackTagsFromTasks,
  PACK_ICON_SUGGESTIONS,
} from '../features/pack';
import {
  CARD_TYPES,
  getDerivedTaskFields,
  getTaskCardPresentation,
  normalizeCardType,
} from '../entities/task/model/taskCardPresentation';

import { useDesktopViewport } from '../features/canvas';
import { useDesktopTaskDrag } from '../features/canvas';
import { useDesktopTaskActions } from '../hooks/useDesktopTaskActions';
import { normalizeTask } from '../lib/taskNormalize';
import { taskBelongsToWorkspace } from '../lib/workspaceUtils';
import {
  DESKTOP_APP_WINDOW_SCALE,
  DESKTOP_CANVAS_CARD_GAP,
  DESKTOP_CANVAS_CARD_HEIGHT,
  DESKTOP_CANVAS_CARD_WIDTH,
  DESKTOP_CANVAS_TOP_PADDING,
  DESKTOP_PHOTO_CARD_HEIGHT,
} from '../features/canvas';
import { UPLOADED_FILE_SOURCE_LABEL } from '../features/capture/config/uploadConstants';
import { constrainDesktopCanvasEntries, resolveDesktopCanvasEntries } from '../features/canvas';

const LazyDesktopProfilePage = React.lazy(() => import('../features/session/components/DesktopProfilePage'));
const LazyDesktopSearchModal = React.lazy(() => import('../features/search/components/DesktopSearchModal'));
const LazyPackFullView = React.lazy(() => import('../features/pack/components/PackFullView'));

const INBOX_FEATURE_ENABLED = true;
// Root-level app window scale (OS density scaling) — unrelated to canvas zoom.
// The entire desktop app wrapper is scaled down to 0.8 so the UI fits a typical
// consumer monitor pixel density. Drag overlay positions must compensate for this.
const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const areTaskIdSelectionsEqual = (currentIds, nextIds) => (
  currentIds.length === nextIds.length && nextIds.every((taskId) => currentIds.includes(taskId))
);
const getCanvasDeletionSummary = (labels, tasks, selectedTaskIds) => {
  const selectedTaskIdSet = new Set(selectedTaskIds);
  const selectedTasks = tasks.filter((task) => selectedTaskIdSet.has(task.id));
  if (!selectedTasks.length) return null;

  const groupMembership = tasks.reduce((map, task) => {
    if (!task.desktopGroupId) return map;
    map.set(task.desktopGroupId, (map.get(task.desktopGroupId) || 0) + 1);
    return map;
  }, new Map());
  const selectedGroupCounts = selectedTasks.reduce((map, task) => {
    if (!task.desktopGroupId) return map;
    map.set(task.desktopGroupId, (map.get(task.desktopGroupId) || 0) + 1);
    return map;
  }, new Map());

  let packCount = 0;
  let looseItemCount = 0;
  selectedTasks.forEach((task) => {
    if (!task.desktopGroupId) {
      looseItemCount += 1;
      return;
    }
    if (selectedGroupCounts.get(task.desktopGroupId) === groupMembership.get(task.desktopGroupId)) {
      if (task.id === selectedTasks.find((item) => item.desktopGroupId === task.desktopGroupId)?.id) {
        packCount += 1;
      }
      return;
    }
    looseItemCount += 1;
  });

  let title = labels.deleteObjectQuestion || 'Delete selected objects?';
  if (packCount === 0) {
    title = looseItemCount === 1
      ? labels.deleteItemQuestion
      : labels.deleteMultipleItemsQuestion.replace('{count}', looseItemCount);
  } else if (looseItemCount === 0) {
    title = packCount === 1
      ? labels.deletePackQuestion
      : labels.deleteMultiplePacksQuestion.replace('{count}', packCount);
  } else {
    const itemLabel = (looseItemCount === 1 ? labels.itemLabel : labels.itemsLabel).replace('{count}', looseItemCount);
    const packLabel = (packCount === 1 ? labels.packLabel : labels.packsLabel).replace('{count}', packCount);
    title = labels.deleteItemsAndPacksQuestion.replace('{itemLabel}', itemLabel).replace('{packLabel}', packLabel);
  }

  return {
    title,
    packCount,
    looseItemCount,
    taskIds: selectedTasks.map((task) => task.id),
  };
};
const getDesktopGroupDisplayName = (tasks) => (
  tasks.find((task) => typeof task.desktopGroupName === 'string' && task.desktopGroupName.trim())?.desktopGroupName
  || tasks[0]?.text
  || 'Untitled group'
);
const getDesktopGroupIcon = (tasks) => getPackIconFromTasks(tasks);
const getDesktopGroupTags = (tasks) => getPackTagsFromTasks(tasks);
const getDesktopGroupDisplayTags = (tasks) => {
  const storedTags = getDesktopGroupTags(tasks);
  if (storedTags.length > 0) return storedTags;
  return getDesktopGroupChips(tasks);
};
const formatDesktopGroupChipLabel = (value) => {
  if (!value) return '';
  if (value === 'text') return 'Note';
  return value.charAt(0).toUpperCase() + value.slice(1);
};
const getDesktopGroupChips = (tasks) => {
  const uniqueTypes = [...new Set(tasks.map((task) => normalizeCardType(task.cardType)).filter(Boolean))];
  if (uniqueTypes.length === 0) return [];
  if (uniqueTypes.length > 1) {
    return ['Mixed Content', formatDesktopGroupChipLabel(uniqueTypes[0])];
  }
  return [formatDesktopGroupChipLabel(uniqueTypes[0])];
};
const GlobalStyles = ({ appearance }) => {
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    const style = document.createElement('style');
    const shellBackground = appearance === 'dark' ? '#121212' : '#ffffff';
    style.textContent = `
      * { box-sizing: border-box; }
      html, body, #root { margin: 0; min-height: 100%; background: ${shellBackground}; }
      body { overflow: hidden; }
      button, input { font: inherit; }
      ::selection { background-color: #ef4444; color: white; }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(link);
      document.head.removeChild(style);
    };
  }, [appearance]);
  return null;
};

const GroupDragPreview = ({ tasks, appearance, labels }) => {
  const groupTitle = getDesktopGroupDisplayName(tasks);
  const groupIcon = getDesktopGroupIcon(tasks);
  const metadataText = getPackMetadataTextFromItems(tasks);
  const groupChips = getDesktopGroupDisplayTags(tasks);
  const displayTasks = tasks.slice(0, 4); // Display up to 4 items matching the card

  return (
    <div className="desktop-task-card desktop-task-group-card is-drag-preview" style={{ width: '100%', height: '100%', transform: 'none', padding: '14px 0 0 0' }}>
      <div className="desktop-task-group-header" style={{ marginBottom: 10, padding: '0 14px' }}>
        <div className="desktop-task-group-title-wrap">
          {groupIcon ? (
            <span className="desktop-task-group-title-icon">{groupIcon}</span>
          ) : (
            <span className="desktop-task-group-title-dot" />
          )}
          <div className="desktop-task-group-title-block">
            <span className="desktop-task-group-title">{groupTitle}</span>
            {metadataText && <span className="desktop-task-group-metadata">{metadataText}</span>}
          </div>
        </div>
      </div>

      {groupChips.length > 0 && (
        <div className="desktop-task-group-chip-row" style={{ padding: '0 14px', marginBottom: 10 }}>
          {groupChips.map((chip, idx) => (
            <div key={idx} className="desktop-task-group-chip">
              {chip}
            </div>
          ))}
        </div>
      )}

      <div className="desktop-task-group-list" style={{ padding: 0 }}>
        {displayTasks.map((task) => (
          <div key={task.id} className="desktop-task-group-row" style={{ minHeight: 40, padding: '4px 8px' }}>
            <TaskCardContent task={task} appearance={appearance} labels={labels} />
          </div>
        ))}
        {tasks.length > 4 && (
          <div className="desktop-task-group-more-label">
            {tasks.length} tasks
          </div>
        )}
      </div>
    </div>
  );
};



function App() {
  const {
    appearance,
    appearancePreference,
    handleSignOut,
    language,
    loading,
    profileOpen,
    setAppearancePreference,
    setLanguage,
    setProfileOpen,
    t,
    user,
    userProfile,
  } = useDesktopSession();
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
  } = useDesktopWorkspaces();
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [pendingWorkspaceDeletion, setPendingWorkspaceDeletion] = useState(null);
  const [isWorkspaceNameEditing, setIsWorkspaceNameEditing] = useState(false);
  const [workspaceNameDraft, setWorkspaceNameDraft] = useState('');
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [, setIsGroupDragActive] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [desktopSelectionRect, setDesktopSelectionRect] = useState(null);
  const [isCanvasFileDragActive, setIsCanvasFileDragActive] = useState(false);
  const [desktopDragOverlapTargetId, setDesktopDragOverlapTargetId] = useState(null);
  const [desktopDragOverlayActive, setDesktopDragOverlayActive] = useState(false);
  const [desktopDragOverlaySnapshot, setDesktopDragOverlaySnapshot] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [pendingGroupPrompt, setPendingGroupPrompt] = useState(null);
  const [pendingGroupName, setPendingGroupName] = useState('');
  const [activeGroupView, setActiveGroupView] = useState(null);
  const [pendingCanvasDeletion, setPendingCanvasDeletion] = useState(null);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const workspaceNameInputRef = useRef(null);
  const workspaceControlRef = useRef(null);
  const [tasks, setTasks, commitTodos] = useSyncedTodos({
    userId: user?.id || null,
    normalizeTodo: normalizeTask,
  });
  // The feature flag stays off until the Inbox UI is ready. Once enabled, the
  // existing canvas and global search receive only organized Library items.
  const activeWorkspaceTasks = useMemo(
    () => tasks.filter((task) => taskBelongsToWorkspace(task, activeWorkspaceId)),
    [activeWorkspaceId, tasks],
  );
  const currentWorkspaceTasks = useMemo(
    () => (INBOX_FEATURE_ENABLED ? getLibraryItems(activeWorkspaceTasks) : activeWorkspaceTasks),
    [activeWorkspaceTasks],
  );
  const selectedDateRef = useRef(selectedDate);
  const tasksRef = useRef(currentWorkspaceTasks);
  const desktopDragViewportRef = useRef(null);
  const desktopDragStateRef = useRef({
    pointerId: null,
    taskId: null,
    startX: 0,
    startY: 0,
  });
  const activePointerTaskRef = useRef(null);
  const desktopDragPointerRef = useRef({ x: 0, y: 0 });
  const desktopDragLastMoveRef = useRef(null);
  const desktopDragContainerRectRef = useRef(null);
  const desktopDragModeRef = useRef(false);
  const desktopDragSelectedTaskIdsRef = useRef(new Set());
  const desktopDragSelectionPositionsRef = useRef(new Map());
  const desktopDragAnchorStartPositionRef = useRef(null);
  const desktopDragAnchorSizeRef = useRef({ width: DESKTOP_CANVAS_CARD_WIDTH, height: DESKTOP_CANVAS_CARD_HEIGHT });
  const desktopDragAnchorPointerOffsetRef = useRef(null);
  const desktopDragSourceRectRef = useRef(null);
  const desktopDragDetachedFromGroupRef = useRef(false);
  const desktopDragVisualRafRef = useRef(null);
  const desktopDragVisualPendingRef = useRef(null);
  const desktopDragIsGroupRef = useRef(false);
  const desktopDragOverlayNodeRef = useRef(null);
  const desktopDragOverlaySnapshotRef = useRef(null);
  const desktopDragSourceEntryIdRef = useRef(null);
  const desktopDragOverlapTimeoutRef = useRef(null);
  const desktopDragOverlapStateLastTsRef = useRef(0);
  const selectedTaskIdsRef = useRef(new Set());
  const previousUploadedFileKeysRef = useRef(new Set());
  const selectedDayEntriesRef = useRef([]);
  const desktopSelectionStateRef = useRef({ pointerId: null, origin: null });
  const desktopDragOverlapTargetIdRef = useRef(null);
  const desktopDragOverlapRafRef = useRef(null);
  const desktopDragOverlapPendingRef = useRef(null);
  const suppressTaskClickRef = useRef(null);
  const suppressAllTaskClicksUntilRef = useRef(0);
  const suppressTaskClickTimeoutRef = useRef(null);
  const searchDragSeparateRef = useRef(false);
  const {
    handleSearchTaskLongPress,
    historyOpen,
    setHistoryOpen,
  } = useDesktopSearch({ searchDragSeparateRef });

  const inboxItems = useMemo(() => getInboxItems(activeWorkspaceTasks), [activeWorkspaceTasks]);
  const inboxCount = getInboxCount(activeWorkspaceTasks);
  const inboxTargetPacks = useMemo(() => getInboxTargetPacks(activeWorkspaceTasks), [activeWorkspaceTasks]);
  const { inboxOpen, openInbox, closeInbox } = useInboxPanel();
  const inboxTriggerRef = useRef(null);
  const showInboxStatus = useCallback((message) => {
    setToastMessage(message);
    window.setTimeout(() => {
      setToastMessage((current) => (current === message ? null : current));
    }, 2200);
  }, [setToastMessage]);
  const commitInboxPlacement = useCallback(async ({ itemId, packId = null, position = null }) => {
    try {
      await commitTodos((currentTasks) => (
        packId
          ? moveInboxItemToPack(currentTasks, itemId, packId, createUpdatedTimestamp())
          : placeInboxItem(currentTasks, itemId, position, createUpdatedTimestamp())
      ));
      const targetPack = packId ? inboxTargetPacks.find((pack) => pack.id === packId) : null;
      showInboxStatus(packId ? `Moved to ${targetPack?.name || 'Pack'}` : 'Placed on canvas');
    } catch (error) {
      console.error('Failed to place Inbox item:', error);
      showInboxStatus('Move failed. Item remains in Inbox.');
      throw error;
    }
  }, [commitTodos, inboxTargetPacks, showInboxStatus]);
  const handleMoveInboxItemToPack = useCallback((itemId, packId) => (
    commitInboxPlacement({ itemId, packId })
  ), [commitInboxPlacement]);
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
    showInboxStatus('Workspace deleted. Restore it later from Settings.');
  }, [deleteWorkspace, pendingWorkspaceDeletion, setActiveGroupView, setPendingWorkspaceDeletion, setTasks, showInboxStatus, workspaces]);
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
    showInboxStatus(`${restoredWorkspace.name} restored.`);
    return true;
  }, [restoreWorkspace, setTasks, showInboxStatus]);
  const canvasFileDragDepthRef = useRef(0);
  const {
    viewport,
    viewportContainerRef,
    canvasBounds,
    canvasBoundsRef,
    clampCanvasPosition,
    getCanvasPointFromClient,
    getDragCanvasPointFromClient,
    getDesktopDragAnchorPosition,
    handleDesktopCanvasPointerDown,
    handleDesktopCanvasPointerMove,
    handleDesktopCanvasPointerEnd,
  } = useDesktopViewport({
    activeGroupView,
    desktopDragAnchorPointerOffsetRef,
    desktopDragAnchorSizeRef,
    desktopDragContainerRectRef,
    desktopSelectionStateRef,
    getCanvasDeletionSummary,
    selectedDayEntriesRef,
    selectedTaskIdsRef,
    setDesktopSelectionRect,
    setPendingCanvasDeletion,
    setSelectedTaskIds,
    t,
    tasksRef,
  });
  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);
  useEffect(() => {
    tasksRef.current = currentWorkspaceTasks;
  }, [currentWorkspaceTasks]);
  useEffect(() => {
    const nextKeys = new Set(
      tasks
        .map((task) => task.uploadedFileStorageKey)
        .filter((storageKey) => typeof storageKey === 'string' && storageKey.trim())
    );
    const previousKeys = previousUploadedFileKeysRef.current;
    previousKeys.forEach((storageKey) => {
      if (!nextKeys.has(storageKey)) {
        deleteUploadedFileBlob(storageKey).catch((error) => {
          console.error('Failed to delete uploaded file blob:', error);
        });
      }
    });
    previousUploadedFileKeysRef.current = nextKeys;
  }, [tasks]);
  useEffect(() => {
    const existingIds = new Set(currentWorkspaceTasks.map((task) => task.id));
    console.debug('[desktop-workspace] prune selected tasks effect', {
      taskCount: currentWorkspaceTasks.length,
      taskIds: currentWorkspaceTasks.map((task) => task.id),
    });
    setSelectedTaskIds((current) => {
      const next = current.filter((taskId) => existingIds.has(taskId));
      const changed = next.length !== current.length;
      console.debug('[desktop-workspace] prune selected tasks setState', {
        previous: current,
        next,
        changed,
      });
      return changed ? next : current;
    });
  }, [currentWorkspaceTasks]);
  useEffect(() => {
    if (!isWorkspaceNameEditing) return undefined;
    const frameId = window.requestAnimationFrame(() => {
      workspaceNameInputRef.current?.focus();
      workspaceNameInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [isWorkspaceNameEditing]);
  useEffect(() => {
    selectedTaskIdsRef.current = new Set(selectedTaskIds);
  }, [selectedTaskIds]);
  useEffect(() => () => {
    if (suppressTaskClickTimeoutRef.current !== null) {
      window.clearTimeout(suppressTaskClickTimeoutRef.current);
      suppressTaskClickTimeoutRef.current = null;
    }
  }, []);

  const {
    startDesktopTaskDrag,
    setDesktopDragSourceHidden,
    syncDesktopDraggedTaskPosition,
    handleTaskPointerDown,
    handleTaskPointerMove,
    handleTaskPointerUp,
    handleTaskPointerCancel,
  } = useDesktopTaskDrag({
    activePointerTaskRef,
    cleanupDesktopGroupMetadata,
    desktopDragAnchorPointerOffsetRef,
    desktopDragAnchorSizeRef,
    desktopDragAnchorStartPositionRef,
    desktopDragContainerRectRef,
    desktopDragDetachedFromGroupRef,
    desktopDragIsGroupRef,
    desktopDragLastMoveRef,
    desktopDragModeRef,
    desktopDragOverlapPendingRef,
    desktopDragOverlapRafRef,
    desktopDragOverlapStateLastTsRef,
    desktopDragOverlapTargetIdRef,
    desktopDragOverlapTimeoutRef,
    desktopDragOverlayNodeRef,
    desktopDragOverlaySnapshotRef,
    desktopDragPointerRef,
    desktopDragSelectedTaskIdsRef,
    desktopDragSelectionPositionsRef,
    desktopDragSourceEntryIdRef,
    desktopDragSourceRectRef,
    desktopDragStateRef,
    desktopDragVisualPendingRef,
    canvasBoundsRef,
    desktopDragVisualRafRef,
    desktopSelectionStateRef,
    getCanvasPointFromClient,
    getDesktopDragAnchorPosition,
    getDragCanvasPointFromClient,
    closeExternalDragSource: closeInbox,
    isExternalDragTask: isInboxItem,
    onExternalDrop: commitInboxPlacement,
    searchDragSeparateRef,
    selectedDateRef,
    selectedDayEntriesRef,
    selectedTaskIdsRef,
    setDesktopDragOverlapTargetId,
    setDesktopDragOverlayActive,
    setDesktopDragOverlaySnapshot,
    setDesktopSelectionRect,
    setDraggedTaskId,
    setHistoryOpen,
    setIsGroupDragActive,
    setPendingGroupName,
    setPendingGroupPrompt,
    setTasks,
    suppressAllTaskClicksUntilRef,
    suppressTaskClickRef,
    suppressTaskClickTimeoutRef,
    tasksRef,
    viewportContainerRef,
  });
  const selectedDateKey = dateKey(selectedDate);
  const selectedDayEntries = useMemo(
    () => constrainDesktopCanvasEntries(
      resolveDesktopCanvasEntries(currentWorkspaceTasks),
      canvasBounds,
    ),
    [canvasBounds, currentWorkspaceTasks],
  );
  const {
    connections,
    draftConnection,
    removeConnection,
    removeGroupConnections,
    rewirePackConnections,
    startConnectionDrag,
  } = useDesktopConnections({
    entries: selectedDayEntries,
    getCanvasPointFromClient,
    onStatus: showInboxStatus,
    tasks,
    userId: user?.id || null,
    workspaceId: activeWorkspaceId,
  });
  useEffect(() => {
    selectedDayEntriesRef.current = selectedDayEntries;
  }, [selectedDayEntries]);
  useEffect(() => {
    if (!draggedTaskId || !desktopDragModeRef.current) {
      if (desktopDragOverlayActive) {
        setDesktopDragOverlayActive(false);
      }
      setDesktopDragSourceHidden(false);
      return;
    }

    const shouldOverlay = (
      desktopDragOverlayActive
      || desktopDragDetachedFromGroupRef.current
    );
    if (!desktopDragOverlayActive && shouldOverlay) {
      setDesktopDragOverlayActive(true);
    }
    setDesktopDragSourceHidden(false);
  }, [desktopDragOverlayActive, draggedTaskId, setDesktopDragSourceHidden]);

  useLayoutEffect(() => {
    if (!desktopDragOverlayActive || !desktopDragOverlaySnapshot) return;
    syncDesktopDraggedTaskPosition(desktopDragPointerRef.current.x, desktopDragPointerRef.current.y);
  }, [desktopDragOverlayActive, desktopDragOverlaySnapshot, syncDesktopDraggedTaskPosition]);
  useEffect(() => {
    if (!draggedTaskId || !desktopDragModeRef.current) return undefined;

    const frameId = window.requestAnimationFrame(() => {
      syncDesktopDraggedTaskPosition(
        desktopDragPointerRef.current.x,
        desktopDragPointerRef.current.y,
      );
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [draggedTaskId, selectedDateKey, syncDesktopDraggedTaskPosition]);

  const {
    showToast,
    openUploadedFileTask,
    handleCanvasFileDragEnter,
    handleCanvasFileDragOver,
    handleCanvasFileDragLeave,
    handleCanvasFileDrop,
    applyAsyncMetadata,
  } = useDesktopCapture({
    activeWorkspaceId,
    canvasFileDragDepthRef,
    draggedTaskId,
    getCanvasPointFromClient,
    clampCanvasPosition,
    inboxEnabled: INBOX_FEATURE_ENABLED,
    isCanvasFileDragActive,
    selectedDateKey,
    selectedDateRef,
    setFullscreenImage,
    setIsCanvasFileDragActive,
    setTasks,
    setToastMessage,
  });

  const handleCreateInboxItem = useCallback(async (value) => {
    const rawText = String(value || '').trim();
    if (!rawText) return null;

    const typeFields = getDerivedTaskFields(rawText);
    const operationUpdatedAt = createUpdatedTimestamp();
    let createdTask = null;

    try {
      await commitTodos((currentTasks) => {
        let taskId = Date.now();
        const existingIds = new Set(currentTasks.map((task) => task.id));
        while (existingIds.has(taskId)) taskId += 1;

        createdTask = normalizeTask(createInboxTask({
          id: taskId,
          text: rawText,
          completed: false,
          desktopWorkspaceId: activeWorkspaceId,
          timeOfDay: 'Morning',
          dateString: selectedDateKey,
          updatedAt: operationUpdatedAt,
          ...typeFields,
          desktopZ: Date.now(),
        }));

        return [...currentTasks, createdTask];
      });

      showInboxStatus('Added to Inbox');
      if (createdTask) {
        applyAsyncMetadata(
          createdTask.id,
          typeFields.cardType,
          typeFields.videoUrl,
          typeFields.mapUrl,
          typeFields.primaryUrl,
          operationUpdatedAt,
        );
      }
      return createdTask;
    } catch (error) {
      console.error('Failed to add Inbox item:', error);
      showInboxStatus('Unable to add item. Please try again.');
      throw error;
    }
  }, [
    activeWorkspaceId,
    applyAsyncMetadata,
    commitTodos,
    selectedDateKey,
    showInboxStatus,
  ]);

  const {
    deleteTasksByIds,
    confirmCanvasDeletion,
    cancelCanvasDeletion,
    handleTaskClick,
    handleStartWorkspaceRename,
    handleCommitWorkspaceRename,
    handleCancelWorkspaceRename,
    updateCanvasSelection,
  } = useDesktopTaskActions({
    activeWorkspace,
    areTaskIdSelectionsEqual,
    cleanupDesktopGroupMetadata,
    defaultWorkspaceId: activeWorkspaceId,
    openUploadedFileTask,
    onGroupsDeleted: removeGroupConnections,
    pendingCanvasDeletion,
    selectedTaskIdsRef,
    setActiveWorkspace,
    setFullscreenImage,
    setIsWorkspaceNameEditing,
    setPendingCanvasDeletion,
    setSelectedTaskIds,
    setTasks,
    setWorkspaceNameDraft,
    suppressAllTaskClicksUntilRef,
    suppressTaskClickRef,
    tasksRef,
    t,
    user,
    workspaceNameDraft,
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
    updateCanvasSelection,
    handleTaskClick,
    onPacksMerged: rewirePackConnections,
  });


  if (loading) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: appearance === 'dark' ? '#121212' : '#ffffff' }}>
        <div style={{ width: 42, height: 42, borderRadius: '50%', border: `4px solid ${appearance === 'dark' ? '#333333' : '#e8e0d6'}`, borderTop: '4px solid #ED1F1F', animation: 'desktop-spin 1s linear infinite' }} />
        <style>{`@keyframes desktop-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
  if (!user) return <DesktopLogin />;
  return (
    <>
      <GlobalStyles appearance={appearance} />
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
      <div className={`desktop-app ${appearance === 'dark' ? 'desktop-app-dark' : 'desktop-app-light'}`} style={{ width: '100%', height: '100%', overflow: 'hidden', background: 'var(--desktop-root-bg)', color: 'var(--desktop-root-text)', fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column' }}>
        <header className="desktop-minimal-header">
          <div className="desktop-minimal-brand">
            <div ref={workspaceControlRef} className="desktop-workspace-control">
              <div className={`desktop-workspace-shell ${isWorkspaceNameEditing ? 'is-editing' : ''} ${workspaceMenuOpen ? 'is-open' : ''}`}>
              {isWorkspaceNameEditing ? (
                <input
                  ref={workspaceNameInputRef}
                  type="text"
                  value={workspaceNameDraft}
                  onChange={(event) => setWorkspaceNameDraft(event.target.value)}
                  onBlur={handleCommitWorkspaceRename}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleCommitWorkspaceRename();
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      handleCancelWorkspaceRename();
                    }
                  }}
                  className="desktop-workspace-name-input"
                  aria-label="Workspace name"
                />
              ) : (
                <button
                  type="button"
                  className="desktop-workspace-name-button"
                  aria-haspopup="menu"
                  aria-expanded={workspaceMenuOpen}
                  onClick={() => setWorkspaceMenuOpen((current) => !current)}
                  onDoubleClick={(event) => {
                    event.preventDefault();
                    setWorkspaceMenuOpen(false);
                    handleStartWorkspaceRename();
                  }}
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
                onAddWorkspace={addWorkspace}
                onClose={() => setWorkspaceMenuOpen(false)}
                onRequestDeleteWorkspace={setPendingWorkspaceDeletion}
                onSelectWorkspace={selectWorkspace}
                open={workspaceMenuOpen}
                workspaces={workspaces}
              />
            </div>
          </div>
          <div className="desktop-topbar-actions">
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="desktop-header-icon-button"
            >
              <svg width="19" height="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16.625 16.625L13.1812 13.1812M15.0417 8.70833C15.0417 12.2061 12.2061 15.0417 8.70833 15.0417C5.21053 15.0417 2.375 12.2061 2.375 8.70833C2.375 5.21053 5.21053 2.375 8.70833 2.375C12.2061 2.375 15.0417 5.21053 15.0417 8.70833Z" stroke={appearance === 'dark' ? '#E1E1E1' : '#1E1E1E'} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {INBOX_FEATURE_ENABLED && (
              <button
                ref={inboxTriggerRef}
                type="button"
                onClick={openInbox}
                className="desktop-inbox-trigger"
                aria-label={`Inbox (${inboxCount})`}
                title="Inbox"
              >
                <span className="desktop-inbox-trigger-icon" aria-hidden="true">
                  <svg width="19" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                  </svg>
                </span>
                <span className="desktop-inbox-trigger-label">Inbox</span>
                <span className="desktop-inbox-trigger-count" aria-hidden="true">{inboxCount}</span>
              </button>
            )}
            <button type="button" className="desktop-profile-trigger desktop-header-avatar-button" onClick={() => setProfileOpen(true)}>
              {userProfile.avatarUrl ? (
                <img src={userProfile.avatarUrl} alt={userProfile.fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontFamily: 'DM Serif Display, serif', fontSize: 18, color: 'var(--desktop-root-text)' }}>{userProfile.initial}</span>
              )}
            </button>
          </div>
        </header>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <div
            ref={desktopDragViewportRef}
            className="desktop-main-stage"
            style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative', overflow: 'hidden' }}
          >
            <div className="desktop-main-stage-inner" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--desktop-main-gradient)' }}>

              <main
                ref={viewportContainerRef}
                className={`desktop-canvas-scroll ${isCanvasFileDragActive ? 'is-file-drag-active' : ''}`}
                onPointerDownCapture={handleDesktopCanvasPointerDown}
                onPointerMove={(event) => {
                  handleDesktopCanvasPointerMove(event);
                }}
                onPointerUp={(event) => {
                  handleDesktopCanvasPointerEnd(event);
                }}
                onPointerCancel={handleDesktopCanvasPointerEnd}
                onDragEnter={handleCanvasFileDragEnter}
                onDragOver={handleCanvasFileDragOver}
                onDragLeave={handleCanvasFileDragLeave}
                onDrop={handleCanvasFileDrop}
                style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative', background: 'var(--desktop-root-bg)' }}
              >
                <div
                  className="desktop-canvas-content"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: canvasBounds.width,
                    transformOrigin: '0 0',
                    transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
                    paddingTop: DESKTOP_CANVAS_TOP_PADDING,
                  }}
                >
                    <DesktopCanvas
                      entries={selectedDayEntries}
                      canvasHeight={canvasBounds.height}
                      appearance={appearance}
                      labels={t}
                      onTaskClick={handleTaskClick}
                      onGroupOpenFullView={handleGroupCardOpen}
                      onTaskPointerDown={handleTaskPointerDown}
                      onTaskPointerMove={handleTaskPointerMove}
                      onTaskPointerUp={handleTaskPointerUp}
                      onTaskPointerCancel={handleTaskPointerCancel}
                      draggedTaskId={draggedTaskId}
                      selectedTaskIds={selectedTaskIds}
                      selectionRect={desktopSelectionRect}
                      dragOverlapTargetId={desktopDragOverlapTargetId}
                      TaskCardComponent={TaskCard}
                      GroupedTaskCardComponent={GroupedTaskCard}
                      layoutWidth={canvasBounds.width}
                      connections={connections}
                      draftConnection={draftConnection}
                      getCanvasPointFromClient={getCanvasPointFromClient}
                      onStartConnectionDrag={startConnectionDrag}
                      onRemoveConnection={removeConnection}
                    />
                  {desktopDragOverlayActive && desktopDragOverlaySnapshot ? (
                    <div
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        pointerEvents: 'none',
                        zIndex: 9999,
                      }}
                    >
                      <div
                        ref={desktopDragOverlayNodeRef}
                        className="desktop-canvas-card-node"
                        style={{
                          left: desktopDragOverlaySnapshot.baseX,
                          top: desktopDragOverlaySnapshot.baseY,
                          width: DESKTOP_CANVAS_CARD_WIDTH,
                        }}
                      >
                        <div className="desktop-canvas-card-shell is-dragging">
                          {desktopDragOverlaySnapshot.type === 'group' && Array.isArray(desktopDragOverlaySnapshot.tasks) ? (
                            <GroupedTaskCard
                              tasks={desktopDragOverlaySnapshot.tasks}
                              appearance={appearance}
                              labels={t}
                              isDragging={true}
                              isGroupDragActive={true}
                              isSelected={false}
                              isGroupReady={false}
                              draggedTaskId={desktopDragOverlaySnapshot.taskId}
                              onOpenItem={null}
                              onOpenFullView={null}
                              onPointerDown={null}
                              onPointerMove={null}
                              onPointerUp={null}
                              onPointerCancel={null}
                            />
                          ) : desktopDragOverlaySnapshot.type === 'task' && desktopDragOverlaySnapshot.task ? (
                            <TaskCard
                              task={desktopDragOverlaySnapshot.task}
                              appearance={appearance}
                              labels={t}
                              isDragging={true}
                              isSelected={false}
                              isGroupReady={false}
                              draggedTaskId={desktopDragOverlaySnapshot.taskId}
                              onClick={null}
                              onPointerDown={null}
                              onPointerMove={null}
                              onPointerUp={null}
                              onPointerCancel={null}
                            />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {isCanvasFileDragActive ? (
                    <div className="desktop-canvas-file-drop-indicator">
                      <span>{draggedTaskId ? 'Drop to place task' : 'Drop file to create card'}</span>
                    </div>
                  ) : null}
                </div>
              </main>
            </div>
          </div>
        </div>

        {profileOpen ? (
          <React.Suspense fallback={null}>
            <LazyDesktopProfilePage
              open
              onClose={() => setProfileOpen(false)}
              user={user}
              language={language}
              setLanguage={setLanguage}
              appearance={appearance}
              appearancePreference={appearancePreference}
              setAppearance={setAppearancePreference}
              deletedWorkspaces={deletedWorkspaces}
              canRestoreWorkspace={canAddWorkspace}
              onRestoreWorkspace={handleRestoreWorkspace}
              onSignOut={handleSignOut}
            />
          </React.Suspense>
        ) : null}
        {historyOpen ? (
          <React.Suspense fallback={null}>
            <LazyDesktopSearchModal
              open
              tasks={currentWorkspaceTasks}
              appearance={appearance}
              language={language}
              t={t}
              onClose={() => setHistoryOpen(false)}
              onTaskClick={(task) => {
                if (!task.id) return;
                const { redirectUrl } = getTaskCardPresentation(task, t);
                if (task.uploadedFileStorageKey) {
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
              }}
              onPackClick={handleHistoryPackOpen}
              onPackItemClick={handleHistoryPackItemOpen}
              onTaskPointerDown={handleTaskPointerDown}
              onTaskLongPress={(task) => handleSearchTaskLongPress(task, startDesktopTaskDrag)}
            />
          </React.Suspense>
        ) : null}
        <InboxPanel
          open={INBOX_FEATURE_ENABLED && inboxOpen}
          items={inboxItems}
          packOptions={inboxTargetPacks}
          appearance={appearance}
          t={t}
          onClose={closeInbox}
          onCreateItem={handleCreateInboxItem}
          onMoveToPack={handleMoveInboxItemToPack}
          onTaskPointerDown={handleTaskPointerDown}
          onTaskPointerMove={handleTaskPointerMove}
          onTaskPointerUp={handleTaskPointerUp}
          onTaskPointerCancel={handleTaskPointerCancel}
          anchorRef={inboxTriggerRef}
        />

        <PackPrompt
          prompt={pendingGroupPrompt}
          groupName={pendingGroupName}
          setGroupName={setPendingGroupName}
          onConfirm={handleConfirmGroupPrompt}
          onCancel={handleCancelGroupPrompt}
        />
        {activeGroupView ? (
          <React.Suspense fallback={null}>
            <LazyPackFullView
              view={activeGroupView}
              appearance={appearance}
              labels={t}
              language={language}
              onClose={closeActiveGroupView}
              onDeleteTasks={deleteTasksByIds}
              onUpdateGroup={updateActiveGroupMetadata}
              onToast={showToast}
              onTaskOpen={(task) => {
                closeActiveGroupView();
                handleTaskClick(task);
              }}
            />
          </React.Suspense>
        ) : null}
        <DesktopDeleteConfirmModal
          open={Boolean(pendingWorkspaceDeletion)}
          title={`Delete “${pendingWorkspaceDeletion?.name || 'Workspace'}”?`}
          description="All items in this workspace will be removed. You can restore the workspace later from Settings."
          onCancel={() => setPendingWorkspaceDeletion(null)}
          onConfirm={confirmWorkspaceDeletion}
        />
        <DesktopDeleteConfirmModal
          open={Boolean(pendingCanvasDeletion)}
          title={pendingCanvasDeletion?.title || t.deleteObjectQuestion}
          onCancel={cancelCanvasDeletion}
          onConfirm={confirmCanvasDeletion}
        />
        {toastMessage && (
          <div style={{
            position: 'fixed',
            bottom: 32,
            left: '50%',
            transform: 'translateX(-50%)',
            background: appearance === 'dark' ? '#333' : '#333',
            color: '#FFF',
            padding: '10px 20px',
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 500,
            zIndex: 99999,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            animation: 'fadeInOut 3s forwards'
          }}>
            {toastMessage}
          </div>
        )}

        {fullscreenImage && (
          <div 
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
              cursor: 'zoom-out'
            }}
            onClick={() => setFullscreenImage(null)}
          >
            <button
              onClick={(e) => { e.stopPropagation(); setFullscreenImage(null); }}
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
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'; }}
            >
              <X size={24} />
            </button>
            <img
              src={fullscreenImage}
              alt="Fullscreen"
              style={{
                maxWidth: '90%',
                maxHeight: '90%',
                objectFit: 'contain',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                userSelect: 'none',
                WebkitUserDrag: 'none'
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>
      </div>
      </div>
    </>
  );
}

export default App;
