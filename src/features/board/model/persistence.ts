const DB_NAME = "reference-board";
const DB_VERSION = 1;
const STORE_NAME = "snapshots";
const BOARD_SNAPSHOT_KEY = "current-board";

type PersistedBoardRecord = {
  id: string;
  snapshot: string;
  updatedAt: string;
};

let openDatabasePromise: Promise<IDBDatabase | null> | null = null;

const getIndexedDb = () => {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return null;
  }

  return window.indexedDB;
};

const waitForRequest = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error("IndexedDB request failed"));
    };
  });

const waitForTransaction = (transaction: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => {
      resolve();
    };
    transaction.onerror = () => {
      reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    };
    transaction.onabort = () => {
      reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
    };
  });

const openDatabase = () => {
  const indexedDb = getIndexedDb();
  if (!indexedDb) {
    return Promise.resolve(null);
  }

  if (!openDatabasePromise) {
    openDatabasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDb.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };

      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {
          database.close();
          openDatabasePromise = null;
        };
        resolve(database);
      };

      request.onerror = () => {
        reject(request.error ?? new Error("Unable to open IndexedDB"));
      };
    }).catch((error) => {
      openDatabasePromise = null;
      throw error;
    });
  }

  return openDatabasePromise;
};

export const loadPersistedBoardSnapshot = async () => {
  const database = await openDatabase();
  if (!database) {
    return null;
  }

  const transaction = database.transaction(STORE_NAME, "readonly");
  const store = transaction.objectStore(STORE_NAME);
  const request = store.get(BOARD_SNAPSHOT_KEY);
  const record = (await waitForRequest(request)) as PersistedBoardRecord | undefined;
  await waitForTransaction(transaction);
  return typeof record?.snapshot === "string" ? record.snapshot : null;
};

export const savePersistedBoardSnapshot = async (snapshot: string) => {
  const database = await openDatabase();
  if (!database) {
    return;
  }

  const transaction = database.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  store.put({
    id: BOARD_SNAPSHOT_KEY,
    snapshot,
    updatedAt: new Date().toISOString(),
  } satisfies PersistedBoardRecord);
  await waitForTransaction(transaction);
};

export const clearPersistedBoardSnapshot = async () => {
  const database = await openDatabase();
  if (!database) {
    return;
  }

  const transaction = database.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  store.delete(BOARD_SNAPSHOT_KEY);
  await waitForTransaction(transaction);
};
