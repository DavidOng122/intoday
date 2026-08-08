import { useCallback } from 'react';
import { trackUserEvent } from '../shared/lib/analytics';
import { createUpdatedTimestamp } from '../features/pack';
import { normalizeTask } from '../lib/taskNormalize';
import {
  CARD_TYPES,
  getTaskCardPresentation,
  normalizeCardType,
} from '../entities/task/model/taskCardPresentation';

export const useDesktopTaskActions = ({
  activeWorkspace,
  areTaskIdSelectionsEqual,
  cleanupDesktopGroupMetadata,
  defaultWorkspaceId,
  openUploadedFileTask,
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
  t,
  user,
  workspaceNameDraft,
}) => {
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
  }, [setTasks, cleanupDesktopGroupMetadata, setSelectedTaskIds]);

  const confirmCanvasDeletion = useCallback(() => {
    if (!pendingCanvasDeletion?.taskIds?.length) {
      setPendingCanvasDeletion(null);
      return;
    }
    deleteTasksByIds(pendingCanvasDeletion.taskIds);
    setPendingCanvasDeletion(null);
  }, [deleteTasksByIds, pendingCanvasDeletion, setPendingCanvasDeletion]);

  const cancelCanvasDeletion = useCallback(() => {
    setPendingCanvasDeletion(null);
  }, [setPendingCanvasDeletion]);

  const updateCanvasSelection = useCallback((taskIds, event, openAction) => {
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

    if (normalizedTaskIds.length === 1) {
      openAction?.();
    }
  }, [areTaskIdSelectionsEqual, selectedTaskIdsRef, setSelectedTaskIds]);

  const handleTaskClick = useCallback((task, event) => {
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

    };

    if (!event) {
      openTaskFromCanvas();
      return;
    }

    updateCanvasSelection([task.id], event, openTaskFromCanvas);
  }, [suppressAllTaskClicksUntilRef, suppressTaskClickRef, t, user, openUploadedFileTask, setFullscreenImage, updateCanvasSelection]);

  const handleStartWorkspaceRename = () => {
    setWorkspaceNameDraft(activeWorkspace?.name || 'Untitled');
    setIsWorkspaceNameEditing(true);
  };

  const handleCommitWorkspaceRename = () => {
    const nextName = workspaceNameDraft.trim() || 'Untitled';
    setActiveWorkspace((current) => ({ ...current, id: defaultWorkspaceId, name: nextName }));
    setIsWorkspaceNameEditing(false);
  };

  const handleCancelWorkspaceRename = () => {
    setWorkspaceNameDraft(activeWorkspace?.name || 'Untitled');
    setIsWorkspaceNameEditing(false);
  };

  

  return {
    deleteTasksByIds,
    confirmCanvasDeletion,
    cancelCanvasDeletion,
    handleTaskClick,
    handleStartWorkspaceRename,
    handleCommitWorkspaceRename,
    handleCancelWorkspaceRename,
    updateCanvasSelection,
  };
};
