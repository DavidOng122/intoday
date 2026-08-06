export const COLLECTION_STATES = Object.freeze({
  INBOX: 'inbox',
  LIBRARY: 'library',
});

export const normalizeCollectionState = (value) => (
  value === COLLECTION_STATES.INBOX ? COLLECTION_STATES.INBOX : COLLECTION_STATES.LIBRARY
);
