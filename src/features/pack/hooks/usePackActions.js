import { useCallback, useEffect } from 'react';
import { normalizeTask } from '../../../lib/taskNormalize';
import { createUpdatedTimestamp } from '../model/packMetadata';
import {
  normalizePackActiveDate,
  normalizePackActiveDurationType,
  normalizePackCover,
  normalizePackIcon,
  normalizePackTags,
} from '../../../entities/pack/model/packValueNormalizers';
import {
  getDesktopGroupDisplayName,
  getDesktopGroupDisplayTags,
} from '../model/groupMetadata';

export const usePackActions = ({
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
}) => {
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
  }, [activeGroupView?.groupId, setTasks, setActiveGroupView]);

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
  }, [activeGroupView?.groupId, currentWorkspaceTasks, setActiveGroupView]);

  const closePendingGroupPrompt = useCallback(() => {
    setPendingGroupPrompt(null);
    setPendingGroupName('');
  }, [setPendingGroupPrompt, setPendingGroupName]);

  const closeActiveGroupView = useCallback(() => {
    setActiveGroupView(null);
  }, [setActiveGroupView]);

  const getGroupCardOriginRect = useCallback((groupTasks, event = null) => {
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
  }, []);

  const openActiveGroupView = useCallback((groupTasks, focusTaskId = null, originRect = null) => {
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
  }, [setActiveGroupView]);

  const handleGroupCardOpen = useCallback((groupTasks, event = null) => {
    if (event?.metaKey || event?.ctrlKey) {
      const groupTaskIds = groupTasks.map((task) => task.id);
      updateCanvasSelection(groupTaskIds, event, null);
      return;
    }
    if (Date.now() < suppressAllTaskClicksUntilRef.current) return;
    openActiveGroupView(groupTasks, null, getGroupCardOriginRect(groupTasks, event));
  }, [openActiveGroupView, getGroupCardOriginRect, suppressAllTaskClicksUntilRef, updateCanvasSelection]);

  const handleHistoryPackOpen = useCallback((groupTasks) => {
    setHistoryOpen(false);
    openActiveGroupView(groupTasks);
  }, [openActiveGroupView, setHistoryOpen]);

  const handleHistoryPackItemOpen = useCallback((task) => {
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
  }, [handleTaskClick, openActiveGroupView, setHistoryOpen, tasksRef]);

  const handleConfirmGroupPrompt = useCallback(() => {
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
  }, [closePendingGroupPrompt, pendingGroupName, pendingGroupPrompt, setTasks]);

  const handleCancelGroupPrompt = useCallback(() => {
    closePendingGroupPrompt();
  }, [closePendingGroupPrompt]);

  return {
    updateActiveGroupMetadata,
    closeActiveGroupView,
    handleGroupCardOpen,
    handleHistoryPackOpen,
    handleHistoryPackItemOpen,
    handleConfirmGroupPrompt,
    handleCancelGroupPrompt,
  };
};
