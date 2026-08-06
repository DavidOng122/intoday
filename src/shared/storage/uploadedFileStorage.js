const DB_NAME = 'intoday-uploaded-files';
const DB_VERSION = 1;
const STORE_NAME = 'files';

let dbPromise = null;

const openDb = () => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'storageKey' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open uploaded file store'));
  });

  return dbPromise;
};

const runStoreRequest = async (mode, executor) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = executor(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
};

export const saveUploadedFileBlob = async ({ storageKey, blob, metadata = {} }) => (
  runStoreRequest('readwrite', (store) => store.put({
    storageKey,
    blob,
    ...metadata,
  }))
);

export const getUploadedFileRecord = async (storageKey) => (
  runStoreRequest('readonly', (store) => store.get(storageKey))
);

export const deleteUploadedFileBlob = async (storageKey) => (
  runStoreRequest('readwrite', (store) => store.delete(storageKey))
);
