// Public API for the inbox feature.
// External consumers must import from this file rather than its internal folders.

export { default as InboxPanel } from './components/InboxPanel';
export { useInboxData } from './hooks/useInboxData';
export { useInboxItemCreation } from './hooks/useInboxItemCreation';
export { useInboxPanel } from './hooks/useInboxPanel';
export { useInboxPlacement } from './hooks/useInboxPlacement';

export {
  COLLECTION_STATES,
  normalizeCollectionState,
} from './model/collectionState.js';

export {
  isInboxItem,
  isLibraryItem,
  getInboxItems,
  getLibraryItems,
  getInboxCount,
  getInboxTargetPacks,
  createInboxTask,
  placeInboxItem,
  moveInboxItemToPack,
  removeItemFromPack,
} from './model/inboxLogic.js';
