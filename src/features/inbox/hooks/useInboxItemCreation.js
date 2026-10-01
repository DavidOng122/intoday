import { useCallback } from 'react';
import {
  CARD_TYPES,
  getDerivedTaskFields,
} from '../../../entities/task/model/taskCardPresentation';
import { normalizeTask } from '../../../lib/taskNormalize';
import { createUpdatedTimestamp } from '../../pack/model/packMetadata';
import { createInboxTask } from '../model/inboxLogic.js';

export const useInboxItemCreation = ({
  activeWorkspaceId,
  selectedDateKey,
  commitTodos,
  applyAsyncMetadata,
  onStatus,
}) => {
  const handleCreateInboxItem = useCallback(async (value) => {
    const isTextDraft = value && typeof value === 'object';
    const rawText = String(isTextDraft ? value.text : value || '').trim();
    const explicitTitle = isTextDraft ? String(value.title || '').trim() : '';
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
          ...(isTextDraft ? { cardType: CARD_TYPES.TEXT, primaryUrl: null, redirectUrl: null } : {}),
          ...(explicitTitle ? { title: explicitTitle } : {}),
          desktopZ: Date.now(),
        }));

        return [...currentTasks, createdTask];
      });

      onStatus('Added to Inbox');
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
      onStatus('Unable to add item. Please try again.');
      throw error;
    }
  }, [
    activeWorkspaceId,
    applyAsyncMetadata,
    commitTodos,
    onStatus,
    selectedDateKey,
  ]);

  return {
    handleCreateInboxItem,
  };
};
