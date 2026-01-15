import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { Profile, ProfileManifest } from '../types/profile';
import { AppData } from '../types';
import * as ProfileStorage from '../services/profile/profileStorage';
import * as Migration from '../services/profile/migration';
import { generateId, deepClone } from '../utils/utils';
import { DEFAULT_DATA } from '../utils/constants';
import { calculateClassSchedule } from '../utils/timeUtils';
import { TimeSlot } from '../types';

interface ProfileContextType {
  profiles: ProfileManifest['profiles'];
  activeProfile: Profile | null;
  isLoading: boolean;
  isSaving: boolean;
  createNewProfile: (name: string, templateData?: AppData) => Promise<void>;
  switchProfile: (id: string) => Promise<void>;
  updateActiveProfile: (data: AppData) => void;
  reloadProfiles: () => Promise<void>;
  undo: () => void;
  redo: () => void;
  pushToHistory: (data: AppData) => void;
  canUndo: boolean;
  canRedo: boolean;
  getClassSchedule: (classId: string) => TimeSlot[];
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

const MAX_HISTORY = 50;

export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const [profiles, setProfiles] = useState<ProfileManifest['profiles']>([]);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // History State
  const [past, setPast] = useState<AppData[]>([]);
  const [future, setFuture] = useState<AppData[]>([]);

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
      // Reset history on profile switch
      setPast([]);
      setFuture([]);
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
        if (activeProfile) {
            await ProfileStorage.saveProfile(activeProfile);
        }
    }
    await loadActiveProfile(id);
  };

  const undo = () => {
    if (past.length === 0 || !activeProfile) return;

    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    
    setPast(newPast);
    setFuture([activeProfile.data, ...future]);
    
    // Apply state without pushing to history again
    applyState(previous);
  };

  const redo = () => {
    if (future.length === 0 || !activeProfile) return;

    const next = future[0];
    const newFuture = future.slice(1);
    
    setPast([...past, activeProfile.data]);
    setFuture(newFuture);
    
    // Apply state without pushing to history again
    applyState(next);
  };

  const pushToHistory = (data: AppData) => {
    if (!activeProfile) return;
    
    setPast(prevPast => {
      const newPast = [...prevPast, activeProfile.data];
      if (newPast.length > MAX_HISTORY) {
        return newPast.slice(newPast.length - MAX_HISTORY);
      }
      return newPast;
    });
    setFuture([]);
  };

  const applyState = (data: AppData) => {
    if (!activeProfile) return;

    const updated = { 
        ...activeProfile, 
        data, 
        lastModified: Date.now() 
    };
    setActiveProfile(updated);
    triggerSave(updated);
  };

  const updateActiveProfile = (data: AppData) => {
    if (!activeProfile) return;
    applyState(data);
  };

  const triggerSave = (updatedProfile: Profile) => {
    setIsSaving(true);
    // Debounce Save
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      await ProfileStorage.saveProfile(updatedProfile);
      setIsSaving(false);
    }, 1000);
  };

  const getClassSchedule = (classId: string): TimeSlot[] => {
    if (!activeProfile) return [];
    
    const classGroup = activeProfile.data.classes.find(c => c.id === classId);
    if (!classGroup) return [];

    return calculateClassSchedule(
      classGroup,
      activeProfile.data.settings,
      activeProfile.data.settings.dayStructure
    );
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
      reloadProfiles,
      undo,
      redo,
      pushToHistory,
      canUndo: past.length > 0,
      canRedo: future.length > 0,
      getClassSchedule
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
