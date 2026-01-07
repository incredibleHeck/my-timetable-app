import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { Profile, ProfileManifest } from '../types/profile';
import { AppData } from '../types';
import * as ProfileStorage from '../services/profile/profileStorage';
import * as Migration from '../services/profile/migration';
import { generateId, deepClone } from '../utils/utils';
import { DEFAULT_DATA } from '../utils/constants';

interface ProfileContextType {
  profiles: ProfileManifest['profiles'];
  activeProfile: Profile | null;
  isLoading: boolean;
  isSaving: boolean;
  createNewProfile: (name: string, templateData?: AppData) => Promise<void>;
  switchProfile: (id: string) => Promise<void>;
  updateActiveProfile: (data: AppData) => void;
  reloadProfiles: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const [profiles, setProfiles] = useState<ProfileManifest['profiles']>([]);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reloadProfiles = async () => {
    const list = await ProfileStorage.listProfiles();
    setProfiles(list);
  };

  const loadActiveProfile = async (id: string) => {
    setIsLoading(true);
    const profile = await ProfileStorage.loadProfile(id);
    if (profile) {
      setActiveProfile(profile);
      await ProfileStorage.setActiveProfile(id);
    }
    setIsLoading(false);
  };

  const init = async () => {
    setIsLoading(true);
    try {
      // 1. Migrate if needed
      await Migration.migrateFromLocalStorage();
      
      // 2. Init Storage (ensure manifest)
      await ProfileStorage.init();

      // 3. Load Manifest
      const list = await ProfileStorage.listProfiles();
      setProfiles(list);

      // 4. Load Active
      const activeId = await ProfileStorage.getActiveProfileId();
      if (activeId) {
        await loadActiveProfile(activeId);
      } else if (list.length > 0) {
        // Fallback to first
        await loadActiveProfile(list[0].id);
      } else {
        setIsLoading(false);
      }
    } catch (e) {
      console.error("Profile Init Failed", e);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    init();
  }, []);

  const createNewProfile = async (name: string, templateData?: AppData) => {
    const newProfile: Profile = {
      id: generateId(),
      name,
      created: Date.now(),
      lastModified: Date.now(),
      data: templateData ? deepClone(templateData) : deepClone(DEFAULT_DATA),
      meta: {}
    };

    await ProfileStorage.saveProfile(newProfile);
    await reloadProfiles();
    await switchProfile(newProfile.id);
  };

  const switchProfile = async (id: string) => {
    // Cancel pending saves
    if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        // Force immediate save of current? 
        // For simplicity, we assume debounce is short enough or we accept loss of last <1s chars.
        // Ideally we should flush save here.
        if (activeProfile) {
            await ProfileStorage.saveProfile(activeProfile);
        }
    }
    await loadActiveProfile(id);
  };

  const updateActiveProfile = (data: AppData) => {
    if (!activeProfile) return;

    const updated = { 
        ...activeProfile, 
        data, 
        lastModified: Date.now() 
    };
    setActiveProfile(updated);
    setIsSaving(true);

    // Debounce Save
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      await ProfileStorage.saveProfile(updated);
      setIsSaving(false);
    }, 1000);
  };

  return (
    <ProfileContext.Provider value={{
      profiles,
      activeProfile,
      isLoading,
      isSaving,
      createNewProfile,
      switchProfile,
      updateActiveProfile,
      reloadProfiles
    }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};
