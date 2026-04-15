import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import EmojiPicker from 'emoji-picker-react';
import JSZip from 'jszip';
import { PenLine, Trash2, X } from 'lucide-react';
import { supabase } from '../supabase';
import DesktopLogin from '../DesktopLogin';
import { useSyncedTodos } from '../todoSync';
import { getUserProfile } from '../userProfile';
import DesktopProfilePage from '../components/DesktopProfilePage';
import DesktopHistoryModal from '../components/DesktopHistoryModal';
import IntoDayLogo from '../components/IntoDayLogo';
import { DAY_BOUNDARY_HOUR, getLogicalToday } from '../lib/dateHelpers';
import { getInitialLanguage } from '../lib/language';
import { createUpdatedTimestamp, getPackMetadataTextFromItems } from '../lib/packMetadata';
import { deleteUploadedFileBlob, getUploadedFileRecord, saveUploadedFileBlob } from '../lib/uploadedFileStorage';
import {
  createPackActiveDurationFields,
  getPackActiveBaseDateFromTasks,
  getPackActiveDurationFromTasks,
  getPackActiveLabel,
  getPackIconFromTasks,
  isPackActiveOnDate,
  PACK_ACTIVE_DURATION_OPTIONS,
  getPackTagsFromTasks,
  normalizePackActiveDate,
  normalizePackActiveDurationType,
  normalizePackCover,
  normalizePackIcon,
  normalizePackTags,
  PACK_ICON_SUGGESTIONS,
} from '../lib/packPageUtils';
import { timeBlocks } from '../lib/timeBlocks';
import { translations } from '../lib/translations';
import {
  CARD_TYPES,
  extractPrimaryUrl,
  fetchMapMeta,
  fetchVideoMeta,
  fetchSpotifyMeta,
  fetchLinkPreviewMeta,
  getDerivedTaskFields,
  getTaskCardPresentation,
  normalizeCardType,
} from '../taskCardUtils';
import {
  deriveTaskDisplaySubtitle,
  deriveTaskDisplayTitle,
} from '../lib/taskDisplayUtils';
import { useTaskInteraction } from '../task-interactions/useTaskInteraction';
import { trackUserEvent } from '../lib/analytics';

const SHARED_SELECTED_DATE_KEY = 'shared_selected_date';
const DESKTOP_LANGUAGE_KEY = 'desktop_profile_language';
const DESKTOP_APPEARANCE_KEY = 'desktop_profile_appearance';
const DESKTOP_WORKSPACES_KEY = 'desktop_workspace_items';
const DESKTOP_ACTIVE_WORKSPACE_KEY = 'desktop_active_workspace';
const DEFAULT_DESKTOP_WORKSPACE_ID = 'workspace-untitled';
const MAX_DESKTOP_WORKSPACES = 3;
const LEGACY_SAMPLE_WORKSPACE_IDS = new Set(['workspace-personal-projects', 'workspace-work-setup']);
const DEFAULT_DESKTOP_WORKSPACES = [
  {
    id: DEFAULT_DESKTOP_WORKSPACE_ID,
    name: 'Untitled',
    iconType: 'dot',
  },
];
const LANGUAGE_LOCALES = {
  EN: 'en-US',
  ZH: 'zh-CN',
  MS: 'ms-MY',
  JA: 'ja-JP',
  TH: 'th-TH',
};
const MOBILE_BLOCK_STYLES = Object.fromEntries(timeBlocks.map((block) => [block.id, block]));
const DAY_TASK_TIME_ORDER = ['Morning', 'Afternoon', 'Evening', 'Night', 'Midnight'];
const sections = [
  {
    id: 'morning',
    mobileId: 'Morning',
    labelKey: 'morning',
    start: '06:00',
    end: '12:00',
    pillBg: '#f7d8a5',
    pillColor: '#6b3f06',
    darkPillBg: MOBILE_BLOCK_STYLES.Morning.color,
    darkPillColor: MOBILE_BLOCK_STYLES.Morning.textColor,
    darkPillBorder: MOBILE_BLOCK_STYLES.Morning.strokeColor,
  },
  {
    id: 'afternoon',
    mobileId: 'Afternoon',
    labelKey: 'afternoon',
    start: '12:00',
    end: '18:00',
    pillBg: '#bfe3fb',
    pillColor: '#0d4c82',
    darkPillBg: MOBILE_BLOCK_STYLES.Afternoon.color,
    darkPillColor: MOBILE_BLOCK_STYLES.Afternoon.textColor,
    darkPillBorder: MOBILE_BLOCK_STYLES.Afternoon.strokeColor,
  },
  {
    id: 'evening',
    mobileId: 'Evening',
    labelKey: 'evening',
    start: '18:00',
    end: '22:00',
    pillBg: '#eadffd',
    pillColor: '#5f2d90',
    darkPillBg: MOBILE_BLOCK_STYLES.Evening.color,
    darkPillColor: MOBILE_BLOCK_STYLES.Evening.textColor,
    darkPillBorder: MOBILE_BLOCK_STYLES.Evening.strokeColor,
  },
  {
    id: 'night',
    mobileId: 'Night',
    labelKey: 'night',
    start: '22:00',
    end: '06:00',
    pillBg: '#dfe6ef',
    pillColor: '#213243',
    darkPillBg: MOBILE_BLOCK_STYLES.Night.color,
    darkPillColor: MOBILE_BLOCK_STYLES.Night.textColor,
    darkPillBorder: MOBILE_BLOCK_STYLES.Night.strokeColor,
  },
];
const DESKTOP_DRAG_START_DISTANCE = 8;
const DESKTOP_DRAG_DAY_EDGE_HOLD_MS = 380;
const DESKTOP_DRAG_DAY_FLIP_COOLDOWN_MS = 700;
const DESKTOP_DRAG_DAY_FLIP_ZONE_PX = 56;
const DESKTOP_DRAG_DAY_ARM_DISTANCE_PX = 10;
const DESKTOP_DRAG_DAY_CONFIRM_DISTANCE_PX = 28;
const DESKTOP_DRAG_DAY_CANCEL_DISTANCE_PX = 16;
const DESKTOP_GROUP_OVERLAP_THRESHOLD = 0.5;
const DESKTOP_MAIN_CONTENT_MAX_WIDTH = 1008;
const DESKTOP_MAIN_CONTENT_HORIZONTAL_PADDING = 72;
const DESKTOP_DRAG_EDGE_OVERFLOW_TOP = 20;
const DESKTOP_DRAG_EDGE_OVERFLOW_BOTTOM = 64;
const DESKTOP_DRAG_EDGE_RESISTANCE = 0.22;
const DESKTOP_DRAG_MAX_EDGE_OVERFLOW = 96;
const DESKTOP_BASE_SLOT_COUNT = 4;
const DESKTOP_TIME_AXIS_LINE_TOP = 26;
const DESKTOP_TIME_AXIS_LINE_BOTTOM = 36;
const DESKTOP_TIME_MARKER_SIZE = 7;
const DESKTOP_SLOT_MIN_HEIGHT = 98;
const DESKTOP_SLOT_GAP = 22;
const DESKTOP_CANVAS_DEFAULT_ZOOM = 0.8;
const DESKTOP_CANVAS_MIN_SCALE = 0.15;
const DESKTOP_CANVAS_MAX_SCALE = 2;
const DESKTOP_CANVAS_SCALE_STEP = 0.12;
const DESKTOP_CANVAS_CARD_WIDTH = 336;
const DESKTOP_CANVAS_CARD_HEIGHT = 92;
const DESKTOP_PHOTO_CARD_HEIGHT = 236;
const DESKTOP_CANVAS_CARD_GAP = 20;
const DESKTOP_IMAGE_DROP_MAX_EDGE = 1600;
const DESKTOP_IMAGE_DROP_QUALITY = 0.88;
const UPLOADED_FILE_SOURCE_LABEL = 'Uploaded file';
const SUPPORTED_UPLOAD_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];
const SUPPORTED_UPLOAD_WORD_EXTENSIONS = ['doc', 'docx'];
const SUPPORTED_UPLOAD_PDF_EXTENSIONS = ['pdf'];
const SUPPORTED_UPLOAD_ACCEPT = '.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const SUPPORTED_CONVERT_ACCEPT = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const DESKTOP_CANVAS_MIN_HEIGHT = 560;
const DESKTOP_GROUP_CARD_MIN_HEIGHT = 176;
const DESKTOP_GROUP_CARD_ITEM_HEIGHT = 60;
const DESKTOP_GROUP_CARD_VISIBLE_ITEMS = 3;
const DESKTOP_GROUP_CARD_EXPANDED_VISIBLE_ITEMS = 5;
// Pure coordinate utility functions (no DOM refs, no closures)
const canvasToScreen = (canvasX, canvasY, vp) => ({
  x: canvasX * vp.zoom + vp.panX,
  y: canvasY * vp.zoom + vp.panY,
});
const screenToCanvas = (screenX, screenY, vp) => ({
  x: (screenX - vp.panX) / vp.zoom,
  y: (screenY - vp.panY) / vp.zoom,
});
// Root-level app window scale (OS density scaling) — unrelated to canvas zoom.
// The entire desktop app wrapper is scaled down to 0.8 so the UI fits a typical
// consumer monitor pixel density. Drag overlay positions must compensate for this.
const DESKTOP_APP_WINDOW_SCALE = 0.8;

const getDesktopSectionPillStyle = (section, appearance) => (
  appearance === 'dark'
    ? {
      background: section.darkPillBg,
      color: section.darkPillColor,
      border: `1px solid ${section.darkPillBorder}`,
      WebkitTextStroke: `0.2px ${section.darkPillBorder}`,
    }
    : {
      background: section.pillBg,
      color: section.pillColor,
      border: 'none',
      WebkitTextStroke: '0',
    }
);

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
const getDesktopSectionTaskOrder = (tasks, dateString, timeOfDay) => {
  const sectionTasks = tasks.filter((task) => task.dateString === dateString && task.timeOfDay === timeOfDay);
  const { slots } = resolveDesktopSectionSlots(sectionTasks);
  return slots.filter(Boolean);
};
const getDayTaskOrder = (tasks, dateString) => tasks
  .map((task, index) => ({ task, index }))
  .filter(({ task }) => task.dateString === dateString)
  .sort((a, b) => {
    const timeRankA = DAY_TASK_TIME_ORDER.indexOf(a.task.timeOfDay);
    const timeRankB = DAY_TASK_TIME_ORDER.indexOf(b.task.timeOfDay);
    const normalizedTimeRankA = timeRankA === -1 ? DAY_TASK_TIME_ORDER.length : timeRankA;
    const normalizedTimeRankB = timeRankB === -1 ? DAY_TASK_TIME_ORDER.length : timeRankB;
    const slotA = isValidDesktopSlot(a.task.desktopSlot) ? a.task.desktopSlot : Number.POSITIVE_INFINITY;
    const slotB = isValidDesktopSlot(b.task.desktopSlot) ? b.task.desktopSlot : Number.POSITIVE_INFINITY;

    return normalizedTimeRankA - normalizedTimeRankB || slotA - slotB || a.index - b.index;
  })
  .map(({ task }) => task);
const reflowDesktopSectionSlots = (tasks, dateString, timeOfDay, orderedIds = null) => {
  const currentOrderedTasks = getDesktopSectionTaskOrder(tasks, dateString, timeOfDay);
  const orderedTasks = orderedIds
    ? [
      ...orderedIds
        .map((id) => currentOrderedTasks.find((task) => task.id === id))
        .filter(Boolean),
      ...currentOrderedTasks.filter((task) => !orderedIds.includes(task.id)),
    ]
    : currentOrderedTasks;

  orderedTasks.forEach((task, index) => {
    const targetTask = tasks.find((item) => item.id === task.id);
    if (!targetTask) return;
    targetTask.desktopSlot = index;
  });
};
const buildDesktopRenderSections = ({ tasks, selectedDateKey, draggedTaskId, dragOverSection, dragOverSlot }) => {
  const selectedTasks = tasks.filter((task) => task.dateString === selectedDateKey);
  const baseSections = Object.fromEntries(
    sections.map((section) => {
      const { slots } = resolveDesktopSectionSlots(
        selectedTasks.filter((task) => task.timeOfDay === section.mobileId),
      );
      return [section.mobileId, {
        renderSlots: slots.map((task) => (task ? { type: 'task', task } : { type: 'empty' })),
      }];
    }),
  );

  if (!draggedTaskId) return baseSections;

  const draggedTask = tasks.find((task) => task.id === draggedTaskId);
  if (!draggedTask) return baseSections;

  let previewTasks = tasks;
  if (dragOverSection && isValidDesktopSlot(dragOverSlot)) {
    previewTasks = applyDesktopTaskDrop({
      tasks,
      draggedTaskId,
      sourceDateString: draggedTask.dateString,
      sourceSection: draggedTask.timeOfDay,
      sourceSlot: draggedTask.desktopSlot,
      targetDateString: selectedDateKey,
      targetSection: dragOverSection,
      targetSlot: dragOverSlot,
    });
  }

  const previewDraggedTask = previewTasks.find((task) => task.id === draggedTaskId) || draggedTask;
  const previewSections = Object.fromEntries(
    sections.map((section) => {
      const { slots } = resolveDesktopSectionSlots(
        previewTasks.filter((task) => task.dateString === selectedDateKey && task.timeOfDay === section.mobileId),
      );
      const renderSlots = slots.map((task, slotIndex) => {
        if (
          previewDraggedTask.dateString === selectedDateKey
          &&
          previewDraggedTask.timeOfDay === section.mobileId
          && previewDraggedTask.desktopSlot === slotIndex
        ) {
          return { type: 'placeholder' };
        }
        if (task && task.id === draggedTaskId) {
          return { type: 'empty' };
        }
        return task ? { type: 'task', task } : { type: 'empty' };
      });

      return [section.mobileId, { renderSlots }];
    }),
  );

  return previewSections;
};
const applyDesktopTaskDrop = ({
  tasks,
  draggedTaskId,
  sourceDateString,
  sourceSection,
  sourceSlot,
  targetDateString,
  targetSection,
  targetSlot,
}) => {
  if (!targetSection || !isValidDesktopSlot(targetSlot)) return tasks;

  const nextTasks = tasks.map((task) => ({ ...task }));
  const draggedTask = nextTasks.find((task) => task.id === draggedTaskId);
  if (!draggedTask) return tasks;
  const resolvedSourceDateString = sourceDateString || draggedTask.dateString;
  const resolvedTargetDateString = targetDateString || resolvedSourceDateString;
  const targetOrder = getDesktopSectionTaskOrder(
    nextTasks.filter((task) => task.id !== draggedTaskId),
    resolvedTargetDateString,
    targetSection,
  ).map((task) => task.id);
  const insertIndex = Math.max(0, Math.min(targetSlot, targetOrder.length));
  targetOrder.splice(insertIndex, 0, draggedTaskId);

  draggedTask.dateString = resolvedTargetDateString;
  draggedTask.timeOfDay = targetSection;
  draggedTask.desktopSlot = null;

  if (resolvedSourceDateString !== resolvedTargetDateString || sourceSection !== targetSection) {
    reflowDesktopSectionSlots(nextTasks, resolvedSourceDateString, sourceSection);
  }
  reflowDesktopSectionSlots(nextTasks, resolvedTargetDateString, targetSection, targetOrder);
  return nextTasks.map(normalizeTask);
};

const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const shiftDateByDays = (date, dayOffset) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + dayOffset);
  return nextDate;
};
const getDesktopDayFlipZones = (viewportRect) => {
  const edgeZone = DESKTOP_DRAG_DAY_FLIP_ZONE_PX;
  return {
    mode: 'edge',
    previousStart: viewportRect.left,
    previousEnd: viewportRect.left + edgeZone,
    nextStart: viewportRect.right - edgeZone,
    nextEnd: viewportRect.right,
  };
};
const getLocaleForLanguage = (language) => LANGUAGE_LOCALES[language] || LANGUAGE_LOCALES.EN;
const getTranslationsForLanguage = (language) => translations[language] || translations.EN;
const formatTemplate = (template, values) => Object.entries(values).reduce(
  (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
  template,
);
const clampDesktopCanvasScale = (value) => Math.min(DESKTOP_CANVAS_MAX_SCALE, Math.max(DESKTOP_CANVAS_MIN_SCALE, value));
const isEditableElement = (target) => (
  target instanceof HTMLElement
  && Boolean(target.closest('input, textarea, button, select, [contenteditable="true"], [role="dialog"]'))
);
const isFiniteCanvasCoordinate = (value) => Number.isFinite(value) && value >= 0;
const getDesktopGroupCardHeight = (itemCount, visibleItemCount = itemCount) => {
  const visibleCount = Math.max(1, Math.min(visibleItemCount, itemCount));
  const hasExtra = itemCount > visibleCount;
  const padding = hasExtra ? 20 : 12;
  return Math.max(
    DESKTOP_GROUP_CARD_MIN_HEIGHT,
    70 + (visibleCount * DESKTOP_GROUP_CARD_ITEM_HEIGHT) + padding,
  );
};
const getDesktopCanvasTaskHeight = (task) => (
  normalizeCardType(task?.cardType) === CARD_TYPES.PHOTO
    ? DESKTOP_PHOTO_CARD_HEIGHT
    : DESKTOP_CANVAS_CARD_HEIGHT
);
const getDesktopDragTaskIds = (task) => (
  Array.isArray(task?.groupTaskIds) && task.groupTaskIds.length > 0
    ? task.groupTaskIds
    : task?.id !== undefined && task?.id !== null
      ? [task.id]
      : []
);
const getDesktopCanvasEntryHeight = (entry) => (
  entry?.type === 'group'
    ? getDesktopGroupCardHeight(entry.tasks.length)
    : getDesktopCanvasTaskHeight(entry?.task)
);
const getDesktopCanvasEntryTaskIds = (entry) => (
  entry?.type === 'group'
    ? entry.tasks.map((task) => task.id)
    : entry?.task?.id !== undefined && entry?.task?.id !== null
      ? [entry.task.id]
      : []
);
const getDesktopSelectionRect = (start, end) => ({
  x: Math.min(start.x, end.x),
  y: Math.min(start.y, end.y),
  width: Math.abs(end.x - start.x),
  height: Math.abs(end.y - start.y),
});
const getDefaultDesktopWorkspaces = () => DEFAULT_DESKTOP_WORKSPACES.map((workspace) => ({ ...workspace }));
const getUntitledWorkspaceName = (index) => (index <= 1 ? 'Untitled' : `Untitled ${index}`);
const getTaskWorkspaceId = (task) => (
  typeof task?.desktopWorkspaceId === 'string' && task.desktopWorkspaceId.trim()
    ? task.desktopWorkspaceId
    : DEFAULT_DESKTOP_WORKSPACE_ID
);
const taskBelongsToWorkspace = (task, workspaceId) => getTaskWorkspaceId(task) === workspaceId;
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
const getCanvasDeletionSummary = (tasks, selectedTaskIds) => {
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

  let title = 'Delete selected objects?';
  if (packCount === 0) {
    title = looseItemCount === 1
      ? 'Delete this item?'
      : `Delete ${looseItemCount} selected items?`;
  } else if (looseItemCount === 0) {
    title = packCount === 1
      ? 'Delete this pack and its contents?'
      : `Delete ${packCount} selected packs and their contents?`;
  } else {
    const itemLabel = `${looseItemCount} ${looseItemCount === 1 ? 'item' : 'items'}`;
    const packLabel = `${packCount} ${packCount === 1 ? 'pack' : 'packs'}`;
    title = `Delete ${itemLabel} and ${packLabel}?`;
  }

  return {
    title,
    packCount,
    looseItemCount,
    taskIds: selectedTasks.map((task) => task.id),
  };
};
const doDesktopRectsIntersect = (first, second) => !(
  first.x + first.width < second.x
  || second.x + second.width < first.x
  || first.y + first.height < second.y
  || second.y + second.height < first.y
);
const getDefaultDesktopCanvasPosition = (index) => {
  const column = index % 2;
  const row = Math.floor(index / 2);
  return {
    x: column * (DESKTOP_CANVAS_CARD_WIDTH + DESKTOP_CANVAS_CARD_GAP),
    y: row * (DESKTOP_CANVAS_CARD_HEIGHT + DESKTOP_CANVAS_CARD_GAP),
  };
};
const resolveDesktopCanvasEntries = (tasks, dateString) => {
  const selectedTasks = tasks
    .filter((task) => isPackActiveOnDate(task, dateString))
    .sort((a, b) => {
      const layerA = Number.isFinite(a.desktopZ) ? a.desktopZ : 0;
      const layerB = Number.isFinite(b.desktopZ) ? b.desktopZ : 0;
      return layerA - layerB || Number(a.id) - Number(b.id);
    });
  const processedGroupIds = new Set();

  return selectedTasks.reduce((entries, task, index) => {
    const fallback = getDefaultDesktopCanvasPosition(index);
    if (task.desktopGroupId) {
      if (processedGroupIds.has(task.desktopGroupId)) {
        return entries;
      }
      const activeGroupTasks = selectedTasks.filter((item) => item.desktopGroupId === task.desktopGroupId);
      const groupedTasks = tasks.filter((item) => item.desktopGroupId === task.desktopGroupId);
      if (groupedTasks.length > 1) {
        processedGroupIds.add(task.desktopGroupId);
        const anchorTask = activeGroupTasks.find((item) => (
          isFiniteCanvasCoordinate(item.desktopCanvasX) && isFiniteCanvasCoordinate(item.desktopCanvasY)
        )) || groupedTasks.find((item) => (
          isFiniteCanvasCoordinate(item.desktopCanvasX) && isFiniteCanvasCoordinate(item.desktopCanvasY)
        )) || task;
        entries.push({
          type: 'group',
          id: task.desktopGroupId,
          task: groupedTasks[0],
          tasks: groupedTasks,
          x: isFiniteCanvasCoordinate(anchorTask.desktopCanvasX) ? anchorTask.desktopCanvasX : fallback.x,
          y: isFiniteCanvasCoordinate(anchorTask.desktopCanvasY) ? anchorTask.desktopCanvasY : fallback.y,
        });
        return entries;
      }
    }

    entries.push({
      type: 'task',
      task,
      x: isFiniteCanvasCoordinate(task.desktopCanvasX) ? task.desktopCanvasX : fallback.x,
      y: isFiniteCanvasCoordinate(task.desktopCanvasY) ? task.desktopCanvasY : fallback.y,
    });
    return entries;
  }, []);
};
const getDesktopCanvasHeight = (entries) => Math.max(
  DESKTOP_CANVAS_MIN_HEIGHT,
  entries.reduce((max, entry) => Math.max(max, entry.y + getDesktopCanvasEntryHeight(entry) + 96), 0),
);
const getNextDesktopCanvasPosition = (tasks, dateString) => {
  const entries = resolveDesktopCanvasEntries(tasks, dateString);
  if (entries.length === 0) return getDefaultDesktopCanvasPosition(0);

  const maxBottom = entries.reduce((max, entry) => Math.max(max, entry.y + getDesktopCanvasEntryHeight(entry)), 0);
  return { x: 0, y: maxBottom + DESKTOP_CANVAS_CARD_GAP };
};
const getDesktopCanvasRectIntersectionArea = (first, second) => {
  const overlapWidth = Math.max(0, Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x));
  const overlapHeight = Math.max(0, Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y));
  return overlapWidth * overlapHeight;
};
const getDesktopCanvasOverlapEntry = (tasks, dateString, movingTaskIds, nextPosition, threshold = DESKTOP_GROUP_OVERLAP_THRESHOLD) => {
  const movingTasks = tasks.filter((task) => movingTaskIds.has(task.id));
  if (movingTasks.length === 0) return null;

  const movingHeight = movingTasks.length > 1
    ? getDesktopGroupCardHeight(movingTasks.length)
    : DESKTOP_CANVAS_CARD_HEIGHT;
  const movingRect = {
    x: nextPosition.x,
    y: nextPosition.y,
    width: DESKTOP_CANVAS_CARD_WIDTH,
    height: movingHeight,
  };

  let bestMatch = null;
  let bestRatio = 0;
  resolveDesktopCanvasEntries(tasks, dateString).forEach((entry) => {
    const entryTaskIds = entry.type === 'group' ? entry.tasks.map((item) => item.id) : [entry.task.id];
    
    // Ignore this entry ONLY if we are moving the exact same set of tasks (all of them).
    // This allows pulling 1 task out of a group and then "putting it back" (overlapping with the group).
    const isMovingExactSameItems = entryTaskIds.length === movingTaskIds.size && entryTaskIds.every(id => movingTaskIds.has(id));
    if (isMovingExactSameItems) return;

    const targetWidth = DESKTOP_CANVAS_CARD_WIDTH;
    const targetHeight = getDesktopCanvasEntryHeight(entry);
    const targetArea = targetWidth * targetHeight;
    const movingArea = movingRect.width * movingRect.height;

    const overlapArea = getDesktopCanvasRectIntersectionArea(movingRect, {
      x: entry.x,
      y: entry.y,
      width: targetWidth,
      height: targetHeight,
    });
    
    if (overlapArea <= 0) return;

    const overlapRatio = overlapArea / Math.min(movingArea, targetArea);
    if (overlapRatio >= threshold && overlapRatio > bestRatio) {
      bestRatio = overlapRatio;
      bestMatch = entry;
    }
  });

  return bestMatch ? { entry: bestMatch, ratio: bestRatio } : null;
};
const getDesktopCanvasResolvedPosition = (tasks, dateString, movingTaskIds, preferredPosition) => {
  const movingTasks = tasks.filter((task) => movingTaskIds.has(task.id));
  if (movingTasks.length === 0) return preferredPosition;

  const movingHeight = movingTasks.length > 1
    ? getDesktopGroupCardHeight(movingTasks.length)
    : DESKTOP_CANVAS_CARD_HEIGHT;
  const maxX = Math.max(0, DESKTOP_MAIN_CONTENT_MAX_WIDTH - DESKTOP_CANVAS_CARD_WIDTH);
  const clampedX = Math.max(0, Math.min(maxX, preferredPosition.x));
  const stepY = DESKTOP_CANVAS_CARD_GAP + 12;

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const candidate = {
      x: clampedX,
      y: Math.max(0, preferredPosition.y + (attempt * stepY)),
    };
    const result = getDesktopCanvasOverlapEntry(tasks, dateString, movingTaskIds, candidate, 0.01);
    if (!result) return candidate;
    const overlapEntry = result.entry;
    preferredPosition = {
      x: overlapEntry.x,
      y: overlapEntry.y + getDesktopCanvasEntryHeight(overlapEntry) + DESKTOP_CANVAS_CARD_GAP,
    };
  }

  return {
    x: clampedX,
    y: Math.max(0, preferredPosition.y),
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
const getSuggestedDesktopGroupName = (movingTasks, overlapEntry) => {
  const overlapTasks = overlapEntry?.type === 'group' ? overlapEntry.tasks : overlapEntry?.task ? [overlapEntry.task] : [];
  const existingName = getDesktopGroupDisplayName([...movingTasks, ...overlapTasks]);
  return existingName || 'New group';
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
const cleanupDesktopGroupMetadata = (tasks) => {
  const groupCounts = tasks.reduce((map, task) => {
    if (!task.desktopGroupId) return map;
    map.set(task.desktopGroupId, (map.get(task.desktopGroupId) || 0) + 1);
    return map;
  }, new Map());

  return tasks.map((task) => (
    task.desktopGroupId && (groupCounts.get(task.desktopGroupId) || 0) <= 1
      ? normalizeTask({
        ...task,
        desktopGroupId: null,
        desktopGroupName: null,
        desktopGroupIcon: null,
        desktopGroupCover: null,
        desktopGroupTags: [],
        desktopGroupActiveDurationType: null,
        desktopGroupActiveFrom: null,
        desktopGroupActiveUntil: null,
      })
      : task
  ));
};
const parseSharedSelectedDate = (value) => {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const getUploadedFileTitle = (fileName = '', fallback = 'Untitled file') => fileName.replace(/\.[^.]+$/, '').trim() || fallback;
const getDroppedImageTitle = (fileName = '') => getUploadedFileTitle(fileName, 'Photo');
const getFileExtension = (fileName = '') => {
  const segments = String(fileName || '').toLowerCase().split('.');
  return segments.length > 1 ? segments.pop() : '';
};
const getUploadedFileFallbackMimeType = (uploadKind) => {
  if (uploadKind === 'pdf') return 'application/pdf';
  if (uploadKind === 'word') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (uploadKind === 'image') return 'image/png';
  return 'application/octet-stream';
};
const getSupportedUploadKind = (file) => {
  const mimeType = String(file?.type || '').toLowerCase();
  const extension = getFileExtension(file?.name || '');

  if (mimeType === 'application/pdf' || SUPPORTED_UPLOAD_PDF_EXTENSIONS.includes(extension)) {
    return 'pdf';
  }

  if (
    mimeType === 'application/msword'
    || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || SUPPORTED_UPLOAD_WORD_EXTENSIONS.includes(extension)
  ) {
    return 'word';
  }

  if (
    (mimeType.startsWith('image/') && SUPPORTED_UPLOAD_IMAGE_EXTENSIONS.includes(extension))
    || SUPPORTED_UPLOAD_IMAGE_EXTENSIONS.includes(extension)
  ) {
    return 'image';
  }

  return null;
};
const isSupportedUploadFile = (file) => Boolean(getSupportedUploadKind(file));
const isSupportedConvertFile = (file) => {
  const kind = getSupportedUploadKind(file);
  return kind === 'pdf' || kind === 'word';
};
const hasImageFiles = (dataTransfer) => {
  const files = Array.from(dataTransfer?.files || []);
  if (files.some((file) => getSupportedUploadKind(file) === 'image' || String(file?.type || '').toLowerCase().startsWith('image/'))) {
    return true;
  }

  const items = Array.from(dataTransfer?.items || []);
  if (items.some((item) => item.kind === 'file' && String(item.type || '').toLowerCase().startsWith('image/'))) {
    return true;
  }

  const types = Array.from(dataTransfer?.types || []);
  return types.includes('Files');
};
const hasSupportedUploadFiles = (dataTransfer) => {
  const files = Array.from(dataTransfer?.files || []);
  if (files.some((file) => isSupportedUploadFile(file))) {
    return true;
  }

  const items = Array.from(dataTransfer?.items || []);
  if (items.some((item) => {
    if (item.kind !== 'file') return false;
    const itemType = String(item.type || '').toLowerCase();
    return (
      itemType === 'application/pdf'
      || itemType === 'application/msword'
      || itemType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      || itemType === 'image/png'
      || itemType === 'image/jpeg'
      || itemType === 'image/webp'
    );
  })) {
    return true;
  }

  const types = Array.from(dataTransfer?.types || []);
  return types.includes('Files');
};
const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
  reader.readAsDataURL(file);
});
const loadImageElement = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Failed to decode image'));
  image.src = src;
});
const createUploadAttachmentId = () => `${Date.now()}-${Math.round(Math.random() * 100000)}`;
const createUploadedFileStorageKey = (fileName = 'file') => {
  const normalizedName = String(fileName || 'file')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'file';
  return `upload:${Date.now()}:${Math.random().toString(36).slice(2, 10)}:${normalizedName}`;
};
const serializeDroppedImageFile = async (file) => {
  const originalDataUrl = await readFileAsDataUrl(file);
  const image = await loadImageElement(originalDataUrl);
  const longestEdge = Math.max(image.naturalWidth || 0, image.naturalHeight || 0);
  const scale = longestEdge > DESKTOP_IMAGE_DROP_MAX_EDGE
    ? DESKTOP_IMAGE_DROP_MAX_EDGE / longestEdge
    : 1;
  const targetWidth = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
  const targetHeight = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext('2d');
  if (!context) {
    return {
      photoDataUrl: originalDataUrl,
      photoWidth: image.naturalWidth || targetWidth,
      photoHeight: image.naturalHeight || targetHeight,
      photoMimeType: file.type || 'image/png',
    };
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);
  const shouldKeepAlpha = /png|webp|gif|avif/i.test(file.type || '');
  const mimeType = shouldKeepAlpha ? 'image/png' : 'image/jpeg';
  const photoDataUrl = canvas.toDataURL(mimeType, DESKTOP_IMAGE_DROP_QUALITY);

  return {
    photoDataUrl,
    photoWidth: targetWidth,
    photoHeight: targetHeight,
    photoMimeType: mimeType,
  };
};
const serializeUploadAttachment = async (file) => {
  const uploadKind = getSupportedUploadKind(file);
  if (!uploadKind) {
    throw new Error(`Unsupported file type: ${file?.name || 'unknown'}`);
  }

  const fallbackTitle = uploadKind === 'image' ? 'Photo' : 'Untitled file';
  const baseAttachment = {
    id: createUploadAttachmentId(),
    file,
    uploadKind,
    title: uploadKind === 'image' ? getDroppedImageTitle(file.name) : getUploadedFileTitle(file.name, fallbackTitle),
    originalFileName: file.name || `${fallbackTitle.toLowerCase().replace(/\s+/g, '-')}`,
    mimeType: file.type || getUploadedFileFallbackMimeType(uploadKind),
    size: Number.isFinite(file.size) ? file.size : 0,
    createdAt: createUpdatedTimestamp(),
    updatedAt: createUpdatedTimestamp(),
    extractedText: null,
    previewUrl: null,
  };

  if (uploadKind !== 'image') {
    return baseAttachment;
  }

  const photoFields = await serializeDroppedImageFile(file);
  return {
    ...baseAttachment,
    ...photoFields,
    previewUrl: photoFields.photoDataUrl || null,
  };
};
const sectionIdToMobileId = (sectionId) => {
  const matched = sections.find((section) => section.id === sectionId);
  return matched?.mobileId || 'Morning';
};
const mobileIdToSectionId = (mobileId) => {
  const matched = sections.find((section) => section.mobileId === mobileId);
  return matched?.id || 'morning';
};
const normalizeTask = (task) => {
  const derivedFields = getDerivedTaskFields(task.text || '');

  return {
    ...derivedFields,
    ...task,
    text: task.text || '',
    completed: task.completed ?? false,
    dateString: task.dateString || dateKey(getLogicalToday()),
    timeOfDay: task.timeOfDay || sectionIdToMobileId(task.section),
    cardType: normalizeCardType(task.cardType || derivedFields.cardType),
    updatedAt: typeof task.updatedAt === 'string' && task.updatedAt.trim() ? task.updatedAt : null,
    desktopSlot: isValidDesktopSlot(task.desktopSlot) ? task.desktopSlot : null,
    desktopCanvasX: isFiniteCanvasCoordinate(task.desktopCanvasX) ? task.desktopCanvasX : null,
    desktopCanvasY: isFiniteCanvasCoordinate(task.desktopCanvasY) ? task.desktopCanvasY : null,
    desktopZ: Number.isFinite(task.desktopZ) ? task.desktopZ : null,
    desktopWorkspaceId: getTaskWorkspaceId(task),
    desktopGroupId: typeof task.desktopGroupId === 'string' && task.desktopGroupId.trim() ? task.desktopGroupId : null,
    desktopGroupName: typeof task.desktopGroupName === 'string' && task.desktopGroupName.trim() ? task.desktopGroupName : null,
    desktopGroupIcon: normalizePackIcon(task.desktopGroupIcon),
    desktopGroupCover: normalizePackCover(task.desktopGroupCover),
    desktopGroupTags: normalizePackTags(task.desktopGroupTags),
    desktopGroupActiveDurationType: normalizePackActiveDurationType(task.desktopGroupActiveDurationType),
    desktopGroupActiveFrom: normalizePackActiveDate(task.desktopGroupActiveFrom),
    desktopGroupActiveUntil: normalizePackActiveDate(task.desktopGroupActiveUntil),
    photoDataUrl: typeof task.photoDataUrl === 'string' && task.photoDataUrl.trim() ? task.photoDataUrl : null,
    photoFileName: typeof task.photoFileName === 'string' && task.photoFileName.trim() ? task.photoFileName : null,
    photoMimeType: typeof task.photoMimeType === 'string' && task.photoMimeType.trim() ? task.photoMimeType : null,
    photoWidth: Number.isFinite(task.photoWidth) ? task.photoWidth : null,
    photoHeight: Number.isFinite(task.photoHeight) ? task.photoHeight : null,
    photoUrl: typeof task.photoUrl === 'string' && task.photoUrl.trim() ? task.photoUrl : null,
    photoTitle: typeof task.photoTitle === 'string' && task.photoTitle.trim() ? task.photoTitle : null,
    uploadedFileStorageKey: typeof task.uploadedFileStorageKey === 'string' && task.uploadedFileStorageKey.trim() ? task.uploadedFileStorageKey : null,
    uploadedFileType: typeof task.uploadedFileType === 'string' && task.uploadedFileType.trim() ? task.uploadedFileType : null,
    uploadedOriginalFileName: typeof task.uploadedOriginalFileName === 'string' && task.uploadedOriginalFileName.trim() ? task.uploadedOriginalFileName : null,
    uploadedMimeType: typeof task.uploadedMimeType === 'string' && task.uploadedMimeType.trim() ? task.uploadedMimeType : null,
    uploadedFileSize: Number.isFinite(task.uploadedFileSize) ? task.uploadedFileSize : null,
    uploadedSourceLabel: typeof task.uploadedSourceLabel === 'string' && task.uploadedSourceLabel.trim() ? task.uploadedSourceLabel : null,
    uploadedCreatedAt: typeof task.uploadedCreatedAt === 'string' && task.uploadedCreatedAt.trim() ? task.uploadedCreatedAt : null,
    uploadedUpdatedAt: typeof task.uploadedUpdatedAt === 'string' && task.uploadedUpdatedAt.trim() ? task.uploadedUpdatedAt : null,
    extractedText: typeof task.extractedText === 'string' && task.extractedText.trim() ? task.extractedText : null,
  };
};
const currentSection = (date = new Date()) => {
  const hour = date.getHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
};
const getSectionBounds = (section, logicalDate) => {
  const baseDate = new Date(logicalDate);
  baseDate.setHours(0, 0, 0, 0);

  const [startHour, startMinute] = section.start.split(':').map(Number);
  const [endHour, endMinute] = section.end.split(':').map(Number);

  const sectionStart = new Date(baseDate);
  sectionStart.setHours(startHour, startMinute, 0, 0);
  if (startHour < DAY_BOUNDARY_HOUR) {
    sectionStart.setDate(sectionStart.getDate() + 1);
  }

  const sectionEnd = new Date(baseDate);
  sectionEnd.setHours(endHour, endMinute, 0, 0);
  if (sectionEnd <= sectionStart) {
    sectionEnd.setDate(sectionEnd.getDate() + 1);
  }

  return { sectionStart, sectionEnd };
};
const getSectionMarkerStyle = (section, currentTime, selectedDate) => {
  const logicalToday = getLogicalToday(currentTime);
  const logicalSelectedDate = new Date(selectedDate);
  logicalSelectedDate.setHours(0, 0, 0, 0);

  if (!sameDay(logicalSelectedDate, logicalToday)) return null;

  const { sectionStart, sectionEnd } = getSectionBounds(section, logicalSelectedDate);

  if (currentTime < sectionStart || currentTime >= sectionEnd) return null;

  const progress = Math.max(
    0,
    Math.min(1, (currentTime.getTime() - sectionStart.getTime()) / (sectionEnd.getTime() - sectionStart.getTime())),
  );

  return {
    top: `calc(${DESKTOP_TIME_AXIS_LINE_TOP}px + ((100% - ${DESKTOP_TIME_AXIS_LINE_TOP}px - ${DESKTOP_TIME_AXIS_LINE_BOTTOM}px) * ${progress}) - ${(DESKTOP_TIME_MARKER_SIZE / 2)}px)`,
  };
};
const getCalendarWeekdayLabels = (language) => {
  const locale = getLocaleForLanguage(language);
  const baseSunday = new Date(Date.UTC(2024, 0, 7));

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(baseSunday);
    date.setUTCDate(baseSunday.getUTCDate() + index);
    return new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(date);
  });
};
const panelLabel = (date, language) => {
  const t = getTranslationsForLanguage(language);
  if (sameDay(date, getLogicalToday())) {
    return t.today;
  }

  return date.toLocaleDateString(getLocaleForLanguage(language), {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
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

const PlusIcon = ({ size = 26 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.9" stroke="currentColor" style={{ width: size, height: size }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);
const PackSelectIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4.5 12.5 8.5 16.5 19.5 6.5" />
    <path d="M9.5 12.5 13.5 16.5" opacity="0.42" />
  </svg>
);
const PackExportIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 4.75v10" />
    <path d="M8.25 8.75 12 5l3.75 3.75" />
    <path d="M5.5 13.75v3.5a1.25 1.25 0 0 0 1.25 1.25h10.5a1.25 1.25 0 0 0 1.25-1.25v-3.5" />
  </svg>
);
const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: 18, height: 18 }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
);
const OpenFullViewIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" style={{ width: 14, height: 14 }}>
    <path d="M6.1 2.25H13.75V9.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13.25 2.75L8.85 7.15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9.9 13.75H2.25V6.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2.75 13.25L7.15 8.85" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ArrowUpIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor" style={{ width: 18, height: 18 }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
  </svg>
);
const AttachFileIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ width: 16, height: 16 }}>
    <path d="M6.75 10.25 11.5 5.5a2.5 2.5 0 1 1 3.54 3.54l-6.1 6.1a3.75 3.75 0 1 1-5.3-5.3l6.36-6.36" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ConvertUploadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ width: 22, height: 22 }}>
    <path d="M12 7.25v7.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="m8.75 10.5 3.25-3.25 3.25 3.25" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7.25 15.75H6A1.75 1.75 0 0 1 4.25 14V6A1.75 1.75 0 0 1 6 4.25h8.1a1.75 1.75 0 0 1 1.24.51l2.15 2.15c.33.33.51.78.51 1.24V10.5" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13.5 19.75h4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const HeaderChevronIcon = ({ direction = 'left' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" style={{ width: 16, height: 16 }}>
    <path
      d={direction === 'left' ? 'M9.75 3.5L5.25 8L9.75 12.5' : 'M6.25 3.5L10.75 8L6.25 12.5'}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" style={{ width: 14, height: 14 }}>
    <path d="M12 20H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16.5 3.5C17.3284 2.67157 18.6716 2.67157 19.5 3.5C20.3284 4.32843 20.3284 5.67157 19.5 6.5L7 19L3 20L4 16L16.5 3.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const LinkGlobeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" style={{ width: 16, height: 16 }}>
    <path d="M10 2.5C5.858 2.5 2.5 5.858 2.5 10C2.5 14.142 5.858 17.5 10 17.5C14.142 17.5 17.5 14.142 17.5 10C17.5 5.858 14.142 2.5 10 2.5Z" stroke="currentColor" strokeWidth="1.45" />
    <path d="M2.917 8H17.083M2.917 12H17.083M10 2.917C11.563 4.63 12.451 6.855 12.5 9.167C12.451 11.478 11.563 13.703 10 15.417C8.437 13.703 7.549 11.478 7.5 9.167C7.549 6.855 8.437 4.63 10 2.917Z" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const DocumentTextIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" style={{ width: 16, height: 16 }}>
    <path d="M6 3.5H11.5L14.5 6.5V15.5C14.5 16.052 14.052 16.5 13.5 16.5H6.5C5.948 16.5 5.5 16.052 5.5 15.5V4.5C5.5 3.948 5.948 3.5 6.5 3.5H6Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M11.25 3.75V6.75H14.25M7.75 9H12.25M7.75 11.75H12.25" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const VideoGlyphIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" style={{ width: 16, height: 16 }}>
    <rect x="3.5" y="5.25" width="9.75" height="9.5" rx="2.2" stroke="currentColor" strokeWidth="1.4" />
    <path d="M9 8L11.75 10L9 12V8Z" fill="currentColor" />
    <path d="M13.25 8L16 6.5V13.5L13.25 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const SparkRosetteIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" style={{ width: 16, height: 16 }}>
    <path d="M10 3.25L11.85 6.15L15.25 6.85L13.1 9.5L13.35 12.95L10 11.7L6.65 12.95L6.9 9.5L4.75 6.85L8.15 6.15L10 3.25Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
    <circle cx="10" cy="10" r="1.1" fill="currentColor" />
  </svg>
);
const NotionGlyphIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" style={{ width: 16, height: 16 }}>
    <rect x="4" y="4" width="12" height="12" rx="2.2" stroke="currentColor" strokeWidth="1.4" />
    <path d="M7 13V7L12.6 13V7" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const GithubGlyphIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" style={{ width: 16, height: 16 }}>
    <path d="M7.75 15.25V12.9C6.25 13.35 5.25 12.65 4.75 11.5M15.25 13.5C16.05 12.75 16.5 11.65 16.5 10.25C16.5 7.15 13.95 4.75 10 4.75C6.05 4.75 3.5 7.15 3.5 10.25C3.5 11.65 3.95 12.75 4.75 13.5C5.3 14 6.05 14.45 7 14.75M13 14.75C13.95 14.45 14.7 14 15.25 13.5M8 15.25C8.75 15.55 9.35 15.65 10 15.65C10.65 15.65 11.25 15.55 12 15.25" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="7.4" cy="9.2" r="0.7" fill="currentColor" />
    <circle cx="12.6" cy="9.2" r="0.7" fill="currentColor" />
  </svg>
);
const YouTubeGlyphIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" style={{ width: 16, height: 16 }}>
    <rect x="3.25" y="5.75" width="13.5" height="8.5" rx="2.8" stroke="currentColor" strokeWidth="1.35" />
    <path d="M9 8.35L11.95 10L9 11.65V8.35Z" fill="currentColor" />
  </svg>
);

const getPackItemPrimaryUrl = (task) => (
  task?.primaryUrl
  || task?.videoUrl
  || task?.mapUrl
  || task?.redirectUrl
  || extractPrimaryUrl(task?.text || '')
  || ''
);

const getPackItemSourceMeta = (task, labels) => {
  const cardType = normalizeCardType(task?.cardType);
  const primaryUrl = getPackItemPrimaryUrl(task);
  const subtitle = deriveTaskDisplaySubtitle(task, labels) || 'Item';

  let host = '';
  let domain = '';
  try {
    if (primaryUrl) {
      const parsed = new URL(primaryUrl.startsWith('http') ? primaryUrl : `https://${primaryUrl}`);
      host = parsed.hostname.toLowerCase();
      domain = host.replace(/^www\./, '');
    }
  } catch {
    host = '';
    domain = '';
  }

  if (host.includes('youtube.com') || host.includes('youtu.be')) {
    return { key: 'youtube', label: 'YouTube', domain: 'youtube.com' };
  }
  if (host.includes('chatgpt.com') || host.includes('openai.com')) {
    return { key: 'gpt', label: 'ChatGPT', domain: 'chatgpt.com' };
  }
  if (host.includes('notion.so') || host.includes('notion.site')) {
    return { key: 'notion', label: 'Notion', domain: 'notion.so' };
  }
  if (host.includes('github.com')) {
    return { key: 'github', label: 'GitHub', domain: 'github.com' };
  }
  if (host.includes('spotify.com') || host.includes('spoti.fi')) {
    return { key: 'spotify', label: 'Spotify', domain: 'spotify.com' };
  }
  if (host.includes('instagram.com')) {
    return { key: 'link', label: 'Instagram', domain: 'instagram.com' };
  }
  if (host.includes('twitter.com') || host.includes('x.com')) {
    return { key: 'link', label: 'X (Twitter)', domain: 'x.com' };
  }
  if (host.includes('tiktok.com')) {
    return { key: 'video', label: 'TikTok', domain: 'tiktok.com' };
  }
  if (host.includes('reddit.com')) {
    return { key: 'link', label: 'Reddit', domain: 'reddit.com' };
  }
  if (domain) {
    // generic website — use favicon
    return { key: 'link', label: domain, domain };
  }

  switch (cardType) {
    case 'photo':
      return { key: 'photo', label: labels?.photo || 'Photo', domain: null };
    case 'video':
      return { key: 'video', label: subtitle, domain: null };
    case 'document':
      return { key: 'document', label: subtitle, domain: null };
    case 'ai_tool':
      return { key: 'gpt', label: subtitle, domain: null };
    case 'text':
      return { key: 'text', label: subtitle, domain: null };
    default:
      return { key: 'link', label: subtitle, domain: null };
  }
};
const PACK_EXPORT_SECTION_ORDER = [
  { role: 'Context', heading: 'Context' },
  { role: 'Code', heading: 'Tech' },
  { role: 'Notes', heading: 'Notes' },
  { role: 'Reference', heading: 'Reference' },
];
const PACK_FILTER_ORDER = ['All', 'Context', 'Code', 'Notes', 'Reference'];
const getPackRoleHeading = (role) => PACK_EXPORT_SECTION_ORDER.find((entry) => entry.role === role)?.heading || role;
const getPackFilterLabel = (filter) => (filter === 'Code' ? 'Tech' : filter);

const getPackTaskRoles = (task, labels) => {
  const q = (task?.text || '').toLowerCase();
  const title = (deriveTaskDisplayTitle(task) || '').toLowerCase();
  const sourceMeta = getPackItemSourceMeta(task, labels);
  const source = sourceMeta.key.toLowerCase();
  const sourceLabel = String(sourceMeta.label || '').toLowerCase();
  const sourceDomain = String(sourceMeta.domain || '').toLowerCase();
  const tags = Array.isArray(task?.tags) ? task.tags.map((tag) => String(tag).toLowerCase()) : [];
  const cardType = normalizeCardType(task?.cardType);
  const roles = [];

  if (
    ['gpt'].includes(source)
    || q.includes('chat.openai.com')
    || q.includes('chatgpt.com')
    || q.includes('gemini.google.com')
    || q.includes('claude.ai')
    || q.includes('perplexity.ai')
    || tags.some((tag) => ['context', 'prompt', 'ai'].includes(tag))
    || ['context', 'background', 'summary', 'description', 'prompt'].some((keyword) => q.includes(keyword) || title.includes(keyword))
  ) {
    roles.push('Context');
  }

  if (
    ['github'].includes(source)
    || sourceLabel.includes('github')
    || sourceDomain.includes('github.com')
    || q.includes('github.com')
    || title.includes('github')
    || q.includes('```')
    || tags.some((tag) => ['code', 'dev', 'api', 'technical'].includes(tag))
    || ['code', 'dev', 'api', 'implementation', 'technical'].some((keyword) => q.includes(keyword) || title.includes(keyword))
  ) {
    roles.push('Code');
  }

  if (
    cardType === CARD_TYPES.TEXT
    || tags.some((tag) => ['note', 'memo', 'reminder', 'thoughts'].includes(tag))
  ) {
    if (!roles.includes('Code') && !roles.includes('Context')) {
      roles.push('Notes');
    }
  }

  if (['link', 'video', 'shopping', 'social', 'financial', 'location', 'document', 'meeting', 'music', 'podcast', 'photo'].includes(cardType)) {
    if (!roles.includes('Code') && !roles.includes('Context')) {
      roles.push('Reference');
    }
  }

  if (roles.length === 0) {
    if (cardType === CARD_TYPES.LINK) roles.push('Reference');
    else roles.push('Notes');
  }

  return roles;
};

const getPrimaryPackTaskRole = (task, labels) => {
  const roles = getPackTaskRoles(task, labels);
  return PACK_EXPORT_SECTION_ORDER.find(({ role }) => roles.includes(role))?.role || null;
};

const getPackTasksByRole = (tasks, labels, role) => (
  tasks.filter((task) => getPrimaryPackTaskRole(task, labels) === role)
);

const sanitizePackFilename = (value) => {
  const normalized = String(value || '')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return normalized || 'untitled-pack';
};

const getPackExportBodyText = (task) => {
  const title = deriveTaskDisplayTitle(task).trim();
  const primaryUrl = getPackItemPrimaryUrl(task).trim();
  const candidates = [
    task?.content,
    task?.body,
    task?.previewText,
    task?.preview,
    task?.description,
    task?.summary,
    task?.note,
    task?.text,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    if (title && trimmed === title) continue;
    if (primaryUrl && trimmed === primaryUrl) continue;
    return trimmed;
  }

  return '';
};

const isCodeLikeContent = (value) => {
  const text = String(value || '').trim();
  if (!text) return false;
  if (text.includes('```')) return false;
  if (/[{};]/.test(text) && /\b(const|let|var|function|return|import|export|class|if|else|await|async)\b/.test(text)) return true;
  if (/<[A-Za-z][\s\S]*>/.test(text)) return true;
  if (/^\s{2,}\S/m.test(text)) return true;
  if (/=>/.test(text)) return true;
  return false;
};
const shouldIncludePackExportUrl = (value) => /^(https?:\/\/|www\.)/i.test(String(value || '').trim());
const isBundleExportableUploadedAsset = (task) => (
  Boolean(task?.uploadedFileStorageKey)
  && ['pdf', 'word', 'image'].includes(String(task?.uploadedFileType || '').toLowerCase())
);
const isDataUrl = (value) => /^data:/i.test(String(value || '').trim());
const dataUrlToBlob = async (value) => {
  const response = await fetch(value);
  return response.blob();
};
const sanitizeAssetFilename = (value, fallback = 'file') => {
  const trimmed = String(value || '').trim();
  const extensionMatch = /\.([a-z0-9]+)$/i.exec(trimmed);
  const extension = extensionMatch ? `.${extensionMatch[1].toLowerCase()}` : '';
  const baseName = (extension ? trimmed.slice(0, -extension.length) : trimmed) || fallback;
  const sanitizedBase = baseName
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || fallback;
  const sanitizedExtension = extension.replace(/[^.a-z0-9]+/gi, '').toLowerCase();
  return `${sanitizedBase}${sanitizedExtension}`.toLowerCase();
};
const ensureUniqueAssetFilename = (fileName, usedNames) => {
  const extensionMatch = /(\.[a-z0-9]+)$/i.exec(fileName);
  const extension = extensionMatch ? extensionMatch[1] : '';
  const baseName = extension ? fileName.slice(0, -extension.length) : fileName;
  let candidate = fileName;
  let suffix = 2;
  while (usedNames.has(candidate)) {
    candidate = `${baseName}-${suffix}${extension}`;
    suffix += 1;
  }
  usedNames.add(candidate);
  return candidate;
};
const collectPackAssets = async (tasks) => {
  const usedNames = new Set();
  const assetPathByStorageKey = new Map();
  const assetPathByTaskId = new Map();
  const assets = [];

  for (const task of tasks) {
    if (isBundleExportableUploadedAsset(task)) {
      const storageKey = task.uploadedFileStorageKey;
      if (assetPathByStorageKey.has(storageKey)) {
        assetPathByTaskId.set(task.id, assetPathByStorageKey.get(storageKey));
        continue;
      }

      try {
        const record = await getUploadedFileRecord(storageKey);
        if (!record?.blob) continue;

        const safeName = ensureUniqueAssetFilename(
          sanitizeAssetFilename(
            task.uploadedOriginalFileName
            || record.originalFileName
            || `${deriveTaskDisplayTitle(task) || 'file'}`
          ),
          usedNames,
        );
        const relativePath = `assets/${safeName}`;
        assetPathByStorageKey.set(storageKey, relativePath);
        assetPathByTaskId.set(task.id, relativePath);
        assets.push({
          storageKey,
          path: relativePath,
          blob: record.blob,
        });
      } catch (error) {
        console.error('Failed to collect uploaded asset for export bundle:', error);
      }
      continue;
    }

    if (normalizeCardType(task?.cardType) !== CARD_TYPES.PHOTO) continue;

    const photoReference = task?.photoDataUrl || task?.photoUrl || '';
    if (!isDataUrl(photoReference)) continue;

    try {
      const blob = await dataUrlToBlob(photoReference);
      const mimeType = blob.type || task?.photoMimeType || 'image/png';
      const extension = mimeType.includes('jpeg') ? '.jpg' : mimeType.includes('webp') ? '.webp' : '.png';
      const safeName = ensureUniqueAssetFilename(
        sanitizeAssetFilename(
          task?.photoFileName || `${deriveTaskDisplayTitle(task) || 'image'}${extension}`
        ),
        usedNames,
      );
      const relativePath = `assets/${safeName}`;
      assetPathByTaskId.set(task.id, relativePath);
      assets.push({
        storageKey: null,
        path: relativePath,
        blob,
      });
    } catch (error) {
      console.error('Failed to collect legacy photo asset for export bundle:', error);
    }
  }

  return {
    assets,
    assetPathByStorageKey,
    assetPathByTaskId,
  };
};

const buildPackExportItemMarkdown = (task, labels, role, options = {}) => {
  const title = deriveTaskDisplayTitle(task).trim() || task?.text?.trim() || 'Untitled item';
  const sourceMeta = getPackItemSourceMeta(task, labels);
  const primaryUrl = getPackItemPrimaryUrl(task).trim();
  const bodyText = getPackExportBodyText(task);
  const cardType = normalizeCardType(task?.cardType);
  const isPhotoCard = cardType === CARD_TYPES.PHOTO;
  const assetReferencePath = (
    (task?.uploadedFileStorageKey
      ? options.assetPathByStorageKey?.get(task.uploadedFileStorageKey)
      : null)
    || options.assetPathByTaskId?.get(task?.id)
    || null
  );
  const lines = [`### ${title}`];

  if (sourceMeta?.label) {
    lines.push('');
    lines.push(`Source: ${sourceMeta.label}`);
  }

  if (assetReferencePath && !isPhotoCard) {
    lines.push(`File: ${assetReferencePath}`);
  }

  if (shouldIncludePackExportUrl(primaryUrl)) {
    lines.push(`URL: ${primaryUrl}`);
  }

  if (bodyText) {
    lines.push('');
    if (role === 'Code' && isCodeLikeContent(bodyText)) {
      lines.push('```');
      lines.push(bodyText);
      lines.push('```');
    } else {
      lines.push(bodyText);
    }
  }

  return lines.join('\n');
};

const buildPackSectionMarkdown = (tasks, labels, role, heading, options = {}) => {
  const sectionTasks = getPackTasksByRole(tasks, labels, role);
  if (!sectionTasks.length) return '';

  const lines = [`## ${heading}`, ''];
  sectionTasks.forEach((task, index) => {
    lines.push(buildPackExportItemMarkdown(task, labels, role, options));
    if (index < sectionTasks.length - 1) {
      lines.push('');
    }
    lines.push('');
  });

  return `${lines.join('\n').trim()}\n`;
};

const buildPackExportHeaderLines = (tasks, title) => {
  const updatedLabel = getPackMetadataTextFromItems(tasks);
  const tags = getDesktopGroupDisplayTags(tasks);
  const activeDuration = getPackActiveDurationFromTasks(tasks);
  const activeDurationLabel = getPackActiveLabel(activeDuration);
  const lines = [`# ${title}`, ''];

  lines.push(`- Updated: ${updatedLabel || 'Not available'}`);
  if (tags.length) {
    lines.push(`- Tags: ${tags.join(', ')}`);
  }
  if (activeDuration?.activeDurationType) {
    lines.push(`- Active duration: ${activeDurationLabel}`);
  }

  return lines;
};

const buildRoleMarkdown = (tasks, labels, role) => {
  const roleConfig = PACK_EXPORT_SECTION_ORDER.find((entry) => entry.role === role);
  if (!roleConfig) return '';

  const sectionTasks = getPackTasksByRole(tasks, labels, role);
  if (!sectionTasks.length) return '';

  const packTitle = getDesktopGroupDisplayName(tasks) || 'Untitled pack';
  const lines = buildPackExportHeaderLines(tasks, `${packTitle} — ${roleConfig.heading}`);
  lines.push('');
  lines.push(`## ${roleConfig.heading}`);
  lines.push('');

  sectionTasks.forEach((task, index) => {
    lines.push(buildPackExportItemMarkdown(task, labels, role));
    if (index < sectionTasks.length - 1) {
      lines.push('');
    }
    lines.push('');
  });

  return `${lines.join('\n').trim()}\n`;
};

const buildCopyForAIText = (tasks, labels, exportType) => {
  const packTitle = getDesktopGroupDisplayName(tasks) || 'Untitled pack';

  if (exportType === 'all') {
    const sectionBlocks = PACK_EXPORT_SECTION_ORDER
      .map(({ role, heading }) => buildPackSectionMarkdown(tasks, labels, role, heading))
      .filter(Boolean);

    if (!sectionBlocks.length) return '';

    return [
      'Here is the context for my current task.',
      '',
      `# ${packTitle}`,
      '',
      sectionBlocks.join('\n'),
      '',
      'Please use the information above to help me with the next step.',
    ].join('\n').trim();
  }

  const roleMap = {
    context: 'Context',
    code: 'Code',
    notes: 'Notes',
    reference: 'Reference',
  };
  const role = roleMap[exportType];
  const heading = getPackRoleHeading(role);
  if (!role || !heading) return '';

  const sectionBlock = buildPackSectionMarkdown(tasks, labels, role, heading);
  if (!sectionBlock) return '';

  return [
    `Here is the ${heading.toLowerCase()} for my current task.`,
    '',
    `# ${packTitle} — ${heading}`,
    '',
    sectionBlock.trim(),
    '',
    'Please use the information above to help me.',
  ].join('\n').trim();
};

const buildWholePackMarkdown = (tasks, labels, options = {}) => {
  const packTitle = getDesktopGroupDisplayName(tasks) || 'Untitled pack';
  const sectionMap = new Map(PACK_EXPORT_SECTION_ORDER.map(({ role }) => [role, []]));

  tasks.forEach((task) => {
    const role = getPrimaryPackTaskRole(task, labels);
    if (!role || !sectionMap.has(role)) return;
    sectionMap.get(role).push(task);
  });

  const lines = buildPackExportHeaderLines(tasks, packTitle);

  PACK_EXPORT_SECTION_ORDER.forEach(({ role, heading }) => {
    const sectionTasks = sectionMap.get(role) || [];
    if (!sectionTasks.length) return;
    lines.push('');
    lines.push(`## ${heading}`);
    lines.push('');
    sectionTasks.forEach((task, index) => {
      lines.push(buildPackExportItemMarkdown(task, labels, role, options));
      if (index < sectionTasks.length - 1) {
        lines.push('');
      }
      lines.push('');
    });
    while (lines[lines.length - 1] === '') {
      if (lines[lines.length - 2]?.startsWith('## ')) break;
      lines.pop();
    }
  });

  return `${lines.join('\n').trim()}\n`;
};
const downloadBlob = (filename, blob) => {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
};

const downloadMarkdown = (filename, markdown) => {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  downloadBlob(filename, blob);
};

const copyTextToClipboard = async (text) => {
  await navigator.clipboard.writeText(text);
};

const FALLBACK_TYPE_ICONS = {
  photo: <img src="/photo.svg" alt="" width={16} height={16} style={{ objectFit: 'contain' }} />,
  text: <DocumentTextIcon />,
  document: <DocumentTextIcon />,
  video: <VideoGlyphIcon />,
  link: <LinkGlobeIcon />,
  gpt: <SparkRosetteIcon />,
};

const PackItemSourceIcon = ({ task, appearance, labels }) => {
  const [imgError, setImgError] = useState(false);
  const { cfg } = getTaskCardPresentation(task, labels || {});
  const { sourceKey, domain } = getPackItemSourceMeta(task, labels || {});
  const iconBackground = appearance === 'dark' ? cfg.darkBg : cfg.bg;
  const iconBorder = appearance === 'dark' ? `1px solid ${cfg.darkStroke}` : 'none';
  const photoPreview = task?.photoDataUrl || task?.photoUrl;

  if (normalizeCardType(task?.cardType) === CARD_TYPES.PHOTO && photoPreview) {
    return (
        <span className="desktop-pack-page-item-leading desktop-pack-page-item-leading-photo-preview" aria-hidden="true">
          <img
            src={photoPreview}
            alt=""
            width={36}
            height={36}
            draggable={false}
            onDragStart={(event) => event.preventDefault()}
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }}
          />
        </span>
    );
  }

  if (domain && !imgError) {
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    return (
      <span className="desktop-pack-page-item-leading desktop-pack-page-item-leading-favicon" aria-hidden="true">
        <img
          src={faviconUrl}
          alt=""
          width={22}
          height={22}
          style={{ borderRadius: 4, objectFit: 'contain' }}
          onError={() => setImgError(true)}
        />
      </span>
    );
  }

  return (
    <span
      className={`desktop-pack-page-item-leading desktop-pack-page-item-leading-${sourceKey || 'link'}`}
      aria-hidden="true"
      style={{ background: iconBackground, border: iconBorder }}
    >
      {appearance === 'dark' && cfg.darkIconColor ? (
        <span
          style={{
            width: 18,
            height: 18,
            backgroundColor: cfg.darkIconColor,
            maskImage: `url(${cfg.icon})`,
            WebkitMaskImage: `url(${cfg.icon})`,
            maskSize: 'contain',
            WebkitMaskSize: 'contain',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
            maskPosition: 'center',
            WebkitMaskPosition: 'center',
          }}
        />
      ) : (
        <img src={cfg.icon} alt="" width={18} height={18} style={{ objectFit: 'contain' }} />
      )}
    </span>
  );
};

const ZoomChevronIcon = ({ open = false, color = 'currentColor' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" fill="none" style={{ width: 12, height: 12, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.18s ease' }}>
    <path d="M3 4.5L6 7.5L9 4.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

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
          <button type="button" className="desktop-zoom-menu-item" onClick={() => onZoomPresetSelect(2)}>
            <span>Zoom to 200%</span>
          </button>
        </div>
      </div>
    ) : null}
  </div>
);

const TaskCardFaviconIcon = ({ task, appearance, cfg, faviconUrl: propFaviconUrl }) => {
  const [imgError, setImgError] = useState(false);
  const { domain } = getPackItemSourceMeta(task, {});
  const iconBackground = appearance === 'dark' ? cfg.darkBg : cfg.bg;
  const iconBorder = appearance === 'dark' ? `1px solid ${cfg.darkStroke}` : 'none';
  const photoPreview = task?.photoDataUrl || task?.photoUrl;

  if (normalizeCardType(task?.cardType) === CARD_TYPES.PHOTO && photoPreview) {
    return (
        <div style={{ width: 32, height: 32, borderRadius: 8, overflow: 'hidden', background: '#f3f3f3', border: iconBorder, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <img
            src={photoPreview}
            alt=""
            width={32}
            height={32}
            draggable={false}
            onDragStart={(event) => event.preventDefault()}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
    );
  }

  const faviconUrl = propFaviconUrl || (domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : null);

  if (faviconUrl && !imgError) {
    return (
      <div style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        background: appearance === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.9)',
        border: appearance === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <img
          src={faviconUrl}
          alt=""
          width={18}
          height={18}
          style={{ borderRadius: 3, objectFit: 'contain' }}
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  // Fallback: existing card-type icon
  return (
    <div style={{ width: 32, height: 32, borderRadius: 8, background: iconBackground, border: iconBorder, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {appearance === 'dark' && cfg.darkIconColor ? (
        <div style={{
          width: 18,
          height: 18,
          backgroundColor: cfg.darkIconColor,
          maskImage: `url(${cfg.icon})`,
          WebkitMaskImage: `url(${cfg.icon})`,
          maskSize: 'contain',
          WebkitMaskSize: 'contain',
          maskRepeat: 'no-repeat',
          WebkitMaskRepeat: 'no-repeat',
          maskPosition: 'center',
          WebkitMaskPosition: 'center',
        }} />
      ) : (
        <img src={cfg.icon} alt="" width={18} height={18} style={{ objectFit: 'contain' }} />
      )}
    </div>
  );
};

const TaskCardContent = ({ task, appearance, labels }) => {
  const { cfg, displayTitle, displaySub, faviconUrl } = getTaskCardPresentation(task, labels);
  const isPhotoCard = normalizeCardType(task?.cardType) === CARD_TYPES.PHOTO;
  const photoPreview = task?.photoDataUrl || task?.photoUrl;

  // Resolve the best available content title
  const contentTitle = (() => {
    const fetched = task.photoTitle || task.linkTitle || task.videoTitle || task.musicTitle || task.mapTitle;
    if (fetched && fetched.trim()) return fetched.trim();
    return displayTitle; // already derived (may be slug, URL slug, or platform name)
  })();

  // Source label: e.g. "ChatGPT", "YouTube", "youtube.com"
  const { label: sourceLabel } = getPackItemSourceMeta(task, labels || {});

  // Only show subtitle if it adds different info from the title
  const subtitle = sourceLabel && sourceLabel.toLowerCase() !== contentTitle.toLowerCase()
    ? sourceLabel
    : displaySub;

  if (isPhotoCard && photoPreview) {
    return (
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div
          style={{
            width: '100%',
            height: 162,
            borderRadius: 12,
            overflow: 'hidden',
            background: appearance === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(17,17,17,0.04)',
            border: appearance === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(17,17,17,0.06)',
            flexShrink: 0,
          }}
        >
            <img
              src={photoPreview}
              alt={contentTitle || 'Photo'}
              draggable={false}
              onDragStart={(event) => event.preventDefault()}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
        </div>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden', wordBreak: 'break-word', color: 'var(--desktop-card-title)', fontSize: 13, fontWeight: 590, lineHeight: '18px' }}>
            {contentTitle}
          </div>
          <div style={{ color: 'var(--desktop-card-desc)', fontSize: 11, fontWeight: 400, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {subtitle}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <TaskCardFaviconIcon task={task} appearance={appearance} cfg={cfg} faviconUrl={faviconUrl} />
      <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden', wordBreak: 'break-word', color: 'var(--desktop-card-title)', fontSize: 13, fontWeight: 590, lineHeight: '20px' }}>
          {contentTitle}
        </div>
        <div style={{ color: 'var(--desktop-card-desc)', fontSize: 11, fontWeight: 400, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {subtitle}
        </div>
      </div>
    </>
  );
};

const TaskCard = (props) => {
  const {
    task,
    appearance,
    onClick,
    onEdit,
    onDelete,
    onPointerDown,
    onPointerMove,
    onPointerUp,
      onPointerCancel,
      isDragging,
      isSelected,
      editLabel,
      deleteLabel,
    } = props;
  const taskCardLabels = props?.labels;

  const isPast = task.dateString < dateKey(getLogicalToday());
  const isPhotoCard = normalizeCardType(task?.cardType) === CARD_TYPES.PHOTO;

  return (
      <div id={`desktop-task-wrapper-${task.id}`} className={`desktop-task-wrapper ${isDragging ? 'is-dragging' : ''} ${isSelected ? 'is-selected' : ''} ${isPast ? 'is-past' : ''}`}>
      <button
        id={`desktop-task-card-${task.id}`}
        type="button"
        className={`desktop-task-card ${isDragging ? 'is-dragging' : ''}`}
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onDragStart={(event) => event.preventDefault()}
        style={{
          width: '100%',
          minHeight: isPhotoCard ? DESKTOP_PHOTO_CARD_HEIGHT : 76,
          borderRadius: 11,
          border: '2px solid var(--desktop-task-border)',
          background: 'var(--desktop-task-bg)',
          padding: isPhotoCard ? '10px' : '12px 14px',
          display: 'flex',
          flexDirection: isPhotoCard ? 'column' : 'row',
          alignItems: isPhotoCard ? 'stretch' : 'center',
          gap: 12,
          boxShadow: 'var(--desktop-task-shadow)',
          cursor: isDragging ? 'grabbing' : 'pointer',
          textAlign: 'left',
          opacity: 1,
          transition: 'none',
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        <TaskCardContent
          task={task}
          appearance={appearance}
          labels={taskCardLabels}
          onDragStart={(e) => e.preventDefault()}
        />
      </button>
      <div className="desktop-task-actions">
        <button
          type="button"
          className="desktop-task-action-button desktop-task-edit-button"
          aria-label={editLabel}
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onEdit?.(task);
          }}
        >
          <PenLine size={14} strokeWidth={2.2} />
        </button>
        <button
          type="button"
          className="desktop-task-action-button desktop-task-delete-button"
          aria-label={deleteLabel}
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onDelete?.(task);
          }}
        >
          <Trash2 size={14} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
};

const GroupedTaskCard = ({
  tasks,
  appearance,
  labels,
  isDragging,
  isGroupDragActive,
  isSelected,
  isGroupReady,
  draggedTaskId,
  onOpenItem,
  onOpenFullView,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}) => {
  const leadTask = tasks[0];
  const [isExpanded, setIsExpanded] = useState(false);
  const groupTitle = getDesktopGroupDisplayName(tasks);
  const groupMetadataText = getPackMetadataTextFromItems(tasks);
  const groupChips = getDesktopGroupDisplayTags(tasks);
  const groupIcon = getDesktopGroupIcon(tasks);
  const groupTask = {
    ...leadTask,
    groupTaskIds: tasks.map((task) => task.id),
    groupSize: tasks.length,
    desktopGroupName: groupTitle,
    updatedAt: leadTask.updatedAt,
    isGroupInitiator: true,
  };

  // If we are dragging a single item out of this group, hide it from the group preview
  const isDraggingGroup = isDragging && isGroupDragActive;
  const filteredTasks = tasks.filter((t) => isDraggingGroup || t.id !== draggedTaskId);
  const collapsedVisibleCount = Math.min(filteredTasks.length, DESKTOP_GROUP_CARD_VISIBLE_ITEMS);
  const expandedVisibleCount = Math.min(filteredTasks.length, DESKTOP_GROUP_CARD_EXPANDED_VISIBLE_ITEMS);
  const visibleItemCount = isExpanded ? expandedVisibleCount : collapsedVisibleCount;
  const hiddenTaskCount = Math.max(0, filteredTasks.length - collapsedVisibleCount);
  const groupCardMinHeight = getDesktopGroupCardHeight(filteredTasks.length, visibleItemCount);
  const groupListMaxHeight = (visibleItemCount * DESKTOP_GROUP_CARD_ITEM_HEIGHT) + (Math.max(0, visibleItemCount - 1) * 6);
  const canScrollExpandedList = isExpanded && filteredTasks.length > expandedVisibleCount;

  return (
      <div id={`desktop-task-wrapper-${leadTask.id}`} className={`desktop-task-wrapper desktop-task-group-wrapper ${isDragging ? 'is-dragging' : ''} ${isSelected ? 'is-selected' : ''}`}>
        <div
          id={`desktop-group-card-${leadTask.id}`}
          className={`desktop-task-card desktop-task-group-card ${isDragging ? 'is-dragging' : ''} ${isExpanded ? 'is-expanded' : ''}`}
          onPointerDown={(event) => onPointerDown(groupTask, event)}
          onPointerMove={(event) => onPointerMove(groupTask, event)}
          onPointerUp={(event) => onPointerUp(groupTask, event)}
          onPointerCancel={(event) => onPointerCancel(groupTask, event)}
          onMouseLeave={() => setIsExpanded(false)}
          style={{ width: '100%', minHeight: groupCardMinHeight, touchAction: 'none', userSelect: 'none' }}
        >
          <button
            type="button"
            className="desktop-task-group-summary-button"
            aria-label="Open full view"
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => {
              event.stopPropagation();
              onPointerDown?.(groupTask, event);
            }}
            onClick={(event) => {
              event.stopPropagation();
              onOpenFullView?.(event);
            }}
          >
            <div className="desktop-task-group-header">
              <div className="desktop-task-group-title-wrap">
                {groupIcon ? (
                  <span className="desktop-task-group-title-icon">{groupIcon}</span>
                ) : (
                  <span className="desktop-task-group-title-dot" />
                )}
                <div className="desktop-task-group-title-block">
                  <span
                    className="desktop-task-group-title"
                    onDragStart={(e) => e.preventDefault()}
                    style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                  >
                    {groupTitle}
                  </span>
                  {groupMetadataText ? (
                    <span
                      className="desktop-task-group-metadata"
                      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                    >
                      {groupMetadataText}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="desktop-task-group-header-actions">
                <span className="desktop-task-group-open-icon" aria-hidden="true">
                  <OpenFullViewIcon />
                </span>
              </div>
            </div>
            {groupChips.length > 0 ? (
              <div className="desktop-task-group-chip-row">
                {groupChips.map((chip) => (
                  <span key={chip} className="desktop-task-group-chip">{chip}</span>
                ))}
              </div>
            ) : null}
          </button>
          <div className="desktop-task-group-divider" />
        <div
          className="desktop-task-group-list"
          style={{ maxHeight: groupListMaxHeight, overflowY: canScrollExpandedList ? 'auto' : 'hidden' }}
          onPointerDown={(event) => {
            // Only trigger if clicking the list container itself (empty space)
            if (event.target === event.currentTarget) {
              onPointerDown?.(groupTask, event);
            }
          }}
          onPointerMove={(event) => {
            if (event.target === event.currentTarget) {
              onPointerMove?.(groupTask, event);
            }
          }}
          onPointerUp={(event) => {
            if (event.target === event.currentTarget) {
              onPointerUp?.(groupTask, event);
            }
          }}
          onPointerCancel={(event) => {
            if (event.target === event.currentTarget) {
              onPointerCancel?.(groupTask, event);
            }
          }}
        >
          {filteredTasks.map((task) => {
            const isTaskDragging = draggedTaskId === task.id && !isDraggingGroup;
            return (
              <div id={`desktop-task-wrapper-${task.id}`} key={task.id} style={{ display: 'block', width: '100%', visibility: isTaskDragging ? 'hidden' : 'visible' }}>
                <button
                  id={`desktop-task-card-${task.id}`}
                  type="button"
                  className="desktop-task-group-row"
                  onMouseDown={(event) => event.stopPropagation()}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    onPointerDown?.(task, event);
                  }}
                  onPointerMove={(event) => {
                    event.stopPropagation();
                    onPointerMove?.(task, event);
                  }}
                  onPointerUp={(event) => {
                    event.stopPropagation();
                    onPointerUp?.(task, event);
                  }}
                  onPointerCancel={(event) => {
                    onPointerCancel?.(task, event);
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenItem?.(task);
                  }}
                >
                  <TaskCardContent task={task} appearance={appearance} labels={labels} />
                </button>
              </div>
            );
          })}
        </div>
        {hiddenTaskCount > 0 && (
          <button
            type="button"
            className="desktop-task-group-more-label"
            onMouseEnter={() => setIsExpanded(true)}
            onFocus={() => setIsExpanded(true)}
            onBlur={() => setIsExpanded(false)}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.preventDefault()}
          >
            + {hiddenTaskCount} more
          </button>
        )}
      </div>
    </div>
  );
};

const DesktopPackPageHeader = ({
  tasks,
  onUpdateGroup,
  appearance,
  language,
  isSelectMode = false,
  selectedCount = 0,
  onEnterSelectMode,
  onExitSelectMode,
  onDeleteSelected,
}) => {
  const groupTitle = getDesktopGroupDisplayName(tasks);
  const groupIcon = getDesktopGroupIcon(tasks);
  const groupTags = getDesktopGroupDisplayTags(tasks);
  const packActiveDuration = getPackActiveDurationFromTasks(tasks);
  const activeDurationLabel = getPackActiveLabel(packActiveDuration);
  const activeDurationBaseDate = getPackActiveBaseDateFromTasks(tasks);
  const updatedLabel = getPackMetadataTextFromItems(tasks);
  const metadataParts = [
    `${tasks.length} ${tasks.length === 1 ? 'item' : 'items'}`,
    updatedLabel,
  ].filter(Boolean);
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [isTagInputOpen, setIsTagInputOpen] = useState(false);
  const [isDurationMenuOpen, setIsDurationMenuOpen] = useState(false);
  const [draftCustomUntil, setDraftCustomUntil] = useState(packActiveDuration.activeUntil || activeDurationBaseDate);
  const [draftTag, setDraftTag] = useState('');

  useEffect(() => {
    setDraftCustomUntil(packActiveDuration.activeUntil || activeDurationBaseDate);
  }, [activeDurationBaseDate, packActiveDuration.activeUntil]);

  const commitTitle = useCallback(() => {
    const nextTitle = draftTitle.trim();
    setIsTitleEditing(false);
    if (!nextTitle || nextTitle === groupTitle) return;
    onUpdateGroup({ desktopGroupName: nextTitle });
  }, [draftTitle, groupTitle, onUpdateGroup]);

  const handleTitleKeyDown = useCallback((event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitTitle();
    }
    if (event.key === 'Escape') {
      setDraftTitle(groupTitle);
      setIsTitleEditing(false);
    }
  }, [commitTitle, groupTitle]);

  const handleTagSubmit = useCallback(() => {
    const nextTag = draftTag.trim();
    if (!nextTag) {
      setDraftTag('');
      setIsTagInputOpen(false);
      return;
    }

    const nextTags = normalizePackTags([...groupTags, nextTag]);
    onUpdateGroup({ desktopGroupTags: nextTags });
    setDraftTag('');
    setIsTagInputOpen(false);
  }, [draftTag, groupTags, onUpdateGroup]);

  const applyDuration = useCallback((nextType, customUntil = null) => {
    onUpdateGroup(createPackActiveDurationFields(nextType, {
      activeFrom: activeDurationBaseDate,
      activeUntil: customUntil,
    }));
    setIsDurationMenuOpen(false);
  }, [activeDurationBaseDate, onUpdateGroup]);

  return (
    <div className="desktop-pack-page-header">
      <div className="desktop-pack-page-header-body">
        <div className="desktop-pack-page-header-tools">
          {groupIcon ? (
            <button
              type="button"
              className="desktop-pack-page-icon"
              onClick={() => setIsIconPickerOpen((current) => !current)}
              aria-label="Change icon"
            >
              {groupIcon}
            </button>
          ) : (
            <button
              type="button"
              className="desktop-pack-page-inline-action"
              onClick={() => setIsIconPickerOpen((current) => !current)}
            >
              Add icon
            </button>
          )}
          {!groupTags.length && !isTagInputOpen ? (
            <button
              type="button"
              className="desktop-pack-page-inline-action"
              onClick={() => setIsTagInputOpen(true)}
            >
              Add tag
            </button>
          ) : null}
        </div>

        {isIconPickerOpen ? (
          <div className="desktop-pack-page-icon-picker" style={{ padding: 0, border: 'none', background: 'transparent', boxShadow: 'none', zIndex: 9999 }}>
            <EmojiPicker
              theme={appearance === 'dark' ? 'dark' : 'light'}
              onEmojiClick={(emojiData) => {
                onUpdateGroup({ desktopGroupIcon: emojiData.emoji });
                setIsIconPickerOpen(false);
              }}
              skinTonesDisabled
              autoFocusSearch={false}
              width={320}
              height={400}
            />
            {groupIcon ? (
              <button
                type="button"
                className="desktop-pack-page-inline-action is-inline"
                style={{
                  marginTop: 8,
                  width: '100%',
                  justifyContent: 'center',
                  background: 'var(--desktop-cancel-bg)',
                  padding: '8px',
                  borderRadius: 8,
                }}
                onClick={() => {
                  onUpdateGroup({ desktopGroupIcon: null });
                  setIsIconPickerOpen(false);
                }}
              >
                Remove icon
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="desktop-pack-page-title-area">
          {isTitleEditing ? (
            <input
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              onBlur={commitTitle}
              onKeyDown={handleTitleKeyDown}
              className="desktop-pack-page-title-input"
              autoFocus
            />
          ) : (
            <button
              type="button"
              id="desktop-group-full-view-title"
              className="desktop-pack-page-title"
              onClick={() => {
                setDraftTitle(groupTitle);
                setIsTitleEditing(true);
              }}
            >
              {groupTitle}
            </button>
          )}
          <div className="desktop-pack-page-metadata">
            {metadataParts.join(' / ')}
          </div>
        </div>

        <div className="desktop-pack-page-tags">
          {groupTags.map((tag) => (
            <span key={tag} className="desktop-pack-page-tag">
              <span>{tag}</span>
              <button
                type="button"
                className="desktop-pack-page-tag-remove"
                onClick={() => onUpdateGroup({
                  desktopGroupTags: groupTags.filter((currentTag) => currentTag !== tag),
                })}
                aria-label={`Remove ${tag}`}
              >
                x
              </button>
            </span>
          ))}
          {isTagInputOpen ? (
            <input
              value={draftTag}
              onChange={(event) => setDraftTag(event.target.value)}
              onBlur={handleTagSubmit}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleTagSubmit();
                }
                if (event.key === 'Escape') {
                  setDraftTag('');
                  setIsTagInputOpen(false);
                }
              }}
              className="desktop-pack-page-tag-input"
              placeholder="Add tag"
              autoFocus
            />
          ) : (
            <button
              type="button"
              className="desktop-pack-page-inline-action is-inline"
              onClick={() => setIsTagInputOpen(true)}
            >
              Add tag
            </button>
          )}
          <span className="desktop-pack-page-property-divider" aria-hidden="true" />
          <div className="desktop-pack-page-property-control">
            <button
              type="button"
              className={`desktop-pack-page-inline-action is-inline desktop-pack-page-duration-trigger ${packActiveDuration.activeDurationType ? 'has-value' : ''}`}
              onClick={() => setIsDurationMenuOpen((current) => !current)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
                <path d="M12 7.8v4.6l3.2 1.9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{activeDurationLabel}</span>
              <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {isDurationMenuOpen ? (
              <div className="desktop-pack-page-duration-menu">
                {PACK_ACTIVE_DURATION_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`desktop-pack-page-duration-option ${packActiveDuration.activeDurationType === option.value ? 'is-active' : ''}`}
                    onClick={() => {
                      if (option.value === 'custom') {
                        return;
                      }
                      applyDuration(option.value);
                    }}
                  >
                    <span>{option.label}</span>
                  </button>
                ))}
                <div className="desktop-pack-page-duration-custom-row">
                  <input
                    type="date"
                    value={draftCustomUntil || activeDurationBaseDate}
                    min={activeDurationBaseDate}
                    className="desktop-pack-page-duration-date-input"
                    onChange={(event) => setDraftCustomUntil(event.target.value)}
                  />
                  <button
                    type="button"
                    className="desktop-pack-page-duration-apply"
                    onClick={() => applyDuration('custom', draftCustomUntil || activeDurationBaseDate)}
                  >
                    Apply
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {isSelectMode ? (
        <div className="desktop-pack-page-selection-bar">
          <button
            type="button"
            className="desktop-pack-page-selection-action"
            onClick={onExitSelectMode}
          >
            Cancel
          </button>
          <div className="desktop-pack-page-selection-count">
            {selectedCount} selected
          </div>
          <button
            type="button"
            className="desktop-pack-page-selection-delete"
            onClick={onDeleteSelected}
            disabled={selectedCount === 0}
          >
            Delete selected
          </button>
        </div>
      ) : null}
    </div>
  );
};


const DesktopGroupFullViewModal = ({
  view,
  appearance,
  labels,
  language,
  onClose,
  onTaskOpen,
  onTaskEdit,
  onDeleteTasks,
  onUpdateGroup,
  onToast,
}) => {
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [highlightedTaskId, setHighlightedTaskId] = useState(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isBackdropVisible, setIsBackdropVisible] = useState(false);
  const [isContentVisible, setIsContentVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isAtSourcePosition, setIsAtSourcePosition] = useState(false);
  const [flipSnapshot, setFlipSnapshot] = useState(null);
  const [hasOriginTransition, setHasOriginTransition] = useState(false);
  const exportMenuRef = useRef(null);
  const shellRef = useRef(null);
  const openContentTimerRef = useRef(null);
  const closeTimerRef = useRef(null);
  
  const tasks = view?.tasks || [];
  const open = Boolean(view);

  useEffect(() => {
    if (!open) {
      setItemSearchQuery('');
      setActiveFilter('All');
      setIsSearchVisible(false);
      setIsExportMenuOpen(false);
      setHighlightedTaskId(null);
      setIsSelectMode(false);
      setSelectedItemIds([]);
      setIsDeleteConfirmOpen(false);
      setIsBackdropVisible(false);
      setIsContentVisible(false);
      setIsClosing(false);
      setIsAtSourcePosition(false);
      setFlipSnapshot(null);
      setHasOriginTransition(false);
    }
  }, [open]);

  useEffect(() => () => {
    if (openContentTimerRef.current) window.clearTimeout(openContentTimerRef.current);
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
  }, []);

  useLayoutEffect(() => {
    if (!open || !view?.groupId || !shellRef.current) return;

    if (openContentTimerRef.current) window.clearTimeout(openContentTimerRef.current);
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);

    const finalRect = shellRef.current.getBoundingClientRect();
    const originRect = view.originRect;

    setIsClosing(false);

    if (!originRect || !finalRect.width || !finalRect.height) {
      setFlipSnapshot(null);
      setHasOriginTransition(false);
      setIsAtSourcePosition(false);
      setIsBackdropVisible(true);
      setIsContentVisible(true);
      return;
    }

    const scaleX = Math.max(0.36, originRect.width / finalRect.width);
    const scaleY = Math.max(0.22, originRect.height / finalRect.height);
    const translateX = (originRect.left + (originRect.width / 2)) - (finalRect.left + (finalRect.width / 2));
    const translateY = (originRect.top + (originRect.height / 2)) - (finalRect.top + (finalRect.height / 2));

    setFlipSnapshot({
      translateX,
      translateY,
      scaleX,
      scaleY,
    });
    setHasOriginTransition(true);
    setIsAtSourcePosition(true);
    setIsBackdropVisible(false);
    setIsContentVisible(false);

    window.requestAnimationFrame(() => {
      setIsBackdropVisible(true);
      setIsAtSourcePosition(false);
      openContentTimerRef.current = window.setTimeout(() => {
        setIsContentVisible(true);
      }, 110);
    });
  }, [open, view?.groupId]);

  useEffect(() => {
    const existingIds = new Set(tasks.map((task) => task.id));
    setSelectedItemIds((current) => current.filter((taskId) => existingIds.has(taskId)));
  }, [tasks]);

  useEffect(() => {
    if (!open || !isExportMenuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setIsExportMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsExportMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExportMenuOpen, open]);

  useEffect(() => {
    if (!open || !view?.focusTaskId) return undefined;

    const targetId = view.focusTaskId;
    setHighlightedTaskId(targetId);
    const scrollTimer = window.setTimeout(() => {
      const node = document.getElementById(`desktop-pack-page-item-${targetId}`);
      node?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 60);
    const clearTimer = window.setTimeout(() => {
      setHighlightedTaskId((current) => (current === targetId ? null : current));
    }, 2200);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [open, view?.focusTaskId]);
  
  const filteredTasks = useMemo(() => {
    let list = [...tasks];

    // Filter by role
    if (activeFilter !== 'All') {
      list = list.filter(task => {
        const roles = getPackTaskRoles(task, labels);
        return roles.includes(activeFilter);
      });
    }

    // Search filter
    if (itemSearchQuery.trim()) {
      const sq = itemSearchQuery.toLowerCase();
      list = list.filter(task => {
        const { displayTitle, displaySub } = getTaskCardPresentation(task, labels);
        const { domain } = getPackItemSourceMeta(task, labels);
        return (
          (displayTitle || '').toLowerCase().includes(sq) ||
          (displaySub || '').toLowerCase().includes(sq) ||
          (task.text || '').toLowerCase().includes(sq) ||
          (domain || '').toLowerCase().includes(sq) ||
          (task.tags || []).some(t => t.toLowerCase().includes(sq))
        );
      });
    }
    
    return list;
  }, [tasks, itemSearchQuery, activeFilter, labels]);

  if (!open || !tasks?.length) return null;

  const filters = PACK_FILTER_ORDER;
  const isDark = appearance === 'dark';
  const selectedCount = selectedItemIds.length;
  const toggleSelectItem = (taskId) => {
    setSelectedItemIds((current) => (
      current.includes(taskId)
        ? current.filter((id) => id !== taskId)
        : [...current, taskId]
    ));
  };
  const enterSelectMode = () => {
    setIsSearchVisible(false);
    setIsExportMenuOpen(false);
    setIsSelectMode(true);
    setSelectedItemIds([]);
    setIsDeleteConfirmOpen(false);
  };
  const exitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedItemIds([]);
    setIsDeleteConfirmOpen(false);
  };
  const handleDeleteSelected = () => {
    if (selectedCount === 0) return;
    setIsDeleteConfirmOpen(true);
  };
  const confirmDeleteSelected = () => {
    if (selectedCount === 0) {
      setIsDeleteConfirmOpen(false);
      return;
    }
    onDeleteTasks?.(selectedItemIds);
    setIsDeleteConfirmOpen(false);
    setSelectedItemIds([]);
    setIsSelectMode(false);
  };
  const handleExportWholePack = () => {
    const markdown = buildWholePackMarkdown(tasks, labels);
    const filename = `${sanitizePackFilename(getDesktopGroupDisplayName(tasks))}.md`;
    downloadMarkdown(filename, markdown);
    setIsExportMenuOpen(false);
  };
  const handleExportPackBundle = async () => {
    try {
      const { assets, assetPathByStorageKey, assetPathByTaskId } = await collectPackAssets(tasks);
      const markdown = buildWholePackMarkdown(tasks, labels, { assetPathByStorageKey, assetPathByTaskId });
      const zip = new JSZip();
      zip.file('context.md', markdown);
      assets.forEach((asset) => {
        zip.file(asset.path, asset.blob);
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const packSlug = sanitizePackFilename(getDesktopGroupDisplayName(tasks));
      const filename = packSlug === 'untitled-pack' ? 'untitled-pack.zip' : `${packSlug}-pack.zip`;
      downloadBlob(filename, zipBlob);
    } catch (error) {
      console.error('Failed to export pack bundle:', error);
      onToast?.('Unable to export pack bundle');
    }
    setIsExportMenuOpen(false);
  };
  const handleCopyWholePackForAi = async () => {
    const text = buildCopyForAIText(tasks, labels, 'all');
    if (!text) {
      onToast?.('No pack content to copy');
      setIsExportMenuOpen(false);
      return;
    }
    try {
      await copyTextToClipboard(text);
      onToast?.('Copied whole pack for AI');
    } catch (_) {
      onToast?.('Unable to copy whole pack');
    }
    setIsExportMenuOpen(false);
  };
  const handleCopyRoleForAi = async (role, exportType) => {
    const text = buildCopyForAIText(tasks, labels, exportType);
    const roleHeading = getPackRoleHeading(role);
    if (!text) {
      onToast?.(`No ${roleHeading} items to copy`);
      setIsExportMenuOpen(false);
      return;
    }
    try {
      await copyTextToClipboard(text);
      onToast?.(`Copied ${roleHeading} for AI`);
    } catch (_) {
      onToast?.(`Unable to copy ${roleHeading}`);
    }
    setIsExportMenuOpen(false);
  };
  const handleExportByRole = (role) => {
    const markdown = buildRoleMarkdown(tasks, labels, role);
    const roleHeading = getPackRoleHeading(role);
    const roleSlug = roleHeading.toLowerCase();
    if (!markdown) {
      onToast?.(`No ${roleHeading} items to export`);
      setIsExportMenuOpen(false);
      return;
    }
    const filename = `${sanitizePackFilename(getDesktopGroupDisplayName(tasks))}-${roleSlug}.md`;
    downloadMarkdown(filename, markdown);
    setIsExportMenuOpen(false);
  };
  const handleExportMenuAction = (action) => {
    if (action === 'copy-for-ai') {
      handleCopyWholePackForAi();
      return;
    }
    if (action === 'copy-context') {
      handleCopyRoleForAi('Context', 'context');
      return;
    }
    if (action === 'copy-code') {
      handleCopyRoleForAi('Code', 'code');
      return;
    }
    if (action === 'copy-notes') {
      handleCopyRoleForAi('Notes', 'notes');
      return;
    }
    if (action === 'copy-reference') {
      handleCopyRoleForAi('Reference', 'reference');
      return;
    }
    if (action === 'whole-pack') {
      handleExportWholePack();
      return;
    }
    if (action === 'pack-bundle') {
      void handleExportPackBundle();
      return;
    }
    if (action === 'context') {
      handleExportByRole('Context');
      return;
    }
    if (action === 'code') {
      handleExportByRole('Code');
      return;
    }
    if (action === 'notes') {
      handleExportByRole('Notes');
      return;
    }
    if (action === 'reference') {
      handleExportByRole('Reference');
      return;
    }
    setIsExportMenuOpen(false);
  };
  const exportMenuOptions = (() => {
    switch (activeFilter) {
      case 'Context':
        return [
          { id: 'copy-context', label: 'Copy for AI' },
          { id: 'context', label: 'Export Context' },
        ];
      case 'Code':
        return [
          { id: 'copy-code', label: 'Copy for AI' },
          { id: 'code', label: 'Export Tech' },
        ];
      case 'Notes':
        return [
          { id: 'copy-notes', label: 'Copy for AI' },
          { id: 'notes', label: 'Export Notes' },
        ];
      case 'Reference':
        return [
          { id: 'copy-reference', label: 'Copy for AI' },
          { id: 'reference', label: 'Export Reference' },
        ];
      case 'All':
      default:
        return [
          { id: 'copy-for-ai', label: 'Copy for AI' },
          { id: 'whole-pack', label: 'Export whole pack' },
          { id: 'pack-bundle', label: 'Export Pack Bundle (.zip)' },
        ];
    }
  })();

  const handleRequestClose = () => {
    if (isClosing) return;

    if (openContentTimerRef.current) window.clearTimeout(openContentTimerRef.current);
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);

    setIsExportMenuOpen(false);
    setIsDeleteConfirmOpen(false);
    setIsContentVisible(false);
    setIsBackdropVisible(false);
    setIsClosing(true);

    closeTimerRef.current = window.setTimeout(() => {
      onClose?.();
    }, view?.originRect ? 260 : 180);
  };

  const shellMotionStyle = flipSnapshot ? {
    '--desktop-pack-flip-x': `${flipSnapshot.translateX}px`,
    '--desktop-pack-flip-y': `${flipSnapshot.translateY}px`,
    '--desktop-pack-flip-scale-x': `${flipSnapshot.scaleX}`,
    '--desktop-pack-flip-scale-y': `${flipSnapshot.scaleY}`,
  } : undefined;

  return (
    <div
      role="presentation"
      onClick={handleRequestClose}
      className="desktop-pack-page-modal"
    >
      <div className={`desktop-pack-page-backdrop ${isBackdropVisible ? 'is-visible' : ''}`} />
      <div
        ref={shellRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="desktop-group-full-view-title"
        onClick={(event) => event.stopPropagation()}
        className={`desktop-pack-page-shell ${isDark ? 'is-dark' : ''} ${hasOriginTransition ? 'has-origin-transition' : ''} ${isAtSourcePosition ? 'is-from-card' : ''} ${isClosing ? 'is-closing' : ''}`}
        style={shellMotionStyle}
      >
        <div className={`desktop-pack-page-shell-inner ${isContentVisible ? 'is-visible' : ''}`}>
        <div className="desktop-pack-page-topbar">
          <button
            type="button"
            onClick={handleRequestClose}
            aria-label={labels.close}
            className="desktop-pack-page-close"
          >
            <CloseIcon />
          </button>
        </div>

        <DesktopPackPageHeader
          tasks={tasks}
          onUpdateGroup={onUpdateGroup}
          appearance={appearance}
          language={language}
          isSelectMode={isSelectMode}
          selectedCount={selectedCount}
          onEnterSelectMode={enterSelectMode}
          onExitSelectMode={exitSelectMode}
          onDeleteSelected={handleDeleteSelected}
        />

        <div className="desktop-pack-page-content">
          <div className="desktop-pack-page-controls">
            <div className="desktop-pack-page-controls-bar">
              <div className="desktop-pack-page-filters" role="tablist" aria-label="Pack filters">
                {filters.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    className={`desktop-pack-page-filter-btn ${activeFilter === filter ? 'is-active' : ''}`}
                    onClick={() => {
                      setActiveFilter(filter);
                      setIsSearchVisible(false);
                      setIsExportMenuOpen(false);
                    }}
                  >
                    {getPackFilterLabel(filter)}
                  </button>
                ))}
              </div>
              <div className={`desktop-pack-page-control-actions ${isSelectMode ? 'is-select-mode' : ''}`}>
                {isSelectMode ? (
                  <button
                    type="button"
                    className="desktop-pack-page-toolbar-action desktop-pack-page-toolbar-text-action is-active"
                    onClick={exitSelectMode}
                  >
                    <PackSelectIcon />
                    <span>Select</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className={`desktop-pack-page-toolbar-action desktop-pack-page-search-toggle ${isSearchVisible ? 'is-active' : ''}`}
                      onClick={() => {
                        setIsSearchVisible((current) => !current);
                        setIsExportMenuOpen(false);
                      }}
                      aria-label="Search items"
                      aria-expanded={isSearchVisible}
                    >
                      <SearchIcon />
                    </button>
                    <span className="desktop-pack-page-toolbar-divider" aria-hidden="true" />
                    <button
                      type="button"
                      className="desktop-pack-page-toolbar-action desktop-pack-page-toolbar-text-action"
                      onClick={enterSelectMode}
                    >
                      <PackSelectIcon />
                      <span>Select</span>
                    </button>
                    <div className="desktop-pack-page-toolbar-menu-anchor" ref={exportMenuRef}>
                      <button
                        type="button"
                        className={`desktop-pack-page-toolbar-action desktop-pack-page-toolbar-text-action ${isExportMenuOpen ? 'is-active' : ''}`}
                        aria-haspopup="menu"
                        aria-expanded={isExportMenuOpen}
                        onClick={() => setIsExportMenuOpen((current) => !current)}
                      >
                        <PackExportIcon />
                        <span>Export</span>
                      </button>
                      {isExportMenuOpen ? (
                        <div className="desktop-pack-page-toolbar-menu" role="menu" aria-label="Export pack">
                          {exportMenuOptions.map(({ id, label }) => (
                            <button
                              key={id}
                              type="button"
                              role="menuitem"
                              className="desktop-pack-page-toolbar-menu-item"
                              onClick={() => handleExportMenuAction(id)}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            </div>
            {isSearchVisible && (
              <div className="desktop-pack-page-search-wrapper is-revealed">
                <SearchIcon />
                <input
                  type="text"
                  placeholder="Search in pack..."
                  value={itemSearchQuery}
                  onChange={(e) => setItemSearchQuery(e.target.value)}
                  className="desktop-pack-page-search-input"
                  autoFocus
                />
              </div>
            )}
          </div>
          
          <div className="desktop-pack-page-item-list">
            {filteredTasks.length === 0 ? (
              <div className="desktop-pack-page-empty">No items found</div>
            ) : (
              filteredTasks.map((task) => (
                <div
                  key={task.id}
                  id={`desktop-pack-page-item-${task.id}`}
                  className={`desktop-pack-page-item ${highlightedTaskId === task.id ? 'is-highlighted' : ''}`}
                >
                  {isSelectMode ? (
                    <button
                      type="button"
                      className={`desktop-pack-page-item-checkbox ${selectedItemIds.includes(task.id) ? 'is-selected' : ''}`}
                      aria-pressed={selectedItemIds.includes(task.id)}
                      aria-label={`${selectedItemIds.includes(task.id) ? 'Deselect' : 'Select'} ${task.text || 'item'}`}
                      onClick={() => toggleSelectItem(task.id)}
                    >
                      <span className="desktop-pack-page-item-checkbox-mark" aria-hidden="true">
                        {selectedItemIds.includes(task.id) ? '✓' : ''}
                      </span>
                    </button>
                  ) : null}
                  {(() => {
                    const { label } = getPackItemSourceMeta(task, labels);
                    const { displayTitle } = getTaskCardPresentation(task, labels);
                    return (
                      <>
                        <PackItemSourceIcon task={task} appearance={appearance} labels={labels} />
                        <button
                          type="button"
                          onClick={() => {
                            if (isSelectMode) {
                              toggleSelectItem(task.id);
                              return;
                            }
                            onTaskOpen(task);
                          }}
                          className="desktop-pack-page-item-main"
                        >
                          <div className="desktop-pack-page-item-title">
                            {displayTitle || task.text || 'Untitled item'}
                          </div>
                          <div className="desktop-pack-page-item-subtitle">
                            {label}
                          </div>
                        </button>
                      </>
                    );
                  })()}
                  {!isSelectMode ? (
                    <div className="desktop-pack-page-item-actions">
                      <button
                        type="button"
                        className="desktop-pack-page-item-action"
                        aria-label={`Edit ${task.text || 'item'}`}
                        onClick={() => onTaskEdit?.(task)}
                      >
                        <EditIcon />
                      </button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
        <DesktopDeleteConfirmModal
          open={isDeleteConfirmOpen}
          title={`Delete ${selectedCount} ${selectedCount === 1 ? 'item' : 'items'} from this pack?`}
          onCancel={() => setIsDeleteConfirmOpen(false)}
          onConfirm={confirmDeleteSelected}
        />
        </div>
      </div>
    </div>
  );
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



const DesktopGroupPrompt = ({
  prompt,
  groupName,
  setGroupName,
  onConfirm,
  onCancel,
}) => {
  if (!prompt) return null;

  const panelWidth = 320;
  const left = Math.min(
    Math.max(24, prompt.anchorX - (panelWidth / 2)),
    window.innerWidth - panelWidth - 24,
  );
  const top = Math.min(
    Math.max(96, prompt.anchorY + 18),
    window.innerHeight - 220,
  );

  return (
    <div
      role="presentation"
      onClick={onCancel}
      className="desktop-group-prompt-backdrop"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="desktop-group-prompt-title"
        onClick={(event) => event.stopPropagation()}
        className="desktop-group-prompt-panel"
        style={{
          left,
          top,
          width: 360,
        }}
      >
        <div className="desktop-group-prompt-eyebrow">
          <span className="desktop-group-prompt-eyebrow-icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" style={{ width: 14, height: 14 }}>
              <path d="M6.167 5.5H4.833a2.333 2.333 0 0 0 0 4.667h1.334M9.833 5.5h1.334a2.333 2.333 0 0 1 0 4.667H9.833M5.667 8h4.666" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span>Merge into group</span>
        </div>
        <input
          type="text"
          value={groupName}
          onChange={(event) => setGroupName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onConfirm();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              onCancel();
            }
          }}
          autoFocus
          placeholder="Group title"
          className="desktop-group-prompt-input"
        />
        <div className="desktop-group-prompt-actions">
          <button
            type="button"
            onClick={onCancel}
            className="desktop-group-prompt-secondary"
          >
            Keep separate
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="desktop-group-prompt-primary"
          >
            Group items <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const DragDayFeedbackOverlay = ({
  direction,
  previousLabel,
  nextLabel,
  zones,
  isConfirming,
}) => (
  <div className={`desktop-drag-day-feedback ${direction ? 'is-visible' : ''} ${isConfirming ? 'is-confirming' : ''}`} aria-hidden="true">
    <div
      className={`desktop-drag-day-feedback-edge desktop-drag-day-feedback-edge-previous ${direction === 'previous' ? 'is-active' : ''}`}
      style={zones ? { width: Math.max(0, zones.previousEnd - zones.previousStart) } : undefined}
    >
      <div className="desktop-drag-day-feedback-chip">
        <span className="desktop-drag-day-feedback-arrow desktop-drag-day-feedback-arrow-previous">{'←'}</span>
        <span className="desktop-drag-day-feedback-label">{previousLabel}</span>
      </div>
    </div>
    <div
      className={`desktop-drag-day-feedback-edge desktop-drag-day-feedback-edge-next ${direction === 'next' ? 'is-active' : ''}`}
      style={zones ? { width: Math.max(0, zones.nextEnd - zones.nextStart) } : undefined}
    >
      <div className="desktop-drag-day-feedback-chip">
        <span className="desktop-drag-day-feedback-label">{nextLabel}</span>
        <span className="desktop-drag-day-feedback-arrow desktop-drag-day-feedback-arrow-next">{'→'}</span>
      </div>
    </div>
  </div>
);

const DragDayFeedbackOverlayV2 = ({
  direction,
  previousLabel,
  nextLabel,
  zones,
  isConfirming,
}) => {
  const renderEdge = (edgeDirection, label, arrow, width) => {
    const isActive = direction === edgeDirection;
    const stateClass = isActive ? (isConfirming ? 'is-armed' : 'is-preview') : '';

    return (
      <div
        className={`desktop-drag-day-feedback-edge desktop-drag-day-feedback-edge-${edgeDirection} ${isActive ? 'is-active' : ''} ${stateClass}`}
        style={typeof width === 'number' ? { width } : undefined}
      >
        <div className="desktop-drag-day-feedback-chip">
          {edgeDirection === 'previous' ? (
            <span className="desktop-drag-day-feedback-arrow desktop-drag-day-feedback-arrow-previous">{'<'}</span>
          ) : null}
          <div className="desktop-drag-day-feedback-copy">
            <span className="desktop-drag-day-feedback-label">{label}</span>
            {isActive ? (
              <span className="desktop-drag-day-feedback-hint">
                {isConfirming ? 'Ready to switch' : 'Hold or drag further'}
              </span>
            ) : null}
          </div>
          {edgeDirection === 'next' ? (
            <span className="desktop-drag-day-feedback-arrow desktop-drag-day-feedback-arrow-next">{'>'}</span>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className={`desktop-drag-day-feedback ${direction ? 'is-visible' : ''} ${isConfirming ? 'is-confirming' : ''}`} aria-hidden="true">
      {renderEdge('previous', previousLabel, '<', zones ? Math.max(0, zones.previousEnd - zones.previousStart) : undefined)}
      {renderEdge('next', nextLabel, '>', zones ? Math.max(0, zones.nextEnd - zones.nextStart) : undefined)}
    </div>
  );
};

const ScheduleSection = ({
  section,
  appearance,
  language,
  labels,
  renderSlots,
  markerStyle,
  onTaskClick,
  onTaskEdit,
  onTaskDelete,
  onTaskPointerDown,
  onTaskPointerMove,
  onTaskPointerUp,
  onTaskPointerCancel,
  draggedTaskId,
  isDragOver,
}) => {
  const pillStyle = getDesktopSectionPillStyle(section, appearance);
  const t = getTranslationsForLanguage(language);
  const desktopRowCount = Math.max(2, Math.ceil(renderSlots.length / 2));
  const timelineColumnMinHeight = (desktopRowCount * DESKTOP_SLOT_MIN_HEIGHT) + ((desktopRowCount - 1) * DESKTOP_SLOT_GAP);

  return (
    <section style={{ borderBottom: '1px solid var(--desktop-divider)', background: 'var(--desktop-section-bg)' }}>
      <div style={{ width: 'min(1008px, calc(100% - 72px))', margin: '0 auto', padding: '22px 0 24px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 72, padding: '6px 14px', borderRadius: 999, fontFamily: 'DM Serif Display, serif', fontSize: 14, fontStyle: 'italic', ...pillStyle }}>{t[section.labelKey]}</span>
        <div style={{ display: 'grid', gridTemplateColumns: '110px minmax(0, 1fr)', gap: 24, marginTop: 18, alignItems: 'stretch' }}>
          <div style={{ position: 'relative', minHeight: timelineColumnMinHeight, height: '100%' }}>
            <div style={{ color: 'var(--desktop-root-text)', fontSize: 15, fontWeight: 500 }}>{section.start}</div>
            <div style={{ position: 'absolute', left: 5, top: DESKTOP_TIME_AXIS_LINE_TOP, bottom: DESKTOP_TIME_AXIS_LINE_BOTTOM, width: 1, background: 'var(--desktop-time-axis-line)' }} />
            {markerStyle ? <div style={{ position: 'absolute', left: 2, width: DESKTOP_TIME_MARKER_SIZE, height: DESKTOP_TIME_MARKER_SIZE, borderRadius: '50%', background: 'var(--desktop-accent)', ...markerStyle }} /> : null}
            <div style={{ position: 'absolute', left: 0, bottom: 0, color: 'var(--desktop-root-text)', fontSize: 15, fontWeight: 500 }}>{section.end}</div>
          </div>
          <div
            data-desktop-block-id={section.mobileId}
            className={`desktop-schedule-task-grid ${isDragOver ? 'is-drag-over' : ''}`}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(260px, 1fr))', gap: DESKTOP_SLOT_GAP, alignItems: 'stretch' }}
          >
            {renderSlots.map((item, slotIndex) => (
              <div
                key={`${section.mobileId}-${slotIndex}`}
                data-desktop-slot-id={`${section.mobileId}-${slotIndex}`}
                data-desktop-slot-section={section.mobileId}
                data-desktop-slot-index={slotIndex}
                className="desktop-schedule-slot"
              >
                {item.type === 'task' ? (
                  <div data-desktop-layout-id={`task-${item.task.id}`}>
                <TaskCard
                  task={item.task}
                  appearance={appearance}
                  labels={labels}
                  isDragging={draggedTaskId === item.task.id}
                      onClick={(event) => onTaskClick(item.task, event)}
                  onEdit={() => onTaskEdit(item.task)}
                  onDelete={() => onTaskDelete(item.task)}
                      onPointerDown={(event) => onTaskPointerDown(item.task, event)}
                      onPointerMove={(event) => onTaskPointerMove(item.task, event)}
                      onPointerUp={(event) => onTaskPointerUp(item.task, event)}
                      onPointerCancel={(event) => onTaskPointerCancel(item.task, event)}
                      editLabel={labels.edit}
                      deleteLabel={labels.delete}
                    />
                  </div>
                ) : item.type === 'placeholder' ? (
                  <div data-desktop-layout-id="desktop-drag-placeholder" className="desktop-drag-placeholder" aria-hidden="true" />
                ) : (
                  <div className="desktop-empty-slot" aria-hidden="true" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const DailyTaskList = ({
  entries,
  canvasHeight,
  appearance,
  labels,
  onTaskClick,
  onGroupOpenFullView,
  onTaskEdit,
  onTaskDelete,
  onTaskPointerDown,
  onTaskPointerMove,
  onTaskPointerUp,
  onTaskPointerCancel,
  draggedTaskId,
  isGroupDragActive,
  selectedTaskIds,
  selectionRect,
  dragOverlapTargetId,
  layoutWidth = DESKTOP_MAIN_CONTENT_MAX_WIDTH,
}) => (
  <div style={{ width: layoutWidth, minHeight: canvasHeight, height: canvasHeight, margin: '0 auto', position: 'relative' }}>
    {entries.length > 0 ? (
      entries.map((entry) => {
        const dragTask = entry.type === 'group'
          ? { ...entry.task, groupTaskIds: entry.tasks.map((task) => task.id), groupSize: entry.tasks.length }
          : entry.task;
        const isGroupReady = dragOverlapTargetId === dragTask.id;
        const isDragging = entry.type === 'group'
          ? (draggedTaskId === dragTask.id && isGroupDragActive) // Only hide whole card if lead task (group drag) is active
          : (draggedTaskId === entry.task.id && !isGroupDragActive);
        return (
        <div key={entry.type === 'group' ? `group-${entry.id}` : entry.task.id} id={`desktop-canvas-entry-${dragTask.id}`} data-desktop-layout-id={`task-${dragTask.id}`} className="desktop-canvas-card-node" style={{ left: entry.x, top: entry.y, width: DESKTOP_CANVAS_CARD_WIDTH }}>
          <div className={`desktop-canvas-card-shell ${isGroupReady ? 'desktop-canvas-card-shell--group-ready' : ''} ${isDragging ? 'is-dragging' : ''}`}>
            {entry.type === 'group' ? (
                <GroupedTaskCard
                  tasks={entry.tasks}
                  appearance={appearance}
                  labels={labels}
                  isDragging={isDragging}
                  isGroupDragActive={isGroupDragActive}
                  isSelected={entry.tasks.every((task) => selectedTaskIds.includes(task.id))}
                  isGroupReady={isGroupReady}
                  draggedTaskId={draggedTaskId}
                  onOpenItem={onTaskClick}
                onOpenFullView={(event) => onGroupOpenFullView(entry.tasks, event)}
                onPointerDown={onTaskPointerDown}
                onPointerMove={onTaskPointerMove}
                onPointerUp={onTaskPointerUp}
                onPointerCancel={onTaskPointerCancel}
              />
            ) : (
                <TaskCard
                  task={entry.task}
                  appearance={appearance}
                  labels={labels}
                  isDragging={isDragging}
                  isSelected={selectedTaskIds.includes(entry.task.id)}
                  isGroupReady={isGroupReady}
                  draggedTaskId={draggedTaskId}
                  onClick={(event) => onTaskClick(entry.task, event)}
                  onEdit={() => onTaskEdit(entry.task)}
                  onDelete={() => onTaskDelete(entry.task)}
                  onPointerDown={(event) => onTaskPointerDown(entry.task, event)}
                  onPointerMove={(event) => onTaskPointerMove(entry.task, event)}
                  onPointerUp={(event) => onTaskPointerUp(entry.task, event)}
                  onPointerCancel={(event) => onTaskPointerCancel(entry.task, event)}
                  editLabel={labels.edit}
                  deleteLabel={labels.delete}
                />
            )}
          </div>
        </div>
      )})
    ) : (
      <div
        aria-hidden="true"
        style={{
          minHeight: 220,
          borderRadius: 28,
          border: appearance === 'dark' ? 'none' : '1px dashed var(--desktop-divider)',
          background: appearance === 'dark' ? 'transparent' : 'var(--desktop-section-bg)',
        }}
        />
      )}
      {selectionRect ? (
        <div
          className="desktop-canvas-selection-rect"
          aria-hidden="true"
          style={{
            left: selectionRect.x,
            top: selectionRect.y,
            width: selectionRect.width,
            height: selectionRect.height,
          }}
        />
      ) : null}
    </div>
  );

const InlineMiniCalendar = ({
  language,
  selectedDate,
  minDate,
  maxDate,
  onSelectDate,
}) => {
  const [calendarOffset, setCalendarOffset] = useState(0);
  const locale = getLocaleForLanguage(language);
  const calendarMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + calendarOffset, 1);
  const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const monthLabel = monthStart.toLocaleDateString(locale, { month: 'short', year: 'numeric' });
  const startOffset = monthStart.getDay();
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const trailingCells = Math.max(0, 42 - startOffset - daysInMonth);
  const desktopCalendarCellSize = 32;
  const desktopCalendarGap = 6;
  const calendarWeekdayLabels = getCalendarWeekdayLabels(language);
  const normalizedMinDate = minDate ? new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate()) : null;
  const normalizedMaxDate = maxDate ? new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate()) : null;
  const isAtMinMonth = normalizedMinDate
    ? monthStart.getFullYear() === normalizedMinDate.getFullYear() && monthStart.getMonth() === normalizedMinDate.getMonth()
    : false;
  const isAtMaxMonth = normalizedMaxDate
    ? monthStart.getFullYear() === normalizedMaxDate.getFullYear() && monthStart.getMonth() === normalizedMaxDate.getMonth()
    : false;

  return (
    <div style={{ width: 'fit-content', maxWidth: '100%', marginBottom: 16, padding: '4px 0 8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button
          type="button"
          disabled={isAtMinMonth}
          onClick={() => setCalendarOffset((prev) => prev - 1)}
          style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'var(--desktop-panel-close-bg)', color: isAtMinMonth ? 'var(--desktop-muted-subtle)' : 'var(--desktop-root-text)', cursor: isAtMinMonth ? 'default' : 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {'<'}
        </button>
        <span style={{ fontFamily: 'DM Serif Display, serif', fontSize: 18, fontStyle: 'italic' }}>{monthLabel}</span>
        <button
          type="button"
          disabled={isAtMaxMonth}
          onClick={() => setCalendarOffset((prev) => prev + 1)}
          style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'var(--desktop-panel-close-bg)', color: isAtMaxMonth ? 'var(--desktop-muted-subtle)' : 'var(--desktop-root-text)', cursor: isAtMaxMonth ? 'default' : 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {'>'}
        </button>
      </div>
      <div style={{ display: 'grid', width: 'fit-content', maxWidth: '100%', gridTemplateColumns: `repeat(7, ${desktopCalendarCellSize}px)`, gap: desktopCalendarGap }}>
        {calendarWeekdayLabels.map((label, index) => (
          <div key={`${label}-${index}`} style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--desktop-muted-subtle)' }}>{label}</div>
        ))}
        {Array.from({ length: startOffset }).map((_, index) => <div key={`empty-${index}`} />)}
        {Array.from({ length: daysInMonth }).map((_, index) => {
          const day = index + 1;
          const cellDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
          const inRange = (!normalizedMinDate || cellDate >= normalizedMinDate) && (!normalizedMaxDate || cellDate <= normalizedMaxDate);
          const currentSelectedDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
          const selected = sameDay(cellDate, currentSelectedDate);
          const today = sameDay(cellDate, getLogicalToday());

          return (
            <button
              key={day}
              type="button"
              disabled={!inRange}
              onClick={() => {
                if (!inRange) return;
                onSelectDate(cellDate);
              }}
              style={{
                width: desktopCalendarCellSize,
                aspectRatio: '1 / 1',
                borderRadius: '50%',
                border: today && !selected ? '1px solid var(--desktop-accent)' : 'none',
                background: selected ? 'var(--desktop-active-date-bg)' : 'transparent',
                color: selected ? '#fff' : today ? 'var(--desktop-accent)' : inRange ? 'var(--desktop-root-text)' : 'var(--desktop-disabled-text)',
                fontSize: 14,
                fontWeight: selected || today ? 700 : 500,
                cursor: inRange ? 'pointer' : 'default',
              }}
            >
              {day}
            </button>
          );
        })}
        {Array.from({ length: trailingCells }).map((_, index) => <div key={`trail-${index}`} />)}
      </div>
    </div>
  );
};

const AddPanel = ({
  open,
  language,
  inputText,
  setInputText,
  fileAttachments,
  onAddFiles,
  onRemoveFile,
  onClose,
  onSubmit,
}) => {
  const [mode, setMode] = useState('add');
  const [isFileDragActive, setIsFileDragActive] = useState(false);
  const [isConvertDragActive, setIsConvertDragActive] = useState(false);
  const [convertFileName, setConvertFileName] = useState('');
  const fileInputRef = useRef(null);
  const convertFileInputRef = useRef(null);
  const t = getTranslationsForLanguage(language);

  useEffect(() => {
    if (!open) {
      setMode('add');
      setIsFileDragActive(false);
      setIsConvertDragActive(false);
      setConvertFileName('');
    }
  }, [open]);

  if (!open) return null;

  const handleConvertFiles = (files) => {
    const selectedFiles = Array.from(files || []);
    const firstSupportedFile = selectedFiles.find((file) => isSupportedConvertFile(file));
    if (!firstSupportedFile) return;
    setConvertFileName(firstSupportedFile.name || 'Untitled document');
  };

  return (
    <div role="dialog" className="desktop-add-panel">
      <div className="desktop-add-panel-header">
        <div className="desktop-add-panel-segmented" role="tablist" aria-label="Panel mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'add'}
            className={`desktop-add-panel-segment ${mode === 'add' ? 'active' : ''}`}
            onClick={() => setMode('add')}
          >
            Add
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'convert'}
            className={`desktop-add-panel-segment ${mode === 'convert' ? 'active' : ''}`}
            onClick={() => setMode('convert')}
          >
            Convert
          </button>
        </div>
        <button type="button" onClick={onClose} aria-label={t.close} className="desktop-add-panel-close"><CloseIcon /></button>
      </div>
      <div className="desktop-add-panel-body">
        <div className="desktop-add-panel-mode-content">
          {mode === 'add' ? (
            <>
              <div className="desktop-add-panel-copy">
                <h2 className="desktop-add-panel-title">Add to workspace</h2>
                <p className="desktop-add-panel-support">Type a note, paste a link, or drop an image</p>
              </div>
              <div
                className={`desktop-add-panel-surface ${isFileDragActive ? 'drag-active' : ''}`}
                onDragEnter={(event) => {
                  if (!hasSupportedUploadFiles(event.dataTransfer)) return;
                  event.preventDefault();
                  setIsFileDragActive(true);
                }}
                onDragOver={(event) => {
                  if (!hasSupportedUploadFiles(event.dataTransfer)) return;
                  event.preventDefault();
                  if (event.dataTransfer) {
                    event.dataTransfer.dropEffect = 'copy';
                  }
                  if (!isFileDragActive) {
                    setIsFileDragActive(true);
                  }
                }}
                onDragLeave={(event) => {
                  if (!hasSupportedUploadFiles(event.dataTransfer)) return;
                  event.preventDefault();
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setIsFileDragActive(false);
                  }
                }}
                onDrop={(event) => {
                  if (!hasSupportedUploadFiles(event.dataTransfer)) return;
                  event.preventDefault();
                  setIsFileDragActive(false);
                  const files = Array.from(event.dataTransfer?.files || []);
                  if (files.length) {
                    onAddFiles?.(files);
                  }
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={SUPPORTED_UPLOAD_ACCEPT}
                  multiple
                  style={{ display: 'none' }}
                  onChange={(event) => {
                    const files = Array.from(event.target.files || []);
                    if (files.length) {
                      onAddFiles?.(files);
                    }
                    event.target.value = '';
                  }}
                />
                {fileAttachments.length ? (
                  <div className="desktop-add-panel-attachment-strip">
                    {fileAttachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className={`desktop-add-panel-attachment ${attachment.uploadKind === 'image' ? 'image' : 'document'}`}
                      >
                        {attachment.uploadKind === 'image' ? (
                          <img
                            src={attachment.previewUrl || attachment.photoDataUrl}
                            alt={attachment.title}
                            draggable={false}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div className="desktop-add-panel-attachment-content">
                            <div className={`desktop-add-panel-attachment-badge ${attachment.uploadKind}`}>
                              {attachment.uploadKind === 'pdf' ? 'PDF' : 'DOC'}
                            </div>
                            <div className="desktop-add-panel-attachment-copy">
                              <span className="desktop-add-panel-attachment-title">{attachment.title}</span>
                              <span className="desktop-add-panel-attachment-kind">{attachment.uploadKind}</span>
                            </div>
                          </div>
                        )}
                        <button
                          type="button"
                          aria-label={`Remove ${attachment.title}`}
                          onClick={() => onRemoveFile?.(attachment.id)}
                          className="desktop-add-panel-attachment-remove"
                        >
                          <CloseIcon />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <textarea
                  autoFocus
                  value={inputText}
                  onChange={(event) => setInputText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      onSubmit();
                    }
                  }}
                  placeholder="Start typing or drop something here..."
                  className="desktop-add-panel-textarea"
                />
                {isFileDragActive ? (
                  <div className="desktop-add-panel-drop-overlay">
                    Drop PDF, Word, or image to attach
                  </div>
                ) : null}
              </div>
              <div className="desktop-add-panel-footer">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="desktop-add-panel-files-button"
                >
                  <AttachFileIcon />
                  <span>Files</span>
                </button>
                <button type="button" onClick={onSubmit} className="desktop-add-panel-submit-button">Add</button>
              </div>
            </>
          ) : (
            <>
              <div className="desktop-add-panel-copy">
                <h2 className="desktop-add-panel-title">Convert to Markdown</h2>
                <p className="desktop-add-panel-support">Drop a PDF or DOCX file to turn it into reusable markdown</p>
              </div>
              <div
                className={`desktop-convert-panel-dropzone ${isConvertDragActive ? 'drag-active' : ''}`}
                onClick={() => convertFileInputRef.current?.click()}
                onDragEnter={(event) => {
                  if (!Array.from(event.dataTransfer?.files || []).some((file) => isSupportedConvertFile(file))) return;
                  event.preventDefault();
                  setIsConvertDragActive(true);
                }}
                onDragOver={(event) => {
                  if (!Array.from(event.dataTransfer?.files || []).some((file) => isSupportedConvertFile(file))) return;
                  event.preventDefault();
                  if (event.dataTransfer) {
                    event.dataTransfer.dropEffect = 'copy';
                  }
                  if (!isConvertDragActive) {
                    setIsConvertDragActive(true);
                  }
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setIsConvertDragActive(false);
                  }
                }}
                onDrop={(event) => {
                  const files = Array.from(event.dataTransfer?.files || []);
                  if (!files.some((file) => isSupportedConvertFile(file))) return;
                  event.preventDefault();
                  setIsConvertDragActive(false);
                  handleConvertFiles(files);
                }}
              >
                <input
                  ref={convertFileInputRef}
                  type="file"
                  accept={SUPPORTED_CONVERT_ACCEPT}
                  style={{ display: 'none' }}
                  onChange={(event) => {
                    handleConvertFiles(event.target.files || []);
                    event.target.value = '';
                  }}
                />
                <div className="desktop-convert-panel-icon-shell">
                  <ConvertUploadIcon />
                </div>
                <div className="desktop-convert-panel-drop-copy">
                  <div className="desktop-convert-panel-drop-title">
                    {convertFileName || 'Click or drag a file here'}
                  </div>
                  {convertFileName ? (
                    <div className="desktop-convert-panel-drop-subtitle">Frontend preview only</div>
                  ) : null}
                </div>
              </div>
              <div className="desktop-convert-panel-meta">
                <span>Supports PDF, DOCX</span>
                <span>Up to 10MB</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const DesktopDeleteConfirmModal = ({
  open,
  title,
  description = null,
  cancelLabel = 'Cancel',
  confirmLabel = 'Delete',
  onCancel,
  onConfirm,
}) => {
  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={onCancel}
      className="desktop-delete-confirm-backdrop"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="desktop-delete-confirm-title"
        onClick={(event) => event.stopPropagation()}
        className="desktop-delete-confirm-dialog"
      >
        <div className="desktop-delete-confirm-copy">
          <h2 id="desktop-delete-confirm-title" className="desktop-delete-confirm-title">{title}</h2>
          {description ? (
            <p className="desktop-delete-confirm-description">{description}</p>
          ) : null}
        </div>
        <div className="desktop-delete-confirm-actions">
          <button
            type="button"
            className="desktop-delete-confirm-button desktop-delete-confirm-button-secondary"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="desktop-delete-confirm-button desktop-delete-confirm-button-primary"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

const WorkspaceChevronIcon = ({ open = false }) => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path
      d={open ? 'M5 12.5 10 7.5 15 12.5' : 'M5 7.5 10 12.5 15 7.5'}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const WorkspaceMoreIcon = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <circle cx="5" cy="10" r="1.2" fill="currentColor" />
    <circle cx="10" cy="10" r="1.2" fill="currentColor" />
    <circle cx="15" cy="10" r="1.2" fill="currentColor" />
  </svg>
);

const WorkspacePlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M10 4.5v11M4.5 10h11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Track retention on Desktop app wide open
  useEffect(() => {
    if (user?.id) {
      trackUserEvent(user.id, 'app_opened', { platform: 'desktop' });
    }
  }, [user?.id]);
  const [selectedDate, setSelectedDate] = useState(() => {
    const savedDate = parseSharedSelectedDate(localStorage.getItem(SHARED_SELECTED_DATE_KEY));
    return savedDate || getLogicalToday();
  });
  const [language, setLanguage] = useState(getInitialLanguage);
  const [appearance, setAppearance] = useState(() => localStorage.getItem(DESKTOP_APPEARANCE_KEY) || 'light');
  const [workspaces, setWorkspaces] = useState(() => {
    try {
      return normalizeDesktopWorkspaces(JSON.parse(localStorage.getItem(DESKTOP_WORKSPACES_KEY) || 'null'));
    } catch (_) {
      return getDefaultDesktopWorkspaces();
    }
  });
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => localStorage.getItem(DESKTOP_ACTIVE_WORKSPACE_KEY) || DEFAULT_DESKTOP_WORKSPACE_ID);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [isWorkspaceNameEditing, setIsWorkspaceNameEditing] = useState(false);
  const [workspaceNameDraft, setWorkspaceNameDraft] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [profileOpen, setProfileOpenState] = useState(false);
  const setProfileOpen = useCallback((val) => {
    sessionStorage.setItem('shared_profile_open', String(Boolean(val)));
    setProfileOpenState(val);
  }, []);
  const [panelOpen, setPanelOpen] = useState(false);
  const [showAddPreview, setShowAddPreview] = useState(false);
  const hoverAddTimeoutRef = useRef(null);
  const [inputText, setInputText] = useState('');
  const [addPanelAttachments, setAddPanelAttachments] = useState([]);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editCopied, setEditCopied] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [isGroupDragActive, setIsGroupDragActive] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [desktopSelectionRect, setDesktopSelectionRect] = useState(null);
  const [dragOverSection, setDragOverSection] = useState(null);
  const [dragOverSlot, setDragOverSlot] = useState(null);
  const [isCanvasFileDragActive, setIsCanvasFileDragActive] = useState(false);
  const [desktopDragDayFeedback, setDesktopDragDayFeedback] = useState(null);
  const [desktopDragDayZones, setDesktopDragDayZones] = useState(null);
  const [desktopDragDayConfirming, setDesktopDragDayConfirming] = useState(false);
  const [desktopDragOverlapTargetId, setDesktopDragOverlapTargetId] = useState(null);
  const [historyOpen, setHistoryOpenState] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [pendingGroupPrompt, setPendingGroupPrompt] = useState(null);
  const [pendingGroupName, setPendingGroupName] = useState('');
  const [activeGroupView, setActiveGroupView] = useState(null);
  const [pendingCanvasDeletion, setPendingCanvasDeletion] = useState(null);
  const [workspaceActionMenuId, setWorkspaceActionMenuId] = useState(null);
  const [pendingWorkspaceDeletion, setPendingWorkspaceDeletion] = useState(null);
  const workspaceMenuRef = useRef(null);
  const workspaceNameInputRef = useRef(null);
  const setHistoryOpen = useCallback((val) => {
    sessionStorage.setItem('shared_history_open', String(Boolean(val)));
    setHistoryOpenState(val);
  }, []);
  const [tasks, setTasks] = useSyncedTodos({
    userId: user?.id || null,
    normalizeTodo: normalizeTask,
  });
  const t = useMemo(() => getTranslationsForLanguage(language), [language]);
  const userProfile = useMemo(() => getUserProfile(user), [user]);
  const currentWorkspaceTasks = useMemo(
    () => tasks.filter((task) => taskBelongsToWorkspace(task, activeWorkspaceId)),
    [activeWorkspaceId, tasks],
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
  const desktopDragCanvasStartRef = useRef(null); // canvas-space point where drag began
  const desktopDragModeRef = useRef(false);
  const desktopDragSelectedTaskIdsRef = useRef(new Set());
  const desktopDragSelectionPositionsRef = useRef(new Map());
  const desktopDragAnchorStartPositionRef = useRef(null);
  const selectedTaskIdsRef = useRef(new Set());
  const previousUploadedFileKeysRef = useRef(new Set());
  const selectedDayEntriesRef = useRef([]);
  const desktopSelectionStateRef = useRef({ pointerId: null, origin: null });
  const dragOverSectionRef = useRef(null);
  const dragOverSlotRef = useRef(null);
  const desktopDayFlipTimerRef = useRef(null);
  const desktopDayFlipDirectionRef = useRef(0);
  const desktopDayFlipCooldownUntilRef = useRef(0);
  const desktopDragDayEntryPointXRef = useRef(null);
  const desktopDragDayIsReadyRef = useRef(false);
  const desktopDragDayFeedbackRef = useRef(null);
  const desktopDragDayZonesRef = useRef(null);
  const desktopDragOverlapTargetIdRef = useRef(null);
  const suppressTaskClickRef = useRef(null);
  const suppressAllTaskClicksUntilRef = useRef(0);
  const suppressTaskClickTimeoutRef = useRef(null);
  const desktopLayoutRectsRef = useRef(new Map());
  const desktopCanvasContentRef = useRef(null);
  const viewportContainerRef = useRef(null);
  const searchDragSeparateRef = useRef(false);
  const editCopyResetTimerRef = useRef(null);
  const canvasFileDragDepthRef = useRef(0);
  const [viewport, setViewport] = useState({ panX: 0, panY: 0, zoom: DESKTOP_CANVAS_DEFAULT_ZOOM });
  const viewportRef = useRef({ panX: 0, panY: 0, zoom: DESKTOP_CANVAS_DEFAULT_ZOOM });
  const [desktopCanvasPanReady, setDesktopCanvasPanReady] = useState(false);
  const [desktopCanvasPanActive, setDesktopCanvasPanActive] = useState(false);
  const [desktopZoomMenuOpen, setDesktopZoomMenuOpen] = useState(false);
  const desktopCanvasPanStateRef = useRef({
    pointerId: null,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
  });

  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);
  useEffect(() => {
    sessionStorage.setItem('shared_profile_open', 'false');
    sessionStorage.setItem('shared_history_open', 'false');
  }, []);
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
    setSelectedTaskIds((current) => current.filter((taskId) => existingIds.has(taskId)));
  }, [currentWorkspaceTasks]);
  useEffect(() => {
    if (!workspaceMenuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (workspaceMenuRef.current && !workspaceMenuRef.current.contains(event.target)) {
        setWorkspaceMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setWorkspaceMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [workspaceMenuOpen]);
  useEffect(() => {
    if (!workspaceMenuOpen) {
      setWorkspaceActionMenuId(null);
    }
  }, [workspaceMenuOpen]);
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
    viewportRef.current = viewport;
  }, [viewport]);
  useEffect(() => {
    if (!desktopZoomMenuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!(event.target instanceof HTMLElement)) return;
      if (event.target.closest('.desktop-zoom-menu-anchor')) return;
      setDesktopZoomMenuOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setDesktopZoomMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [desktopZoomMenuOpen]);
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
    if (desktopDayFlipTimerRef.current !== null) {
      window.clearTimeout(desktopDayFlipTimerRef.current);
      desktopDayFlipTimerRef.current = null;
    }
  }, []);
  useEffect(() => {
    localStorage.setItem(SHARED_SELECTED_DATE_KEY, dateKey(selectedDate));
  }, [selectedDate]);
  useEffect(() => {
    localStorage.setItem(DESKTOP_LANGUAGE_KEY, language);
  }, [language]);
  useEffect(() => {
    localStorage.setItem(DESKTOP_APPEARANCE_KEY, appearance);
  }, [appearance]);
  useEffect(() => {
    localStorage.setItem(DESKTOP_WORKSPACES_KEY, JSON.stringify(workspaces));
  }, [workspaces]);
  useEffect(() => {
    const hasActiveWorkspace = workspaces.some((workspace) => workspace.id === activeWorkspaceId);
    if (hasActiveWorkspace) {
      localStorage.setItem(DESKTOP_ACTIVE_WORKSPACE_KEY, activeWorkspaceId);
      return;
    }
    const fallbackWorkspaceId = workspaces[0]?.id || DEFAULT_DESKTOP_WORKSPACE_ID;
    setActiveWorkspaceId(fallbackWorkspaceId);
    localStorage.setItem(DESKTOP_ACTIVE_WORKSPACE_KEY, fallbackWorkspaceId);
  }, [activeWorkspaceId, workspaces]);

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === DESKTOP_APPEARANCE_KEY && e.newValue) {
        setAppearance(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 5000);
    if (!supabase) {
      setLoading(false);
      clearTimeout(timeout);
      return undefined;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      clearTimeout(timeout);
    }).catch(() => {
      setLoading(false);
      clearTimeout(timeout);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const logicalToday = getLogicalToday();
  const todaySelected = sameDay(selectedDate, logicalToday);
  const currentBlock = currentSection(currentTime);

  const fitDesktopCanvas = useCallback(() => {
    const container = viewportContainerRef.current;
    if (!container) return;
    const vw = container.clientWidth;
    const zoom = clampDesktopCanvasScale(Math.min(vw / DESKTOP_MAIN_CONTENT_MAX_WIDTH, DESKTOP_CANVAS_DEFAULT_ZOOM));
    const nextVp = { panX: 0, panY: 0, zoom };
    viewportRef.current = nextVp;
    setViewport(nextVp);
  }, []);

  const getCanvasPointFromClient = useCallback((clientX, clientY) => {
    const container = viewportContainerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    return screenToCanvas(clientX - rect.left, clientY - rect.top, viewportRef.current);
  }, []);

  const updateDesktopSelectionFromRect = useCallback((selectionRect) => {
    const nextSelectedTaskIds = selectedDayEntriesRef.current.flatMap((entry) => {
      const entryRect = {
        x: entry.x,
        y: entry.y,
        width: DESKTOP_CANVAS_CARD_WIDTH,
        height: getDesktopCanvasEntryHeight(entry),
      };

      return doDesktopRectsIntersect(selectionRect, entryRect)
        ? getDesktopCanvasEntryTaskIds(entry)
        : [];
    });

    setSelectedTaskIds([...new Set(nextSelectedTaskIds)]);
  }, []);

  const updateDesktopCanvasZoom = useCallback((nextZoom, anchor = null) => {
    const container = viewportContainerRef.current;
    const current = viewportRef.current;
    const clampedZoom = clampDesktopCanvasScale(Number(nextZoom.toFixed(3)));
    if (!container || Math.abs(clampedZoom - current.zoom) < 0.001) return;

    const containerRect = container.getBoundingClientRect();
    const screenAnchorX = anchor ? anchor.clientX - containerRect.left : container.clientWidth / 2;
    const screenAnchorY = anchor ? anchor.clientY - containerRect.top : container.clientHeight / 2;
    const { x: canvasAnchorX, y: canvasAnchorY } = screenToCanvas(screenAnchorX, screenAnchorY, current);
    const nextPanX = screenAnchorX - canvasAnchorX * clampedZoom;
    const nextPanY = screenAnchorY - canvasAnchorY * clampedZoom;
    const nextVp = { panX: nextPanX, panY: nextPanY, zoom: clampedZoom };
    viewportRef.current = nextVp;
    setViewport(nextVp);
  }, []);

  const handleDesktopCanvasWheel = useCallback((event) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    const direction = event.deltaY > 0 ? -1 : 1;
    updateDesktopCanvasZoom(
      viewportRef.current.zoom + (direction * DESKTOP_CANVAS_SCALE_STEP),
      { clientX: event.clientX, clientY: event.clientY },
    );
  }, [updateDesktopCanvasZoom]);

  const handleDesktopCanvasPointerDown = useCallback((event) => {
    if (event.button !== 0 || isEditableElement(event.target)) return;

    if (desktopCanvasPanReady) {
      event.preventDefault();
      event.stopPropagation();

      desktopCanvasPanStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startPanX: viewportRef.current.panX,
        startPanY: viewportRef.current.panY,
      };

      event.currentTarget.setPointerCapture?.(event.pointerId);
      setDesktopCanvasPanActive(true);
      return;
    }

    if (event.target instanceof HTMLElement && event.target.closest('.desktop-task-card, .desktop-task-group-row, .desktop-task-actions, .desktop-task-action-button')) {
      return;
    }

    const origin = getCanvasPointFromClient(event.clientX, event.clientY);
    if (!origin) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    desktopSelectionStateRef.current = {
      pointerId: event.pointerId,
      origin,
    };
    setDesktopSelectionRect({ x: origin.x, y: origin.y, width: 0, height: 0 });
    setSelectedTaskIds([]);
  }, [desktopCanvasPanReady, getCanvasPointFromClient]);

  const handleDesktopCanvasPointerMove = useCallback((event) => {
    if (desktopSelectionStateRef.current.pointerId === event.pointerId) {
      const nextPoint = getCanvasPointFromClient(event.clientX, event.clientY);
      if (!nextPoint || !desktopSelectionStateRef.current.origin) return;

      const nextRect = getDesktopSelectionRect(desktopSelectionStateRef.current.origin, nextPoint);
      setDesktopSelectionRect(nextRect);
      updateDesktopSelectionFromRect(nextRect);
      return;
    }

    if (!desktopCanvasPanActive || desktopCanvasPanStateRef.current.pointerId !== event.pointerId) return;

    const dx = event.clientX - desktopCanvasPanStateRef.current.startX;
    const dy = event.clientY - desktopCanvasPanStateRef.current.startY;
    const nextPanX = desktopCanvasPanStateRef.current.startPanX + dx;
    const nextPanY = desktopCanvasPanStateRef.current.startPanY + dy;
    const nextVp = { ...viewportRef.current, panX: nextPanX, panY: nextPanY };
    viewportRef.current = nextVp;
    setViewport(nextVp);
  }, [desktopCanvasPanActive, getCanvasPointFromClient, updateDesktopSelectionFromRect]);

  const handleDesktopCanvasPointerEnd = useCallback((event) => {
    if (desktopSelectionStateRef.current.pointerId === event.pointerId) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      desktopSelectionStateRef.current = { pointerId: null, origin: null };
      setDesktopSelectionRect(null);
      return;
    }

    if (desktopCanvasPanStateRef.current.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    desktopCanvasPanStateRef.current.pointerId = null;
    setDesktopCanvasPanActive(false);
  }, []);
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (isEditableElement(event.target)) return;

      if (event.code === 'Space') {
        event.preventDefault();
        setDesktopCanvasPanReady(true);
      }

      if (event.shiftKey && event.key === '1') {
        event.preventDefault();
        fitDesktopCanvas();
        return;
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && !activeGroupView && !editingTaskId && !panelOpen) {
        if (selectedTaskIdsRef.current.size > 0) {
          event.preventDefault();
          const summary = getCanvasDeletionSummary(tasksRef.current, [...selectedTaskIdsRef.current]);
          if (summary) {
            setPendingCanvasDeletion(summary);
          }
        }
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        updateDesktopCanvasZoom(viewportRef.current.zoom + DESKTOP_CANVAS_SCALE_STEP);
      } else if (event.key === '-') {
        event.preventDefault();
        updateDesktopCanvasZoom(viewportRef.current.zoom - DESKTOP_CANVAS_SCALE_STEP);
      } else if (event.key === '0') {
        event.preventDefault();
        updateDesktopCanvasZoom(DESKTOP_CANVAS_DEFAULT_ZOOM);
      }
    };

    const handleKeyUp = (event) => {
      if (event.code === 'Space') {
        setDesktopCanvasPanReady(false);
        setDesktopCanvasPanActive(false);
        desktopCanvasPanStateRef.current.pointerId = null;
      }
    };

    const handleWindowBlur = () => {
      setDesktopCanvasPanReady(false);
      setDesktopCanvasPanActive(false);
      desktopCanvasPanStateRef.current.pointerId = null;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [activeGroupView, editingTaskId, fitDesktopCanvas, panelOpen]);
  const handleDesktopZoomPresetSelect = useCallback((preset) => {
    if (preset === 'in') {
      updateDesktopCanvasZoom(viewportRef.current.zoom + DESKTOP_CANVAS_SCALE_STEP);
    } else if (preset === 'out') {
      updateDesktopCanvasZoom(viewportRef.current.zoom - DESKTOP_CANVAS_SCALE_STEP);
    } else if (preset === 'fit') {
      fitDesktopCanvas();
    } else if (typeof preset === 'number') {
      updateDesktopCanvasZoom(preset);
    }
    setDesktopZoomMenuOpen(false);
  }, [fitDesktopCanvas, updateDesktopCanvasZoom]);

  const suppressNextTaskClick = useCallback((taskId) => {
    if (suppressTaskClickTimeoutRef.current !== null) {
      window.clearTimeout(suppressTaskClickTimeoutRef.current);
    }
    suppressAllTaskClicksUntilRef.current = Date.now() + 350;
    suppressTaskClickRef.current = taskId;
    suppressTaskClickTimeoutRef.current = window.setTimeout(() => {
      if (suppressTaskClickRef.current === taskId) {
        suppressTaskClickRef.current = null;
      }
      suppressTaskClickTimeoutRef.current = null;
    }, 250);
  }, []);

  const resetDesktopDragInteraction = useCallback(() => {
    if (desktopDayFlipTimerRef.current !== null) {
      window.clearTimeout(desktopDayFlipTimerRef.current);
      desktopDayFlipTimerRef.current = null;
    }
    desktopDayFlipDirectionRef.current = 0;
    desktopDragDayEntryPointXRef.current = null;
    desktopDragDayIsReadyRef.current = false;
    desktopDragDayFeedbackRef.current = null;
    desktopDragDayZonesRef.current = null;
    setDesktopDragDayFeedback(null);
    setDesktopDragDayZones(null);
    setDesktopDragDayConfirming(false);

    desktopDragOverlapTargetIdRef.current = null;
    setDesktopDragOverlapTargetId(null);
  }, []);

  const clearDesktopDayFlipHoldTimer = useCallback(() => {
    if (desktopDayFlipTimerRef.current !== null) {
      window.clearTimeout(desktopDayFlipTimerRef.current);
      desktopDayFlipTimerRef.current = null;
    }
  }, []);

  const setDesktopDragDayArmed = useCallback((nextValue) => {
    if (desktopDragDayIsReadyRef.current === nextValue) return;
    desktopDragDayIsReadyRef.current = nextValue;
    setDesktopDragDayConfirming(nextValue);
  }, []);

  const scheduleDesktopDayFlipArm = useCallback((direction, taskId) => {
    clearDesktopDayFlipHoldTimer();
    desktopDayFlipTimerRef.current = window.setTimeout(() => {
      desktopDayFlipTimerRef.current = null;
      if (!desktopDragModeRef.current || desktopDragStateRef.current.taskId !== taskId) return;
      if (desktopDayFlipDirectionRef.current !== direction) return;
      setDesktopDragDayArmed(true);
    }, DESKTOP_DRAG_DAY_EDGE_HOLD_MS);
  }, [clearDesktopDayFlipHoldTimer, setDesktopDragDayArmed]);

  const clearDesktopDayFlipTimer = useCallback(() => {
    resetDesktopDragInteraction();
  }, [resetDesktopDragInteraction]);

  const updateDesktopDragOverlapTarget = useCallback((clientX, clientY, taskId) => {
    const nextPosition = getCanvasPointFromClient(clientX, clientY);
    if (!nextPosition) return;

    const movingTaskIds = new Set(
      desktopDragSelectedTaskIdsRef.current.size > 0
        ? [...desktopDragSelectedTaskIdsRef.current]
        : [taskId],
    );

    const overlapResult = getDesktopCanvasOverlapEntry(
      tasksRef.current,
      dateKey(selectedDateRef.current),
      movingTaskIds,
      nextPosition,
    );

    const nextTargetId = overlapResult?.entry?.id || null;
    const currentTargetId = desktopDragOverlapTargetIdRef.current;

    if (nextTargetId === currentTargetId) return;

    // Stability / Anti-Flicker:
    // If we have a current target and a new candidate, only switch if the new 
    // candidate is meaningfully better (e.g. 10% higher ratio).
    if (currentTargetId && nextTargetId) {
      const currentOverlap = getDesktopCanvasOverlapEntry(
        tasksRef.current,
        dateKey(selectedDateRef.current),
        movingTaskIds,
        nextPosition,
        0.01, // Use low threshold to get actual ratio even if below 0.6
      );
      // If current still has a decent overlap, don't switch unless next is much better
      if (currentOverlap && currentOverlap.ratio * 1.1 > (overlapResult?.ratio || 0)) {
        return;
      }
    }

    desktopDragOverlapTargetIdRef.current = nextTargetId;
    setDesktopDragOverlapTargetId(nextTargetId);
  }, [getCanvasPointFromClient]);

  const getNearestDesktopDropTarget = useCallback((clientX, clientY) => {
    const slots = document.querySelectorAll('[data-desktop-slot-id]');
    let nearest = null;
    let nearestScore = Number.POSITIVE_INFINITY;

    slots.forEach((slot) => {
      const rect = slot.getBoundingClientRect();
      const clampedX = Math.max(rect.left, Math.min(clientX, rect.right));
      const clampedY = Math.max(rect.top, Math.min(clientY, rect.bottom));
      const edgeDistance = Math.hypot(clientX - clampedX, clientY - clampedY);
      const centerDistance = Math.hypot(clientX - (rect.left + (rect.width / 2)), clientY - (rect.top + (rect.height / 2)));
      const score = (edgeDistance * 1000) + centerDistance;
      if (score < nearestScore) {
        nearestScore = score;
        nearest = {
          section: slot.getAttribute('data-desktop-slot-section'),
          slot: Number(slot.getAttribute('data-desktop-slot-index')),
        };
      }
    });

    return nearest;
  }, []);


  const syncDesktopDraggedTaskPosition = useCallback((clientX, clientY) => {
    const startPt = desktopDragCanvasStartRef.current;
    if (!startPt) return;
    const currentPt = getCanvasPointFromClient(clientX, clientY);
    if (!currentPt) return;

    const dx = currentPt.x - startPt.x;
    const dy = currentPt.y - startPt.y;

    const movingIds = desktopDragSelectedTaskIdsRef.current.size > 0
      ? [...desktopDragSelectedTaskIdsRef.current]
      : [desktopDragStateRef.current.taskId];

    movingIds.forEach((id) => {
      // Target the absolutely-positioned canvas entry node (not the inner wrapper)
      const node = document.getElementById(`desktop-canvas-entry-${id}`);
      if (node) {
        node.style.transform = `translate(${dx}px, ${dy}px)`;
        node.style.zIndex = '999';
      }
    });
  }, [getCanvasPointFromClient]);

  const moveDraggedTaskToDate = useCallback((taskId, nextDate) => {
    if (!taskId || !nextDate) return;

    const currentDate = selectedDateRef.current;
    if (sameDay(currentDate, nextDate)) return;

    const draggedTask = tasksRef.current.find((task) => task.id === taskId);
    const preservedSection = dragOverSectionRef.current || draggedTask?.timeOfDay || 'Morning';
    const nextDateKey = dateKey(nextDate);
    const nextSlot = getDesktopSectionTaskOrder(
      tasksRef.current.filter((task) => task.id !== taskId),
      nextDateKey,
      preservedSection,
    ).length;

    dragOverSectionRef.current = preservedSection;
    dragOverSlotRef.current = nextSlot;
    setDragOverSection(preservedSection);
    setDragOverSlot(nextSlot);
    selectedDateRef.current = nextDate;
    setSelectedDate(nextDate);
  }, []);

  const updateDesktopDragDayAutoFlip = useCallback((clientX, taskId) => {
    const viewportEl = desktopDragViewportRef.current || viewportContainerRef.current;
    if (!viewportEl || !taskId) return;

    const rect = viewportEl.getBoundingClientRect();
    const zones = getDesktopDayFlipZones(rect);

    let direction = 0;
    if (clientX <= zones.previousEnd) {
      direction = -1;
    } else if (clientX >= zones.nextStart) {
      direction = 1;
    }

    // Sync zone state for visual overlay
    const currentZones = desktopDragDayZonesRef.current;
    if (
      !currentZones
      || currentZones.previousStart !== zones.previousStart
      || currentZones.previousEnd !== zones.previousEnd
      || currentZones.nextStart !== zones.nextStart
      || currentZones.nextEnd !== zones.nextEnd
    ) {
      desktopDragDayZonesRef.current = zones;
      setDesktopDragDayZones(zones);
    }

    const nextFeedback = direction === -1 ? 'previous' : direction === 1 ? 'next' : null;
    if (desktopDragDayFeedbackRef.current !== nextFeedback) {
      desktopDragDayFeedbackRef.current = nextFeedback;
      setDesktopDragDayFeedback(nextFeedback);
    }

    // Pointer left edge zones — full reset
    if (direction === 0) {
      clearDesktopDayFlipTimer();
      return;
    }

    if (Date.now() < desktopDayFlipCooldownUntilRef.current) {
      clearDesktopDayFlipHoldTimer();
      setDesktopDragDayArmed(false);
      return;
    }

    if (desktopDayFlipDirectionRef.current !== direction) {
      clearDesktopDayFlipHoldTimer();
      desktopDayFlipDirectionRef.current = direction;
      desktopDragDayEntryPointXRef.current = clientX;
      setDesktopDragDayArmed(false);
      scheduleDesktopDayFlipArm(direction, taskId);
      return;
    }

    const entryX = desktopDragDayEntryPointXRef.current;
    if (entryX === null) return;

    const outwardDelta = (clientX - entryX) * direction;

    if (outwardDelta <= -DESKTOP_DRAG_DAY_CANCEL_DISTANCE_PX) {
      clearDesktopDayFlipTimer();
      return;
    }

    if (!desktopDragDayIsReadyRef.current && outwardDelta >= DESKTOP_DRAG_DAY_ARM_DISTANCE_PX) {
      clearDesktopDayFlipHoldTimer();
      setDesktopDragDayArmed(true);
    } else if (desktopDragDayIsReadyRef.current && outwardDelta < DESKTOP_DRAG_DAY_ARM_DISTANCE_PX * 0.35) {
      setDesktopDragDayArmed(false);
      if (desktopDayFlipTimerRef.current === null) {
        scheduleDesktopDayFlipArm(direction, taskId);
      }
    } else if (!desktopDragDayIsReadyRef.current && desktopDayFlipTimerRef.current === null) {
      scheduleDesktopDayFlipArm(direction, taskId);
    }

    if (desktopDragDayIsReadyRef.current && outwardDelta >= DESKTOP_DRAG_DAY_CONFIRM_DISTANCE_PX) {
      if (!desktopDragModeRef.current || desktopDragStateRef.current.taskId !== taskId) {
        clearDesktopDayFlipTimer();
        return;
      }
      desktopDayFlipCooldownUntilRef.current = Date.now() + DESKTOP_DRAG_DAY_FLIP_COOLDOWN_MS;
      moveDraggedTaskToDate(taskId, shiftDateByDays(selectedDateRef.current, direction));
      clearDesktopDayFlipTimer();
    }
  }, [clearDesktopDayFlipHoldTimer, clearDesktopDayFlipTimer, moveDraggedTaskToDate, scheduleDesktopDayFlipArm, setDesktopDragDayArmed]);


  const startDesktopTaskDrag = useCallback((task) => {
    setHistoryOpen(false); // Ensure modal closes when drag starts

    const taskId = task.id;
    const movingTaskIds = desktopDragSelectedTaskIdsRef.current.size > 0
      ? [...desktopDragSelectedTaskIdsRef.current]
      : getDesktopDragTaskIds(task);

    // Record original canvas positions of all moving tasks for multi-drag delta math
    const entryPositionMap = new Map();
    selectedDayEntriesRef.current.forEach((entry) => {
      const taskIds = getDesktopCanvasEntryTaskIds(entry);
      taskIds.forEach((entryTaskId) => {
        entryPositionMap.set(entryTaskId, { x: entry.x, y: entry.y });
      });
    });
    const anchorPosition = entryPositionMap.get(taskId) || { x: 0, y: 0 };
    const nextPositions = new Map();
    movingTaskIds.forEach((movingTaskId) => {
      const movingPosition = entryPositionMap.get(movingTaskId) || anchorPosition;
      nextPositions.set(movingTaskId, movingPosition);
    });
    desktopDragSelectionPositionsRef.current = nextPositions;
    desktopDragAnchorStartPositionRef.current = anchorPosition;

    // Record the canvas-space point where the drag started
    desktopDragCanvasStartRef.current = getCanvasPointFromClient(
      desktopDragPointerRef.current.x,
      desktopDragPointerRef.current.y,
    );

    desktopDragModeRef.current = true;
    document.body.classList.add('desktop-task-dragging');

    movingTaskIds.forEach((movingTaskId) => {
      // Mark the canvas-card-shell (direct child of the canvas entry node) for the lift CSS
      const entryNode = document.getElementById(`desktop-canvas-entry-${movingTaskId}`);
      const shell = entryNode?.querySelector('.desktop-canvas-card-shell');
      if (shell) shell.classList.add('is-dragging');
    });

    setDraggedTaskId(taskId);
    setIsGroupDragActive(!!task.isGroupInitiator);
  }, [getCanvasPointFromClient]);

  const finishDesktopTaskDrag = useCallback((task, pointerTarget, pointerId) => {
    clearDesktopDayFlipTimer();

    const movingTaskIds = desktopDragSelectedTaskIdsRef.current.size > 0
      ? [...desktopDragSelectedTaskIdsRef.current]
      : getDesktopDragTaskIds(task);

    // Reset live transform and class on every dragged canvas entry node
    movingTaskIds.forEach((movingTaskId) => {
      const node = document.getElementById(`desktop-canvas-entry-${movingTaskId}`);
      if (node) {
        node.style.transform = '';
        node.style.zIndex = '';
        const shell = node.querySelector('.desktop-canvas-card-shell');
        if (shell) shell.classList.remove('is-dragging');
      }
    });

    document.body.classList.remove('desktop-task-dragging');

    if (desktopDragModeRef.current) {
      suppressNextTaskClick(task.id);

      // Compute canvas-space delta: current pointer canvas pos minus drag-start canvas pos
      const startPt = desktopDragCanvasStartRef.current;
      const currentPt = getCanvasPointFromClient(
        desktopDragPointerRef.current.x,
        desktopDragPointerRef.current.y,
      );

      if (startPt && currentPt) {
        const deltaX = currentPt.x - startPt.x;
        const deltaY = currentPt.y - startPt.y;
        const anchorStart = desktopDragAnchorStartPositionRef.current || { x: 0, y: 0 };
        // The anchor card's final canvas position
        const nextPosition = { x: anchorStart.x + deltaX, y: anchorStart.y + deltaY };

        flushSync(() => {
          setTasks((prev) => {
            const isGroupDrag = !!task.isGroupInitiator;
            const movingTaskIds = new Set(
              desktopDragSelectedTaskIdsRef.current.size > 0
                ? [...desktopDragSelectedTaskIdsRef.current]
                : (isGroupDrag ? task.groupTaskIds : [task.id]),
            );
            const activeDateKey = selectedDateRef.current ? dateKey(selectedDateRef.current) : task.dateString;
            const overlapResult = searchDragSeparateRef.current
              ? null
              : getDesktopCanvasOverlapEntry(prev, activeDateKey, movingTaskIds, nextPosition);
            const overlapEntry = overlapResult?.entry;
            const timestamp = Date.now();

            if (overlapEntry) {
              const movingTasks = prev.filter((item) => movingTaskIds.has(item.id));

              // Put Back Logic: If the target group is the group this task is already in, merge instantly
              const isPutBack = overlapEntry.type === 'group' && movingTasks.every(t => t.desktopGroupId === overlapEntry.id);

              if (isPutBack) {
                return prev.map((item) => {
                  if (!movingTaskIds.has(item.id)) return item;
                  return normalizeTask({
                    ...item,
                    dateString: activeDateKey,
                    desktopCanvasX: overlapEntry.x,
                    desktopCanvasY: overlapEntry.y,
                    desktopZ: timestamp,
                  });
                });
              }

              setPendingGroupPrompt({
                movingTaskIds: [...movingTaskIds],
                targetTaskIds: overlapEntry.type === 'group' ? overlapEntry.tasks.map((item) => item.id) : [overlapEntry.task.id],
                groupId: overlapEntry.type === 'group' ? overlapEntry.id : `desktop-group-${timestamp}`,
                anchorX: desktopDragPointerRef.current.x,
                anchorY: desktopDragPointerRef.current.y,
                targetDateKey: activeDateKey,
                overlapX: overlapEntry.x,
                overlapY: overlapEntry.y,
                dropX: nextPosition.x,
                dropY: nextPosition.y,
                fallbackPosition: getDesktopCanvasResolvedPosition(prev, activeDateKey, movingTaskIds, {
                  x: overlapEntry.x,
                  y: overlapEntry.y + getDesktopCanvasEntryHeight(overlapEntry) + DESKTOP_CANVAS_CARD_GAP,
                }),
              });
              setPendingGroupName(getSuggestedDesktopGroupName(movingTasks, overlapEntry));
              return prev;
            }

            setPendingGroupPrompt(null);
            return prev.map((item) => {
              if (!movingTaskIds.has(item.id)) return item;
              const itemStartPosition = desktopDragSelectionPositionsRef.current.get(item.id) || anchorStart;

              const isMultiDrag = desktopDragSelectedTaskIdsRef.current.size > 1;
              const shouldResetGroup = !isGroupDrag && !isMultiDrag;
              const resetGroupProps = shouldResetGroup ? {
                desktopGroupId: null,
                desktopGroupName: null,
                desktopGroupIcon: null,
                desktopGroupTags: [],
                desktopGroupCover: null,
                desktopGroupActiveDurationType: null,
                desktopGroupActiveFrom: null,
                desktopGroupActiveUntil: null,
              } : {};

              return normalizeTask({
                ...item,
                ...resetGroupProps,
                dateString: activeDateKey,
                desktopSlot: null,
                desktopCanvasX: Number((itemStartPosition.x + deltaX).toFixed(1)),
                desktopCanvasY: Number((itemStartPosition.y + deltaY).toFixed(1)),
                desktopZ: timestamp,
              });
            });
          });
        });
      }
    }

    desktopDragModeRef.current = false;
    desktopDragStateRef.current = { pointerId: null, taskId: null, startX: 0, startY: 0 };
    desktopDragCanvasStartRef.current = null;
    desktopDragSelectionPositionsRef.current = new Map();
    desktopDragAnchorStartPositionRef.current = null;
    desktopDayFlipCooldownUntilRef.current = 0;
    dragOverSectionRef.current = null;
    dragOverSlotRef.current = null;
    desktopDragSelectedTaskIdsRef.current = new Set();
    searchDragSeparateRef.current = false;
    setDragOverSection(null);
    setDragOverSlot(null);
    setDraggedTaskId(null);
    setIsGroupDragActive(false);

    if (pointerTarget?.hasPointerCapture?.(pointerId)) {
      try {
        pointerTarget.releasePointerCapture(pointerId);
      } catch (_) {
        // Pointer capture may already be released.
      }
    }
  }, [clearDesktopDayFlipTimer, getCanvasPointFromClient, setTasks, suppressNextTaskClick]);


  const handleTaskPointerDown = useCallback((task, event) => {
    if (!event.isPrimary || event.button !== 0) return;

    const taskSelectionIds = getDesktopDragTaskIds(task);
    const isWithinCurrentSelection = taskSelectionIds.some((taskId) => selectedTaskIdsRef.current.has(taskId));
    const dragTaskIds = isWithinCurrentSelection && selectedTaskIdsRef.current.size > 0
      ? [...selectedTaskIdsRef.current]
      : taskSelectionIds;

    desktopDragSelectedTaskIdsRef.current = new Set(dragTaskIds);
    setDesktopSelectionRect(null);
    desktopSelectionStateRef.current = { pointerId: null, origin: null };
    activePointerTaskRef.current = task;
    desktopDragModeRef.current = false;
    desktopDragStateRef.current = {
      pointerId: event.pointerId,
      taskId: task.id,
      startX: event.clientX,
      startY: event.clientY,
    };
    desktopDragPointerRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, []);

  const processDesktopDragMove = useCallback((task, clientX, clientY, nativeEvent = null) => {
    desktopDragPointerRef.current = { x: clientX, y: clientY };
    const deltaX = clientX - desktopDragStateRef.current.startX;
    const deltaY = clientY - desktopDragStateRef.current.startY;

    if (!desktopDragModeRef.current) {
      const distance = Math.hypot(deltaX, deltaY);
      if (distance >= DESKTOP_DRAG_START_DISTANCE) {
        startDesktopTaskDrag(task);
      } else {
        return;
      }
    }

    if (nativeEvent?.cancelable) {
      nativeEvent.preventDefault();
    }
    syncDesktopDraggedTaskPosition(clientX, clientY);
    updateDesktopDragDayAutoFlip(clientX, task.id);
    updateDesktopDragOverlapTarget(clientX, clientY, task.id);
  }, [startDesktopTaskDrag, syncDesktopDraggedTaskPosition, updateDesktopDragDayAutoFlip, updateDesktopDragOverlapTarget]);

  const handleTaskPointerMove = useCallback((task, event) => {
    if (desktopDragStateRef.current.pointerId !== event.pointerId || desktopDragStateRef.current.taskId !== task.id) return;
    processDesktopDragMove(task, event.clientX, event.clientY, event);
  }, [processDesktopDragMove]);

  const handleTaskPointerUp = useCallback((task, event) => {
    if (desktopDragStateRef.current.pointerId !== event.pointerId || desktopDragStateRef.current.taskId !== task.id) return;
    if (desktopDragModeRef.current) {
      finishDesktopTaskDrag(task, event.currentTarget, event.pointerId);
      activePointerTaskRef.current = null;
      return;
    }

    desktopDragStateRef.current = { pointerId: null, taskId: null, startX: 0, startY: 0 };
    activePointerTaskRef.current = null;
    if (event.currentTarget?.hasPointerCapture?.(event.pointerId)) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch (_) {
        // Pointer capture may already be released.
      }
    }
  }, [clearDesktopDayFlipTimer, finishDesktopTaskDrag, setHistoryOpen]);

  const handleTaskPointerCancel = useCallback((task, event) => {
    if (desktopDragStateRef.current.pointerId !== event.pointerId || desktopDragStateRef.current.taskId !== task.id) return;
    if (desktopDragModeRef.current) {
      finishDesktopTaskDrag(task, event.currentTarget, event.pointerId);
      activePointerTaskRef.current = null;
      return;
    }

    desktopDragStateRef.current = { pointerId: null, taskId: null, startX: 0, startY: 0 };
    activePointerTaskRef.current = null;
    if (event.currentTarget?.hasPointerCapture?.(event.pointerId)) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch (_) {
        // Pointer capture may already be released.
      }
    }
  }, [finishDesktopTaskDrag]);

  useEffect(() => {
    const handleWindowPointerMove = (event) => {
      const activeTask = activePointerTaskRef.current;
      if (!activeTask) return;
      if (desktopDragStateRef.current.pointerId !== event.pointerId || desktopDragStateRef.current.taskId !== activeTask.id) return;
      processDesktopDragMove(activeTask, event.clientX, event.clientY, event);
    };

    const handleWindowPointerEnd = (event) => {
      const activeTask = activePointerTaskRef.current;
      if (!activeTask) return;
      if (desktopDragStateRef.current.pointerId !== event.pointerId || desktopDragStateRef.current.taskId !== activeTask.id) return;

      if (desktopDragModeRef.current) {
        finishDesktopTaskDrag(activeTask, null, event.pointerId);
      } else {
        desktopDragStateRef.current = { pointerId: null, taskId: null, startX: 0, startY: 0 };
        clearDesktopDayFlipTimer();
      }
      activePointerTaskRef.current = null;
    };

    const handleWindowMouseMove = (event) => {
      const activeTask = activePointerTaskRef.current;
      if (!activeTask) return;
      if (desktopDragStateRef.current.taskId !== activeTask.id) return;
      if ((event.buttons & 1) !== 1 && !desktopDragModeRef.current) return;

      processDesktopDragMove(activeTask, event.clientX, event.clientY, event);
    };

    const handleWindowMouseUp = () => {
      const activeTask = activePointerTaskRef.current;
      if (!activeTask) return;

      if (desktopDragModeRef.current) {
        finishDesktopTaskDrag(activeTask, null, null);
      } else {
        desktopDragStateRef.current = { pointerId: null, taskId: null, startX: 0, startY: 0 };
        clearDesktopDayFlipTimer();
      }
      activePointerTaskRef.current = null;
    };

    window.addEventListener('pointermove', handleWindowPointerMove, { passive: false });
    window.addEventListener('pointerup', handleWindowPointerEnd);
    window.addEventListener('pointercancel', handleWindowPointerEnd);
    window.addEventListener('mousemove', handleWindowMouseMove, { passive: false });
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerEnd);
      window.removeEventListener('pointercancel', handleWindowPointerEnd);
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [clearDesktopDayFlipTimer, finishDesktopTaskDrag, processDesktopDragMove]);

  const selectedDateKey = dateKey(selectedDate);
  const desktopPreviousDayLabel = useMemo(
    () => panelLabel(shiftDateByDays(selectedDate, -1), language),
    [language, selectedDate],
  );
  const desktopNextDayLabel = useMemo(
    () => panelLabel(shiftDateByDays(selectedDate, 1), language),
    [language, selectedDate],
  );
  const selectedDayEntries = useMemo(
    () => resolveDesktopCanvasEntries(currentWorkspaceTasks, selectedDateKey),
    [currentWorkspaceTasks, selectedDateKey],
  );
  useEffect(() => {
    selectedDayEntriesRef.current = selectedDayEntries;
  }, [selectedDayEntries]);
  const selectedDayCanvasHeight = useMemo(
    () => getDesktopCanvasHeight(selectedDayEntries),
    [selectedDayEntries],
  );
  useEffect(() => {
    if (!draggedTaskId || !desktopDragModeRef.current) return undefined;

    const frameId = window.requestAnimationFrame(() => {
      syncDesktopDraggedTaskPosition(
        draggedTaskId,
        desktopDragPointerRef.current.x,
        desktopDragPointerRef.current.y,
      );
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [draggedTaskId, selectedDateKey, syncDesktopDraggedTaskPosition]);

  const editingTask = editingTaskId ? tasks.find((task) => task.id === editingTaskId) || null : null;
  const canSaveEdit = editText.trim().length > 0;
  const handleTaskEdit = useCallback((task) => {
    setEditingTaskId(task.id);
    setEditText(task.text);
  }, []);

  const deleteTasksByIds = useCallback((taskIds) => {
    if (!Array.isArray(taskIds) || taskIds.length === 0) return;
    const taskIdSet = new Set(taskIds);
    setTasks((prev) => {
      const affectedGroupIds = new Set(
        prev
          .filter((item) => taskIdSet.has(item.id) && item.desktopGroupId)
          .map((item) => item.desktopGroupId),
      );
      const nextUpdatedAt = createUpdatedTimestamp();
      const remainingTasks = prev
        .filter((item) => !taskIdSet.has(item.id))
        .map((item) => (
          item.desktopGroupId && affectedGroupIds.has(item.desktopGroupId)
            ? normalizeTask({ ...item, updatedAt: nextUpdatedAt })
            : item
        ));
      return cleanupDesktopGroupMetadata(remainingTasks);
    });
    setSelectedTaskIds((current) => current.filter((taskId) => !taskIdSet.has(taskId)));
  }, [setTasks]);

  const handleTaskDelete = useCallback((task) => {
    deleteTasksByIds([task.id]);
  }, [deleteTasksByIds]);

  const confirmCanvasDeletion = useCallback(() => {
    if (!pendingCanvasDeletion?.taskIds?.length) {
      setPendingCanvasDeletion(null);
      return;
    }
    deleteTasksByIds(pendingCanvasDeletion.taskIds);
    setPendingCanvasDeletion(null);
  }, [deleteTasksByIds, pendingCanvasDeletion]);

  const cancelCanvasDeletion = useCallback(() => {
    setPendingCanvasDeletion(null);
  }, []);

  const closeEditModal = useCallback(() => {
    setEditingTaskId(null);
    setEditText('');
    setEditCopied(false);
    if (editCopyResetTimerRef.current !== null) {
      window.clearTimeout(editCopyResetTimerRef.current);
      editCopyResetTimerRef.current = null;
    }
  }, []);

  const handleEditCopy = useCallback(async () => {
    const nextText = editText.trim();
    if (!nextText) return;

    try {
      await navigator.clipboard.writeText(editText);
      setEditCopied(true);
      if (editCopyResetTimerRef.current !== null) {
        window.clearTimeout(editCopyResetTimerRef.current);
      }
      editCopyResetTimerRef.current = window.setTimeout(() => {
        setEditCopied(false);
        editCopyResetTimerRef.current = null;
      }, 1400);
    } catch (_) {
      // Ignore clipboard failures so editing is unaffected.
    }
  }, [editText]);

  useEffect(() => {
    if (editingTaskId && !editingTask) {
      closeEditModal();
    }
  }, [closeEditModal, editingTask, editingTaskId]);

  useEffect(() => {
    if (!editingTaskId) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeEditModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeEditModal, editingTaskId]);

  const openTaskEditor = useCallback((task, jumpToDate = true) => {
    setProfileOpen(false);
    setPanelOpen(false);
    if (jumpToDate) {
      setSelectedDate(parseSharedSelectedDate(task.dateString) || selectedDate);
    }
    setEditingTaskId(task.id);
    setEditText(task.text || '');
  }, [selectedDate]);

  const [fullscreenImage, setFullscreenImage] = useState(null);

  const openTaskUrl = useCallback((url, task) => {
    const cardType = normalizeCardType(task?.cardType);
    if (cardType === CARD_TYPES.PHOTO) {
      setFullscreenImage(url);
      return true;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  }, []);

  const {
    onPrimaryAction: handleTaskPrimaryAction,
    onEditAction: handleTaskEditAction,
  } = useTaskInteraction({
    platform: 'desktop',
    openTaskEditor,
    openTaskUrl,
  });
  const updateActiveGroupMetadata = useCallback((changes) => {
    const groupId = activeGroupView?.groupId;
    if (!groupId) return;

    const nextFields = {};
    if (Object.prototype.hasOwnProperty.call(changes, 'desktopGroupName')) {
      nextFields.desktopGroupName = typeof changes.desktopGroupName === 'string'
        ? changes.desktopGroupName.trim() || null
        : null;
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'desktopGroupIcon')) {
      nextFields.desktopGroupIcon = normalizePackIcon(changes.desktopGroupIcon);
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'desktopGroupCover')) {
      nextFields.desktopGroupCover = normalizePackCover(changes.desktopGroupCover);
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'desktopGroupTags')) {
      nextFields.desktopGroupTags = normalizePackTags(changes.desktopGroupTags);
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'desktopGroupActiveDurationType')) {
      nextFields.desktopGroupActiveDurationType = normalizePackActiveDurationType(changes.desktopGroupActiveDurationType);
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'desktopGroupActiveFrom')) {
      nextFields.desktopGroupActiveFrom = normalizePackActiveDate(changes.desktopGroupActiveFrom);
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'desktopGroupActiveUntil')) {
      nextFields.desktopGroupActiveUntil = normalizePackActiveDate(changes.desktopGroupActiveUntil);
    }
    if (!Object.keys(nextFields).length) return;

    const nextUpdatedAt = createUpdatedTimestamp();
    setTasks((prev) => prev.map((task) => (
      task.desktopGroupId === groupId
        ? normalizeTask({
          ...task,
          ...nextFields,
          updatedAt: nextUpdatedAt,
        })
        : task
    )));
    setActiveGroupView((prev) => {
      if (!prev || prev.groupId !== groupId) return prev;
      const nextTasks = prev.tasks.map((task) => normalizeTask({
        ...task,
        ...nextFields,
        updatedAt: nextUpdatedAt,
      }));
      return {
        ...prev,
        title: getDesktopGroupDisplayName(nextTasks),
        tasks: nextTasks,
      };
    });
  }, [activeGroupView?.groupId, setTasks]);
  useEffect(() => {
    const activeGroupId = activeGroupView?.groupId;
    if (!activeGroupId) return;

    const nextGroupTasks = currentWorkspaceTasks
      .filter((task) => task.desktopGroupId === activeGroupId)
      .map((task) => normalizeTask(task));

    if (!nextGroupTasks.length) {
      setActiveGroupView(null);
      return;
    }

    setActiveGroupView((prev) => {
      if (!prev || prev.groupId !== activeGroupId) return prev;
      return {
        ...prev,
        title: getDesktopGroupDisplayName(nextGroupTasks),
        tasks: nextGroupTasks,
      };
    });
  }, [activeGroupView?.groupId, currentWorkspaceTasks]);

  if (loading) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: appearance === 'dark' ? '#121212' : '#ffffff' }}>
        <div style={{ width: 42, height: 42, borderRadius: '50%', border: `4px solid ${appearance === 'dark' ? '#333333' : '#e8e0d6'}`, borderTop: '4px solid #ED1F1F', animation: 'desktop-spin 1s linear infinite' }} />
        <style>{`@keyframes desktop-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
  if (!user) return <DesktopLogin />;
  const draggedTask = draggedTaskId 
    ? (tasks.find((task) => task.id === draggedTaskId) 
        ? { ...tasks.find((task) => task.id === draggedTaskId), isGroupInitiator: isGroupDragActive } 
        : null)
    : null;
  const closePanel = () => {
    setInputText('');
    setAddPanelAttachments([]);
    setPanelOpen(false);
  };
  const showToast = (message) => {
    setToastMessage(message);
    window.setTimeout(() => {
      setToastMessage((current) => (current === message ? null : current));
    }, 2200);
  };
  const openUploadedFileTask = async (task) => {
    const storageKey = typeof task?.uploadedFileStorageKey === 'string' && task.uploadedFileStorageKey.trim()
      ? task.uploadedFileStorageKey
      : null;
    const uploadedType = typeof task?.uploadedFileType === 'string' ? task.uploadedFileType : null;

    if (uploadedType === 'image' && (task?.photoUrl || task?.photoDataUrl)) {
      setFullscreenImage(task.photoUrl || task.photoDataUrl);
      return true;
    }

    if (!storageKey) {
      return false;
    }

    try {
      const record = await getUploadedFileRecord(storageKey);
      if (!record?.blob) {
        showToast('File is no longer available on this device');
        return true;
      }

      const objectUrl = URL.createObjectURL(record.blob);
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 60_000);
      return true;
    } catch (error) {
      console.error('Failed to open uploaded file:', error);
      showToast('Unable to open file');
      return true;
    }
  };
  const handleCanvasFileDragEnter = (event) => {
    if (!hasImageFiles(event.dataTransfer)) return;
    event.preventDefault();
    canvasFileDragDepthRef.current += 1;
    setIsCanvasFileDragActive(true);
  };
  const handleCanvasFileDragOver = (event) => {
    if (!hasImageFiles(event.dataTransfer)) return;
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    if (!isCanvasFileDragActive) {
      setIsCanvasFileDragActive(true);
    }
  };
  const handleCanvasFileDragLeave = (event) => {
    if (!hasImageFiles(event.dataTransfer)) return;
    event.preventDefault();
    canvasFileDragDepthRef.current = Math.max(0, canvasFileDragDepthRef.current - 1);
    if (canvasFileDragDepthRef.current === 0) {
      setIsCanvasFileDragActive(false);
    }
  };
  const handleCanvasFileDrop = async (event) => {
    if (!hasImageFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    canvasFileDragDepthRef.current = 0;
    setIsCanvasFileDragActive(false);

    const imageFiles = Array.from(event.dataTransfer?.files || []).filter((file) => file.type?.startsWith('image/'));
    if (!imageFiles.length) return;

    const droppedDateKey = selectedDateRef.current ? dateKey(selectedDateRef.current) : selectedDateKey;
    const dropCenter = getCanvasPointFromClient(event.clientX, event.clientY);
    const dropBasePosition = dropCenter
      ? { x: dropCenter.x - DESKTOP_CANVAS_CARD_WIDTH / 2, y: dropCenter.y - DESKTOP_PHOTO_CARD_HEIGHT / 2 }
      : null;

    try {
      const imageTasks = await Promise.all(imageFiles.map(async (file, index) => {
        const photoFields = await serializeDroppedImageFile(file);
        const storageKey = createUploadedFileStorageKey(file.name);
        await saveUploadedFileBlob({
          storageKey,
          blob: file,
          metadata: {
            originalFileName: file.name,
            mimeType: file.type || getUploadedFileFallbackMimeType('image'),
            size: Number.isFinite(file.size) ? file.size : 0,
            uploadedFileType: 'image',
            createdAt: createUpdatedTimestamp(),
            updatedAt: createUpdatedTimestamp(),
          },
        });
        const taskId = Date.now() + index + Math.floor(Math.random() * 1000);
        const title = getDroppedImageTitle(file.name);
        return normalizeTask({
          id: taskId,
          text: title,
          title,
          completed: false,
          desktopWorkspaceId: activeWorkspaceId,
          timeOfDay: 'Morning',
          dateString: droppedDateKey,
          updatedAt: createUpdatedTimestamp(),
          cardType: CARD_TYPES.PHOTO,
          primaryUrl: null,
          source: UPLOADED_FILE_SOURCE_LABEL,
          uploadedSourceLabel: UPLOADED_FILE_SOURCE_LABEL,
          uploadedFileStorageKey: storageKey,
          uploadedFileType: 'image',
          uploadedOriginalFileName: file.name,
          uploadedMimeType: file.type || getUploadedFileFallbackMimeType('image'),
          uploadedFileSize: Number.isFinite(file.size) ? file.size : 0,
          uploadedCreatedAt: createUpdatedTimestamp(),
          uploadedUpdatedAt: createUpdatedTimestamp(),
          extractedText: null,
          redirectUrl: photoFields.photoDataUrl || null,
          photoUrl: photoFields.photoDataUrl || null,
          photoTitle: title,
          photoFileName: file.name,
          ...photoFields,
          desktopSlot: null,
          desktopZ: Date.now() + index,
        });
      }));

      setTasks((prev) => {
        let nextTasks = [...prev];
        imageTasks.forEach((task, index) => {
          const workspaceTasks = nextTasks.filter((item) => taskBelongsToWorkspace(item, activeWorkspaceId));
          const preferredPosition = dropBasePosition
            ? {
              x: dropBasePosition.x,
              y: dropBasePosition.y + (index * (DESKTOP_CANVAS_CARD_GAP + 12)),
            }
            : getNextDesktopCanvasPosition(workspaceTasks, droppedDateKey);
          const nextPosition = getDesktopCanvasResolvedPosition(
            workspaceTasks,
            droppedDateKey,
            new Set([task.id]),
            preferredPosition,
          );
          nextTasks = [
            ...nextTasks,
            normalizeTask({
              ...task,
              desktopCanvasX: nextPosition.x,
              desktopCanvasY: nextPosition.y,
            }),
          ];
        });
        return nextTasks;
      });

      showToast(imageFiles.length === 1 ? 'Photo added' : `${imageFiles.length} photos added`);
    } catch (error) {
      console.error('Failed to import dropped image files:', error);
      showToast('Unable to import image');
    }
  };
  const applyAsyncMetadata = (taskId, cardType, videoUrl, mapUrl, primaryUrl, updatedAt = null) => {
    if (cardType === 'video' && videoUrl) {
      fetchVideoMeta(videoUrl).then((meta) => {
        setTasks((prev) => prev.map((task) => (task.id === taskId ? normalizeTask({ ...task, ...meta, ...(updatedAt ? { updatedAt } : {}) }) : task)));
      });
    } else if (cardType === 'place' && mapUrl) {
      fetchMapMeta(mapUrl).then((meta) => {
        setTasks((prev) => prev.map((task) => (task.id === taskId ? normalizeTask({ ...task, ...meta, ...(updatedAt ? { updatedAt } : {}) }) : task)));
      });
    } else if ((cardType === 'music' || cardType === 'podcast') && primaryUrl) {
      fetchSpotifyMeta(primaryUrl).then((meta) => {
        setTasks((prev) => prev.map((task) => (task.id === taskId ? normalizeTask({ ...task, ...meta, ...(updatedAt ? { updatedAt } : {}) }) : task)));
      });
    } else if (primaryUrl && (!cardType || cardType === 'link' || cardType === 'text' || cardType === 'ai_tool' || cardType === 'social' || cardType === 'shopping' || cardType === 'financial' || cardType === 'document')) {
      fetchLinkPreviewMeta(primaryUrl).then((meta) => {
        if (meta) {
          setTasks((prev) => prev.map((task) => (task.id === taskId ? normalizeTask({ ...task, ...meta, ...(updatedAt ? { updatedAt } : {}) }) : task)));
        }
      });
    }
  };
  const handleAddPanelFilesSelected = async (files) => {
    if (!files?.length) return;

    const selectedFiles = Array.from(files);
    const supportedFiles = selectedFiles.filter((file) => isSupportedUploadFile(file));
    const rejectedCount = selectedFiles.length - supportedFiles.length;

    if (rejectedCount > 0) {
      showToast(rejectedCount === 1 ? 'Unsupported file skipped' : `${rejectedCount} unsupported files skipped`);
    }
    if (!supportedFiles.length) return;

    try {
      const serializedAttachments = await Promise.all(supportedFiles.map((file) => serializeUploadAttachment(file)));
      setAddPanelAttachments((current) => [...current, ...serializedAttachments]);
      showToast(serializedAttachments.length === 1 ? 'File attached' : `${serializedAttachments.length} files attached`);
    } catch (error) {
      console.error('Failed to attach files to add panel:', error);
      showToast('Unable to attach files');
    }
  };
  const handleRemoveAddPanelAttachment = (attachmentId) => {
    setAddPanelAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
  };
  const saveTask = async () => {
    const rawText = inputText.trim();
    if (!rawText && addPanelAttachments.length === 0) return;

    const resolvedTimeOfDay = todaySelected ? sectionIdToMobileId(currentBlock) : 'Morning';
    const typeFields = rawText ? getDerivedTaskFields(rawText) : null;
    const taskId = Date.now();
    const operationUpdatedAt = createUpdatedTimestamp();
    let preparedAttachments = [];

    if (addPanelAttachments.length) {
      try {
        preparedAttachments = await Promise.all(addPanelAttachments.map(async (attachment) => {
          const storageKey = createUploadedFileStorageKey(attachment.originalFileName || attachment.title);
          await saveUploadedFileBlob({
            storageKey,
            blob: attachment.file,
            metadata: {
              originalFileName: attachment.originalFileName,
              mimeType: attachment.mimeType,
              size: attachment.size,
              uploadedFileType: attachment.uploadKind,
              createdAt: attachment.createdAt,
              updatedAt: operationUpdatedAt,
            },
          });
          return {
            ...attachment,
            storageKey,
          };
        }));
      } catch (error) {
        console.error('Failed to store uploaded files:', error);
        showToast('Unable to save files');
        return;
      }
    }

    setTasks((prev) => {
      let nextTasks = [...prev];

      if (rawText && typeFields) {
        const nextTask = normalizeTask({
          id: taskId,
          text: rawText,
          completed: false,
          desktopWorkspaceId: activeWorkspaceId,
          timeOfDay: resolvedTimeOfDay,
          dateString: selectedDateKey,
          updatedAt: operationUpdatedAt,
          ...typeFields,
          desktopSlot: null,
          desktopZ: Date.now(),
        });
        const workspaceTasks = nextTasks.filter((task) => taskBelongsToWorkspace(task, activeWorkspaceId));
        const nextPosition = getNextDesktopCanvasPosition(workspaceTasks, selectedDateKey);
        const desktopSlot = getFirstAvailableDesktopSlot(workspaceTasks, selectedDateKey, nextTask.timeOfDay);
        nextTasks = [...nextTasks, normalizeTask({
          ...nextTask,
          desktopSlot,
          desktopCanvasX: nextPosition.x,
          desktopCanvasY: nextPosition.y,
        })];
      }

      preparedAttachments.forEach((attachment, index) => {
        const attachmentTaskId = taskId + index + 1;
        const isImageAttachment = attachment.uploadKind === 'image';
        const attachmentTask = normalizeTask({
          id: attachmentTaskId,
          text: attachment.title,
          title: attachment.title,
          completed: false,
          desktopWorkspaceId: activeWorkspaceId,
          timeOfDay: 'Morning',
          dateString: selectedDateKey,
          updatedAt: operationUpdatedAt,
          cardType: isImageAttachment ? CARD_TYPES.PHOTO : CARD_TYPES.DOCUMENT,
          primaryUrl: null,
          source: UPLOADED_FILE_SOURCE_LABEL,
          uploadedSourceLabel: UPLOADED_FILE_SOURCE_LABEL,
          uploadedFileStorageKey: attachment.storageKey,
          uploadedFileType: attachment.uploadKind,
          uploadedOriginalFileName: attachment.originalFileName,
          uploadedMimeType: attachment.mimeType,
          uploadedFileSize: attachment.size,
          uploadedCreatedAt: attachment.createdAt,
          uploadedUpdatedAt: operationUpdatedAt,
          extractedText: null,
          redirectUrl: isImageAttachment ? (attachment.previewUrl || attachment.photoDataUrl || null) : null,
          photoUrl: isImageAttachment ? (attachment.previewUrl || attachment.photoDataUrl || null) : null,
          photoTitle: isImageAttachment ? attachment.title : null,
          photoFileName: isImageAttachment ? attachment.originalFileName : null,
          photoDataUrl: isImageAttachment ? attachment.photoDataUrl : null,
          photoWidth: isImageAttachment ? attachment.photoWidth : null,
          photoHeight: isImageAttachment ? attachment.photoHeight : null,
          desktopSlot: null,
          desktopZ: Date.now() + index + 1,
        });
        const workspaceTasks = nextTasks.filter((task) => taskBelongsToWorkspace(task, activeWorkspaceId));
        const nextPosition = getNextDesktopCanvasPosition(workspaceTasks, selectedDateKey);
        nextTasks = [...nextTasks, normalizeTask({
          ...attachmentTask,
          desktopCanvasX: nextPosition.x,
          desktopCanvasY: nextPosition.y,
        })];
      });

      return nextTasks;
    });

    // Track analytics 
    if (user?.id && rawText && typeFields) {
      trackUserEvent(user.id, 'task_added', { cardType: typeFields.cardType, platform: 'desktop' });
    }

    setInputText('');
    setAddPanelAttachments([]);
    setPanelOpen(false);
    if (rawText && typeFields) {
      applyAsyncMetadata(taskId, typeFields.cardType, typeFields.videoUrl, typeFields.mapUrl, typeFields.primaryUrl, operationUpdatedAt);
    }
  };
  const handleEditSave = () => {
    const rawText = editText.trim();
    if (!editingTask || !rawText) return;

    const typeFields = getDerivedTaskFields(rawText);
    const operationUpdatedAt = createUpdatedTimestamp();
    setTasks((prev) => prev.map((task) => (
      task.id === editingTask.id
        ? normalizeTask({ ...task, text: rawText, updatedAt: operationUpdatedAt, ...typeFields })
        : task
    )));
    applyAsyncMetadata(editingTask.id, typeFields.cardType, typeFields.videoUrl, typeFields.mapUrl, typeFields.primaryUrl, operationUpdatedAt);
    closeEditModal();
  };
  const updateCanvasSelection = (taskIds, event, openAction) => {
    const normalizedTaskIds = [...new Set(taskIds)];
    if (!normalizedTaskIds.length) return;

    if (event?.metaKey || event?.ctrlKey) {
      event.preventDefault?.();
      event.stopPropagation?.();
      setSelectedTaskIds((current) => {
        const currentSet = new Set(current);
        const isFullySelected = normalizedTaskIds.every((taskId) => currentSet.has(taskId));
        normalizedTaskIds.forEach((taskId) => {
          if (isFullySelected) currentSet.delete(taskId);
          else currentSet.add(taskId);
        });
        return [...currentSet];
      });
      return;
    }

    if (areTaskIdSelectionsEqual(selectedTaskIdsRef.current, normalizedTaskIds)) {
      openAction?.();
      return;
    }

    setSelectedTaskIds(normalizedTaskIds);

    // For a single loose task, keep canvas selection visible but still open it on first click.
    if (normalizedTaskIds.length === 1) {
      openAction?.();
    }
  };

  const handleTaskClick = (task, event) => {
    const openTaskFromCanvas = () => {
      if (Date.now() < suppressAllTaskClicksUntilRef.current) {
        return;
      }
      if (suppressTaskClickRef.current === task.id) {
        suppressTaskClickRef.current = null;
        return;
      }

      const { redirectUrl, isPlain } = getTaskCardPresentation(task, t);

      if (user?.id) {
        trackUserEvent(user.id, 'task_clicked', { action: 'card_click', platform: 'desktop', isPlain, hasRedirect: !!redirectUrl });
      }

      if (task.uploadedFileStorageKey) {
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

      openTaskEditor(task);
    };

    if (!event) {
      openTaskFromCanvas();
      return;
    }

    updateCanvasSelection([task.id], event, openTaskFromCanvas);
  };
  const handleSignOut = async () => {
    try {
      await supabase?.auth?.signOut();
    } finally {
      setProfileOpen(false);
    }
  };
  const closePendingGroupPrompt = () => {
    setPendingGroupPrompt(null);
    setPendingGroupName('');
  };
  const closeActiveGroupView = () => {
    setActiveGroupView(null);
  };
  const getGroupCardOriginRect = (groupTasks, event = null) => {
    const leadTask = groupTasks?.[0];
    const triggerNode = event?.currentTarget instanceof HTMLElement
      ? event.currentTarget.closest('.desktop-task-group-card')
      : null;
    const fallbackNode = leadTask
      ? document.getElementById(`desktop-group-card-${leadTask.id}`) || document.getElementById(`desktop-task-wrapper-${leadTask.id}`)
      : null;
    const sourceNode = triggerNode || fallbackNode;
    if (!sourceNode) return null;

    const rect = sourceNode.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
  };
  const openActiveGroupView = (groupTasks, focusTaskId = null, originRect = null) => {
    if (!groupTasks?.length) return;
    const nextView = {
      groupId: groupTasks[0].desktopGroupId || `group-${groupTasks[0].id}`,
      title: getDesktopGroupDisplayName(groupTasks),
      tasks: groupTasks.map((task) => normalizeTask(task)),
      focusTaskId,
      originRect,
    };
    window.requestAnimationFrame(() => {
      setActiveGroupView(nextView);
    });
  };
  const handleGroupCardOpen = (groupTasks, event = null) => {
    if (event?.metaKey || event?.ctrlKey) {
      const groupTaskIds = groupTasks.map((task) => task.id);
      updateCanvasSelection(groupTaskIds, event, null);
      return;
    }
    if (Date.now() < suppressAllTaskClicksUntilRef.current) return;
    openActiveGroupView(groupTasks, null, getGroupCardOriginRect(groupTasks, event));
  };
  const handleHistoryPackOpen = (groupTasks) => {
    setHistoryOpen(false);
    openActiveGroupView(groupTasks);
  };
  const handleHistoryPackItemOpen = (task) => {
    if (!task?.desktopGroupId) {
      handleTaskClick(task);
      return;
    }

    const groupTasks = tasksRef.current
      .filter((currentTask) => currentTask.desktopGroupId === task.desktopGroupId)
      .map((currentTask) => normalizeTask(currentTask));

    if (!groupTasks.length) {
      handleTaskClick(task);
      return;
    }

    setHistoryOpen(false);
    openActiveGroupView(groupTasks, task.id);
  };
  const handleHistorySearchLongPress = (task) => {
    searchDragSeparateRef.current = true;
    startDesktopTaskDrag(task);
  };
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) || workspaces[0] || getDefaultDesktopWorkspaces()[0];
  const canAddWorkspace = workspaces.length < MAX_DESKTOP_WORKSPACES;
  const handleSelectWorkspace = (workspaceId) => {
    setActiveWorkspaceId(workspaceId);
    setWorkspaceMenuOpen(false);
    setWorkspaceActionMenuId(null);
    setIsWorkspaceNameEditing(false);
    setSelectedTaskIds([]);
    setPendingCanvasDeletion(null);
    setActiveGroupView(null);
    setHistoryOpen(false);
  };
  const handleStartWorkspaceRename = () => {
    setWorkspaceMenuOpen(false);
    setWorkspaceActionMenuId(null);
    setWorkspaceNameDraft(activeWorkspace?.name || 'Untitled');
    setIsWorkspaceNameEditing(true);
  };
  const handleCommitWorkspaceRename = () => {
    const nextName = workspaceNameDraft.trim() || 'Untitled';
    setWorkspaces((current) => current.map((workspace) => (
      workspace.id === activeWorkspace?.id
        ? { ...workspace, name: nextName }
        : workspace
    )));
    setIsWorkspaceNameEditing(false);
  };
  const handleCancelWorkspaceRename = () => {
    setWorkspaceNameDraft(activeWorkspace?.name || 'Untitled');
    setIsWorkspaceNameEditing(false);
  };
  const handleAddWorkspace = () => {
    if (!canAddWorkspace) return;
    setWorkspaces((current) => {
      const nextWorkspace = {
        id: `workspace-${Date.now()}`,
        name: getUntitledWorkspaceName(current.length + 1),
        iconType: 'dot',
      };
      setActiveWorkspaceId(nextWorkspace.id);
      setWorkspaceNameDraft(nextWorkspace.name);
      setIsWorkspaceNameEditing(true);
      return [...current, nextWorkspace];
    });
    setWorkspaceMenuOpen(false);
    setWorkspaceActionMenuId(null);
    setSelectedTaskIds([]);
    setPendingCanvasDeletion(null);
    setActiveGroupView(null);
    setHistoryOpen(false);
  };
  const handleWorkspaceActionsToggle = (workspaceId, event) => {
    event.preventDefault();
    event.stopPropagation();
    setWorkspaceActionMenuId((current) => (current === workspaceId ? null : workspaceId));
  };
  const handleWorkspaceDeleteRequest = (workspace, event) => {
    event.preventDefault();
    event.stopPropagation();
    if (workspaces.length <= 1) return;
    setWorkspaceActionMenuId(null);
    setPendingWorkspaceDeletion({
      workspaceId: workspace.id,
      workspaceName: workspace.name || 'Untitled',
      title: `Delete workspace "${workspace.name || 'Untitled'}"?`,
      description: 'This will remove this page and its items.',
    });
  };
  const cancelWorkspaceDeletion = () => {
    setPendingWorkspaceDeletion(null);
  };
  const confirmWorkspaceDeletion = () => {
    if (!pendingWorkspaceDeletion?.workspaceId || workspaces.length <= 1) {
      setPendingWorkspaceDeletion(null);
      return;
    }

    const deletedWorkspaceId = pendingWorkspaceDeletion.workspaceId;
    const remainingWorkspaces = workspaces.filter((workspace) => workspace.id !== deletedWorkspaceId);
    const fallbackWorkspaceId = remainingWorkspaces[0]?.id || DEFAULT_DESKTOP_WORKSPACE_ID;

    setWorkspaces(remainingWorkspaces);
    setTasks((prev) => prev.filter((task) => !taskBelongsToWorkspace(task, deletedWorkspaceId)));
    if (activeWorkspaceId === deletedWorkspaceId) {
      setActiveWorkspaceId(fallbackWorkspaceId);
    }
    setWorkspaceMenuOpen(false);
    setWorkspaceActionMenuId(null);
    setPendingWorkspaceDeletion(null);
    setSelectedTaskIds([]);
    setPendingCanvasDeletion(null);
    setActiveGroupView(null);
    setHistoryOpen(false);
  };
  const handleConfirmGroupPrompt = () => {
    if (!pendingGroupPrompt) return;
    const groupName = pendingGroupName.trim() || 'New group';
    const groupedTaskIds = new Set([
      ...pendingGroupPrompt.movingTaskIds,
      ...pendingGroupPrompt.targetTaskIds,
    ]);

    const nextUpdatedAt = createUpdatedTimestamp();
    setTasks((prev) => {
      const groupedTasks = prev.filter((task) => groupedTaskIds.has(task.id));
      const nextGroupTags = getDesktopGroupDisplayTags(groupedTasks);
      return prev.map((task) => (
        groupedTaskIds.has(task.id)
          ? normalizeTask({
            ...task,
            dateString: pendingGroupPrompt.targetDateKey,
            updatedAt: nextUpdatedAt,
            desktopSlot: null,
            desktopCanvasX: Number(pendingGroupPrompt.overlapX.toFixed(1)),
            desktopCanvasY: Number(pendingGroupPrompt.overlapY.toFixed(1)),
            desktopGroupId: pendingGroupPrompt.groupId,
            desktopGroupName: groupName,
            desktopGroupTags: nextGroupTags,
            desktopZ: Date.now(),
          })
          : task
      ));
    });
    closePendingGroupPrompt();
  };
  const handleCancelGroupPrompt = () => {
    closePendingGroupPrompt();
  };
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
          <div className="desktop-minimal-brand" ref={workspaceMenuRef}>
            <div className={`desktop-workspace-shell ${workspaceMenuOpen ? 'is-open' : ''} ${isWorkspaceNameEditing ? 'is-editing' : ''}`}>
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
                  <span className="desktop-workspace-trigger-label">{activeWorkspace?.name || 'Untitled'}</span>
                </button>
              )}
              <button
                type="button"
                className="desktop-workspace-menu-button"
                onClick={() => {
                  if (isWorkspaceNameEditing) {
                    handleCommitWorkspaceRename();
                  }
                  setWorkspaceMenuOpen((current) => !current);
                }}
                aria-haspopup="menu"
                aria-expanded={workspaceMenuOpen}
              >
                <span className="desktop-workspace-trigger-chevron">
                  <WorkspaceChevronIcon open={workspaceMenuOpen} />
                </span>
              </button>
            </div>
            {workspaceMenuOpen ? (
              <div className="desktop-workspace-menu" role="menu" aria-label="Workspace menu">
                <div className="desktop-workspace-menu-header">Switch Workspace</div>
                <div className="desktop-workspace-menu-list">
                  {workspaces.map((workspace) => {
                    const isActive = workspace.id === activeWorkspace?.id;
                    const isActionsOpen = workspaceActionMenuId === workspace.id;
                    return (
                      <div
                        key={workspace.id}
                        className={`desktop-workspace-menu-row ${isActive ? 'is-active' : ''} ${isActionsOpen ? 'is-actions-open' : ''}`}
                      >
                        <button
                          type="button"
                          className="desktop-workspace-menu-item"
                          onClick={() => handleSelectWorkspace(workspace.id)}
                          role="menuitemradio"
                          aria-checked={isActive}
                        >
                          <span className="desktop-workspace-menu-item-label">{workspace.name}</span>
                        </button>
                        <div className="desktop-workspace-menu-item-actions">
                          <button
                            type="button"
                            className="desktop-workspace-menu-item-more"
                            onClick={(event) => handleWorkspaceActionsToggle(workspace.id, event)}
                            aria-label={`Workspace actions for ${workspace.name}`}
                            aria-expanded={isActionsOpen}
                          >
                            <WorkspaceMoreIcon />
                          </button>
                          {isActionsOpen ? (
                            <div className="desktop-workspace-menu-item-popover" role="menu" aria-label="Workspace actions">
                              <button
                                type="button"
                                className="desktop-workspace-menu-item-delete"
                                onClick={(event) => handleWorkspaceDeleteRequest(workspace, event)}
                                disabled={workspaces.length <= 1}
                              >
                                Delete workspace
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="desktop-workspace-menu-add"
                  onClick={handleAddWorkspace}
                  disabled={!canAddWorkspace}
                >
                  <WorkspacePlusIcon />
                  <span>Add workspace</span>
                </button>
              </div>
            ) : null}
          </div>
          <div className="desktop-minimal-date-nav-wrap">
            {!todaySelected && (
              <button
                type="button"
                className="desktop-minimal-today-button"
                onClick={() => {
                  setSelectedDate(getLogicalToday());
                  setProfileOpen(false);
                }}
              >
                Today
              </button>
            )}
            <div className="desktop-minimal-date-nav" role="group" aria-label="Date navigation">
            <button
              type="button"
              className="desktop-minimal-date-nav-button"
              onClick={() => {
                setSelectedDate(shiftDateByDays(selectedDate, -1));
                setProfileOpen(false);
              }}
              aria-label={t.previousDay || 'Previous day'}
            >
              <HeaderChevronIcon direction="left" />
            </button>
            <button
              type="button"
              className={`desktop-minimal-date-nav-label ${todaySelected ? 'is-today' : ''}`}
              onClick={() => {
                setSelectedDate(logicalToday);
                setProfileOpen(false);
              }}
              aria-label={t.backToToday}
            >
              {panelLabel(selectedDate, language)}
            </button>
            <button
              type="button"
              className="desktop-minimal-date-nav-button"
              onClick={() => {
                setSelectedDate(shiftDateByDays(selectedDate, 1));
                setProfileOpen(false);
              }}
              aria-label={t.nextDay || 'Next day'}
            >
              <HeaderChevronIcon direction="right" />
            </button>
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
            className={`desktop-main-stage ${desktopDragDayFeedback ? `desktop-main-stage-feedback-${desktopDragDayFeedback}` : ''} ${desktopDragDayConfirming ? 'desktop-main-stage-feedback-armed' : ''}`}
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
                    paddingTop: 110,
                  }}
                >
                    <DailyTaskList
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
                    layoutWidth={DESKTOP_MAIN_CONTENT_MAX_WIDTH}
                  />
                  {isCanvasFileDragActive ? (
                    <div className="desktop-canvas-file-drop-indicator">
                      <span>Drop image to create a photo card</span>
                    </div>
                  ) : null}
                </div>
              </main>
            </div>
            <DragDayFeedbackOverlayV2
              direction={desktopDragDayFeedback}
              previousLabel={desktopPreviousDayLabel}
              nextLabel={desktopNextDayLabel}
              zones={desktopDragDayZones}
              isConfirming={desktopDragDayConfirming}
            />
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
          setAppearance={setAppearance}
          onSignOut={handleSignOut}
        />
        <DesktopHistoryModal
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
          onTaskLongPress={handleHistorySearchLongPress}
        />

        <DesktopGroupPrompt
          prompt={pendingGroupPrompt}
          groupName={pendingGroupName}
          setGroupName={setPendingGroupName}
          onConfirm={handleConfirmGroupPrompt}
          onCancel={handleCancelGroupPrompt}
        />
        <DesktopGroupFullViewModal
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
          title={pendingCanvasDeletion?.title || 'Delete selected objects?'}
          onCancel={cancelCanvasDeletion}
          onConfirm={confirmCanvasDeletion}
        />
        <DesktopDeleteConfirmModal
          open={Boolean(pendingWorkspaceDeletion)}
          title={pendingWorkspaceDeletion?.title || 'Delete workspace?'}
          description={pendingWorkspaceDeletion?.description || null}
          onCancel={cancelWorkspaceDeletion}
          onConfirm={confirmWorkspaceDeletion}
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
