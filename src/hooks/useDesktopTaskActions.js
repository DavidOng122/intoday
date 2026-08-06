import { useCallback, useEffect } from 'react';
import { trackUserEvent } from '../lib/analytics';
import { createUpdatedTimestamp } from '../features/pack';
import { normalizeTask } from '../lib/taskNormalize';
import {
  CARD_TYPES,
  getDerivedTaskFields,
  getTaskCardPresentation,
  normalizeCardType,
} from '../taskCardUtils';

export const useDesktopTaskActions = ({
  activeWorkspace,
  applyAsyncMetadata,
  areTaskIdSelectionsEqual,
  cleanupDesktopGroupMetadata,
  defaultWorkspaceId,
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
}) => {
  const editingTask = editingTaskId ? tasks.find((task) => task.id === editingTaskId) || null : null;
  const canSaveEdit = editText.trim().length > 0;
  
  const handleTaskEdit = useCallback((task) => {
    setEditingTaskId(task.id);
    setEditText(task.text);
  }, [setEditingTaskId, setEditText]);

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
  }, [deleteTasksByIds, pendingCanvasDeletion, setPendingCanvasDeletion]);

  const cancelCanvasDeletion = useCallback(() => {
    setPendingCanvasDeletion(null);
  }, [setPendingCanvasDeletion]);

  const closeEditModal = useCallback(() => {
    setEditingTaskId(null);
    setEditText('');
    setEditCopied(false);
    if (editCopyResetTimerRef.current !== null) {
      window.clearTimeout(editCopyResetTimerRef.current);
      editCopyResetTimerRef.current = null;
    }
  }, [setEditingTaskId, setEditText, setEditCopied, editCopyResetTimerRef]);

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
    } catch {
      // Ignore clipboard failures so editing is unaffected.
    }
  }, [editText, setEditCopied, editCopyResetTimerRef]);

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

  const openTaskEditor = useCallback((task) => {
    setProfileOpen(false);
    setPanelOpen(false);
    setEditingTaskId(task.id);
    setEditText(task.text || '');
  }, [setProfileOpen, setPanelOpen, setEditingTaskId, setEditText]);

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

      openTaskEditor(task);
    };

    if (!event) {
      openTaskFromCanvas();
      return;
    }

    updateCanvasSelection([task.id], event, openTaskFromCanvas);
  }, [suppressAllTaskClicksUntilRef, suppressTaskClickRef, t, user, openUploadedFileTask, setFullscreenImage, openTaskEditor, updateCanvasSelection]);

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
  };
};
