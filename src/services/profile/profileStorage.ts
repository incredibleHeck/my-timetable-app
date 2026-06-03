import * as NativeAdapter from "../fileSystem/nativeAdapter";
import { Profile, ProfileManifest } from "../../types/profile";
import { parseProfile } from "../../schemas/profile";
import { isTauriEnv, getTauriPath } from "../../utils/platform";

const MANIFEST_FILE = "manifest.json";
const WEB_MANIFEST_KEY = "profile_manifest";
const WEB_PROFILE_PREFIX = "profile_data_";

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
      // Web Init
      if (!localStorage.getItem(WEB_MANIFEST_KEY)) {
        const initialManifest: ProfileManifest = {
          profiles: [],
          activeProfileId: null,
        };
        localStorage.setItem(WEB_MANIFEST_KEY, JSON.stringify(initialManifest));
      }
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
      const content = localStorage.getItem(WEB_MANIFEST_KEY);
      if (!content) return [];
      const manifest: ProfileManifest = JSON.parse(content);
      return manifest.profiles;
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
      // Web Save
      localStorage.setItem(`${WEB_PROFILE_PREFIX}${profile.id}`, JSON.stringify(profile));

      const content = localStorage.getItem(WEB_MANIFEST_KEY);
      const manifest: ProfileManifest = content
        ? JSON.parse(content)
        : { profiles: [], activeProfileId: null };

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

      localStorage.setItem(WEB_MANIFEST_KEY, JSON.stringify(manifest));
    }
  } catch (error: any) {
    console.error(`Failed to save profile ${profile.id}:`, error);
    if (
      error &&
      (error.name === "QuotaExceededError" ||
        error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
        error.code === 22 ||
        error.code === 1014)
    ) {
      throw new Error("QuotaExceededError: Local storage quota exceeded. Please export your profiles/data to free up space.");
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
      const content = localStorage.getItem(`${WEB_PROFILE_PREFIX}${id}`);
      return content ? parseProfile(JSON.parse(content)) : null;
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
      localStorage.removeItem(`${WEB_PROFILE_PREFIX}${id}`);

      const content = localStorage.getItem(WEB_MANIFEST_KEY);
      if (content) {
        const manifest: ProfileManifest = JSON.parse(content);
        manifest.profiles = manifest.profiles.filter((p) => p.id !== id);
        if (manifest.activeProfileId === id) {
          manifest.activeProfileId = manifest.profiles.length > 0 ? manifest.profiles[0].id : null;
        }
        localStorage.setItem(WEB_MANIFEST_KEY, JSON.stringify(manifest));
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
      const content = localStorage.getItem(WEB_MANIFEST_KEY);
      if (content) {
        const manifest: ProfileManifest = JSON.parse(content);
        manifest.activeProfileId = id;
        localStorage.setItem(WEB_MANIFEST_KEY, JSON.stringify(manifest));
      }
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
      const content = localStorage.getItem(WEB_MANIFEST_KEY);
      if (!content) return null;
      const manifest: ProfileManifest = JSON.parse(content);
      return manifest.activeProfileId;
    }
  } catch (error) {
    return null;
  }
};
