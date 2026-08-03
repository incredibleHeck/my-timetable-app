import { Profile } from "../../types/profile";

/**
 * Minimal promise-based IndexedDB wrapper backing web-mode profile storage.
 * Replaces the old localStorage backend (which was capped at ~5 MB) so multiple
 * large profiles can be stored. Two stores:
 *   - "profiles": full Profile objects, keyed by id (the manifest is derived).
 *   - "meta": small key/value pairs (e.g. the active profile id).
 */

const DB_NAME = "eduscheduler";
const DB_VERSION = 1;
const PROFILE_STORE = "profiles";
const META_STORE = "meta";

let dbPromise: Promise<IDBDatabase> | null = null;

const openDb = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROFILE_STORE)) {
        db.createObjectStore(PROFILE_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
};

/** Run a single-store transaction and resolve with the request result. */
const run = async <T>(
  store: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest,
): Promise<T> => {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(store, mode);
    const request = action(transaction.objectStore(store));
    let result: T;
    request.onsuccess = () => {
      result = request.result as T;
    };
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
};

/** Ensure the database (and its stores) exist. */
export const ensureDb = async (): Promise<void> => {
  await openDb();
};

export const putProfile = (profile: Profile): Promise<void> =>
  run(PROFILE_STORE, "readwrite", (s) => s.put(profile)).then(() => undefined);

export const getProfile = (id: string): Promise<Profile | undefined> =>
  run<Profile | undefined>(PROFILE_STORE, "readonly", (s) => s.get(id));

export const getAllProfiles = (): Promise<Profile[]> =>
  run<Profile[]>(PROFILE_STORE, "readonly", (s) => s.getAll());

export const removeProfile = (id: string): Promise<void> =>
  run(PROFILE_STORE, "readwrite", (s) => s.delete(id)).then(() => undefined);

export const getMeta = <T>(key: string): Promise<T | undefined> =>
  run<T | undefined>(META_STORE, "readonly", (s) => s.get(key));

export const setMeta = (key: string, value: unknown): Promise<void> =>
  run(META_STORE, "readwrite", (s) => s.put(value, key)).then(() => undefined);

/** Test helper: drop the cached connection so a fresh open re-runs. */
export const __resetDbForTests = (): void => {
  dbPromise = null;
};
