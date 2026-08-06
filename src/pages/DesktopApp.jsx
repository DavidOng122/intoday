/* eslint-disable react-hooks/set-state-in-effect */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import DesktopLogin from '../DesktopLogin';
import { useSyncedTodos } from '../todoSync';
import { DesktopProfilePage, useDesktopSession } from '../features/session';
import { DesktopSearchModal, useDesktopSearch } from '../features/search';
import IntoDayLogo from '../components/IntoDayLogo';
import DesktopDeleteConfirmModal from '../components/desktop/DesktopDeleteConfirmModal';
import { DesktopCanvas } from '../features/canvas';
import { AddPanel, useDesktopCapture } from '../features/capture';
import { GroupedTaskCard, TaskCard } from '../features/canvas';
import {
  PackFullView,
  PackPrompt,
  cleanupDesktopGroupMetadata,
  usePackActions,
} from '../features/pack';
import {
  CloseIcon,
  PlusIcon,
  ZoomChevronIcon,
} from '../components/icons/DesktopIcons';
import { getLogicalToday } from '../lib/dateHelpers';
import { getPackMetadataTextFromItems } from '../features/pack';
import { deleteUploadedFileBlob } from '../lib/uploadedFileStorage';
import {
  getPackIconFromTasks,
  getPackTagsFromTasks,
  PACK_ICON_SUGGESTIONS,
} from '../features/pack';
import {
  CARD_TYPES,
  getTaskCardPresentation,
  normalizeCardType,
} from '../taskCardUtils';

import { useDesktopViewport } from '../features/canvas';
import { useDesktopTaskDrag } from '../features/canvas';
import { useDesktopTaskActions } from '../hooks/useDesktopTaskActions';
import { normalizeTask } from '../lib/taskNormalize';
import {
  DESKTOP_APP_WINDOW_SCALE,
  DESKTOP_BASE_SLOT_COUNT,
  DESKTOP_CANVAS_CARD_GAP,
  DESKTOP_CANVAS_CARD_HEIGHT,
  DESKTOP_CANVAS_CARD_WIDTH,
  DESKTOP_CANVAS_DEFAULT_ZOOM,
  DESKTOP_CANVAS_MIN_HEIGHT,
  DESKTOP_MAIN_CONTENT_HORIZONTAL_PADDING,
  DESKTOP_MAIN_CONTENT_MAX_WIDTH,
  DESKTOP_PHOTO_CARD_HEIGHT,
} from '../features/canvas';
import { UPLOADED_FILE_SOURCE_LABEL } from '../features/capture/config/uploadConstants';
import { getLibraryItems } from '../lib/inboxLogic';
import { getDesktopCanvasHeight, resolveDesktopCanvasEntries } from '../features/canvas';

const DESKTOP_WORKSPACES_KEY = 'desktop_workspace_items';
const DESKTOP_ACTIVE_WORKSPACE_KEY = 'desktop_active_workspace';
const DEFAULT_DESKTOP_WORKSPACE_ID = 'workspace-untitled';
const LEGACY_SAMPLE_WORKSPACE_IDS = new Set(['workspace-personal-projects', 'workspace-work-setup']);
const DEFAULT_DESKTOP_WORKSPACES = [
  {
    id: DEFAULT_DESKTOP_WORKSPACE_ID,
    name: 'Untitled',
    iconType: 'dot',
  },
];
const INBOX_FEATURE_ENABLED = import.meta.env.VITE_INBOX_ENABLED === 'true';
// Root-level app window scale (OS density scaling) — unrelated to canvas zoom.
// The entire desktop app wrapper is scaled down to 0.8 so the UI fits a typical
// consumer monitor pixel density. Drag overlay positions must compensate for this.
const isValidDesktopSlot = (value) => Number.isInteger(value) && value >= 0;
const getDesktopSlotCapacity = (tasks) => {
  const preferredSlotCount = tasks.reduce((max, task) => (
    isValidDesktopSlot(task.desktopSlot) ? Math.max(max, task.desktopSlot + 1) : max
  ), 0);
  const itemCount = Math.max(tasks.length, preferredSlotCount);
  return Math.max(
    DESKTOP_BASE_SLOT_COUNT,
    itemCount <= DESKTOP_BASE_SLOT_COUNT ? DESKTOP_BASE_SLOT_COUNT : Math.ceil(itemCount / 2) * 2,
  );
};
const resolveDesktopSectionSlots = (tasks) => {
  const slots = Array.from({ length: getDesktopSlotCapacity(tasks) }, () => null);
  const orderedTasks = tasks
    .map((task, index) => ({
      task,
      index,
      preferredSlot: isValidDesktopSlot(task.desktopSlot) ? task.desktopSlot : null,
    }))
    .sort((a, b) => {
      const aHasSlot = a.preferredSlot !== null;
      const bHasSlot = b.preferredSlot !== null;
      if (aHasSlot && bHasSlot) {
        return a.preferredSlot - b.preferredSlot || a.index - b.index;
      }
      if (aHasSlot) return -1;
      if (bHasSlot) return 1;
      return a.index - b.index;
    });

  orderedTasks.forEach(({ task, preferredSlot }) => {
    let slot = preferredSlot;
    if (slot === null || slots[slot]) {
      slot = slots.findIndex((entry) => entry === null);
    }
    slots[slot] = normalizeTask({ ...task, desktopSlot: slot });
  });

  return { slots };
};
const getFirstAvailableDesktopSlot = (tasks, dateString, timeOfDay) => {
  const { slots } = resolveDesktopSectionSlots(
    tasks.filter((task) => task.dateString === dateString && task.timeOfDay === timeOfDay),
  );
  const index = slots.findIndex((task) => task === null);
  return index === -1 ? null : index;
};
const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const getDefaultDesktopWorkspaces = () => DEFAULT_DESKTOP_WORKSPACES.map((workspace) => ({ ...workspace }));
const getUntitledWorkspaceName = (index) => (index <= 1 ? 'Untitled' : `Untitled ${index}`);
const normalizeDesktopWorkspaces = (value) => {
  if (!Array.isArray(value) || !value.length) return getDefaultDesktopWorkspaces();
  const normalized = value
    .filter((workspace) => workspace && !LEGACY_SAMPLE_WORKSPACE_IDS.has(workspace.id))
    .filter((workspace) => workspace && typeof workspace.id === 'string' && typeof workspace.name === 'string')
    .map((workspace, index) => ({
      id: workspace.id,
      name: workspace.name.trim() || getUntitledWorkspaceName(index + 1),
      iconType: workspace.iconType === 'letter' ? 'letter' : 'dot',
      iconLetter: typeof workspace.iconLetter === 'string' ? workspace.iconLetter.slice(0, 1).toUpperCase() : null,
      iconBackground: typeof workspace.iconBackground === 'string' ? workspace.iconBackground : null,
      iconColor: typeof workspace.iconColor === 'string' ? workspace.iconColor : null,
    }));
  return normalized.length ? normalized : getDefaultDesktopWorkspaces();
};
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
const currentSection = (date = new Date()) => {
  const hour = date.getHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
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

const DesktopZoomControl = ({
  zoomScale,
  isZoomMenuOpen,
  onToggleZoomMenu,
  onZoomPresetSelect,
}) => (
  <div className="desktop-zoom-menu-anchor">
    <button
      type="button"
      className={`desktop-zoom-trigger ${isZoomMenuOpen ? 'is-open' : ''}`}
      onClick={onToggleZoomMenu}
      aria-haspopup="menu"
      aria-expanded={isZoomMenuOpen}
    >
      <span>{Math.round(zoomScale * 100)}%</span>
      <ZoomChevronIcon open={isZoomMenuOpen} color={isZoomMenuOpen ? '#0B72E7' : '#171717'} />
    </button>
    {isZoomMenuOpen ? (
      <div className="desktop-zoom-menu" role="menu" aria-label="Zoom menu">
        <div className="desktop-zoom-menu-input">{Math.round(zoomScale * 100)}%</div>
        <div className="desktop-zoom-menu-list">
          <button type="button" className="desktop-zoom-menu-item" onClick={() => onZoomPresetSelect('in')}>
            <span>Zoom in</span>
            <span>+</span>
          </button>
          <button type="button" className="desktop-zoom-menu-item" onClick={() => onZoomPresetSelect('out')}>
            <span>Zoom out</span>
            <span>-</span>
          </button>
          <button type="button" className="desktop-zoom-menu-item" onClick={() => onZoomPresetSelect('fit')}>
            <span>Zoom to fit</span>
            <span>Shift+1</span>
          </button>
          <button type="button" className="desktop-zoom-menu-item" onClick={() => onZoomPresetSelect(0.5)}>
            <span>Zoom to 50%</span>
          </button>
          <button type="button" className="desktop-zoom-menu-item" onClick={() => onZoomPresetSelect(1)}>
            <span>Zoom to 100%</span>
            <span>0</span>
          </button>
          <button type="button" className="desktop-zoom-menu-item" onClick={() => onZoomPresetSelect(1.6)}>
            <span>Zoom to 160%</span>
          </button>
        </div>
      </div>
    ) : null}
  </div>
);

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
  const [activeWorkspace, setActiveWorkspace] = useState(() => {
    try {
      return normalizeDesktopWorkspaces(JSON.parse(localStorage.getItem(DESKTOP_WORKSPACES_KEY) || 'null'))[0];
    } catch {
      return getDefaultDesktopWorkspaces()[0];
    }
  });
  const activeWorkspaceId = DEFAULT_DESKTOP_WORKSPACE_ID;
  const [isWorkspaceNameEditing, setIsWorkspaceNameEditing] = useState(false);
  const [workspaceNameDraft, setWorkspaceNameDraft] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [panelOpen, setPanelOpen] = useState(false);
  const [showAddPreview, setShowAddPreview] = useState(false);
  const hoverAddTimeoutRef = useRef(null);
  const [inputText, setInputText] = useState('');
  const [addPanelAttachments, setAddPanelAttachments] = useState([]);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editCopied, setEditCopied] = useState(false);
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
  const [tasks, setTasks] = useSyncedTodos({
    userId: user?.id || null,
    normalizeTodo: normalizeTask,
  });
  // The feature flag stays off until the Inbox UI is ready. Once enabled, the
  // existing canvas and global search receive only organized Library items.
  const currentWorkspaceTasks = useMemo(
    () => (INBOX_FEATURE_ENABLED ? getLibraryItems(tasks) : tasks),
    [tasks],
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
  const desktopCanvasContentRef = useRef(null);
  const searchDragSeparateRef = useRef(false);
  const {
    handleSearchTaskLongPress,
    historyOpen,
    setHistoryOpen,
  } = useDesktopSearch({ searchDragSeparateRef });
  const editCopyResetTimerRef = useRef(null);
  const canvasFileDragDepthRef = useRef(0);
  const {
    viewport,
    viewportContainerRef,
    desktopCanvasPanReady,
    desktopCanvasPanActive,
    getCanvasPointFromClient,
    getDragCanvasPointFromClient,
    getDesktopDragAnchorPosition,
    handleDesktopCanvasWheel,
    handleDesktopCanvasPointerDown,
    handleDesktopCanvasPointerMove,
    handleDesktopCanvasPointerEnd,
  } = useDesktopViewport({
    desktopDragAnchorPointerOffsetRef,
    desktopDragAnchorSizeRef,
    desktopDragContainerRectRef,
    desktopDragModeRef,
    desktopSelectionStateRef,
    editingTaskId,
    getCanvasDeletionSummary,
    panelOpen,
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
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => () => {
    if (suppressTaskClickTimeoutRef.current !== null) {
      window.clearTimeout(suppressTaskClickTimeoutRef.current);
      suppressTaskClickTimeoutRef.current = null;
    }
    if (editCopyResetTimerRef.current !== null) {
      window.clearTimeout(editCopyResetTimerRef.current);
      editCopyResetTimerRef.current = null;
    }
  }, []);
  useEffect(() => {
    localStorage.setItem(DESKTOP_WORKSPACES_KEY, JSON.stringify([{ ...activeWorkspace, id: DEFAULT_DESKTOP_WORKSPACE_ID }]));
  }, [activeWorkspace]);
  useEffect(() => {
    localStorage.setItem(DESKTOP_ACTIVE_WORKSPACE_KEY, DEFAULT_DESKTOP_WORKSPACE_ID);
  }, []);

  const todaySelected = true;
  const currentBlock = currentSection(currentTime);

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
    desktopDragVisualRafRef,
    desktopSelectionStateRef,
    getCanvasPointFromClient,
    getDesktopDragAnchorPosition,
    getDragCanvasPointFromClient,
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
    () => resolveDesktopCanvasEntries(currentWorkspaceTasks),
    [currentWorkspaceTasks],
  );
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
  const selectedDayCanvasHeight = useMemo(
    () => getDesktopCanvasHeight(selectedDayEntries),
    [selectedDayEntries],
  );
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
    closePanel,
    showToast,
    openUploadedFileTask,
    handleCanvasFileDragEnter,
    handleCanvasFileDragOver,
    handleCanvasFileDragLeave,
    handleCanvasFileDrop,
    applyAsyncMetadata,
    handleAddPanelFilesSelected,
    handleRemoveAddPanelAttachment,
    saveTask,
  } = useDesktopCapture({
    activeWorkspaceId,
    addPanelAttachments,
    canvasFileDragDepthRef,
    currentBlock,
    draggedTaskId,
    getCanvasPointFromClient,
    getFirstAvailableDesktopSlot,
    inboxEnabled: INBOX_FEATURE_ENABLED,
    inputText,
    isCanvasFileDragActive,
    selectedDateKey,
    selectedDateRef,
    setAddPanelAttachments,
    setFullscreenImage,
    setInputText,
    setIsCanvasFileDragActive,
    setPanelOpen,
    setTasks,
    setToastMessage,
    todaySelected,
    user,
  });

  const {
    editingTask,
    canSaveEdit,
    deleteTasksByIds,
    handleTaskDelete,
    handleTaskEdit,
    confirmCanvasDeletion,
    cancelCanvasDeletion,
    closeEditModal,
    handleEditCopy,
    openTaskEditor,
    handleEditSave,
    handleTaskClick,
    handleStartWorkspaceRename,
    handleCommitWorkspaceRename,
    handleCancelWorkspaceRename,
    updateCanvasSelection,
  } = useDesktopTaskActions({
    activeWorkspace,
    applyAsyncMetadata,
    areTaskIdSelectionsEqual,
    cleanupDesktopGroupMetadata,
    defaultWorkspaceId: DEFAULT_DESKTOP_WORKSPACE_ID,
    editCopyResetTimerRef,
    editingTaskId,
    editText,
    openUploadedFileTask,
    pendingCanvasDeletion,
    selectedTaskIdsRef,
    setActiveWorkspace,
    setEditCopied,
    setEditingTaskId,
    setEditText,
    setFullscreenImage,
    setIsWorkspaceNameEditing,
    setPanelOpen,
    setPendingCanvasDeletion,
    setProfileOpen,
    setSelectedTaskIds,
    setTasks,
    setWorkspaceNameDraft,
    suppressAllTaskClicksUntilRef,
    suppressTaskClickRef,
    t,
    tasks,
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
      <div className={`desktop-app ${appearance === 'dark' ? 'desktop-app-dark dark-theme' : 'desktop-app-light'}`} style={{ width: '100%', height: '100%', overflow: 'hidden', background: 'var(--desktop-root-bg)', color: 'var(--desktop-root-text)', fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column' }}>
        <header className="desktop-minimal-header">
          <div className="desktop-minimal-brand">
            <div className={`desktop-workspace-shell ${isWorkspaceNameEditing ? 'is-editing' : ''}`}>
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
                  onClick={handleStartWorkspaceRename}
                >
                  <span className="desktop-workspace-trigger-label">{activeWorkspace?.name || t.untitledWorkspace}</span>
                </button>
              )}
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
                className={`desktop-canvas-scroll ${desktopCanvasPanReady ? 'is-pan-ready' : ''} ${desktopCanvasPanActive ? 'is-panning' : ''} ${isCanvasFileDragActive ? 'is-file-drag-active' : ''}`}
                onWheel={handleDesktopCanvasWheel}
                onPointerDownCapture={handleDesktopCanvasPointerDown}
                onPointerMove={handleDesktopCanvasPointerMove}
                onPointerUp={handleDesktopCanvasPointerEnd}
                onPointerCancel={handleDesktopCanvasPointerEnd}
                onDragEnter={handleCanvasFileDragEnter}
                onDragOver={handleCanvasFileDragOver}
                onDragLeave={handleCanvasFileDragLeave}
                onDrop={handleCanvasFileDrop}
                style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative', background: 'var(--desktop-root-bg)' }}
              >
                <div
                  ref={desktopCanvasContentRef}
                  className="desktop-canvas-content"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: DESKTOP_MAIN_CONTENT_MAX_WIDTH,
                    transformOrigin: '0 0',
                    transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
                    paddingTop: 180,
                  }}
                >
                    <DesktopCanvas
                      entries={selectedDayEntries}
                      canvasHeight={selectedDayCanvasHeight}
                      appearance={appearance}
                      labels={t}
                      onTaskClick={handleTaskClick}
                      onGroupOpenFullView={handleGroupCardOpen}
                      onTaskEdit={handleTaskEdit}
                      onTaskDelete={handleTaskDelete}
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
                    layoutWidth={DESKTOP_MAIN_CONTENT_MAX_WIDTH}
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
                              onEdit={null}
                              onDelete={null}
                              onPointerDown={null}
                              onPointerMove={null}
                              onPointerUp={null}
                              onPointerCancel={null}
                              editLabel={t.edit}
                              deleteLabel={t.delete}
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


        {panelOpen ? <div style={{ position: 'fixed', inset: 0, zIndex: 25 }} onClick={closePanel} /> : null}
        <AddPanel
          open={panelOpen}
          language={language}
          inputText={inputText}
          setInputText={setInputText}
          fileAttachments={addPanelAttachments}
          onAddFiles={handleAddPanelFilesSelected}
          onRemoveFile={handleRemoveAddPanelAttachment}
          onShowToast={showToast}
          onClose={closePanel}
          onSubmit={saveTask}
        />

        {(!panelOpen && showAddPreview) ? (
          <div style={{ position: 'fixed', right: 104, bottom: 38, background: 'var(--desktop-floating-bg)', color: 'var(--desktop-floating-text)', padding: '6px 14px', borderRadius: 16, border: '1px solid var(--desktop-floating-border)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', zIndex: 19, fontSize: 13, fontWeight: 500, pointerEvents: 'none', animation: 'fadeIn 0.2s ease-out' }}>
            Add task...
          </div>
        ) : null}

        {!panelOpen ? (
          <button 
            type="button" 
            onClick={() => { 
              setProfileOpen(false); 
              closeEditModal(); 
              setInputText(''); 
              setPanelOpen(true); 
              setShowAddPreview(false);
              if (hoverAddTimeoutRef.current) clearTimeout(hoverAddTimeoutRef.current);
            }} 
            onMouseEnter={() => {
              hoverAddTimeoutRef.current = setTimeout(() => setShowAddPreview(true), 500);
            }}
            onMouseLeave={() => {
              if (hoverAddTimeoutRef.current) clearTimeout(hoverAddTimeoutRef.current);
              setShowAddPreview(false);
            }}
            aria-label={t.addTaskAria} 
            style={{ position: 'fixed', right: 42, bottom: 30, width: 50, height: 50, borderRadius: '50%', border: '1px solid var(--desktop-floating-border)', background: 'var(--desktop-floating-bg)', color: 'var(--desktop-floating-text)', boxShadow: 'var(--desktop-floating-shadow)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 20 }}
          >
            <PlusIcon />
          </button>
        ) : null}

        {editingTask ? (
          <div
            role="presentation"
            onClick={closeEditModal}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 40,
              background: 'var(--desktop-modal-backdrop)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 28,
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="desktop-edit-modal-title"
              onClick={(event) => event.stopPropagation()}
              style={{
                width: 'min(100%, 560px)',
                maxHeight: 'min(640px, calc(100vh - 56px))',
                background: 'var(--desktop-edit-bg)',
                border: '1px solid var(--desktop-edit-border)',
                borderRadius: 24,
                boxShadow: 'var(--desktop-edit-shadow)',
                display: 'grid',
                gridTemplateRows: 'auto minmax(0, 1fr) auto',
                overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '22px 24px 16px', borderBottom: '1px solid var(--desktop-edit-border)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <IntoDayLogo
                    showWordmark={false}
                    className="desktop-edit-modal-logo"
                    iconClassName="desktop-edit-modal-logo-icon"
                  />
                  <h2 id="desktop-edit-modal-title" style={{ margin: 0, fontFamily: 'DM Serif Display, serif', fontSize: 28, fontStyle: 'italic', lineHeight: 1, color: 'var(--desktop-root-text)' }}>
                    {t.editTaskTitle}
                  </h2>
                </div>
                <button type="button" onClick={closeEditModal} aria-label={t.close} style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--desktop-modal-close-bg)', border: '1px solid var(--desktop-edit-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, color: 'var(--desktop-modal-close-text)' }}>
                  <CloseIcon />
                </button>
              </div>
              <div style={{ minHeight: 0, padding: 24 }}>
                <div style={{ position: 'relative', height: '100%' }}>
                  {normalizeCardType(editingTask.cardType) === CARD_TYPES.PHOTO && editingTask.photoDataUrl ? (
                    <div
                      style={{
                        marginBottom: 14,
                        borderRadius: 18,
                        overflow: 'hidden',
                        border: '1px solid var(--desktop-edit-input-border)',
                        background: 'rgba(255,255,255,0.66)',
                      }}
                    >
                        <img
                          src={editingTask.photoDataUrl}
                          alt={editingTask.photoTitle || editingTask.text || 'Photo'}
                          draggable={false}
                          onDragStart={(event) => event.preventDefault()}
                          style={{ display: 'block', width: '100%', maxHeight: 220, objectFit: 'cover' }}
                        />
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleEditCopy}
                    disabled={!editText.trim()}
                    style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      zIndex: 1,
                      minWidth: 72,
                      height: 32,
                      padding: '0 12px',
                      borderRadius: 999,
                      border: '1px solid var(--desktop-edit-border)',
                      background: 'var(--desktop-modal-close-bg)',
                      color: 'var(--desktop-root-text)',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: editText.trim() ? 'pointer' : 'not-allowed',
                      opacity: editText.trim() ? 1 : 0.45,
                    }}
                  >
                    {editCopied ? 'Copied' : 'Copy'}
                  </button>
                  <textarea
                    value={editText}
                    onChange={(event) => setEditText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                        event.preventDefault();
                        handleEditSave();
                      }
                    }}
                    autoFocus
                    rows={10}
                    placeholder={t.editTaskPlaceholder}
                    style={{
                      width: '100%',
                      height: '100%',
                      minHeight: normalizeCardType(editingTask.cardType) === CARD_TYPES.PHOTO ? 180 : 280,
                      border: '1px solid var(--desktop-edit-input-border)',
                      background: 'var(--desktop-edit-input-bg)',
                      borderRadius: 18,
                      padding: '52px 18px 18px',
                      fontSize: 16,
                      lineHeight: 1.6,
                      color: 'var(--desktop-root-text)',
                      resize: 'none',
                      outline: 'none',
                      fontFamily: 'Inter, sans-serif',
                    }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '16px 24px 24px', borderTop: '1px solid var(--desktop-edit-border)' }}>
                <button type="button" onClick={closeEditModal} style={{ minWidth: 96, height: 44, padding: '0 18px', borderRadius: 14, border: '1px solid var(--desktop-cancel-border)', background: 'var(--desktop-cancel-bg)', color: 'var(--desktop-cancel-text)', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                  {t.cancel}
                </button>
                <button type="button" onClick={handleEditSave} disabled={!canSaveEdit} style={{ minWidth: 136, height: 44, padding: '0 20px', background: canSaveEdit ? 'var(--desktop-save-bg)' : 'var(--desktop-save-disabled-bg)', color: canSaveEdit ? 'var(--desktop-save-text)' : 'var(--desktop-save-disabled-text)', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 600, cursor: canSaveEdit ? 'pointer' : 'not-allowed' }}>
                  {t.save}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <DesktopProfilePage
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          user={user}
          language={language}
          setLanguage={setLanguage}
          appearance={appearance}
          appearancePreference={appearancePreference}
          setAppearance={setAppearancePreference}
          onSignOut={handleSignOut}
        />
        <DesktopSearchModal
          open={historyOpen}
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
            openTaskEditor(task, false);
          }}
          onPackClick={handleHistoryPackOpen}
          onPackItemClick={handleHistoryPackItemOpen}
          onTaskPointerDown={handleTaskPointerDown}
          onTaskLongPress={(task) => handleSearchTaskLongPress(task, startDesktopTaskDrag)}
        />

        <PackPrompt
          prompt={pendingGroupPrompt}
          groupName={pendingGroupName}
          setGroupName={setPendingGroupName}
          onConfirm={handleConfirmGroupPrompt}
          onCancel={handleCancelGroupPrompt}
        />
        <PackFullView
          view={activeGroupView}
          appearance={appearance}
          labels={t}
          language={language}
          onClose={closeActiveGroupView}
          onTaskEdit={(task) => {
            closeActiveGroupView();
            handleTaskEdit(task);
          }}
          onDeleteTasks={deleteTasksByIds}
          onUpdateGroup={updateActiveGroupMetadata}
          onToast={showToast}
          onTaskOpen={(task) => {
            closeActiveGroupView();
            handleTaskClick(task);
          }}
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
