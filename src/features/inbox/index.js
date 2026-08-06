// Public API for the inbox feature.
// All external consumers must import from this file only —
// never import directly from inbox/model/ or inbox/components/.

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
  createInboxTask,
  placeInboxItem,
  moveInboxItemToPack,
  removeItemFromPack,
} from './model/inboxLogic.js';
