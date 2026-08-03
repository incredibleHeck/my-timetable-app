import * as NativeAdapter from "../fileSystem/nativeAdapter";
import * as WebDb from "./webDb";
import { Profile, ProfileManifest } from "../../types/profile";
import { parseProfile } from "../../schemas/profile";
import { isTauriEnv, getTauriPath } from "../../utils/platform";

const MANIFEST_FILE = "manifest.json";
const WEB_MANIFEST_KEY = "profile_manifest";
const WEB_PROFILE_PREFIX = "profile_data_";
const WEB_PENDING_FLUSH_KEY = "pending_flush";
const WEB_ACTIVE_META = "activeProfileId";
const WEB_MIGRATED_META = "lsMigrated";

/** One-time migration of the old localStorage backend into IndexedDB. */
const migrateLocalStorageToIdb = async (): Promise<void> => {
  if (typeof localStorage === "undefined") return;
  if (await WebDb.getMeta<boolean>(WEB_MIGRATED_META)) return;

  try {
    const raw = localStorage.getItem(WEB_MANIFEST_KEY);
    if (raw) {
      const manifest = JSON.parse(raw) as ProfileManifest;
      for (const entry of manifest.profiles) {
        const profileRaw = localStorage.getItem(`${WEB_PROFILE_PREFIX}${entry.id}`);
        if (!profileRaw) continue;
        try {
          await WebDb.putProfile(parseProfile(JSON.parse(profileRaw)));
        } catch (err) {
          console.error(`Skipped migrating profile ${entry.id}:`, err);
        }
      }

      if (!(await WebDb.getMeta(WEB_ACTIVE_META))) {
        await WebDb.setMeta(WEB_ACTIVE_META, manifest.activeProfileId ?? null);
      }

      // Free the localStorage space now that data lives in IndexedDB.
      for (const entry of manifest.profiles) {
        localStorage.removeItem(`${WEB_PROFILE_PREFIX}${entry.id}`);
      }
      localStorage.removeItem(WEB_MANIFEST_KEY);
    }
    await WebDb.setMeta(WEB_MIGRATED_META, true);
  } catch (err) {
    console.error("localStorage -> IndexedDB migration failed:", err);
  }
};

/** Apply an emergency snapshot written synchronously on tab close. */
const reconcilePendingFlush = async (): Promise<void> => {
  if (typeof localStorage === "undefined") return;
  const raw = localStorage.getItem(WEB_PENDING_FLUSH_KEY);
  if (!raw) return;
  try {
    await WebDb.putProfile(parseProfile(JSON.parse(raw)));
  } catch (err) {
    console.error("Failed to reconcile pending profile flush:", err);
  } finally {
    localStorage.removeItem(WEB_PENDING_FLUSH_KEY);
  }
};

/**
 * Best-effort synchronous save used from the tab-close handler, where async
 * IndexedDB writes cannot be guaranteed to finish. The snapshot is applied to
 * IndexedDB on the next init via {@link reconcilePendingFlush}.
 */
export const flushProfileEmergency = (profile: Profile): void => {
  if (isTauriEnv() || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(WEB_PENDING_FLUSH_KEY, JSON.stringify(profile));
  } catch (err) {
    console.error("Emergency profile flush failed:", err);
  }
};

const getManifestPath = async () => {
  const pathApi = await getTauriPath();
  if (!pathApi) return MANIFEST_FILE;
  const base = await pathApi.appDataDir();
  return await pathApi.join(base, MANIFEST_FILE);
};

const getProfilePath = async (id: string) => {
  const pathApi = await getTauriPath();
  if (!pathApi) return `profile_${id}.json`;
  const base = await pathApi.appDataDir();
  return await pathApi.join(base, `profile_${id}.json`);
};

export const init = async (): Promise<void> => {
  try {
    if (isTauriEnv()) {
      const path = await getManifestPath();
      const exists = await NativeAdapter.fileExists(path);
      if (!exists) {
        const initialManifest: ProfileManifest = {
          profiles: [],
          activeProfileId: null,
        };
        await NativeAdapter.writeFile(path, JSON.stringify(initialManifest));
      }
    } else {
      // Web Init (IndexedDB)
      await WebDb.ensureDb();
      await migrateLocalStorageToIdb();
      await reconcilePendingFlush();
    }
  } catch (error) {
    console.error("Failed to init profile storage:", error);
    throw error;
  }
};

export const listProfiles = async (): Promise<ProfileManifest["profiles"]> => {
  try {
    if (isTauriEnv()) {
      const path = await getManifestPath();
      const content = await NativeAdapter.readFile(path);
      const manifest: ProfileManifest = JSON.parse(content);
      return manifest.profiles;
    } else {
      const profiles = await WebDb.getAllProfiles();
      return profiles.map((p) => ({ id: p.id, name: p.name, lastModified: p.lastModified }));
    }
  } catch (error) {
    console.error("Failed to list profiles:", error);
    return [];
  }
};

export const saveProfile = async (profile: Profile): Promise<void> => {
  try {
    if (isTauriEnv()) {
      // 1. Write Profile File
      const profilePath = await getProfilePath(profile.id);
      await NativeAdapter.writeFile(profilePath, JSON.stringify(profile));

      // 2. Update Manifest
      const manifestPath = await getManifestPath();
      const content = await NativeAdapter.readFile(manifestPath);
      const manifest: ProfileManifest = JSON.parse(content);

      const existingIndex = manifest.profiles.findIndex((p) => p.id === profile.id);
      const entry = {
        id: profile.id,
        name: profile.name,
        lastModified: profile.lastModified,
      };

      if (existingIndex >= 0) {
        manifest.profiles[existingIndex] = entry;
      } else {
        manifest.profiles.push(entry);
      }

      if (!manifest.activeProfileId) {
        manifest.activeProfileId = profile.id;
      }

      await NativeAdapter.writeFile(manifestPath, JSON.stringify(manifest));
    } else {
      // Web Save (IndexedDB) — manifest is derived from the profiles store.
      await WebDb.putProfile(profile);
      if (!(await WebDb.getMeta<string | null>(WEB_ACTIVE_META))) {
        await WebDb.setMeta(WEB_ACTIVE_META, profile.id);
      }
    }
  } catch (error) {
    console.error(`Failed to save profile ${profile.id}:`, error);
    if (error && typeof error === "object") {
      const err = error as { name?: string; code?: number };
      if (
        err.name === "QuotaExceededError" ||
        err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
        err.code === 22 ||
        err.code === 1014
      ) {
        throw new Error(
          "QuotaExceededError: Local storage quota exceeded. Please export your profiles/data to free up space.",
          { cause: error },
        );
      }
    }
    throw error;
  }
};

export const loadProfile = async (id: string): Promise<Profile | null> => {
  try {
    if (isTauriEnv()) {
      const path = await getProfilePath(id);
      const content = await NativeAdapter.readFile(path);
      return parseProfile(JSON.parse(content));
    } else {
      const profile = await WebDb.getProfile(id);
      return profile ? parseProfile(profile) : null;
    }
  } catch (error) {
    console.error(`Failed to load profile ${id}:`, error);
    return null;
  }
};

export const deleteProfile = async (id: string): Promise<void> => {
  try {
    if (isTauriEnv()) {
      const path = await getProfilePath(id);
      await NativeAdapter.removeFile(path);

      const manifestPath = await getManifestPath();
      const content = await NativeAdapter.readFile(manifestPath);
      const manifest: ProfileManifest = JSON.parse(content);

      manifest.profiles = manifest.profiles.filter((p) => p.id !== id);
      if (manifest.activeProfileId === id) {
        manifest.activeProfileId = manifest.profiles.length > 0 ? manifest.profiles[0].id : null;
      }

      await NativeAdapter.writeFile(manifestPath, JSON.stringify(manifest));
    } else {
      await WebDb.removeProfile(id);
      if ((await WebDb.getMeta<string | null>(WEB_ACTIVE_META)) === id) {
        const remaining = await WebDb.getAllProfiles();
        await WebDb.setMeta(WEB_ACTIVE_META, remaining.length > 0 ? remaining[0].id : null);
      }
    }
  } catch (error) {
    console.error(`Failed to delete profile ${id}:`, error);
    throw error;
  }
};

export const setActiveProfile = async (id: string): Promise<void> => {
  try {
    if (isTauriEnv()) {
      const manifestPath = await getManifestPath();
      const content = await NativeAdapter.readFile(manifestPath);
      const manifest: ProfileManifest = JSON.parse(content);
      manifest.activeProfileId = id;
      await NativeAdapter.writeFile(manifestPath, JSON.stringify(manifest));
    } else {
      await WebDb.setMeta(WEB_ACTIVE_META, id);
    }
  } catch (error) {
    console.error(`Failed to set active profile ${id}:`, error);
    throw error;
  }
};

export const getActiveProfileId = async (): Promise<string | null> => {
  try {
    if (isTauriEnv()) {
      const manifestPath = await getManifestPath();
      const content = await NativeAdapter.readFile(manifestPath);
      const manifest: ProfileManifest = JSON.parse(content);
      return manifest.activeProfileId;
    } else {
      return (await WebDb.getMeta<string | null>(WEB_ACTIVE_META)) ?? null;
    }
  } catch {
    return null;
  }
};
