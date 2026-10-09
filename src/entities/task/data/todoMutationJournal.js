const DB_NAME = 'intoday-task-mutation-journal';
const DB_VERSION = 1;
const STORE_NAME = 'mutations';
const USER_INDEX = 'userId';

let databasePromise;

const openDatabase = () => {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable; task changes cannot be made safely.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'operationId' });
        store.createIndex(USER_INDEX, USER_INDEX, { unique: false });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        databasePromise = null;
        database.close();
      };
      resolve(database);
    };
    request.onerror = () => {
      databasePromise = null;
      reject(request.error || new Error('Failed to open task mutation journal.'));
    };
    request.onblocked = () => {
      databasePromise = null;
      reject(new Error('Task mutation journal upgrade is blocked by another tab.'));
    };
  });
  return databasePromise;
};

export const taskMutationJournal = {
  async put(mutation) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(mutation);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Failed to persist task mutation.'));
      transaction.onabort = () => reject(transaction.error || new Error('Task mutation persistence was aborted.'));
    });
  },

  async list(userId) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).index(USER_INDEX).getAll(userId);
      let records;
      request.onsuccess = () => {
        records = request.result;
      };
      request.onerror = () => reject(request.error || new Error('Task mutation journal request failed.'));
      transaction.oncomplete = () => resolve(records.sort((left, right) => left.sequence - right.sequence));
      transaction.onerror = () => reject(transaction.error || new Error('Failed to read task mutations.'));
      transaction.onabort = () => reject(transaction.error || new Error('Task mutation journal read was aborted.'));
    });
  },

  async delete(operationId) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(operationId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Failed to remove confirmed task mutation.'));
      transaction.onabort = () => reject(transaction.error || new Error('Task mutation removal was aborted.'));
    });
  },

  async deleteMany(operationIds) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      operationIds.forEach((operationId) => store.delete(operationId));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Failed to resolve pending task mutations.'));
      transaction.onabort = () => reject(transaction.error || new Error('Task mutation resolution was aborted.'));
    });
  },

  async replace(operationIds, replacement) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      operationIds.forEach((operationId) => store.delete(operationId));
      store.put(replacement);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Failed to persist conflict resolution.'));
      transaction.onabort = () => reject(transaction.error || new Error('Conflict resolution was aborted.'));
    });
  },
};
