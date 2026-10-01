import { useCallback } from 'react';
import { createUpdatedTimestamp } from '../../pack/model/packMetadata';
import {
  moveInboxItemToPack,
  placeInboxItem,
} from '../model/inboxLogic.js';

export const useInboxPlacement = ({
  commitTodos,
  inboxTargetPacks,
  onStatus,
}) => {
  const commitInboxPlacement = useCallback(async ({ itemId, packId = null, position = null }) => {
    try {
      await commitTodos((currentTasks) => (
        packId
          ? moveInboxItemToPack(currentTasks, itemId, packId, createUpdatedTimestamp())
          : placeInboxItem(currentTasks, itemId, position, createUpdatedTimestamp())
      ));
      const targetPack = packId ? inboxTargetPacks.find((pack) => pack.id === packId) : null;
      onStatus(packId ? `Moved to ${targetPack?.name || 'Pack'}` : 'Placed on canvas');
    } catch (error) {
      console.error('Failed to place Inbox item:', error);
      onStatus('Move failed. Item remains in Inbox.');
      throw error;
    }
  }, [commitTodos, inboxTargetPacks, onStatus]);

  const handleMoveInboxItemToPack = useCallback((itemId, packId) => (
    commitInboxPlacement({ itemId, packId })
  ), [commitInboxPlacement]);

  return {
    commitInboxPlacement,
    handleMoveInboxItemToPack,
  };
};
