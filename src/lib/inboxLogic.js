// Re-export barrel — kept for backward compatibility during migration.
// New code must import from 'features/inbox' instead.
export {
  isInboxItem,
  isLibraryItem,
  getInboxItems,
  getLibraryItems,
  getInboxCount,
  createInboxTask,
  placeInboxItem,
  moveInboxItemToPack,
  removeItemFromPack,
} from '../features/inbox/model/inboxLogic.js';
