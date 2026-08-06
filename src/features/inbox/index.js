// Public API for the inbox feature.
// External consumers must import from this file rather than its internal folders.

export { default as InboxPanel } from './components/InboxPanel';
export { useInboxPanel } from './hooks/useInboxPanel';

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
