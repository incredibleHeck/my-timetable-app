import { appDataDir, join } from '@tauri-apps/api/path';
import * as NativeAdapter from '../fileSystem/nativeAdapter';
import { Profile, ProfileManifest } from '../../types/profile';

const MANIFEST_FILE = 'manifest.json';

const getManifestPath = async () => {
  const base = await appDataDir();
  return await join(base, MANIFEST_FILE);
};

const getProfilePath = async (id: string) => {
  const base = await appDataDir();
  return await join(base, `profile_${id}.json`);
};

export const init = async (): Promise<void> => {
  try {
    const path = await getManifestPath();
    const exists = await NativeAdapter.fileExists(path);
    if (!exists) {
      const initialManifest: ProfileManifest = {
        profiles: [],
        activeProfileId: null
      };
      await NativeAdapter.writeFile(path, JSON.stringify(initialManifest));
    }
  } catch (error) {
    console.error('Failed to init profile storage:', error);
    throw error;
  }
};

export const listProfiles = async (): Promise<ProfileManifest['profiles']> => {
  try {
    const path = await getManifestPath();
    const content = await NativeAdapter.readFile(path);
    const manifest: ProfileManifest = JSON.parse(content);
    return manifest.profiles;
  } catch (error) {
    console.error('Failed to list profiles:', error);
    return [];
  }
};

export const saveProfile = async (profile: Profile): Promise<void> => {
  try {
    // 1. Write Profile File
    const profilePath = await getProfilePath(profile.id);
    await NativeAdapter.writeFile(profilePath, JSON.stringify(profile));

    // 2. Update Manifest
    const manifestPath = await getManifestPath();
    const content = await NativeAdapter.readFile(manifestPath);
    const manifest: ProfileManifest = JSON.parse(content);

    const existingIndex = manifest.profiles.findIndex(p => p.id === profile.id);
    const entry = {
      id: profile.id,
      name: profile.name,
      lastModified: profile.lastModified
    };

    if (existingIndex >= 0) {
      manifest.profiles[existingIndex] = entry;
    } else {
      manifest.profiles.push(entry);
    }
    
    // Auto-set active if first
    if (!manifest.activeProfileId) {
        manifest.activeProfileId = profile.id;
    }

    await NativeAdapter.writeFile(manifestPath, JSON.stringify(manifest));
  } catch (error) {
    console.error(`Failed to save profile ${profile.id}:`, error);
    throw error;
  }
};

export const loadProfile = async (id: string): Promise<Profile | null> => {
  try {
    const path = await getProfilePath(id);
    const content = await NativeAdapter.readFile(path);
    return JSON.parse(content) as Profile;
  } catch (error) {
    console.error(`Failed to load profile ${id}:`, error);
    return null;
  }
};

export const deleteProfile = async (id: string): Promise<void> => {
    try {
        // 1. Remove File
        const path = await getProfilePath(id);
        await NativeAdapter.removeFile(path);

        // 2. Update Manifest
        const manifestPath = await getManifestPath();
        const content = await NativeAdapter.readFile(manifestPath);
        const manifest: ProfileManifest = JSON.parse(content);

        manifest.profiles = manifest.profiles.filter(p => p.id !== id);
        if (manifest.activeProfileId === id) {
            manifest.activeProfileId = manifest.profiles.length > 0 ? manifest.profiles[0].id : null;
        }

        await NativeAdapter.writeFile(manifestPath, JSON.stringify(manifest));
    } catch (error) {
        console.error(`Failed to delete profile ${id}:`, error);
        throw error;
    }
};

export const setActiveProfile = async (id: string): Promise<void> => {
    try {
        const manifestPath = await getManifestPath();
        const content = await NativeAdapter.readFile(manifestPath);
        const manifest: ProfileManifest = JSON.parse(content);
        
        manifest.activeProfileId = id;
        
        await NativeAdapter.writeFile(manifestPath, JSON.stringify(manifest));
    } catch (error) {
         console.error(`Failed to set active profile ${id}:`, error);
         throw error;
    }
};

export const getActiveProfileId = async (): Promise<string | null> => {
     try {
        const manifestPath = await getManifestPath();
        const content = await NativeAdapter.readFile(manifestPath);
        const manifest: ProfileManifest = JSON.parse(content);
        return manifest.activeProfileId;
    } catch (error) {
         return null;
    }
};
