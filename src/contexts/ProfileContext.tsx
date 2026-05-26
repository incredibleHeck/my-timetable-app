import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  ReactNode,
} from "react";
import { Profile, ProfileManifest } from "../types/profile";
import { AppData, Activity, ActivityType } from "../types";
import * as ProfileStorage from "../services/profile/profileStorage";
import * as Migration from "../services/profile/migration";
import { generateId, deepClone, mergeWithDefaults } from "../utils/utils";
import { DEFAULT_DATA } from "../utils/constants";
import { calculateClassSchedule } from "../utils/timeUtils";
import { TimeSlot } from "../types";
import { auditFinalSchedule } from "../features/generator/scheduler/validation";
import { syncHomeRooms } from "../features/classes/utils";

interface ProfileContextType {
  profiles: ProfileManifest["profiles"];
  activeProfile: Profile | null;
  isLoading: boolean;
  isSaving: boolean;
  isDirty: boolean;
  createNewProfile: (name: string, templateData?: AppData) => Promise<void>;
  switchProfile: (id: string) => Promise<void>;
  updateActiveProfile: (data: AppData) => void;
  addActivity: (
    type: ActivityType,
    message: string,
    dataToUpdate?: AppData,
  ) => void;
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
  const [profiles, setProfiles] = useState<ProfileManifest["profiles"]>([]);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

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
      // Ensure defaults for new schema fields
      profile.data = mergeWithDefaults(profile.data, DEFAULT_DATA);

      // Auto-assign/sync unique home rooms on load
      const { updatedClasses, updatedRooms } = syncHomeRooms(
        profile.data.classes,
        profile.data.rooms,
      );
      profile.data.classes = updatedClasses;
      profile.data.rooms = updatedRooms;

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
      meta: {},
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

    setPast((prevPast) => {
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

    // Ensure all classes have a unique system-generated Home Room
    const { updatedClasses, updatedRooms } = syncHomeRooms(
      data.classes,
      data.rooms,
    );
    data.classes = updatedClasses;
    data.rooms = updatedRooms;

    // Audit: generated timetables only need real failures (gaps + double-bookings).
    // Full audit runs after manual edits.
    const isFreshGeneration =
      !!data.lastGenerated &&
      data.lastGenerated !== activeProfile.data.lastGenerated;

    // GHOST-CONFLICT GUARD
    // 1. Build a "scrubbed" snapshot with an EMPTY conflicts array BEFORE auditing
    //    so any pre-existing or intermediate conflicts cannot leak into the audit
    //    input or accidentally survive a later spread.
    const auditInput: AppData = { ...data, conflicts: [] };

    // 2. Audit runs against a 1:1 snapshot of the final settled grid.
    const conflicts = auditFinalSchedule(auditInput, {
      mode: isFreshGeneration ? "generated" : "full",
    });

    // 3. OVERWRITE-ONLY: never spread/merge prior conflicts. The order below
    //    matters - `conflicts` MUST appear after `...auditInput` so it wins.
    //    Do NOT change to `[...prev, ...newAuditedConflicts]`.
    const validatedData: AppData = { ...auditInput, conflicts };

    const updated = {
      ...activeProfile,
      data: validatedData,
      lastModified: Date.now(),
    };
    setActiveProfile(updated);
    triggerSave(updated);
  };

  const updateActiveProfile = (data: AppData) => {
    if (!activeProfile) return;
    applyState(data);
  };

  const addActivity = (
    type: ActivityType,
    message: string,
    dataToUpdate?: AppData,
  ) => {
    if (!activeProfile) return;

    const newActivity: Activity = {
      id: generateId(),
      type,
      message,
      timestamp: new Date().toISOString(),
    };

    const currentData = dataToUpdate || activeProfile.data;

    const updatedData = {
      ...currentData,
      recentActivity: [
        newActivity,
        ...(currentData.recentActivity || []),
      ].slice(0, 50),
    };

    updateActiveProfile(updatedData);
  };

  const triggerSave = (updatedProfile: Profile) => {
    setIsDirty(true);
    setIsSaving(true);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      await ProfileStorage.saveProfile(updatedProfile);
      setIsSaving(false);
      setIsDirty(false);
    }, 1000);
  };

  const getClassSchedule = (classId: string): TimeSlot[] => {
    if (!activeProfile) return [];

    const classGroup = activeProfile.data.classes.find((c) => c.id === classId);
    if (!classGroup) return [];

    return calculateClassSchedule(
      classGroup,
      activeProfile.data.settings,
      activeProfile.data.settings.dayStructure,
    );
  };

  return (
    <ProfileContext.Provider
      value={{
        profiles,
        activeProfile,
        isLoading,
        isSaving,
        isDirty,
        createNewProfile,
        switchProfile,
        updateActiveProfile,
        addActivity,
        reloadProfiles,
        undo,
        redo,
        pushToHistory,
        canUndo: past.length > 0,
        canRedo: future.length > 0,
        getClassSchedule,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return context;
};
